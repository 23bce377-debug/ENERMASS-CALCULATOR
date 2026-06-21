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
  type OrgMemberRole,
} from '@/lib/saas';

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
