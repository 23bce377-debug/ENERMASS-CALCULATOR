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
  superAdminTabs,
  tableClass,
  tdClass,
  thClass,
} from '@/components/saas/ManagementUi';
import { listSuperAdminOrgs } from '@/lib/saas/services/managementService';
import { requireSuperAdminPageSession } from '@/lib/saas/managementPageGuards';
import { createOrgAction } from '../actions';
import Link from 'next/link';
import { Settings } from 'lucide-react';

export default async function SuperAdminOrgsPage() {
  await requireSuperAdminPageSession();
  const orgs = await listSuperAdminOrgs();

  return (
    <PageShell title="Organizations" description="Create tenant organizations and review subscription health." nav={<AdminTabs items={superAdminTabs} />}>
      <Section title="Create Organization">
        <form action={createOrgAction} className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <Field label="Organization Name">
            <input className={inputClass} name="name" required placeholder="Company name" />
          </Field>
          <Field label="Billing Email">
            <input className={inputClass} name="email" type="email" placeholder="billing@company.com" />
          </Field>
          <button className={buttonClass} type="submit">Create Org</button>
        </form>
      </Section>

      <Section title="All Organizations">
        {orgs.length === 0 ? (
          <EmptyState title="No organizations found">Create an organization to begin assigning SaaS plans.</EmptyState>
        ) : (
          <TableWrap>
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>Organization</th>
                  <th className={thClass}>Subscription</th>
                  <th className={thClass}>Plan</th>
                  <th className={thClass}>Seat Limit</th>
                  <th className={thClass}>Created</th>
                  <th className={thClass}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-background">
                {orgs.map((org) => (
                  <tr key={org.id}>
                    <td className={tdClass}>
                      <div className="font-semibold text-text-primary">{org.name}</div>
                      <div className="font-mono text-[11px] text-text-muted">{org.id}</div>
                    </td>
                    <td className={tdClass}><StatusBadge status={org.subscription_status ?? 'missing'} /></td>
                    <td className={tdClass}>{org.plan_name ?? 'No plan'}</td>
                    <td className={tdClass}>{org.seat_limit ?? 'Not set'}</td>
                    <td className={tdClass}>{new Date(org.created_at).toLocaleDateString('en-IN')}</td>
                    <td className={tdClass}>
                      <Link
                        href={`/super-admin/orgs/${org.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-surface-2 hover:bg-surface-hover border border-border text-text-primary transition-colors"
                      >
                        <Settings size={14} />
                        Manage
                      </Link>
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
