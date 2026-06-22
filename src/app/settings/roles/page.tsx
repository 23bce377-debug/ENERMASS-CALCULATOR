import {
  AdminTabs,
  EmptyState,
  PageShell,
  Section,
  StatusBadge,
  TableWrap,
  buttonClass,
  inputClass,
  orgAdminTabs,
  tableClass,
  tdClass,
  thClass,
} from '@/components/saas/ManagementUi';
import { listOrgUsers } from '@/lib/saas/services/managementService';
import { requireOrgAdminPageSession } from '@/lib/saas/managementPageGuards';
import { changeOrgUserRoleAction } from '../saasActions';

const roles = ['owner', 'admin', 'manager', 'staff', 'viewer'];

export default async function RolesPage() {
  const session = await requireOrgAdminPageSession();
  const users = await listOrgUsers(session.orgId);

  return (
    <PageShell
      title="Roles"
      description="Review and update organization permissions for billing, users, devices, and settings."
      nav={<AdminTabs items={orgAdminTabs} />}
    >
      <Section title="Role Assignments">
        {users.length === 0 ? (
          <EmptyState title="No role assignments found">Invite users before assigning roles.</EmptyState>
        ) : (
          <TableWrap>
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>User</th>
                  <th className={thClass}>Status</th>
                  <th className={thClass}>Current Role</th>
                  <th className={thClass}>Permissions</th>
                  <th className={thClass}>Change Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-background">
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className={tdClass}>
                      <div className="font-semibold text-text-primary">{user.full_name ?? user.email ?? user.user_id}</div>
                      <div className="font-mono text-[11px] text-text-muted">{user.email ?? user.user_id}</div>
                    </td>
                    <td className={tdClass}><StatusBadge status={user.status} /></td>
                    <td className={tdClass}><StatusBadge status={user.role} /></td>
                    <td className={tdClass}>
                      {user.role === 'owner' ? 'Billing, org, users, devices' :
                        user.role === 'admin' ? 'Org, users, devices' :
                        user.role === 'manager' ? 'Users and settings' :
                        user.role === 'staff' ? 'Operational access' :
                        'Read-only access'}
                    </td>
                    <td className={tdClass}>
                      <form action={changeOrgUserRoleAction} className="flex items-center gap-2">
                        <input type="hidden" name="memberId" value={user.id} />
                        <select className={`${inputClass} min-w-32`} name="role" defaultValue={user.role}>
                          {roles.map((role) => <option key={role} value={role}>{role}</option>)}
                        </select>
                        <button className={buttonClass} type="submit">Save</button>
                      </form>
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
