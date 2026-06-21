import {
  AdminTabs,
  EmptyState,
  PageShell,
  Section,
  StatusBadge,
  TableWrap,
  superAdminTabs,
  tableClass,
  tdClass,
  thClass,
  formatDateTime,
} from '@/components/saas/ManagementUi';
import { listAllActivationKeys, listSuperAdminOrgs } from '@/lib/saas';
import { requireSuperAdminPageSession } from '@/lib/saas/managementPageGuards';
import { GenerateKeysModal } from '@/components/saas/GenerateKeysModal';

export default async function SuperAdminActivationKeysPage() {
  await requireSuperAdminPageSession();

  const [keys, orgs] = await Promise.all([
    listAllActivationKeys(),
    listSuperAdminOrgs(),
  ]);

  const orgMap = new Map(orgs.map(o => [o.id, o.name]));

  const unused = keys.filter(k => k.status === 'unused').length;
  const activated = keys.filter(k => k.status === 'activated').length;
  const revoked = keys.filter(k => k.status === 'revoked').length;

  return (
    <PageShell
      title="Activation Keys"
      description="Generate, monitor, and revoke one-time activation keys for organisations."
      nav={<AdminTabs items={superAdminTabs} />}
    >
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Keys', value: keys.length, color: 'text-text-primary' },
          { label: 'Unused', value: unused, color: 'text-amber-400' },
          { label: 'Activated', value: activated, color: 'text-green-400' },
          { label: 'Revoked', value: revoked, color: 'text-error' },
        ].map(stat => (
          <div key={stat.label} className="rounded-lg border border-border bg-surface p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted">{stat.label}</div>
            <div className={`mt-2 text-2xl font-bold ${stat.color}`}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Generate Keys Per Org */}
      <Section title="Generate Keys by Organisation">
        {orgs.length === 0 ? (
          <EmptyState title="No organisations found">Create an organisation first.</EmptyState>
        ) : (
          <TableWrap>
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>Organisation</th>
                  <th className={thClass}>Subscription</th>
                  <th className={thClass}>Seats</th>
                  <th className={thClass}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-background">
                {orgs.map(org => (
                  <tr key={org.id}>
                    <td className={tdClass}>
                      <div className="font-semibold text-text-primary">{org.name}</div>
                      <div className="font-mono text-[10px] text-text-muted">{org.id}</div>
                    </td>
                    <td className={tdClass}>
                      <StatusBadge status={org.subscription_status} />
                    </td>
                    <td className={tdClass}>{org.seat_limit ?? '—'}</td>
                    <td className={tdClass}>
                      <GenerateKeysModal orgId={org.id} orgName={org.name} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Section>

      {/* All Keys */}
      <Section title="All Activation Keys">
        {keys.length === 0 ? (
          <EmptyState title="No activation keys generated yet">
            Use the &quot;Generate Keys&quot; button above to create keys for an organisation.
          </EmptyState>
        ) : (
          <TableWrap>
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>Key Prefix</th>
                  <th className={thClass}>Organisation</th>
                  <th className={thClass}>Status</th>
                  <th className={thClass}>Activated By</th>
                  <th className={thClass}>Activated At</th>
                  <th className={thClass}>Expires</th>
                  <th className={thClass}>Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-background">
                {keys.map(key => (
                  <tr key={key.id}>
                    <td className={tdClass}>
                      <code className="font-mono text-xs text-accent bg-accent/10 px-2 py-1 rounded-md">
                        {key.key_prefix}-****-****-****
                      </code>
                    </td>
                    <td className={tdClass}>{orgMap.get(key.org_id) ?? key.org_id}</td>
                    <td className={tdClass}><StatusBadge status={key.status} /></td>
                    <td className={tdClass}>
                      {key.activated_by_name || key.activated_by_email ? (
                        <div>
                          <div className="text-sm text-text-primary">{key.activated_by_name ?? 'Activated user'}</div>
                          <div className="text-[11px] text-text-muted">{key.activated_by_email ?? key.activated_by}</div>
                        </div>
                      ) : (
                        <span className="text-text-muted text-xs">—</span>
                      )}
                    </td>
                    <td className={tdClass}>{formatDateTime(key.activated_at)}</td>
                    <td className={tdClass}>{formatDateTime(key.expires_at)}</td>
                    <td className={tdClass}>{formatDateTime(key.created_at)}</td>
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
