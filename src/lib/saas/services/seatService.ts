import 'server-only';

import { createAdminClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { OrgMemberRepository } from '../repositories';
import { SeatLimitReachedError } from '../errors';
import type { OrgMemberRole, SeatUsage } from '../types';
import { logLicenseEvent } from './licenseAuditService';
import { assertActiveSubscription, type SubscriptionServiceDeps } from './subscriptionService';

export interface SeatServiceDeps extends SubscriptionServiceDeps {
  orgMemberRepository?: Pick<OrgMemberRepository, 'countBillableSeats' | 'create' | 'disableByOrgAndUser'>;
  resolveUserIdByEmail?: (email: string) => Promise<string>;
  audit?: typeof logLicenseEvent;
}

const inviteSchema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase()),
  role: z.enum(['owner', 'admin', 'manager', 'staff', 'viewer']),
});

async function defaultResolveUserIdByEmail(email: string): Promise<string> {
  const supabase = createAdminClient();
  const normalised = email.toLowerCase();

  // Paginated scan — early exit as soon as the user is found.
  // 100 per page keeps each request small; stops when the last page is shorter than 100.
  let page = 1;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw new Error(`Failed to resolve invited user: ${error.message}`);

    const found = data.users.find(u => u.email?.toLowerCase() === normalised);
    if (found) return found.id;
    if (data.users.length < 100) break; // reached the last page
    page++;
  }

  // User not found in auth.users → send an invitation
  const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email);
  if (inviteError || !inviteData.user?.id) {
    throw new Error(`Failed to invite user: ${inviteError?.message ?? 'No user returned'}`);
  }

  return inviteData.user.id;
}

export async function getSeatUsage(orgId: string, deps: SeatServiceDeps = {}): Promise<SeatUsage> {
  const subscription = await assertActiveSubscription(orgId, deps);
  const orgMemberRepository = deps.orgMemberRepository ?? new OrgMemberRepository();
  const counts = await orgMemberRepository.countBillableSeats(orgId);
  const usedSeats = counts.active + counts.invited;

  return {
    activeSeats: counts.active,
    invitedSeats: counts.invited,
    usedSeats,
    seatLimit: subscription.seat_limit,
    overLimitBy: Math.max(0, usedSeats - subscription.seat_limit),
  };
}

export async function assertSeatAvailable(orgId: string, deps: SeatServiceDeps = {}) {
  const audit = deps.audit ?? logLicenseEvent;
  const usage = await getSeatUsage(orgId, deps);

  if (usage.usedSeats >= usage.seatLimit) {
    await audit({
      orgId,
      entityType: 'org_subscription',
      eventType: 'seat_limit_reached',
      eventData: usage as unknown as Record<string, number>,
    });
    throw new SeatLimitReachedError({ orgId, usage });
  }

  return usage;
}

export async function inviteOrgUser(
  orgId: string,
  email: string,
  role: OrgMemberRole,
  deps: SeatServiceDeps = {}
) {
  const { email: normalizedEmail, role: parsedRole } = inviteSchema.parse({ email, role });
  await assertSeatAvailable(orgId, deps);

  const resolveUserIdByEmail = deps.resolveUserIdByEmail ?? defaultResolveUserIdByEmail;
  const orgMemberRepository = deps.orgMemberRepository ?? new OrgMemberRepository();
  const audit = deps.audit ?? logLicenseEvent;
  const userId = await resolveUserIdByEmail(normalizedEmail);
  let member;
  try {
    member = await orgMemberRepository.create(orgId, {
      user_id: userId,
      role: parsedRole,
      status: 'invited',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/seat limit|seat_limit|23514/i.test(message)) {
      const usage = await getSeatUsage(orgId, deps).catch(() => null);
      await audit({
        orgId,
        entityType: 'org_subscription',
        eventType: 'seat_limit_reached',
        eventData: (usage ?? { reason: 'database_seat_limit_rejected' }) as unknown as Record<string, number>,
      });
      throw new SeatLimitReachedError({ orgId, usage, reason: 'database_seat_limit_rejected' });
    }
    throw error;
  }

  await audit({
    orgId,
    userId,
    entityType: 'org_member',
    entityId: member.id,
    eventType: 'user_invited',
    eventData: { email: normalizedEmail, role: parsedRole },
  });

  return member;
}

export async function disableOrgUser(
  orgId: string,
  userId: string,
  deps: SeatServiceDeps = {}
) {
  const orgMemberRepository = deps.orgMemberRepository ?? new OrgMemberRepository();
  const audit = deps.audit ?? logLicenseEvent;
  const member = await orgMemberRepository.disableByOrgAndUser(orgId, userId);

  await audit({
    orgId,
    userId,
    entityType: 'org_member',
    entityId: member.id,
    eventType: 'user_disabled',
    eventData: { status: member.status },
  });

  return member;
}
