import {
  AdminTabs,
  EmptyState,
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
import { listOrgDeviceResetRequests } from '@/lib/saas/services/managementService';
import { requireOrgAdminPageSession } from '@/lib/saas/managementPageGuards';
import { approveOrgDeviceResetAction, rejectOrgDeviceResetAction } from '../saasActions';

function infoValue(info: unknown, key: string) {
  if (!info || typeof info !== 'object' || Array.isArray(info)) return null;
  const value = (info as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : null;
}

export default async function DeviceResetRequestsPage() {
  const session = await requireOrgAdminPageSession();
  const requests = await listOrgDeviceResetRequests(session.orgId);

  return (
    <PageShell
      title="Device Reset Requests"
      description="View device reset requests from your team. Contact Pitbull Corporations super admin to approve resets."
      nav={<AdminTabs items={orgAdminTabs} />}
    >
      <div className="p-4 rounded-xl bg-surface-2 border border-border">
        <p className="text-sm text-text-secondary">
          <strong>Review Device Resets</strong> — Approving a request will revoke the user's old device binding and allow them to log in on their new device. Rejecting will keep the current binding.
        </p>
      </div>

      <Section title="Reset Queue">
        {requests.length === 0 ? (
          <EmptyState title="No device reset requests">Pending user requests appear here for visibility.</EmptyState>
        ) : (
          <TableWrap>
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>User</th>
                  <th className={thClass}>Requested Device</th>
                  <th className={thClass}>Old Device</th>
                  <th className={thClass}>Status</th>
                  <th className={thClass}>Requested</th>
                  <th className={thClass}>Review</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-background">
                {requests.map((request) => {
                  return (
                    <tr key={request.id}>
                      <td className={tdClass}>
                        <div className="font-semibold text-text-primary">{request.user_name ?? request.user_email ?? 'Unknown user'}</div>
                        <div className="font-mono text-[11px] text-text-muted">{request.user_email ?? request.user_id}</div>
                      </td>
                      <td className={tdClass}>
                        <div className="text-text-primary">{infoValue(request.requested_device_info, 'deviceName') ?? 'Unnamed device'}</div>
                        <div className="text-xs text-text-muted">
                          {infoValue(request.requested_device_info, 'browser') ?? 'Unknown browser'} ·{' '}
                          {infoValue(request.requested_device_info, 'os') ?? 'Unknown OS'}
                        </div>
                      </td>
                      <td className={tdClass}>{request.old_device_name ?? 'No old device'}</td>
                      <td className={tdClass}><StatusBadge status={request.status} /></td>
                      <td className={tdClass}>{formatDateTime(request.requested_at)}</td>
                      <td className={tdClass}>
                        {request.status === 'pending' ? (
                          <div className="flex items-center gap-2">
                            <form action={approveOrgDeviceResetAction}>
                              <input type="hidden" name="requestId" value={request.id} />
                              <button className="text-[11px] font-bold uppercase tracking-wider text-success hover:text-success/80 underline" type="submit">Approve</button>
                            </form>
                            <span className="text-text-muted">|</span>
                            <form action={rejectOrgDeviceResetAction}>
                              <input type="hidden" name="requestId" value={request.id} />
                              <button className="text-[11px] font-bold uppercase tracking-wider text-error hover:text-error/80 underline" type="submit">Reject</button>
                            </form>
                          </div>
                        ) : (
                          <span className="text-[11px] text-text-muted italic">Reviewed</span>
                        )}
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
