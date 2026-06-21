import {
  AdminTabs,
  EmptyState,
  Field,
  PageShell,
  Section,
  StatusBadge,
  TableWrap,
  buttonClass,
  inputClass,
  secondaryButtonClass,
  superAdminTabs,
  tableClass,
  tdClass,
  thClass,
} from '@/components/saas/ManagementUi';
import { listSuperAdminPlans } from '@/lib/saas';
import { requireSuperAdminPageSession } from '@/lib/saas/managementPageGuards';
import { createPlanAction, updatePlanFeaturesAction } from '../actions';

function prettyJson(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}

export default async function SuperAdminPlansPage() {
  await requireSuperAdminPageSession();
  const plans = await listSuperAdminPlans();

  return (
    <PageShell title="Plans" description="Create SaaS plans and manage feature entitlements." nav={<AdminTabs items={superAdminTabs} />}>
      <Section title="Create Plan">
        <form action={createPlanAction} className="grid gap-3 lg:grid-cols-6 lg:items-end">
          <Field label="Name"><input className={inputClass} name="name" required placeholder="Pro" /></Field>
          <Field label="Code"><input className={inputClass} name="code" required placeholder="pro" /></Field>
          <Field label="Monthly"><input className={inputClass} name="monthlyPrice" type="number" min="0" defaultValue="0" /></Field>
          <Field label="Yearly"><input className={inputClass} name="yearlyPrice" type="number" min="0" defaultValue="0" /></Field>
          <Field label="Seats"><input className={inputClass} name="seatLimit" type="number" min="1" defaultValue="1" /></Field>
          <button className={buttonClass} type="submit">Create</button>
          <div className="lg:col-span-6">
            <Field label="Features JSON">
              <textarea className={inputClass} name="features" rows={4} defaultValue={'{"calculator":true,"inventory":false,"erp":false}'} />
            </Field>
          </div>
        </form>
      </Section>

      <Section title="Plan Feature Matrix">
        {plans.length === 0 ? (
          <EmptyState title="No plans found">Create a plan before assigning subscriptions.</EmptyState>
        ) : (
          <TableWrap>
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>Plan</th>
                  <th className={thClass}>Seats</th>
                  <th className={thClass}>Status</th>
                  <th className={thClass}>Features</th>
                  <th className={thClass}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-background">
                {plans.map((plan) => (
                  <tr key={plan.id}>
                    <td className={tdClass}>
                      <div className="font-semibold text-text-primary">{plan.name}</div>
                      <div className="font-mono text-[11px] text-text-muted">{plan.code}</div>
                    </td>
                    <td className={tdClass}>{plan.seat_limit}</td>
                    <td className={tdClass}><StatusBadge status={plan.is_active ? 'active' : 'inactive'} /></td>
                    <td className={tdClass}>
                      <form action={updatePlanFeaturesAction} className="space-y-2">
                        <input type="hidden" name="planId" value={plan.id} />
                        <textarea className={`${inputClass} font-mono text-xs`} name="features" rows={5} defaultValue={prettyJson(plan.features)} />
                        <select className={`${inputClass} max-w-40`} name="isActive" defaultValue={String(plan.is_active)}>
                          <option value="true">active</option>
                          <option value="false">inactive</option>
                        </select>
                        <button className={secondaryButtonClass} type="submit">Update Features</button>
                      </form>
                    </td>
                    <td className={tdClass}>Feature gates read this JSON exactly.</td>
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
