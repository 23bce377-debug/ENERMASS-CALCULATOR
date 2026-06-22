import {
  AdminTabs,
  EmptyState,
  PageShell,
  Section,
  StatusBadge,
  TableWrap,
  dangerButtonClass,
  orgAdminTabs,
  tableClass,
  tdClass,
  thClass,
} from '@/components/saas/ManagementUi';
import { listOrgDevices } from '@/lib/saas';
import { requireOrgAdminPageSession } from '@/lib/saas/managementPageGuards';
import Link from 'next/link';
import { revokeOrgDeviceAction } from '../saasActions';

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default async function DevicesSettingsPage() {
  const session = await requireOrgAdminPageSession();
  const devices = await listOrgDevices(session.orgId);

  const activeDevices = devices.filter(d => d.status === 'active');
  const revokedDevices = devices.filter(d => d.status !== 'active');

  return (
    <PageShell
      title="Device Management"
      description={`Monitor and manage all registered devices for your organization. ${activeDevices.length} active device${activeDevices.length !== 1 ? 's' : ''}.`}
      nav={<AdminTabs items={orgAdminTabs} />}
    >
      {/* Active Devices */}
      <Section
        title="Active Devices"
        aside={
          <span className="text-xs font-semibold text-text-muted">
            {activeDevices.length} active
          </span>
        }
      >
        {activeDevices.length === 0 ? (
          <EmptyState title="No active devices">
            No devices are currently active in your organization.
          </EmptyState>
        ) : (
          <TableWrap>
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>Device</th>
                  <th className={thClass}>User</th>
                  <th className={thClass}>First Seen</th>
                  <th className={thClass}>Last Active</th>
                  <th className={thClass}>Status</th>
                  <th className={thClass}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-background">
                {activeDevices.map((device) => (
                  <tr key={device.id} className="hover:bg-surface-hover/30 transition-colors">
                    <td className={tdClass}>
                      <div className="font-semibold text-text-primary text-sm">
                        {device.device_name ?? 'Unnamed Device'}
                      </div>
                      <div className="text-[10px] text-text-muted">
                        {device.browser ?? 'Unknown browser'} · {device.os ?? 'Unknown OS'}
                      </div>
                    </td>
                    <td className={tdClass}>
                      <div className="text-sm text-text-primary">{device.user_name ?? '—'}</div>
                      <div className="text-[10px] text-text-muted font-mono">{device.user_email ?? device.user_id}</div>
                    </td>
                    <td className={`${tdClass} text-xs text-text-muted whitespace-nowrap`}>
                      {formatDate(device.first_seen_at)}
                    </td>
                    <td className={`${tdClass} text-xs text-text-muted whitespace-nowrap`}>
                      {formatDate(device.last_seen_at)}
                    </td>
                    <td className={tdClass}>
                      <StatusBadge status={device.status} />
                    </td>
                    <td className={tdClass}>
                      <form action={revokeOrgDeviceAction}>
                        <input type="hidden" name="deviceId" value={device.id} />
                        <button
                          className={dangerButtonClass}
                          type="submit"
                          title="Revoke this device — the user will need to request a device reset"
                        >
                          Revoke
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Section>

      {/* Revoked Devices (collapsible context) */}
      {revokedDevices.length > 0 && (
        <Section
          title={`Revoked Devices (${revokedDevices.length})`}
          aside={<span className="text-xs text-text-muted">Historical — read only</span>}
        >
          <TableWrap>
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>Device</th>
                  <th className={thClass}>User</th>
                  <th className={thClass}>Revoked At</th>
                  <th className={thClass}>Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-background">
                {revokedDevices.map((device) => (
                  <tr key={device.id} className="opacity-60">
                    <td className={tdClass}>
                      <div className="font-medium text-text-primary text-sm">
                        {device.device_name ?? 'Unnamed Device'}
                      </div>
                      <div className="text-[10px] text-text-muted">
                        {device.browser ?? 'Unknown'} · {device.os ?? 'Unknown'}
                      </div>
                    </td>
                    <td className={tdClass}>
                      <div className="text-sm text-text-primary">{device.user_name ?? '—'}</div>
                      <div className="text-[10px] text-text-muted font-mono">{device.user_email ?? device.user_id}</div>
                    </td>
                    <td className={`${tdClass} text-xs text-text-muted whitespace-nowrap`}>
                      {formatDate(device.revoked_at)}
                    </td>
                    <td className={tdClass}>
                      <StatusBadge status={device.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Section>
      )}

      {/* Guidance */}
      <Section title="Device Reset Requests">
        <p className="text-sm text-text-secondary leading-relaxed">
          If a user&apos;s device has been revoked or they need to switch devices,
          they can submit a <strong>Device Reset Request</strong> from the{' '}
          <Link href="/device-reset-request" className="text-accent underline hover:text-accent/80 transition-colors">
            Device Reset page
          </Link>
          . Super admins can then approve or reject those requests from the Super Admin dashboard.
        </p>
      </Section>
    </PageShell>
  );
}
