'use server';

import { revalidatePath } from 'next/cache';
import {
  approveOrgDeviceResetAsAdmin,
  changeOrgUserRoleAsAdmin,
  disableOrgUserAsAdmin,
  inviteOrgUserAsAdmin,
  rejectOrgDeviceResetAsAdmin,
  requireOrgManagementSession,
  revokeOrgDeviceAsAdmin,
} from '@/lib/saas/services/managementService';
import type { OrgMemberRole } from '@/lib/saas/types';
import { createAdminClient } from '@/lib/supabase/server';

export interface ManagementActionState {
  ok: boolean;
  message: string;
}

function value(formData: FormData, key: string) {
  const item = formData.get(key);
  return typeof item === 'string' ? item.trim() : '';
}

function messageForError(error: unknown) {
  if (error && typeof error === 'object' && 'userMessage' in error && typeof error.userMessage === 'string') {
    return error.userMessage;
  }
  if (error instanceof Error) return error.message;
  return 'Unable to complete that request.';
}

function refreshOrgAdminPages() {
  revalidatePath('/settings/billing');
  revalidatePath('/settings/subscription');
  revalidatePath('/settings/users');
  revalidatePath('/settings/devices');
  revalidatePath('/settings/device-reset-requests');
  revalidatePath('/settings/roles');
  revalidatePath('/settings/team');
}

export async function inviteOrgUserAction(formData: FormData): Promise<void> {
  try {
    const session = await requireOrgManagementSession(['owner', 'admin', 'manager']);
    await inviteOrgUserAsAdmin(
      session.orgId,
      session.user.id,
      value(formData, 'email'),
      value(formData, 'role') as OrgMemberRole
    );
    refreshOrgAdminPages();
    return;
  } catch (error) {
    throw new Error(messageForError(error));
  }
}

export async function disableOrgUserAction(formData: FormData): Promise<void> {
  try {
    const session = await requireOrgManagementSession(['owner', 'admin', 'manager']);
    await disableOrgUserAsAdmin(session.orgId, session.user.id, value(formData, 'memberId'));
    refreshOrgAdminPages();
    return;
  } catch (error) {
    throw new Error(messageForError(error));
  }
}

export async function changeOrgUserRoleAction(formData: FormData): Promise<void> {
  try {
    const session = await requireOrgManagementSession(['owner', 'admin', 'manager']);
    await changeOrgUserRoleAsAdmin(
      session.orgId,
      session.user.id,
      value(formData, 'memberId'),
      value(formData, 'role') as OrgMemberRole
    );
    refreshOrgAdminPages();
    return;
  } catch (error) {
    throw new Error(messageForError(error));
  }
}

export async function revokeOrgDeviceAction(formData: FormData): Promise<void> {
  try {
    const session = await requireOrgManagementSession(['owner', 'admin', 'manager']);
    await revokeOrgDeviceAsAdmin(session.orgId, session.user.id, value(formData, 'deviceId'));
    refreshOrgAdminPages();
    return;
  } catch (error) {
    throw new Error(messageForError(error));
  }
}

export async function approveOrgDeviceResetAction(formData: FormData): Promise<void> {
  try {
    const session = await requireOrgManagementSession(['owner', 'admin', 'manager']);
    await approveOrgDeviceResetAsAdmin(session.orgId, session.user.id, value(formData, 'requestId'));
    refreshOrgAdminPages();
    return;
  } catch (error) {
    throw new Error(messageForError(error));
  }
}

export async function rejectOrgDeviceResetAction(formData: FormData): Promise<void> {
  try {
    const session = await requireOrgManagementSession(['owner', 'admin', 'manager']);
    await rejectOrgDeviceResetAsAdmin(session.orgId, session.user.id, value(formData, 'requestId'));
    refreshOrgAdminPages();
    return;
  } catch (error) {
    throw new Error(messageForError(error));
  }
}

/**
 * Resend an invitation email for a member still in 'invited' status.
 * Uses Supabase admin inviteUserByEmail to re-send the magic link.
 */
export async function resendInviteAction(formData: FormData): Promise<void> {
  try {
    const session = await requireOrgManagementSession(['owner', 'admin', 'manager']);
    const email = value(formData, 'email');
    if (!email) throw new Error('Email is required.');

    const adminClient = createAdminClient();
    const { error } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: { org_id: session.orgId },
    });
    if (error) throw new Error(`Failed to resend invitation: ${error.message}`);
    refreshOrgAdminPages();
    return;
  } catch (error) {
    throw new Error(messageForError(error));
  }
}

export async function revokeSelfDeviceAction(formData: FormData): Promise<void> {
  const { UserDeviceRepository } = await import('@/lib/saas/repositories');
  try {
    const session = await requireOrgManagementSession(['owner', 'admin', 'manager', 'staff', 'viewer']);
    const deviceId = value(formData, 'deviceId');
    if (!deviceId) throw new Error('Device ID is required.');

    const deviceRepo = new UserDeviceRepository(createAdminClient);
    const device = await deviceRepo.getById(deviceId);
    if (!device) throw new Error('Device not found.');

    if (device.user_id !== session.user.id) {
      throw new Error('Unauthorized: You can only revoke your own devices.');
    }

    await deviceRepo.revoke(deviceId);

    const { logLicenseEvent } = await import('@/lib/saas/services/licenseAuditService');
    await logLicenseEvent({
      orgId: session.orgId,
      userId: session.user.id,
      entityType: 'user_devices',
      entityId: deviceId,
      eventType: 'device_reset_rejected',
      eventData: { action: 'self_device_revoked', deviceName: device.device_name },
    });

    revalidatePath('/settings/security');
    return;
  } catch (error) {
    throw new Error(messageForError(error));
  }
}
