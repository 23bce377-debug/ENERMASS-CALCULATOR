import 'server-only';

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
