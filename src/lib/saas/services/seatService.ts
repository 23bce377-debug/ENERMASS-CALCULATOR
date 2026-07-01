import 'server-only';
import { Client } from 'pg';

import { createAdminClient } from '@/lib/supabase/server';
import z from 'zod';
import { OrgMemberRepository, OrgSubscriptionRepository } from '../repositories';
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
  const normalised = email.toLowerCase();

  // O(1) direct database lookup if DATABASE_URL is available
  if (process.env.DATABASE_URL) {
    const pgClient = new Client({ connectionString: process.env.DATABASE_URL });
    try {
      await pgClient.connect();
      const res = await pgClient.query('SELECT id FROM auth.users WHERE LOWER(email) = $1 LIMIT 1', [normalised]);
      if (res.rows.length > 0) {
        return res.rows[0].id;
      }
    } catch (err) {
      console.error('[SeatService] Direct database email lookup failed, falling back to paginated scan:', err);
    } finally {
      await pgClient.end().catch(() => {});
    }
  }

  const supabase = createAdminClient();
  // Fallback: paginated scan
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
  const usedSeats = counts.active;

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

/**
 * Checks seat availability during activation key redemption.
 * Unlike `assertSeatAvailable`, this does NOT require an active subscription.
 * The activation key itself is the authorization — we only enforce the seat cap
 * if a subscription record exists. If no subscription exists at all (first user
 * for a new org), the activation is allowed unconditionally.
 */
export async function assertSeatAvailableForActivation(orgId: string, deps: SeatServiceDeps = {}) {
  const audit = deps.audit ?? logLicenseEvent;
  const orgSubscriptionRepository = deps.orgSubscriptionRepository ?? new OrgSubscriptionRepository();
  const orgMemberRepository = deps.orgMemberRepository ?? new OrgMemberRepository();

  // Get the subscription WITHOUT asserting it's active — we just need the seat_limit
  const subscription = await orgSubscriptionRepository.getActiveByOrgId(orgId);
  const counts = await orgMemberRepository.countBillableSeats(orgId);
  const usedSeats = counts.active;

  // No subscription at all → allow only 1 user (first user bootstrapping the org)
  if (!subscription) {
    if (usedSeats >= 1) {
      await audit({
        orgId,
        entityType: 'org_subscription',
        eventType: 'seat_limit_reached',
        eventData: { activeSeats: counts.active, invitedSeats: counts.invited, usedSeats, seatLimit: 1, overLimitBy: usedSeats - 1 } as unknown as Record<string, number>,
      });
      throw new SeatLimitReachedError({
        orgId,
        usage: { activeSeats: counts.active, invitedSeats: counts.invited, usedSeats, seatLimit: 1, overLimitBy: usedSeats - 1 },
      });
    }
    return {
      activeSeats: counts.active,
      invitedSeats: counts.invited,
      usedSeats,
      seatLimit: 1,
      overLimitBy: 0,
    };
  }

  const seatLimit = subscription.seat_limit;

  if (seatLimit > 0 && usedSeats >= seatLimit) {
    await audit({
      orgId,
      entityType: 'org_subscription',
      eventType: 'seat_limit_reached',
      eventData: { activeSeats: counts.active, invitedSeats: counts.invited, usedSeats, seatLimit, overLimitBy: usedSeats - seatLimit } as unknown as Record<string, number>,
    });
    throw new SeatLimitReachedError({ orgId, usage: { activeSeats: counts.active, invitedSeats: counts.invited, usedSeats, seatLimit, overLimitBy: usedSeats - seatLimit } });
  }

  return {
    activeSeats: counts.active,
    invitedSeats: counts.invited,
    usedSeats,
    seatLimit,
    overLimitBy: 0,
  };
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
    const pgErr = error as any;
    const isSeatLimit = 
      pgErr.code === '23514' || 
      pgErr.constraint === 'org_members_enforce_seat_limit' ||
      /seat limit|seat_limit|23514/i.test(pgErr.message || String(pgErr));

    if (isSeatLimit) {
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

  // Cascading revoke of all active user devices in this organization
  try {
    const client = createAdminClient();
    await client
      .from('user_devices')
      .update({ status: 'revoked', revoked_at: new Date().toISOString() })
      .eq('org_id', orgId)
      .eq('user_id', userId)
      .eq('status', 'active');
  } catch (err) {
    console.error(`[SeatService] Failed to cascading revoke devices for disabled user ${userId}:`, err);
  }

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
