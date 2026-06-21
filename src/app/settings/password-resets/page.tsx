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
import { listPasswordResetRequests } from '@/lib/saas/services/passwordResetService';
import { requireOrgAdminPageSession } from '@/lib/saas/managementPageGuards';
import { PasswordResetActions } from '@/components/saas/PasswordResetActions';

export default async function OrgPasswordResetsPage() {
  const session = await requireOrgAdminPageSession(['owner', 'admin']);
  const requests = await listPasswordResetRequests(session.orgId);

  const pending = requests.filter(r => r.status === 'pending_admin_approval');

  return (
    <PageShell
      title="Password Resets"
      description="Review and approve password reset requests from your team members."
      nav={<AdminTabs items={orgAdminTabs} />}
    >
      {pending.length > 0 && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <p className="text-sm font-semibold text-amber-300">
            ⚠ {pending.length} pending password reset request{pending.length > 1 ? 's' : ''} require{pending.length === 1 ? 's' : ''} your approval.
          </p>
        </div>
      )}

      <Section title="Password Reset Requests">
        {requests.length === 0 ? (
          <EmptyState title="No password reset requests">
            When team members request a password reset, they will appear here for your review.
          </EmptyState>
        ) : (
          <TableWrap>
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>User</th>
                  <th className={thClass}>Status</th>
                  <th className={thClass}>Requested</th>
                  <th className={thClass}>Expires</th>
                  <th className={thClass}>Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-background">
                {requests.map(req => (
                  <tr key={req.id}>
                    <td className={tdClass}>
                      <div className="font-semibold text-text-primary text-sm">{req.user_name ?? 'Unknown'}</div>
                      <div className="text-text-muted text-xs">{req.user_email ?? req.user_id}</div>
                    </td>
                    <td className={tdClass}><StatusBadge status={req.status.replace('pending_admin_approval', 'pending')} /></td>
                    <td className={tdClass}>{formatDateTime(req.requested_at)}</td>
                    <td className={tdClass}>{formatDateTime(req.expires_at)}</td>
                    <td className={tdClass}>
                      {req.status === 'pending_admin_approval' ? (
                        <PasswordResetActions request={{
                          id: req.id,
                          user_email: req.user_email ?? null,
                          user_name: req.user_name ?? null,
                          status: req.status,
                          requested_at: req.requested_at,
                          expires_at: req.expires_at,
                        }} />
                      ) : (
                        <span className="text-xs text-text-muted capitalize">{req.status.replaceAll('_', ' ')}</span>
                      )}
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
