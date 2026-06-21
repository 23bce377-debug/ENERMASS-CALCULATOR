import 'server-only';

import { SubscriptionPlanRepository } from '../repositories';
import { FeatureNotEnabledError } from '../errors';
import type { FeatureMap } from '../types';
import { logLicenseEvent } from './licenseAuditService';
import { assertActiveSubscription, type SubscriptionServiceDeps } from './subscriptionService';

export interface FeatureAccessServiceDeps extends SubscriptionServiceDeps {
  subscriptionPlanRepository?: Pick<SubscriptionPlanRepository, 'getById'>;
  audit?: typeof logLicenseEvent;
}

function featureEnabled(features: unknown, feature: string) {
  const featureMap = (features ?? {}) as FeatureMap;
  const value = featureMap[feature];
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value > 0;
  if (typeof value === 'string') return value.length > 0;
  return Boolean(value);
}

export async function assertFeatureAccess(
  orgId: string,
  feature: string,
  deps: FeatureAccessServiceDeps = {}
) {
  const subscription = await assertActiveSubscription(orgId, deps);
  const subscriptionPlanRepository = deps.subscriptionPlanRepository ?? new SubscriptionPlanRepository();
  const audit = deps.audit ?? logLicenseEvent;
  const plan = await subscriptionPlanRepository.getById(subscription.plan_id);

  if (!plan || !featureEnabled(plan.features, feature)) {
    await audit({
      orgId,
      entityType: 'subscription_plan',
      entityId: plan?.id ?? subscription.plan_id,
      eventType: 'feature_access_denied',
      eventData: { feature },
    });
    throw new FeatureNotEnabledError({ orgId, feature, planId: plan?.id ?? null });
  }

  return { subscription, plan, feature };
}

