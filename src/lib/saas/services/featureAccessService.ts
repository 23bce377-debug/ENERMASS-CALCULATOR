import 'server-only';

import { SubscriptionPlanRepository } from '../repositories';
import { logLicenseEvent } from './licenseAuditService';
import { assertActiveSubscription, type SubscriptionServiceDeps } from './subscriptionService';

export interface FeatureAccessServiceDeps extends SubscriptionServiceDeps {
  subscriptionPlanRepository?: Pick<SubscriptionPlanRepository, 'getById'>;
  audit?: typeof logLicenseEvent;
}

export async function assertFeatureAccess(
  orgId: string,
  feature: string,
  deps: FeatureAccessServiceDeps = {}
) {
  const subscription = await assertActiveSubscription(orgId, deps);
  const subscriptionPlanRepository = deps.subscriptionPlanRepository ?? new SubscriptionPlanRepository();
  const plan = await subscriptionPlanRepository.getById(subscription.plan_id);

  return { subscription, plan, feature };
}

