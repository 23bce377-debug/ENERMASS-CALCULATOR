import {
  AdminTabs,
  EmptyState,
  PageShell,
  Section,
  TableWrap,
  tableClass,
  tdClass,
  thClass,
  orgAdminTabs,
} from '@/components/saas/ManagementUi';
import { listLicenseEventsByOrg } from '@/lib/saas';
import { requireOrgAdminPageSession } from '@/lib/saas/managementPageGuards';

// Human-readable labels for event types
const EVENT_LABELS: Record<string, { label: string; colour: string }> = {
  subscription_created:   { label: 'Subscription Created',    colour: 'text-green-400' },
  subscription_updated:   { label: 'Subscription Updated',    colour: 'text-blue-400' },
  subscription_expired:   { label: 'Subscription Expired',    colour: 'text-red-400' },
  payment_recorded:       { label: 'Payment Recorded',        colour: 'text-green-400' },
  role_changed:           { label: 'Role Changed',            colour: 'text-amber-400' },
  seat_limit_reached:     { label: 'Seat Limit Reached',      colour: 'text-red-400' },
  user_invited:           { label: 'User Invited',            colour: 'text-blue-400' },
  user_disabled:          { label: 'User Disabled',           colour: 'text-red-400' },
  device_registered:      { label: 'Device Registered',       colour: 'text-green-400' },
  device_login_verified:  { label: 'Login Verified',          colour: 'text-green-400' },
  device_login_blocked:   { label: 'Login Blocked',           colour: 'text-red-400' },
  device_mismatch_blocked:{ label: 'Device Mismatch',         colour: 'text-red-400' },
  device_reset_requested: { label: 'Device Reset Requested',  colour: 'text-amber-400' },
  device_reset_approved:  { label: 'Device Reset Approved',   colour: 'text-green-400' },
  device_reset_rejected:  { label: 'Device Reset Rejected',   colour: 'text-red-400' },
  feature_access_denied:  { label: 'Feature Access Denied',   colour: 'text-red-400' },
  org_id_spoofed:         { label: '⚠ Org ID Spoofed',        colour: 'text-red-500 font-bold' },
  cross_org_attempt:      { label: '⚠ Cross-Org Attempt',     colour: 'text-red-500 font-bold' },
  invalid_device_session: { label: 'Invalid Device Session',  colour: 'text-amber-400' },
  expired_device_session: { label: 'Expired Device Session',  colour: 'text-amber-400' },
  revoked_device_attempt: { label: 'Revoked Device Attempt',  colour: 'text-red-400' },
  invalid_challenge:      { label: 'Invalid Challenge',       colour: 'text-amber-400' },
  replayed_challenge:     { label: 'Replayed Challenge',      colour: 'text-red-500' },
};

function formatTimestamp(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function truncateId(id: string | null | undefined) {
  if (!id) return null;
  return `${id.slice(0, 8)}…`;
}

export default async function AuditLogPage() {
  const session = await requireOrgAdminPageSession();
  // Fetch last 200 events — sufficient for org admin view
  const events = await listLicenseEventsByOrg(session.orgId, 200);

  return (
    <PageShell
      title="Audit Log"
      description={`Security and license events for your organization. Showing ${events.length} most recent events.`}
      nav={<AdminTabs items={orgAdminTabs} />}
    >
      <Section title="Recent Events">
        {events.length === 0 ? (
          <EmptyState title="No events found">There are no audit events for this organization yet.</EmptyState>
        ) : (
          <TableWrap>
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>Time</th>
                  <th className={thClass}>Event</th>
                  <th className={thClass}>Entity</th>
                  <th className={thClass}>Actor</th>
                  <th className={thClass}>IP</th>
                  <th className={thClass}>Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-background">
                {events.map((event) => {
                  const meta = EVENT_LABELS[event.event_type] ?? { label: event.event_type, colour: 'text-text-muted' };
                  const details = event.event_data ? JSON.stringify(event.event_data, null, 2) : null;
                  return (
                    <tr key={event.id} className="hover:bg-surface-hover/30 transition-colors">
                      <td className={`${tdClass} whitespace-nowrap text-xs text-text-muted`}>
                        {formatTimestamp(event.created_at)}
                      </td>
                      <td className={tdClass}>
                        <span className={`text-xs font-semibold ${meta.colour}`}>
                          {meta.label}
                        </span>
                      </td>
                      <td className={`${tdClass} text-xs text-text-muted`}>
                        <div className="font-medium">{event.entity_type}</div>
                        {event.entity_id && (
                          <div
                            className="font-mono text-[10px] text-text-muted/60"
                            title={event.entity_id}
                          >
                            {truncateId(event.entity_id)}
                          </div>
                        )}
                      </td>
                      <td className={`${tdClass} text-xs text-text-muted`}>
                        {event.actor_user_id ? (
                          <div
                            className="font-mono text-[10px]"
                            title={event.actor_user_id}
                          >
                            {truncateId(event.actor_user_id)}
                          </div>
                        ) : (
                          <span className="text-text-muted/50">System</span>
                        )}
                        {event.actor_role && (
                          <div className="text-[10px] text-text-muted/50">({event.actor_role})</div>
                        )}
                      </td>
                      <td className={`${tdClass} text-xs font-mono text-text-muted`}>
                        {event.ip_address ? String(event.ip_address) : '—'}
                      </td>
                      <td className={tdClass}>
                        {details ? (
                          <details className="cursor-pointer">
                            <summary className="text-[10px] text-text-muted hover:text-accent transition-colors select-none">
                              View details
                            </summary>
                            <pre className="mt-1 text-[10px] text-text-muted whitespace-pre-wrap max-w-xs overflow-hidden bg-surface-hover p-2 rounded border border-border">
                              {details}
                            </pre>
                          </details>
                        ) : (
                          <span className="text-[10px] text-text-muted/40">—</span>
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
