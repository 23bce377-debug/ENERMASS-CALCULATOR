import {
  AdminTabs,
  EmptyState,
  PageShell,
  Section,
  StatusBadge,
  TableWrap,
  buttonClass,
  dangerButtonClass,
  formatDateTime,
  superAdminTabs,
  tableClass,
  tdClass,
  thClass,
} from '@/components/saas/ManagementUi';
import { listSuperAdminDeviceResets } from '@/lib/saas';
import { requireSuperAdminPageSession } from '@/lib/saas/managementPageGuards';
import { approveDeviceResetAsSuperAdminAction, rejectDeviceResetAsSuperAdminAction } from '../actions';
import { Check, X } from 'lucide-react';

function infoSummary(info: unknown) {
  if (!info || typeof info !== 'object' || Array.isArray(info)) return 'No device details';
  const record = info as Record<string, unknown>;
  const deviceName = typeof record.deviceName === 'string' ? record.deviceName : 'Unnamed device';
  const browser = typeof record.browser === 'string' ? record.browser : 'Unknown browser';
  const os = typeof record.os === 'string' ? record.os : 'Unknown OS';
  return `${deviceName} · ${browser} · ${os}`;
}

export default async function SuperAdminDeviceResetsPage() {
  await requireSuperAdminPageSession();
  const resets = await listSuperAdminDeviceResets();

  return (
    <PageShell title="Device Resets" description="Global audit view of device reset requests across organizations." nav={<AdminTabs items={superAdminTabs} />}>
      <Section title="All Device Reset Requests">
        {resets.length === 0 ? (
          <EmptyState title="No device reset requests">Requests across all organizations appear here.</EmptyState>
        ) : (
          <TableWrap>
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>Request</th>
                  <th className={thClass}>Organization</th>
                  <th className={thClass}>User</th>
                  <th className={thClass}>Device</th>
                  <th className={thClass}>Status</th>
                  <th className={thClass}>Requested</th>
                  <th className={thClass}>Reviewed</th>
                  <th className={thClass}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-background">
                {resets.map((reset) => {
                  const pending = reset.status === 'pending';

                  return (
                    <tr key={reset.id}>
                      <td className={`${tdClass} font-mono text-[11px]`}>{reset.id}</td>
                      <td className={tdClass}>
                        <div className="font-semibold text-text-primary">{reset.org_name ?? 'Unknown organization'}</div>
                        <div className="font-mono text-[10px] text-text-muted">{reset.org_id}</div>
                      </td>
                      <td className={tdClass}>
                        <div className="font-semibold text-text-primary">{reset.user_name ?? reset.user_email ?? 'Unknown user'}</div>
                        <div className="text-[11px] text-text-muted">{reset.user_email ?? reset.user_id}</div>
                      </td>
                      <td className={tdClass}>
                        <div className="text-sm text-text-primary">{infoSummary(reset.requested_device_info)}</div>
                        <div className="text-[10px] text-text-muted">Old: {reset.old_device_name ?? 'No previous device'}</div>
                      </td>
                      <td className={tdClass}><StatusBadge status={reset.status} /></td>
                      <td className={tdClass}>{formatDateTime(reset.requested_at)}</td>
                      <td className={tdClass}>{reset.reviewed_at ? formatDateTime(reset.reviewed_at) : 'Not reviewed'}</td>
                      <td className={tdClass}>
                        <div className="flex flex-wrap gap-2">
                          <form action={approveDeviceResetAsSuperAdminAction}>
                            <input type="hidden" name="requestId" value={reset.id} />
                            <input type="hidden" name="orgId" value={reset.org_id} />
                            <button className={`${buttonClass} gap-1.5`} type="submit" disabled={!pending}>
                              <Check size={14} />
                              Approve
                            </button>
                          </form>
                          <form action={rejectDeviceResetAsSuperAdminAction}>
                            <input type="hidden" name="requestId" value={reset.id} />
                            <input type="hidden" name="orgId" value={reset.org_id} />
                            <button className={`${dangerButtonClass} gap-1.5`} type="submit" disabled={!pending}>
                              <X size={14} />
                              Reject
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Section>
    </PageShell>
  );
}
