import 'server-only';

import { createAdminClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { OrgMemberRepository, PasswordResetRequestRepository } from '../repositories';
import { logLicenseEvent } from './licenseAuditService';
import type { PasswordResetRequest } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PasswordResetRequestItem extends PasswordResetRequest {
  user_email: string | null;
  user_name: string | null;
}

// ─── Request a Password Reset ─────────────────────────────────────────────────

/**
 * Creates a password reset request (pending admin approval).
 * The user must be authenticated and have an active org membership.
 * No Supabase reset email is sent until admin approves.
 */
export async function requestPasswordReset(
  email: string,
  options: { ipAddress?: string | null; userAgent?: string | null } = {}
): Promise<{ success: true; message: string } | { success: false; reason: string }> {
  z.string().email().parse(email);

  const adminClient = createAdminClient();

  // ── 1. Look up user by email ──────────────────────────────────────────────────
  // Paginated scan with early exit — avoids 1000-user cap
  let page = 1;
  let user: { id: string; email?: string } | undefined;
  while (!user) {
    const { data: authUsers } = await adminClient.auth.admin.listUsers({ page, perPage: 100 });
    user = authUsers?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
    if (!user && (authUsers?.users?.length ?? 0) < 100) break;
    page++;
  }

  if (!user) {
    // Intentionally vague response to prevent email enumeration
    return { success: true, message: 'If an account with this email exists, your admin has been notified.' };
  }

  // ── 2. Fetch org membership ───────────────────────────────────────────────────
  const memberRepo = new OrgMemberRepository(createAdminClient);
  const { data: members, error: membersError } = await (adminClient as any)
    .from('org_members')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .limit(1);

  if (membersError || !members?.length) {
    return { success: true, message: 'If an account with this email exists, your admin has been notified.' };
  }

  const member = members[0];

  // ── 3. Check for existing pending request (prevent flooding) ──────────────────
  const repo = new PasswordResetRequestRepository(createAdminClient);
  const pending = await repo.listPendingByOrg(member.org_id);
  const alreadyPending = pending.some(r => r.user_id === user.id);
  if (alreadyPending) {
    return { success: true, message: 'A password reset request is already pending admin approval.' };
  }

  // ── 4. Create the request ─────────────────────────────────────────────────────
  await repo.create(member.org_id, user.id, {
    ip_address: options.ipAddress ?? null,
    user_agent: options.userAgent ?? null,
  });

  await logLicenseEvent({
    orgId: member.org_id,
    userId: user.id,
    entityType: 'password_reset_request',
    eventType: 'device_reset_requested',
    eventData: { action: 'password_reset_requested', email },
  });

  return { success: true, message: 'Your password reset request has been sent to your organisation admin for approval.' };
}

// ─── List Pending Requests (for org admin) ────────────────────────────────────

export async function listPasswordResetRequests(orgId: string): Promise<PasswordResetRequestItem[]> {
  const repo = new PasswordResetRequestRepository(createAdminClient);
  const requests = await repo.listByOrg(orgId);

  const userIds = [...new Set(requests.map(r => r.user_id))];
  if (userIds.length === 0) return [];

  const adminClient = createAdminClient();
  // Paginated scan — build emailMap for only the userIds we need
  const emailMap = new Map<string, string>();
  let authPage = 1;
  while (emailMap.size < userIds.length) {
    const { data: authUsers } = await adminClient.auth.admin.listUsers({ page: authPage, perPage: 100 });
    (authUsers?.users ?? []).filter(u => u.id && userIds.includes(u.id)).forEach(u => {
      if (u.email) emailMap.set(u.id, u.email);
    });
    if ((authUsers?.users?.length ?? 0) < 100) break;
    authPage++;
  }

  const { data: profiles } = await (adminClient as any)
    .from('profiles')
    .select('id, full_name')
    .in('id', userIds);
  const nameMap = new Map<string, string>();
  (profiles ?? []).forEach((p: { id: string; full_name: string }) => nameMap.set(p.id, p.full_name));

  return requests.map(r => ({
    ...r,
    user_email: emailMap.get(r.user_id) ?? null,
    user_name: nameMap.get(r.user_id) ?? null,
  }));
}

// ─── Approve Request (org admin) ─────────────────────────────────────────────

/**
 * Approves a password reset request and sends the Supabase reset email.
 */
export async function approvePasswordResetRequest(
  requestId: string,
  adminUserId: string
): Promise<void> {
  const repo = new PasswordResetRequestRepository(createAdminClient);
  const request = await repo.getById(requestId) as PasswordResetRequest | null;

  if (!request) throw new Error('Password reset request not found.');
  if (request.status !== 'pending_admin_approval') {
    throw new Error('This request is no longer pending approval.');
  }
  if (new Date(request.expires_at) < new Date()) {
    throw new Error('This password reset request has expired.');
  }

  // Fetch user email
  const adminClient = createAdminClient();
  const { data: authUser, error } = await adminClient.auth.admin.getUserById(request.user_id);
  if (error || !authUser?.user?.email) {
    throw new Error('Could not find user account to send reset email.');
  }

  // Mark approved first
  await repo.approve(requestId, adminUserId);

  // Send Supabase password reset email via SMTP
  // generateLink() only creates a URL — resetPasswordForEmail() actually sends the email.
  const { error: resetError } = await adminClient.auth.admin.generateLink({
    type: 'recovery',
    email: authUser.user.email,
  });

  if (resetError) {
    // generateLink failure is non-fatal for audit purposes; log but don't block approval
    console.error('[PasswordReset] Failed to generate recovery link:', resetError.message);
  }

  // Also trigger the built-in Supabase email flow (requires SMTP configured in Supabase project)
  const { error: emailError } = await adminClient.auth.resetPasswordForEmail(authUser.user.email);
  if (emailError) {
    throw new Error(`Failed to send password reset email: ${emailError.message}`);
  }

  // Mark link sent
  await repo.markLinkSent(requestId);

  await logLicenseEvent({
    orgId: request.org_id,
    userId: request.user_id,
    entityType: 'password_reset_request',
    entityId: requestId,
    eventType: 'device_reset_approved',
    actorUserId: adminUserId,
    eventData: { action: 'password_reset_approved' },
  });
}

// ─── Reject Request (org admin) ───────────────────────────────────────────────

export async function rejectPasswordResetRequest(
  requestId: string,
  adminUserId: string
): Promise<void> {
  const repo = new PasswordResetRequestRepository(createAdminClient);
  const request = await repo.getById(requestId) as PasswordResetRequest | null;

  if (!request) throw new Error('Password reset request not found.');
  if (request.status !== 'pending_admin_approval') {
    throw new Error('This request is no longer pending approval.');
  }

  await repo.reject(requestId, adminUserId);

  await logLicenseEvent({
    orgId: request.org_id,
    userId: request.user_id,
    entityType: 'password_reset_request',
    entityId: requestId,
    eventType: 'device_reset_rejected',
    actorUserId: adminUserId,
    eventData: { action: 'password_reset_rejected' },
  });
}
