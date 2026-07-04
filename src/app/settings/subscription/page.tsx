import {
  AdminTabs,
  EmptyState,
  Metric,
  MetricGrid,
  PageShell,
  Section,
  StatusBadge,
  formatCurrency,
  formatDate,
  orgAdminTabs,
} from '@/components/saas/ManagementUi';
import { requireOrgAdminPageSession } from '@/lib/saas/managementPageGuards';
import { getBillingOverview } from '@/lib/saas/services/managementService';

function featureRows(features: unknown) {
  if (!features || typeof features !== 'object' || Array.isArray(features)) return [];
  return Object.entries(features as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
}

export default async function SubscriptionPage() {
  const session = await requireOrgAdminPageSession();

  const billing = await getBillingOverview(session.orgId);
  const features = featureRows(billing.plan?.features);

  return (
    <PageShell
      title="Subscription"
      description="Plan entitlement, feature access, and renewal state for this organization."
      nav={<AdminTabs items={orgAdminTabs} />}
    >
      <MetricGrid>
        <Metric label="Plan" value={billing.plan?.name ?? 'No subscription'} detail={billing.plan ? `${formatCurrency(billing.plan.monthly_price)} monthly` : 'Ask a super admin to assign a plan.'} />
        <Metric label="Plan Active" value={<StatusBadge status={billing.plan?.is_active ? 'active' : 'inactive'} />} detail={billing.plan?.is_active === false ? 'Existing access can continue, but the plan is retired.' : 'Plan can be assigned.'} />
        <Metric label="Subscription" value={<StatusBadge status={billing.subscription?.status ?? 'missing'} />} detail={`Billing cycle: ${billing.subscription?.billing_cycle ?? 'not set'}`} />
        <Metric label="Current Period End" value={formatDate(billing.subscription?.current_period_end)} />
      </MetricGrid>

      <Section title="Feature Access">
        {features.length === 0 ? (
          <EmptyState title="No feature map configured">Feature gates will deny modules that are not explicitly enabled.</EmptyState>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {features.map(([feature, enabled]) => (
              <div key={feature} className="rounded-lg border border-border bg-background p-4">
                <div className="text-sm font-bold text-text-primary">{feature.replaceAll('_', ' ')}</div>
                <div className="mt-2">
                  <StatusBadge status={enabled ? 'active' : 'disabled'} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {billing.seatUsage.overLimitBy > 0 && (
        <Section title="Seat Limit Reduced Below Usage">
          <div className="rounded-lg border border-warning/25 bg-warning/10 p-4 text-sm text-warning">
            This organization is {billing.seatUsage.overLimitBy} seat{billing.seatUsage.overLimitBy === 1 ? '' : 's'} over the current limit. New invites are blocked until seats are increased or users are disabled.
          </div>
        </Section>
      )}
    </PageShell>
  );
}
