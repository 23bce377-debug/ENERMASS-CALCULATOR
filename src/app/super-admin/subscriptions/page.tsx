import {
  AdminTabs,
  EmptyState,
  Field,
  PageShell,
  Section,
  StatusBadge,
  TableWrap,
  buttonClass,
  dangerButtonClass,
  inputClass,
  secondaryButtonClass,
  superAdminTabs,
  tableClass,
  tdClass,
  thClass,
} from '@/components/saas/ManagementUi';
import { listSuperAdminOrgs, listSuperAdminPlans, listSuperAdminSubscriptions } from '@/lib/saas';
import { requireSuperAdminPageSession } from '@/lib/saas/managementPageGuards';
import {
  assignPlanAction,
  cancelSubscriptionAction,
  changeSubscriptionStatusAction,
  extendSubscriptionPeriodAction,
  markPastDueAction,
  setSeatLimitAction,
} from '../actions';

export default async function SuperAdminSubscriptionsPage() {
  await requireSuperAdminPageSession();
  const [subscriptions, orgs, plans] = await Promise.all([
    listSuperAdminSubscriptions(),
    listSuperAdminOrgs(),
    listSuperAdminPlans(),
  ]);

  return (
    <PageShell title="Subscriptions" description="Manage organization subscriptions, plans, and statuses." nav={<AdminTabs items={superAdminTabs} />}>
      <Section title="Assign Plan to Organization">
        <form action={assignPlanAction} className="grid gap-3 lg:grid-cols-[1fr_1fr_100px_100px_100px_auto] lg:items-end">
          <Field label="Organization">
            <select className={inputClass} name="orgId" required>
              {orgs.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
            </select>
          </Field>
          <Field label="Plan">
            <select className={inputClass} name="planId" required>
              {plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} ({plan.code})</option>)}
            </select>
          </Field>
          <Field label="Seat Limit"><input className={inputClass} name="seatLimit" type="number" min="1" defaultValue="5" /></Field>
          <Field label="Cycle">
            <select className={inputClass} name="billingCycle" defaultValue="monthly">
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
              <option value="trial">Trial</option>
              <option value="manual">Manual</option>
            </select>
          </Field>
          <Field label="Status">
            <select className={inputClass} name="status" defaultValue="active">
              <option value="active">Active</option>
              <option value="trialing">Trialing</option>
              <option value="past_due">Past Due</option>
            </select>
          </Field>
          <button className={buttonClass} type="submit" disabled={orgs.length === 0 || plans.length === 0}>Assign</button>
        </form>
      </Section>

      <Section title="All Subscriptions">
        {subscriptions.length === 0 ? (
          <EmptyState title="No subscriptions">Assign a plan to an organization above.</EmptyState>
        ) : (
          <TableWrap>
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>Organization</th>
                  <th className={thClass}>Plan</th>
                  <th className={thClass}>Status</th>
                  <th className={thClass}>Seats</th>
                  <th className={thClass}>Period End</th>
                  <th className={thClass}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-background">
                {subscriptions.map((subscription) => (
                  <tr key={subscription.id}>
                    <td className={tdClass}>
                      <div className="font-semibold text-text-primary">{subscription.org_name ?? subscription.org_id}</div>
                      <div className="font-mono text-[11px] text-text-muted">{subscription.org_id}</div>
                    </td>
                    <td className={tdClass}>{subscription.plan_name ?? subscription.plan_id}</td>
                    <td className={tdClass}><StatusBadge status={subscription.status} /></td>
                    <td className={tdClass}>
                      <form action={setSeatLimitAction} className="flex items-center gap-2">
                        <input type="hidden" name="subscriptionId" value={subscription.id} />
                        <input className={`${inputClass} w-24`} name="seatLimit" type="number" min="1" defaultValue={subscription.seat_limit} />
                        <button className={secondaryButtonClass} type="submit">Set</button>
                      </form>
                    </td>
                    <td className={tdClass}>
                      <div className="mb-2">{subscription.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString('en-IN') : 'Not set'}</div>
                      <form action={extendSubscriptionPeriodAction} className="flex items-center gap-2">
                        <input type="hidden" name="subscriptionId" value={subscription.id} />
                        <input className={`${inputClass} w-20 px-2 py-1 text-xs`} name="days" type="number" min="1" defaultValue="30" title="Days to extend" />
                        <button className={`${secondaryButtonClass} px-2 py-1 text-xs`} type="submit">+ Days</button>
                      </form>
                    </td>
                    <td className={tdClass}>
                      <div className="flex flex-wrap gap-2">
                        {subscription.status !== 'active' && subscription.status !== 'cancelled' && (
                          <form action={changeSubscriptionStatusAction}>
                            <input type="hidden" name="subscriptionId" value={subscription.id} />
                            <input type="hidden" name="status" value="active" />
                            <button className={buttonClass} type="submit">Activate</button>
                          </form>
                        )}
                        {subscription.status !== 'past_due' && subscription.status !== 'cancelled' && (
                          <form action={markPastDueAction}>
                            <input type="hidden" name="subscriptionId" value={subscription.id} />
                            <button className={secondaryButtonClass} type="submit">Mark Past Due</button>
                          </form>
                        )}
                        {subscription.status !== 'expired' && subscription.status !== 'cancelled' && (
                          <form action={changeSubscriptionStatusAction}>
                            <input type="hidden" name="subscriptionId" value={subscription.id} />
                            <input type="hidden" name="status" value="expired" />
                            <button className={dangerButtonClass} type="submit">Expire</button>
                          </form>
                        )}
                        {subscription.status !== 'cancelled' && (
                          <form action={cancelSubscriptionAction}>
                            <input type="hidden" name="subscriptionId" value={subscription.id} />
                            <button className={dangerButtonClass} type="submit">Cancel</button>
                          </form>
                        )}
                      </div>
                    </td>
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
