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
import { getSuperAdminOrgDashboard } from '@/lib/saas/services/managementService';
import { requireSuperAdminPageSession } from '@/lib/saas/managementPageGuards';
import { GenerateKeysModal } from '@/components/saas/GenerateKeysModal';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { notFound } from 'next/navigation';

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export default async function SuperAdminOrgDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSuperAdminPageSession();
  
  const resolvedParams = await params;
  const orgId = resolvedParams.id;

  if (!isUuid(orgId)) {
    notFound();
  }

  const { overview, members, devices, activationKeys: keys } = await getSuperAdminOrgDashboard(orgId);

  if (!overview.org) {
    notFound();
  }

  const deviceMap = new Map<string, (typeof devices)[number]>();
  for (const device of devices) {
    const existing = deviceMap.get(device.user_id);
    if (!existing || (existing.status !== 'active' && device.status === 'active')) {
      deviceMap.set(device.user_id, device);
    }
  }

  const keyMap = new Map<string, (typeof keys)[number]>();
  for (const key of keys) {
    if (key.activated_by && !keyMap.has(key.activated_by)) {
      keyMap.set(key.activated_by, key);
    }
  }

  return (
      <PageShell
        title={`Organization: ${overview.org.name}`}
        description={`Manage members, devices, and activation keys for this tenant. ID: ${orgId}`}
        nav={
          <div className="flex items-center justify-between mb-4">
            <AdminTabs items={superAdminTabs} />
            <Link
              href="/super-admin/orgs"
              className="inline-flex items-center gap-2 text-sm font-medium text-text-muted hover:text-text-primary transition-colors"
            >
              <ArrowLeft size={16} />
              Back to Organizations
            </Link>
          </div>
        }
      >
        {/* Actions & Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <Section title="Subscription Overview">
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-text-muted">Status</span>
                <StatusBadge status={overview.subscription?.status ?? 'missing'} />
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Plan</span>
                <span className="font-semibold text-text-primary">{overview.plan?.name ?? 'None'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Seat Usage</span>
                <span className="font-semibold text-text-primary">
                  {overview.seatUsage.usedSeats} / {overview.seatUsage.seatLimit || '—'}
                </span>
              </div>
            </div>
          </Section>

          <Section title="Activation Keys Management">
            <p className="text-sm text-text-muted mb-4">
              Generate new one-time activation keys for this organization. 
              The raw keys will only be shown once and must be shared securely.
            </p>
            <div className="flex justify-start">
              <GenerateKeysModal orgId={overview.org.id} orgName={overview.org.name} />
            </div>
          </Section>
        </div>

        {/* Members & Devices */}
        <Section title="Members & Devices">
          {members.length === 0 ? (
            <EmptyState title="No members found">This organization currently has no registered members.</EmptyState>
          ) : (
            <TableWrap>
              <table className={tableClass}>
                <thead>
                  <tr>
                    <th className={thClass}>Member</th>
                    <th className={thClass}>Role</th>
                    <th className={thClass}>Device Name</th>
                    <th className={thClass}>Used Key Prefix</th>
                    <th className={thClass}>Joined Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-background">
                  {members.map(member => {
                    const device = deviceMap.get(member.user_id);
                    const key = keyMap.get(member.user_id);

                    return (
                      <tr key={member.id}>
                        <td className={tdClass}>
                          <div className="font-semibold text-text-primary">{member.full_name ?? '—'}</div>
                          <div className="text-[11px] text-text-muted">{member.email ?? '—'}</div>
                        </td>
                        <td className={tdClass}>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-surface-2 text-text-secondary border border-border">
                            {member.role}
                          </span>
                        </td>
                        <td className={tdClass}>
                          {device ? (
                            <div>
                              <div className="text-sm text-text-primary">{device.device_name}</div>
                              <div className="text-[10px] text-text-muted">{device.browser ?? 'Unknown Browser'} / {device.os ?? 'Unknown OS'}</div>
                            </div>
                          ) : (
                            <span className="text-text-muted italic text-xs">No Device</span>
                          )}
                        </td>
                        <td className={tdClass}>
                          {key ? (
                            <code className="font-mono text-[10px] text-accent bg-accent/10 px-2 py-1 rounded-md">
                              {key.key_prefix}-****
                            </code>
                          ) : (
                            <span className="text-text-muted italic text-xs">—</span>
                          )}
                        </td>
                        <td className={tdClass}>{new Date(member.created_at).toLocaleDateString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableWrap>
          )}
        </Section>
        
        {/* Keys List */}
        <Section title="Activation Keys Log">
          {keys.length === 0 ? (
            <EmptyState title="No keys generated">Generate keys to allow users to register.</EmptyState>
          ) : (
            <TableWrap>
              <table className={tableClass}>
                <thead>
                  <tr>
                    <th className={thClass}>Key Prefix</th>
                    <th className={thClass}>Status</th>
                    <th className={thClass}>Activated By</th>
                    <th className={thClass}>Activated At</th>
                    <th className={thClass}>Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-background">
                  {keys.map(key => (
                    <tr key={key.id}>
                      <td className={tdClass}>
                        <code className="font-mono text-xs text-text-primary bg-surface-2 px-2 py-1 rounded-md border border-border">
                          {key.key_prefix}-****
                        </code>
                      </td>
                      <td className={tdClass}><StatusBadge status={key.status} /></td>
                      <td className={tdClass}>
                        {key.activated_by_name ? (
                          <div className="text-sm">{key.activated_by_name}</div>
                        ) : (
                          <span className="text-text-muted text-xs">—</span>
                        )}
                      </td>
                      <td className={tdClass}>{formatDateTime(key.activated_at)}</td>
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
