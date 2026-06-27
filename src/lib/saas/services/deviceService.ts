import 'server-only';
import { Client } from 'pg';
import crypto from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/server';

import { UserDeviceRepository } from '../repositories';
import { DeviceMismatchError } from '../errors';
import type { DevicePayload } from '../types';
import { logLicenseEvent } from './licenseAuditService';
import { assertActiveMembership, type MembershipDeps } from './guards';

export interface DeviceServiceDeps extends MembershipDeps {
  userDeviceRepository?: Pick<UserDeviceRepository, 'getActiveForUser' | 'create' | 'touch' | 'update'>;
  audit?: typeof logLicenseEvent;
}

function sameDevice(existing: { device_secret_hash: string | null }, payload: DevicePayload) {
  return existing.device_secret_hash !== null && existing.device_secret_hash === payload.deviceSecretHash;
}

export async function registerDevice(
  userId: string,
  orgId: string,
  devicePayload: DevicePayload,
  deps: DeviceServiceDeps = {}
) {
  await assertActiveMembership(orgId, userId, deps);

  const userDeviceRepository = deps.userDeviceRepository ?? new UserDeviceRepository();
  const audit = deps.audit ?? logLicenseEvent;

  if (process.env.DATABASE_URL) {
    const pgClient = new Client({ connectionString: process.env.DATABASE_URL });
    await pgClient.connect();
    try {
      await pgClient.query('BEGIN');
      
      // Lock the user's profile row to serialize concurrent device registrations for the same user
      await pgClient.query('SELECT id FROM public.profiles WHERE id = $1 FOR UPDATE', [userId]);

      const existingRes = await pgClient.query(
        "SELECT * FROM public.user_devices WHERE user_id = $1 AND device_secret_hash = $2 AND status = 'active' LIMIT 1",
        [userId, devicePayload.deviceSecretHash]
      );
      const existing = existingRes.rows[0];

      if (existing) {
        const deviceName = devicePayload.deviceName ?? existing.device_name;
        const browser = devicePayload.browser ?? existing.browser;
        const os = devicePayload.os ?? existing.os;
        const publicKey = devicePayload.publicKey ?? existing.public_key;
        const fingerprintHash = devicePayload.fingerprintHash ?? existing.fingerprint_hash;

        const updateRes = await pgClient.query(
          `UPDATE public.user_devices 
           SET device_name = $1, browser = $2, os = $3, public_key = $4, fingerprint_hash = $5, last_seen_at = now()
           WHERE id = $6 
           RETURNING *`,
          [deviceName, browser, os, publicKey, fingerprintHash, existing.id]
        );
        
        await pgClient.query('COMMIT');

        const device = updateRes.rows[0];
        await audit({
          orgId,
          userId,
          entityType: 'user_device',
          entityId: device.id,
          eventType: 'device_registered',
          eventData: { alreadyRegistered: true },
        });
        return device;
      }

      // Check device limit
      const countRes = await pgClient.query(
        "SELECT count(*) FROM public.user_devices WHERE user_id = $1 AND status = 'active'",
        [userId]
      );
      const activeCount = parseInt(countRes.rows[0].count, 10);

      const keyRes = await pgClient.query(
        "SELECT max_uses FROM public.activation_keys WHERE activated_by = $1 LIMIT 1",
        [userId]
      );
      const maxUses = keyRes.rows[0]?.max_uses ?? 5;

      if (activeCount >= maxUses) {
        await pgClient.query('COMMIT');
        await audit({
          orgId,
          userId,
          entityType: 'user_device',
          eventType: 'device_mismatch_blocked',
          eventData: {
            reason: 'device_limit_reached',
            activeCount,
            maxUses,
          },
        });
        throw new DeviceMismatchError({ orgId, userId, reason: 'device_limit_reached' });
      }

      const deviceId = crypto.randomUUID();
      const insertRes = await pgClient.query(
        `INSERT INTO public.user_devices 
         (id, org_id, user_id, device_secret_hash, device_name, browser, os, public_key, fingerprint_hash, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active')
         RETURNING *`,
        [
          deviceId,
          orgId,
          userId,
          devicePayload.deviceSecretHash,
          devicePayload.deviceName ?? null,
          devicePayload.browser ?? null,
          devicePayload.os ?? null,
          devicePayload.publicKey ?? null,
          devicePayload.fingerprintHash ?? null,
        ]
      );

      await pgClient.query('COMMIT');
      
      const device = insertRes.rows[0];
      await audit({
        orgId,
        userId,
        entityType: 'user_device',
        entityId: device.id,
        eventType: 'device_registered',
        eventData: {
          browser: devicePayload.browser ?? null,
          os: devicePayload.os ?? null,
        },
      });
      return device;

    } catch (error) {
      await pgClient.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      await pgClient.end().catch(() => {});
    }
  }

  // Fallback to normal client-based logic (e.g. for mocks/tests)
  const client = createAdminClient();
  const { data: activeDevices } = await (client as any)
    .from('user_devices')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active');

  const existing = (activeDevices ?? []).find(
    (d: any) => d.device_secret_hash === devicePayload.deviceSecretHash
  );

  if (existing) {
    const device = await userDeviceRepository.update(existing.id, {
      deviceName: devicePayload.deviceName ?? existing.device_name,
      browser: devicePayload.browser ?? existing.browser,
      os: devicePayload.os ?? existing.os,
      publicKey: devicePayload.publicKey ?? (existing as any).public_key,
      fingerprintHash: devicePayload.fingerprintHash ?? (existing as any).fingerprint_hash,
      status: 'active',
    });
    await audit({
      orgId,
      userId,
      entityType: 'user_device',
      entityId: device.id,
      eventType: 'device_registered',
      eventData: { alreadyRegistered: true },
    });
    return device;
  }

  const activeCount = activeDevices?.length ?? 0;
  const { data: keyData } = await (client as any)
    .from('activation_keys')
    .select('max_uses')
    .eq('activated_by', userId)
    .maybeSingle();
  const maxUses = keyData?.max_uses ?? 5;

  if (activeCount >= maxUses) {
    await audit({
      orgId,
      userId,
      entityType: 'user_device',
      eventType: 'device_mismatch_blocked',
      eventData: {
        reason: 'device_limit_reached',
        activeCount,
        maxUses,
      },
    });
    throw new DeviceMismatchError({ orgId, userId, reason: 'device_limit_reached' });
  }

  const device = await userDeviceRepository.create(orgId, userId, devicePayload);
  await audit({
    orgId,
    userId,
    entityType: 'user_device',
    entityId: device.id,
    eventType: 'device_registered',
    eventData: {
      browser: devicePayload.browser ?? null,
      os: devicePayload.os ?? null,
    },
  });

  return device;
}
