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

export default async function BillingPage() {
  const session = await requireOrgAdminPageSession();

  const billing = await getBillingOverview(session.orgId);

  return (
    <PageShell
      title="Billing"
      description="Subscription billing, seat usage, and payment health for your organization."
      nav={<AdminTabs items={orgAdminTabs} />}
    >
      <MetricGrid>
        <Metric label="Current Plan" value={billing.plan?.name ?? 'No plan'} detail={billing.plan?.code ?? 'Subscription not assigned'} />
        <Metric label="Status" value={<StatusBadge status={billing.subscription?.status ?? 'missing'} />} detail={`Cycle: ${billing.subscription?.billing_cycle ?? 'not set'}`} />
        <Metric label="Period End" value={formatDate(billing.subscription?.current_period_end)} detail="Access is checked against this date." />
        <Metric label="Payment" value={<StatusBadge status={billing.latestPayment?.payment_status ?? 'missing'} />} detail={billing.latestPayment ? formatCurrency(billing.latestPayment.amount, billing.latestPayment.currency) : 'No payment recorded'} />
      </MetricGrid>

      <MetricGrid>
        <Metric label="Seat Limit" value={billing.seatUsage.seatLimit || 'Not set'} />
        <Metric label="Used Seats" value={billing.seatUsage.usedSeats} detail={`${billing.seatUsage.activeSeats} active, ${billing.seatUsage.invitedSeats} invited`} />
        <Metric label="Available Seats" value={Math.max(0, billing.seatUsage.seatLimit - billing.seatUsage.usedSeats)} />
        <Metric label="Over Limit" value={billing.seatUsage.overLimitBy} detail={billing.seatUsage.overLimitBy > 0 ? 'Reduce users or increase seats.' : 'Within plan limit.'} />
      </MetricGrid>

      <Section title="Payment History">
        {billing.payments.length === 0 ? (
          <EmptyState title="No payments recorded">Manual payments and gateway confirmations will appear here.</EmptyState>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {billing.payments.map((payment) => (
              <div key={payment.id} className="rounded-lg border border-border bg-background p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-mono text-sm font-bold text-text-primary">{formatCurrency(payment.amount, payment.currency)}</div>
                  <StatusBadge status={payment.payment_status} />
                </div>
                <div className="mt-2 text-xs text-text-muted">
                  {payment.payment_method.replaceAll('_', ' ')} · {payment.invoice_number ?? 'No invoice'} · {formatDate(payment.paid_at ?? payment.created_at)}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </PageShell>
  );
}
