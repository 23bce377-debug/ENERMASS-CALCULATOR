import 'server-only';

import { DeviceResetRequestRepository, UserDeviceRepository } from '../repositories';
import type { DeviceInfo } from '../types';
import { logLicenseEvent } from './licenseAuditService';
import { assertActiveMembership, type MembershipDeps } from './guards';

export interface DeviceResetServiceDeps extends MembershipDeps {
  deviceResetRequestRepository?: Pick<DeviceResetRequestRepository, 'create' | 'getById' | 'approve' | 'reject'>;
  userDeviceRepository?: Pick<UserDeviceRepository, 'getActiveForUser' | 'revoke'>;
  audit?: typeof logLicenseEvent;
}

export async function requestDeviceReset(
  userId: string,
  orgId: string,
  deviceInfo: DeviceInfo,
  deps: DeviceResetServiceDeps = {}
) {
  await assertActiveMembership(orgId, userId, deps);

  const userDeviceRepository = deps.userDeviceRepository ?? new UserDeviceRepository();
  const deviceResetRequestRepository = deps.deviceResetRequestRepository ?? new DeviceResetRequestRepository();
  const audit = deps.audit ?? logLicenseEvent;
  const oldDevice = await userDeviceRepository.getActiveForUser(userId);
  const resetRequest = await deviceResetRequestRepository.create(orgId, userId, oldDevice?.id ?? null, deviceInfo);

  await audit({
    orgId,
    userId,
    entityType: 'device_reset_request',
    entityId: resetRequest.id,
    eventType: 'device_reset_requested',
    eventData: { oldDeviceId: oldDevice?.id ?? null, requestedDeviceInfo: deviceInfo as Record<string, string | null | undefined> },
  });

  return resetRequest;
}

export async function approveDeviceReset(
  requestId: string,
  adminUserId: string,
  deps: DeviceResetServiceDeps = {}
) {
  const deviceResetRequestRepository = deps.deviceResetRequestRepository ?? new DeviceResetRequestRepository();
  const userDeviceRepository = deps.userDeviceRepository ?? new UserDeviceRepository();
  const audit = deps.audit ?? logLicenseEvent;
  const resetRequest = await deviceResetRequestRepository.getById(requestId);

  if (!resetRequest) {
    throw new Error('Device reset request not found');
  }

  // Device reset review is reserved for super admin callers.
  // API/server-action entry points must verify that before calling this service.

  if (resetRequest.old_device_id) {
    await userDeviceRepository.revoke(resetRequest.old_device_id);
  }

  const approved = await deviceResetRequestRepository.approve(requestId, adminUserId);
  await audit({
    orgId: resetRequest.org_id,
    userId: resetRequest.user_id,
    entityType: 'device_reset_request',
    entityId: requestId,
    eventType: 'device_reset_approved',
    actorUserId: adminUserId,
    eventData: { oldDeviceId: resetRequest.old_device_id },
  });

  return approved;
}


export async function rejectDeviceReset(
  requestId: string,
  adminUserId: string,
  deps: DeviceResetServiceDeps = {}
) {
  const deviceResetRequestRepository = deps.deviceResetRequestRepository ?? new DeviceResetRequestRepository();
  const audit = deps.audit ?? logLicenseEvent;
  const resetRequest = await deviceResetRequestRepository.getById(requestId);

  if (!resetRequest) {
    throw new Error('Device reset request not found');
  }

  const rejected = await deviceResetRequestRepository.reject(requestId, adminUserId);

  await audit({
    orgId: resetRequest.org_id,
    userId: resetRequest.user_id,
    entityType: 'device_reset_request',
    entityId: requestId,
    eventType: 'device_reset_rejected',
    actorUserId: adminUserId,
    eventData: { oldDeviceId: resetRequest.old_device_id },
  });

  return rejected;
}
