import {
  AdminTabs,
  EmptyState,
  PageShell,
  Section,
  TableWrap,
  tableClass,
  tdClass,
  thClass,
  superAdminTabs,
} from '@/components/saas/ManagementUi';
import { listAllLicenseEventsAsSuperAdmin } from '@/lib/saas/services/licenseAuditService';
import { requireSuperAdminPageSession } from '@/lib/saas/managementPageGuards';

export default async function SuperAdminAuditLogPage() {
  await requireSuperAdminPageSession();
  const events = await listAllLicenseEventsAsSuperAdmin();

  return (
    <PageShell
      title="Global Audit Log"
      description="View all security and license events across the platform."
      nav={<AdminTabs items={superAdminTabs} />}
    >
      <Section title="Recent Events">
        {events.length === 0 ? (
          <EmptyState title="No events found">The system audit log is empty.</EmptyState>
        ) : (
          <TableWrap>
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>Time</th>
                  <th className={thClass}>Org ID</th>
                  <th className={thClass}>Event</th>
                  <th className={thClass}>Actor</th>
                  <th className={thClass}>Entity ID</th>
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
                    <td className={`${tdClass} font-mono text-[10px] truncate max-w-[100px] text-text-muted`}>
                      {event.org_id ?? 'System'}
                    </td>
                    <td className={tdClass}>
                      <span className="font-mono text-xs font-semibold text-text-primary">
                        {event.event_type}
                      </span>
                    </td>
                    <td className={`${tdClass} text-xs text-text-muted`}>
                      {event.actor_user_id ? (
                        <div className="font-mono text-[10px] truncate max-w-[100px]" title={event.actor_user_id}>
                          {event.actor_user_id}
                        </div>
                      ) : (
                        'System'
                      )}
                    </td>
                    <td className={`${tdClass} font-mono text-[10px] truncate max-w-[100px] text-text-muted`}>
                      {event.entity_id ?? '-'}
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
