import Link from 'next/link';
import {
  AdminTabs,
  EmptyState,
  Field,
  PageShell,
  Section,
  StatusBadge,
  TableWrap,
  buttonClass,
  dangerButtonClass,
  inputClass,
  orgAdminTabs,
  tableClass,
  tdClass,
  thClass,
} from '@/components/saas/ManagementUi';
import { getBillingOverview, listOrgUsers, listOrgDevices } from '@/lib/saas';
import { requireOrgAdminPageSession } from '@/lib/saas/managementPageGuards';
import { changeOrgUserRoleAction, disableOrgUserAction, inviteOrgUserAction, resendInviteAction, revokeOrgDeviceAction } from '../saasActions';

const roles = ['owner', 'admin', 'manager', 'staff', 'viewer'];

export default async function TeamPage() {
  const session = await requireOrgAdminPageSession();
  const [billing, users, devices] = await Promise.all([
    getBillingOverview(session.orgId),
    listOrgUsers(session.orgId),
    listOrgDevices(session.orgId)
  ]);
  const seatLimitReached = billing.seatUsage.seatLimit <= 0 || billing.seatUsage.usedSeats >= billing.seatUsage.seatLimit;

  // Map devices to users
  const deviceMap = new Map(devices.map(d => [d.user_id, d]));

  return (
    <PageShell
      title="Team & Devices"
      description="Manage your team members, their roles, and their device access in one place."
      nav={<AdminTabs items={orgAdminTabs} />}
    >
      <Section
        title="Invite User"
        aside={<span className="text-xs font-semibold text-text-muted">{billing.seatUsage.usedSeats}/{billing.seatUsage.seatLimit || 0} seats used</span>}
      >
        <form action={inviteOrgUserAction} className="grid gap-3 md:grid-cols-[1fr_180px_auto] md:items-end">
          <Field label="Email">
            <input className={inputClass} type="email" name="email" placeholder="user@company.com" required disabled={seatLimitReached} />
          </Field>
          <Field label="Role">
            <select className={inputClass} name="role" defaultValue="staff" disabled={seatLimitReached}>
              {roles.map((role) => <option key={role} value={role}>{role}</option>)}
            </select>
          </Field>
          <button className={buttonClass} type="submit" disabled={seatLimitReached}>Invite</button>
        </form>
        {seatLimitReached && (
          <div className="mt-3 flex flex-col items-start gap-2 rounded-lg border border-warning/25 bg-warning/10 p-3 text-sm text-warning sm:flex-row sm:items-center sm:justify-between">
            <span>Your organization has reached the maximum number of active logins ({billing.seatUsage.seatLimit}). To invite more members, please buy more logins or disable an existing user.</span>
            <Link href="/settings/subscription" className="shrink-0 font-medium underline hover:text-warning/80">Manage Subscription</Link>
          </div>
        )}
      </Section>

      <Section title="Team Members">
        {users.length === 0 ? (
          <EmptyState title="No users found">Active, invited, and disabled members appear here.</EmptyState>
        ) : (
          <TableWrap>
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>Member</th>
                  <th className={thClass}>Role</th>
                  <th className={thClass}>Device Binding</th>
                  <th className={thClass}>Status</th>
                  <th className={thClass}>Joined</th>
                  <th className={thClass}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-background">
                {users.map((user) => {
                  const device = deviceMap.get(user.user_id);
                  
                  return (
                    <tr key={user.id}>
                      <td className={tdClass}>
                        <div className="font-semibold text-text-primary">{user.full_name ?? user.email ?? user.user_id}</div>
                        <div className="font-mono text-[11px] text-text-muted">{user.email ?? user.user_id}</div>
                      </td>
                      <td className={tdClass}>
                        <form action={changeOrgUserRoleAction} className="flex items-center gap-2">
                          <input type="hidden" name="memberId" value={user.id} />
                          <select className={`${inputClass} min-w-24 text-xs py-1 px-2 h-auto`} name="role" defaultValue={user.role}>
                            {roles.map((role) => <option key={role} value={role}>{role}</option>)}
                          </select>
                          <button className={`${buttonClass} text-xs py-1 px-2 h-auto`} type="submit">Save</button>
                        </form>
                      </td>
                      <td className={tdClass}>
                        {device ? (
                          <div className="flex flex-col gap-1">
                            <div className="font-semibold text-text-primary text-xs">{device.device_name ?? 'Unnamed device'}</div>
                            <div className="text-[10px] text-text-muted">{device.browser ?? 'Unknown browser'} · {device.os ?? 'Unknown OS'}</div>
                            <div className="flex items-center justify-between gap-2 mt-1">
                              <StatusBadge status={device.status} />
                              <form action={revokeOrgDeviceAction}>
                                <input type="hidden" name="deviceId" value={device.id} />
                                <button className="text-[10px] underline text-error hover:text-error/80 disabled:opacity-50" type="submit" disabled={device.status === 'revoked'}>Revoke</button>
                              </form>
                            </div>
                          </div>
                        ) : (
                          <span className="text-text-muted italic text-xs">No Device</span>
                        )}
                      </td>
                      <td className={tdClass}><StatusBadge status={user.status} /></td>
                      <td className={tdClass}>{new Date(user.created_at).toLocaleDateString('en-IN')}</td>
                      <td className={tdClass}>
                        <div className="flex flex-col gap-1.5">
                          <form action={disableOrgUserAction}>
                            <input type="hidden" name="memberId" value={user.id} />
                            <button className={dangerButtonClass} type="submit" disabled={user.status === 'disabled'}>Disable</button>
                          </form>
                          {user.status === 'invited' && (
                            <form action={resendInviteAction}>
                              <input type="hidden" name="email" value={user.email ?? ''} />
                              <button className={`${buttonClass} text-xs py-1 px-2 h-auto`} type="submit" title="Resend invitation email">
                                Resend Invite
                              </button>
                            </form>
                          )}
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
