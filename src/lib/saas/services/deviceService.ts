import 'server-only';
import { Client } from 'pg';
import crypto from 'node:crypto';

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
        "SELECT * FROM public.user_devices WHERE user_id = $1 AND status = 'active' LIMIT 1",
        [userId]
      );
      const existing = existingRes.rows[0];

      if (existing) {
        if (!sameDevice(existing, devicePayload)) {
          await pgClient.query('COMMIT');
          await audit({
            orgId,
            userId,
            entityType: 'user_device',
            entityId: existing.id,
            eventType: 'device_mismatch_blocked',
            eventData: {
              activeDeviceId: existing.id,
            },
          });
          throw new DeviceMismatchError({ orgId, userId, activeDeviceId: existing.id });
        }

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
      const message = error instanceof Error ? error.message : String(error);
      if (/user_devices_one_active_per_user|duplicate key|unique/i.test(message)) {
        await audit({
          orgId,
          userId,
          entityType: 'user_device',
          eventType: 'device_mismatch_blocked',
          eventData: {
            reason: 'device_registration_conflict',
          },
        });
        throw new DeviceMismatchError({ orgId, userId, reason: 'device_registration_conflict' });
      }
      throw error;
    } finally {
      await pgClient.end().catch(() => {});
    }
  }

  // Fallback to normal client-based logic (e.g. for mocks/tests)
  const existing = await userDeviceRepository.getActiveForUser(userId);

  if (existing) {
    if (!sameDevice(existing, devicePayload)) {
      await audit({
        orgId,
        userId,
        entityType: 'user_device',
        entityId: existing.id,
        eventType: 'device_mismatch_blocked',
        eventData: {
          activeDeviceId: existing.id,
        },
      });
      throw new DeviceMismatchError({ orgId, userId, activeDeviceId: existing.id });
    }

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

  let device;
  try {
    device = await userDeviceRepository.create(orgId, userId, devicePayload);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/user_devices_one_active_per_user|duplicate key|unique/i.test(message)) {
      await audit({
        orgId,
        userId,
        entityType: 'user_device',
        eventType: 'device_mismatch_blocked',
        eventData: {
          reason: 'device_registration_conflict',
        },
      });
      throw new DeviceMismatchError({ orgId, userId, reason: 'device_registration_conflict' });
    }
    throw error;
  }
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
