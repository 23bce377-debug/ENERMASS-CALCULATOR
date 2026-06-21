import {
  AdminTabs,
  EmptyState,
  Field,
  PageShell,
  Section,
  StatusBadge,
  TableWrap,
  buttonClass,
  formatCurrency,
  formatDateTime,
  inputClass,
  superAdminTabs,
  tableClass,
  tdClass,
  thClass,
} from '@/components/saas/ManagementUi';
import { listSuperAdminOrgs, listSuperAdminPayments, listSuperAdminSubscriptions } from '@/lib/saas';
import { requireSuperAdminPageSession } from '@/lib/saas/managementPageGuards';
import { recordManualPaymentAction } from '../actions';

export default async function SuperAdminPaymentsPage() {
  await requireSuperAdminPageSession();
  const [payments, subscriptions, orgs] = await Promise.all([
    listSuperAdminPayments(),
    listSuperAdminSubscriptions(),
    listSuperAdminOrgs(),
  ]);

  const orgMap = new Map(orgs.map((org) => [org.id, org.name]));

  return (
    <PageShell title="Payments" description="Record manual subscription payments and inspect payment status." nav={<AdminTabs items={superAdminTabs} />}>
      <Section title="Record Manual Payment">
        <form action={recordManualPaymentAction} className="grid gap-4 bg-surface p-4 rounded-xl border border-border">
          <div className="grid gap-3 lg:grid-cols-[1fr_140px_100px_140px_140px_140px] lg:items-end">
            <Field label="Subscription">
              <select className={inputClass} name="subscriptionId" required>
                {subscriptions.map((subscription) => (
                  <option key={subscription.id} value={subscription.id}>
                    {subscription.org_name ?? subscription.org_id} · {subscription.plan_name ?? subscription.plan_id}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Amount"><input className={inputClass} name="amount" type="number" min="0" defaultValue="0" /></Field>
            <Field label="Currency"><input className={inputClass} name="currency" defaultValue="INR" maxLength={3} /></Field>
            <Field label="Status">
              <select className={inputClass} name="paymentStatus" defaultValue="paid">
                <option value="paid">paid</option>
                <option value="pending">pending</option>
                <option value="failed">failed</option>
                <option value="refunded">refunded</option>
              </select>
            </Field>
            <Field label="Method">
              <select className={inputClass} name="paymentMethod" defaultValue="manual">
                <option value="manual">manual</option>
                <option value="bank_transfer">bank transfer</option>
                <option value="upi">upi</option>
                <option value="cash">cash</option>
                <option value="cheque">cheque</option>
                <option value="card">card</option>
              </select>
            </Field>
            <Field label="Invoice"><input className={inputClass} name="invoiceNumber" placeholder="INV-001" /></Field>
          </div>
          <div className="grid gap-3 lg:grid-cols-[auto_auto_1fr] lg:items-end pt-2 border-t border-border">
            <Field label="Paid At (Optional)">
              <input className={inputClass} type="datetime-local" name="paidAt" />
            </Field>
            <label className="flex items-center gap-2 pb-2 pl-4 cursor-pointer">
              <input type="checkbox" name="activateSubscription" value="true" defaultChecked className="rounded border-border bg-background" />
              <span className="text-sm text-text-primary">Auto-activate subscription on paid</span>
            </label>
            <div className="text-right">
              <button className={buttonClass} type="submit" disabled={subscriptions.length === 0}>Record Payment</button>
            </div>
          </div>
        </form>
      </Section>

      <Section title="Payment History">
        {payments.length === 0 ? (
          <EmptyState title="No payments found">Manual or gateway payments appear here.</EmptyState>
        ) : (
          <TableWrap>
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>Organization</th>
                  <th className={thClass}>Amount</th>
                  <th className={thClass}>Status</th>
                  <th className={thClass}>Method</th>
                  <th className={thClass}>Invoice</th>
                  <th className={thClass}>Paid At</th>
                  <th className={thClass}>Subscription</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-background">
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className={tdClass}>
                      <div className="font-semibold text-text-primary">{orgMap.get(payment.org_id) ?? 'Unknown'}</div>
                    </td>
                    <td className={tdClass}><span className="font-mono font-bold text-text-primary">{formatCurrency(payment.amount, payment.currency)}</span></td>
                    <td className={tdClass}><StatusBadge status={payment.payment_status} /></td>
                    <td className={tdClass}>{payment.payment_method.replaceAll('_', ' ')}</td>
                    <td className={tdClass}>{payment.invoice_number ?? 'No invoice'}</td>
                    <td className={tdClass}>{formatDateTime(payment.paid_at ?? payment.created_at)}</td>
                    <td className={`${tdClass} font-mono text-[11px]`}>{payment.subscription_id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Section>
    </PageShell>
  );
}
