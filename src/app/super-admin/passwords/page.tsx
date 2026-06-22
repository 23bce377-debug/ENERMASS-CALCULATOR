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
  inputClass,
} from '@/components/saas/ManagementUi';
import { listAllPasswordResetRequests } from '@/lib/saas/services/passwordResetService';
import { requireSuperAdminPageSession } from '@/lib/saas/managementPageGuards';
import { createAdminClient } from '@/lib/supabase/server';
import { userEmailsById } from '@/lib/saas/services/userDirectory';
import {
  approvePasswordResetAsSuperAdminAction,
  rejectPasswordResetAsSuperAdminAction,
  adminChangeUserPasswordAction,
  adminChangeUserRoleAction,
} from '../actions';
import { Check, X, KeyRound } from 'lucide-react';

export default async function SuperAdminPasswordsPage() {
  await requireSuperAdminPageSession();
  
  // 1. Fetch password reset requests
  const requests = await listAllPasswordResetRequests();

  // 2. Fetch all users/profiles for global password management
  const adminClient = createAdminClient();
  const { data: profiles, error: profilesError } = await (adminClient as any)
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (profilesError) {
    throw new Error(`Failed to load profiles: ${profilesError.message}`);
  }

  const { data: orgs } = await (adminClient as any)
    .from('organisations')
    .select('id, name');

  const orgMap = new Map<string, string>((orgs ?? []).map((o: any) => [o.id, o.name]));
  const userIds = (profiles ?? []).map((p: any) => p.id);
  const emailMap = await userEmailsById(userIds);

  return (
    <PageShell title="Passwords & Recoveries" description="Global view of password reset requests and direct password management." nav={<AdminTabs items={superAdminTabs} />}>
      {/* SECTION 1: Password Resets */}
      <Section title="All Password Reset Requests">
        {requests.length === 0 ? (
          <EmptyState title="No active password reset requests">Requests across all organizations appear here.</EmptyState>
        ) : (
          <TableWrap>
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>Request ID</th>
                  <th className={thClass}>Organization</th>
                  <th className={thClass}>User</th>
                  <th className={thClass}>Status</th>
                  <th className={thClass}>Requested</th>
                  <th className={thClass}>Expires</th>
                  <th className={thClass}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-background">
                {requests.map((req) => {
                  const pending = req.status === 'pending_admin_approval';
                  const orgName = orgMap.get(req.org_id) ?? 'Unknown organisation';

                  return (
                    <tr key={req.id}>
                      <td className={`${tdClass} font-mono text-[11px]`}>{req.id}</td>
                      <td className={tdClass}>
                        <div className="font-semibold text-text-primary">{orgName}</div>
                        <div className="font-mono text-[10px] text-text-muted">{req.org_id}</div>
                      </td>
                      <td className={tdClass}>
                        <div className="font-semibold text-text-primary">{req.user_name ?? req.user_email ?? 'Unknown user'}</div>
                        <div className="text-[11px] text-text-muted">{req.user_email ?? req.user_id}</div>
                      </td>
                      <td className={tdClass}>
                        <StatusBadge status={req.status.replace('pending_admin_approval', 'pending')} />
                      </td>
                      <td className={tdClass}>{formatDateTime(req.requested_at)}</td>
                      <td className={tdClass}>{formatDateTime(req.expires_at)}</td>
                      <td className={tdClass}>
                        <div className="flex flex-wrap gap-2">
                          <form action={approvePasswordResetAsSuperAdminAction}>
                            <input type="hidden" name="requestId" value={req.id} />
                            <button className={`${buttonClass} gap-1.5`} type="submit" disabled={!pending}>
                              <Check size={14} />
                              Approve
                            </button>
                          </form>
                          <form action={rejectPasswordResetAsSuperAdminAction}>
                            <input type="hidden" name="requestId" value={req.id} />
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

      {/* SECTION 2: View & Reset User Passwords */}
      <Section title="View & Manage User Passwords (Bcrypt Hashes Secured in Supabase)">
        <p className="text-xs text-text-muted mb-4 leading-relaxed">
          Passwords are mathematically hashed using Bcrypt within Supabase Auth and cannot be viewed in plaintext.
          However, as a Super Admin, you can directly set a new password for any user account here.
        </p>

        {(!profiles || profiles.length === 0) ? (
          <EmptyState title="No users found">Registered user accounts appear here.</EmptyState>
        ) : (
          <TableWrap>
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>User Profile</th>
                  <th className={thClass}>Organization</th>
                  <th className={thClass}>System Role</th>
                  <th className={thClass}>Password Status</th>
                  <th className={thClass} style={{ width: '320px' }}>Administrative Change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-background">
                {profiles.map((profile: any) => {
                  const email = emailMap.get(profile.id) ?? 'No email found';
                  const orgName = profile.org_id ? (orgMap.get(profile.org_id) ?? 'Unknown') : 'No Organization';

                  return (
                    <tr key={profile.id} className="hover:bg-surface-hover/20 transition-colors">
                      <td className={tdClass}>
                        <div className="font-semibold text-text-primary text-sm">{profile.full_name ?? 'Unnamed User'}</div>
                        <div className="text-[11px] text-text-muted">{email}</div>
                        <div className="font-mono text-[9px] text-text-muted/60">{profile.id}</div>
                      </td>
                      <td className={tdClass}>
                        <span className="font-medium text-text-secondary text-xs">{orgName}</span>
                      </td>
                      <td className={tdClass}>
                        <form action={adminChangeUserRoleAction} className="flex gap-2 items-center">
                          <input type="hidden" name="userId" value={profile.id} />
                          <select
                            className={`${inputClass} !py-1 !px-2 !text-xs max-w-[110px]`}
                            name="role"
                            defaultValue={profile.role ?? 'staff'}
                          >
                            <option value="owner" className="bg-surface text-text-primary">owner</option>
                            <option value="admin" className="bg-surface text-text-primary">admin</option>
                            <option value="manager" className="bg-surface text-text-primary">manager</option>
                            <option value="staff" className="bg-surface text-text-primary">staff</option>
                            <option value="viewer" className="bg-surface text-text-primary">viewer</option>
                          </select>
                          <button className={`${buttonClass} !py-1 !px-3 !text-xs`} type="submit">
                            Save
                          </button>
                        </form>
                      </td>
                      <td className={tdClass}>
                        <span className="inline-flex items-center gap-1.5 text-xs text-text-muted font-mono bg-surface-2 border border-border px-2 py-0.5 rounded">
                          <KeyRound size={12} className="text-accent" />
                          Encrypted (Bcrypt)
                        </span>
                      </td>
                      <td className={tdClass}>
                        <form action={adminChangeUserPasswordAction} className="flex gap-2 items-center">
                          <input type="hidden" name="userId" value={profile.id} />
                          <input
                            className={`${inputClass} !py-1 !px-2.5 !text-xs max-w-[160px]`}
                            type="text"
                            name="password"
                            placeholder="New Password"
                            required
                            minLength={8}
                          />
                          <button className={`${buttonClass} !py-1 !px-3 !text-xs`} type="submit">
                            Set
                          </button>
                        </form>
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
