import {
  AdminTabs,
  EmptyState,
  PageShell,
  Section,
  StatusBadge,
  TableWrap,
  superAdminTabs,
  tableClass,
  tdClass,
  thClass,
  formatDateTime,
  inputClass,
  buttonClass,
} from '@/components/saas/ManagementUi';
import { getSuperAdminOrgDashboard } from '@/lib/saas/services/managementService';
import { requireSuperAdminPageSession } from '@/lib/saas/managementPageGuards';
import { GenerateKeysModal } from '@/components/saas/GenerateKeysModal';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { notFound } from 'next/navigation';
import { adminChangeUserRoleAction, updateOrgDetailsAction, setSeatLimitAction } from '../../actions';

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export default async function SuperAdminOrgDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSuperAdminPageSession();
  
  const resolvedParams = await params;
  const orgId = resolvedParams.id;

  if (!isUuid(orgId)) {
    notFound();
  }

  const { overview, members, devices, activationKeys: keys } = await getSuperAdminOrgDashboard(orgId);

  if (!overview.org) {
    notFound();
  }

  const deviceMap = new Map<string, (typeof devices)[number]>();
  for (const device of devices) {
    const existing = deviceMap.get(device.user_id);
    if (!existing || (existing.status !== 'active' && device.status === 'active')) {
      deviceMap.set(device.user_id, device);
    }
  }

  const keyMap = new Map<string, (typeof keys)[number]>();
  for (const key of keys) {
    if (key.activated_by && !keyMap.has(key.activated_by)) {
      keyMap.set(key.activated_by, key);
    }
  }

  return (
      <PageShell
        title={`Organization: ${overview.org.name}`}
        description={`Manage members, devices, and activation keys for this tenant. ID: ${orgId}`}
        nav={
          <div className="flex items-center justify-between mb-4">
            <AdminTabs items={superAdminTabs} />
            <Link
              href="/super-admin/orgs"
              className="inline-flex items-center gap-2 text-sm font-medium text-text-muted hover:text-text-primary transition-colors"
            >
              <ArrowLeft size={16} />
              Back to Organizations
            </Link>
          </div>
        }
      >
        {/* Actions & Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-1 space-y-6">
            <Section title="Subscription Overview">
              <div className="space-y-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-muted">Status</span>
                  <StatusBadge status={overview.subscription?.status ?? 'missing'} />
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Plan</span>
                  <span className="font-semibold text-text-primary">{overview.plan?.name ?? 'None'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Seat Usage</span>
                  <span className="font-semibold text-text-primary">
                    {overview.seatUsage.usedSeats} / {overview.seatUsage.seatLimit || '—'}
                  </span>
                </div>

                {overview.subscription && (
                  <form action={setSeatLimitAction} className="pt-3 border-t border-border/40 space-y-2">
                    <input type="hidden" name="subscriptionId" value={overview.subscription.id} />
                    <div>
                      <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1.5">
                        Edit Seat Limit
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          name="seatLimit"
                          defaultValue={overview.seatUsage.seatLimit ?? 5}
                          min={1}
                          className={`${inputClass} !py-1.5 !px-2.5 !text-xs w-24`}
                        />
                        <button type="submit" className={`${buttonClass} !py-1.5 !px-3 !text-xs`}>
                          Save Seats
                        </button>
                      </div>
                    </div>
                  </form>
                )}
              </div>
            </Section>

            <Section title="Activation Keys Management">
              {keys.length > 0 ? (
                <div className="space-y-3">
                  <p className="text-xs text-text-muted">
                    License key already generated for this organization. Only one key per organization is allowed.
                  </p>
                  <div className="p-3 rounded-xl border border-accent/20 bg-accent/5">
                    <span className="text-[10px] font-bold text-accent uppercase tracking-widest block mb-1">
                      Active License Key Prefix
                    </span>
                    <code className="font-mono text-xs text-text-primary bg-background/50 border border-border/60 px-2 py-1 rounded-md block w-fit">
                      {keys[0].key_prefix}-****
                    </code>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm text-text-muted mb-4">
                    Generate the license key for this organization. Raw keys are shown exactly once and must be shared securely.
                  </p>
                  <div className="flex justify-start">
                    <GenerateKeysModal orgId={overview.org.id} orgName={overview.org.name} />
                  </div>
                </>
              )}
            </Section>
          </div>

          <div className="lg:col-span-2">
            <Section title="Edit Organization Details">
              <form action={updateOrgDetailsAction} className="space-y-4">
                <input type="hidden" name="orgId" value={orgId} />
                
                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1">Company Name</label>
                  <input
                    type="text"
                    name="name"
                    defaultValue={overview.org.name ?? ''}
                    className={inputClass}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-text-muted mb-1">Email</label>
                    <input
                      type="email"
                      name="email"
                      defaultValue={overview.org.email ?? ''}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-muted mb-1">Phone</label>
                    <input
                      type="text"
                      name="phone"
                      defaultValue={overview.org.phone ?? ''}
                      className={inputClass}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1">Address</label>
                  <input
                    type="text"
                    name="address"
                    defaultValue={overview.org.address ?? ''}
                    className={inputClass}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-text-muted mb-1">City</label>
                    <input
                      type="text"
                      name="city"
                      defaultValue={overview.org.city ?? ''}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-muted mb-1">State</label>
                    <input
                      type="text"
                      name="state"
                      defaultValue={overview.org.state ?? ''}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-muted mb-1">Pincode</label>
                    <input
                      type="text"
                      name="pincode"
                      defaultValue={overview.org.pincode ?? ''}
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-text-muted mb-1">GSTIN</label>
                    <input
                      type="text"
                      name="gstin"
                      defaultValue={overview.org.gstin ?? ''}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-muted mb-1">Website</label>
                    <input
                      type="text"
                      name="website"
                      defaultValue={overview.org.website ?? ''}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-muted mb-1">Quote Prefix</label>
                    <input
                      type="text"
                      name="quote_prefix"
                      defaultValue={overview.org.quote_prefix ?? 'QM'}
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button type="submit" className={buttonClass}>
                    Save Details
                  </button>
                </div>
              </form>
            </Section>
          </div>
        </div>

        {/* Members & Devices */}
        <Section title="Members & Devices">
          {members.length === 0 ? (
            <EmptyState title="No members found">This organization currently has no registered members.</EmptyState>
          ) : (
            <TableWrap>
              <table className={tableClass}>
                <thead>
                  <tr>
                    <th className={thClass}>Member</th>
                    <th className={thClass}>Role</th>
                    <th className={thClass}>Device Name</th>
                    <th className={thClass}>Used Key Prefix</th>
                    <th className={thClass}>Joined Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-background">
                  {members.map(member => {
                    const device = deviceMap.get(member.user_id);
                    const key = keyMap.get(member.user_id);

                    return (
                      <tr key={member.id}>
                        <td className={tdClass}>
                          <div className="font-semibold text-text-primary">{member.full_name ?? '—'}</div>
                          <div className="text-[11px] text-text-muted">{member.email ?? '—'}</div>
                        </td>
                        <td className={tdClass}>
                          <form action={adminChangeUserRoleAction} className="flex gap-2 items-center">
                            <input type="hidden" name="userId" value={member.user_id} />
                            <select
                              className={`${inputClass} !py-1 !px-2 !text-xs max-w-[110px]`}
                              name="role"
                              defaultValue={member.role ?? 'staff'}
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
                          {device ? (
                            <div>
                              <div className="text-sm text-text-primary">{device.device_name}</div>
                              <div className="text-[10px] text-text-muted">{device.browser ?? 'Unknown Browser'} / {device.os ?? 'Unknown OS'}</div>
                            </div>
                          ) : (
                            <span className="text-text-muted italic text-xs">No Device</span>
                          )}
                        </td>
                        <td className={tdClass}>
                          {key ? (
                            <code className="font-mono text-[10px] text-accent bg-accent/10 px-2 py-1 rounded-md">
                              {key.key_prefix}-****
                            </code>
                          ) : (
                            <span className="text-text-muted italic text-xs">—</span>
                          )}
                        </td>
                        <td className={tdClass}>{new Date(member.created_at).toLocaleDateString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableWrap>
          )}
        </Section>
        
        {/* Keys List */}
        <Section title="Activation Keys Log">
          {keys.length === 0 ? (
            <EmptyState title="No keys generated">Generate keys to allow users to register.</EmptyState>
          ) : (
            <TableWrap>
              <table className={tableClass}>
                <thead>
                  <tr>
                    <th className={thClass}>Key Prefix</th>
                    <th className={thClass}>Status</th>
                    <th className={thClass}>Activated By</th>
                    <th className={thClass}>Activated At</th>
                    <th className={thClass}>Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-background">
                  {keys.map(key => (
                    <tr key={key.id}>
                      <td className={tdClass}>
                        <code className="font-mono text-xs text-text-primary bg-surface-2 px-2 py-1 rounded-md border border-border">
                          {key.key_prefix}-****
                        </code>
                      </td>
                      <td className={tdClass}><StatusBadge status={key.status} /></td>
                      <td className={tdClass}>
                        {key.activated_by_name ? (
                          <div className="text-sm">{key.activated_by_name}</div>
                        ) : (
                          <span className="text-text-muted text-xs">—</span>
                        )}
                      </td>
                      <td className={tdClass}>{formatDateTime(key.activated_at)}</td>
                      <td className={tdClass}>{formatDateTime(key.created_at)}</td>
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
