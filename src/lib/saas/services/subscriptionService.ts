import 'server-only';

import {
  OrgSubscriptionRepository,
  SubscriptionPaymentRepository,
} from '../repositories';
import { SubscriptionExpiredError } from '../errors';
import type { OrgSubscription, SubscriptionPayment } from '../types';
import { logLicenseEvent } from './licenseAuditService';

export interface SubscriptionServiceDeps {
  orgSubscriptionRepository?: Pick<OrgSubscriptionRepository, 'getActiveByOrgId'>;
  subscriptionPaymentRepository?: Pick<SubscriptionPaymentRepository, 'listByOrgId'>;
  audit?: typeof logLicenseEvent;
  now?: () => Date;
  /**
   * Optional grace period in days after current_period_end during which an
   * active/trialing subscription without a paid payment is still considered
   * usable. Default: 0 (strict enforcement). Set to 3 for a 3-day grace window.
   */
  graceDays?: number;
}

function isAfterNow(value: string | null, now: Date) {
  return Boolean(value && new Date(value).getTime() > now.getTime());
}

function isWithinGracePeriod(value: string | null, now: Date, graceDays: number): boolean {
  if (!value || graceDays <= 0) return false;
  const periodEnd = new Date(value).getTime();
  const graceEnd = periodEnd + graceDays * 24 * 60 * 60 * 1000;
  return now.getTime() <= graceEnd;
}

function hasPaidPayment(subscription: OrgSubscription, payments: SubscriptionPayment[], now: Date) {
  return payments.some(
    (payment) =>
      payment.subscription_id === subscription.id &&
      payment.payment_status === 'paid' &&
      (!payment.paid_at || new Date(payment.paid_at).getTime() <= now.getTime())
  );
}

function isSubscriptionUsable(
  subscription: OrgSubscription,
  payments: SubscriptionPayment[],
  now: Date,
  graceDays: number
) {
  if (subscription.status === 'cancelled' || subscription.status === 'expired') {
    return false;
  }

  // past_due: still allow access during the grace window
  if (subscription.status === 'past_due') {
    return isWithinGracePeriod(subscription.current_period_end, now, graceDays) ||
      hasPaidPayment(subscription, payments, now);
  }

  if (subscription.status === 'active') {
    return (
      isAfterNow(subscription.current_period_end, now) ||
      isWithinGracePeriod(subscription.current_period_end, now, graceDays) ||
      hasPaidPayment(subscription, payments, now)
    );
  }

  if (subscription.status === 'trialing') {
    return (
      Boolean(subscription.trial_ends_at || subscription.current_period_end) &&
      isAfterNow(subscription.trial_ends_at, now) ||
      isAfterNow(subscription.current_period_end, now) ||
      isWithinGracePeriod(subscription.current_period_end, now, graceDays) ||
      hasPaidPayment(subscription, payments, now)
    );
  }

  return false;
}

export async function getActiveSubscriptionForOrg(
  orgId: string,
  deps: SubscriptionServiceDeps = {}
): Promise<OrgSubscription | null> {
  const orgSubscriptionRepository = deps.orgSubscriptionRepository ?? new OrgSubscriptionRepository();
  return orgSubscriptionRepository.getActiveByOrgId(orgId);
}

export async function assertActiveSubscription(
  orgId: string,
  deps: SubscriptionServiceDeps = {}
): Promise<OrgSubscription> {
  const orgSubscriptionRepository = deps.orgSubscriptionRepository ?? new OrgSubscriptionRepository();
  const subscriptionPaymentRepository = deps.subscriptionPaymentRepository ?? new SubscriptionPaymentRepository();
  const audit = deps.audit ?? logLicenseEvent;
  const now = deps.now?.() ?? new Date();
  const graceDays = deps.graceDays ?? 0;

  const subscription = await orgSubscriptionRepository.getActiveByOrgId(orgId);
  const payments = subscription ? await subscriptionPaymentRepository.listByOrgId(orgId) : [];

  if (!subscription || !isSubscriptionUsable(subscription, payments as SubscriptionPayment[], now, graceDays)) {
    await audit({
      orgId,
      entityType: 'org_subscription',
      entityId: subscription?.id ?? null,
      eventType: 'subscription_expired',
      eventData: { status: subscription?.status ?? 'missing' },
    });
    throw new SubscriptionExpiredError({ orgId, subscriptionId: subscription?.id ?? null });
  }

  return subscription;
}
