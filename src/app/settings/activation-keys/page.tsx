import {
  AdminTabs,
  EmptyState,
  Metric,
  MetricGrid,
  PageShell,
  Section,
  StatusBadge,
  TableWrap,
  formatDateTime,
  orgAdminTabs,
  tableClass,
  tdClass,
  thClass,
} from '@/components/saas/ManagementUi';
import { listOrgActivationKeys, countOrgActivationKeys } from '@/lib/saas/services/activationKeyService';
import { requireOrgAdminPageSession } from '@/lib/saas/managementPageGuards';

export default async function OrgActivationKeysPage() {
  const session = await requireOrgAdminPageSession(['owner', 'admin']);
  const orgId = session.orgId;

  const [keys, counts] = await Promise.all([
    listOrgActivationKeys(orgId),
    countOrgActivationKeys(orgId),
  ]);

  return (
    <PageShell
      title="Activation Keys"
      description="Monitor your organisation's activation keys. Contact Pitbull Corporations to request more keys."
      nav={<AdminTabs items={orgAdminTabs} />}
    >
      <MetricGrid>
        <Metric label="Total Keys" value={counts.total} />
        <Metric label="Available" value={counts.unused} detail="Ready to activate" />
        <Metric label="In Use" value={counts.activated} detail="Active accounts" />
        <Metric label="Revoked" value={counts.revoked} detail="Cancelled by admin" />
      </MetricGrid>

      <Section title="Your Activation Keys">
        <div className="mb-4 p-3 rounded-xl bg-surface-hover border border-border/60">
          <p className="text-xs text-text-muted">
            <span className="text-accent font-bold">ℹ</span> Keys are shown in masked format for security. Only your Pitbull Corporations administrator can generate or revoke keys.
            To purchase additional keys, contact{' '}
            <a href="mailto:hrushibhanvadiya@gmail.com" className="text-accent hover:underline">
              hrushibhanvadiya@gmail.com
            </a>.
          </p>
        </div>

        {keys.length === 0 ? (
          <EmptyState title="No activation keys for your organisation">
            Contact Pitbull Corporations to get activation keys assigned.
          </EmptyState>
        ) : (
          <TableWrap>
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>Key</th>
                  <th className={thClass}>Status</th>
                  <th className={thClass}>Activated By</th>
                  <th className={thClass}>Activated At</th>
                  <th className={thClass}>Expires</th>
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
                    <td className={tdClass}><StatusBadge status={key.status} /></td>
                    <td className={tdClass}>
                      <div className="text-xs">
                        <div className="text-text-primary">{key.activated_by_name ?? '—'}</div>
                        <div className="text-text-muted">{key.activated_by_email ?? ''}</div>
                      </div>
                    </td>
                    <td className={tdClass}>{formatDateTime(key.activated_at)}</td>
                    <td className={tdClass}>{formatDateTime(key.expires_at)}</td>
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
