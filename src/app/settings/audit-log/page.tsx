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

export default async function AuditLogPage() {
  const session = await requireOrgAdminPageSession();
  const events = await listLicenseEventsByOrg(session.orgId);

  return (
    <PageShell
      title="Audit Log"
      description="View security and license events for your organization."
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
                  <th className={thClass}>IP Address</th>
                  <th className={thClass}>Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-background">
                {events.map((event) => (
                  <tr key={event.id}>
                    <td className={`${tdClass} whitespace-nowrap text-xs text-text-muted`}>
                      {new Date(event.created_at).toLocaleString()}
                    </td>
                    <td className={tdClass}>
                      <span className="font-mono text-xs font-semibold text-text-primary">
                        {event.event_type}
                      </span>
                    </td>
                    <td className={`${tdClass} text-xs text-text-muted`}>
                      <div>{event.entity_type}</div>
                      {event.entity_id && (
                        <div className="font-mono text-[10px] truncate max-w-[120px]" title={event.entity_id}>
                          {event.entity_id}
                        </div>
                      )}
                    </td>
                    <td className={`${tdClass} text-xs text-text-muted`}>
                      {event.actor_user_id ? (
                        <div className="font-mono text-[10px] truncate max-w-[120px]" title={event.actor_user_id}>
                          {event.actor_user_id}
                        </div>
                      ) : (
                        'System'
                      )}
                      {event.actor_role && <div>({event.actor_role})</div>}
                    </td>
                    <td className={`${tdClass} text-xs text-text-muted font-mono`}>
                      {String(event.ip_address ?? '-')}
                    </td>
                    <td className={tdClass}>
                      <pre className="text-[10px] text-text-muted whitespace-pre-wrap max-w-sm overflow-hidden bg-background-alt p-2 rounded border border-border">
                        {JSON.stringify(event.event_data, null, 2)}
                      </pre>
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
