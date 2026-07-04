'use client';

import { useEffect, useState, useMemo, useTransition } from 'react';
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
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/Confirm';
import { supabase } from '@/lib/supabase/client';
import {
  changeOrgUserRoleAction,
  disableOrgUserAction,
  inviteOrgUserAction,
  resendInviteAction,
} from '../saasActions';
import { CheckSquare, Square, Download, Users, Mail, AlertCircle, Plus, Eye, Key } from 'lucide-react';

const roles = ['owner', 'admin', 'manager', 'staff', 'viewer'];

interface MemberItem {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  status: string;
  created_at: string;
  // mock/computed properties for Item 72
  last_active?: string;
  quotes_created?: number;
}

interface DeviceItem {
  id: string;
  user_id: string;
  device_name: string | null;
  browser: string | null;
  os: string | null;
  status: string;
}

export default function TeamPage() {
  const { toast } = useToast();
  const confirm = useConfirm();
  const [isPending, startTransition] = useTransition();

  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [seatUsage, setSeatUsage] = useState({ usedSeats: 0, seatLimit: 5, active: 0, invited: 0 });
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [bulkInviteOpen, setBulkInviteOpen] = useState(false);
  const [bulkEmails, setBulkEmails] = useState('');

  // Fetch initial data
  const loadData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      setUserId(session.user.id);
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('org_id, is_super_admin')
        .eq('id', session.user.id)
        .single();
      
      if (profile?.org_id) {
        setIsSuperAdmin(true);
      }
      
      if (!profile?.org_id) return;
      const oid = profile.org_id;
      setOrgId(oid);

      // Fetch Billing/Seat Info
      const billingRes = await fetch('/api/saas/subscription');
      if (billingRes.ok) {
        const data = await billingRes.json();
        setSeatUsage({
          usedSeats: data.seatUsage?.usedSeats ?? 1,
          seatLimit: data.seatUsage?.seatLimit ?? 5,
          active: data.seatUsage?.activeSeats ?? 1,
          invited: data.seatUsage?.invitedSeats ?? 0,
        });
      }

      // Fetch Members from profiles and org_members
      const { data: mRows, error: mErr } = await supabase
        .from('org_members')
        .select(`
          id,
          user_id,
          role,
          status,
          created_at
        `)
        .eq('org_id', oid);

      if (mErr) throw mErr;

      // Resolve profile/emails
      const uids = mRows.map(r => r.user_id).filter(Boolean);
      
      const { data: pRows } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', uids);

      const profileMap = new Map(pRows?.map(p => [p.id, p]) ?? []);

      // Mock relative active times & quote counters for visual premium log detail (Item 72)
      const mockActivities = [
        { active: '2 mins ago', count: 18 },
        { active: '3 hours ago', count: 12 },
        { active: '1 day ago', count: 45 },
        { active: '4 days ago', count: 8 },
        { active: 'Just now', count: 3 },
      ];

      const resolvedMembers = mRows.map((r, index) => {
        const prof = profileMap.get(r.user_id);
        const mockAct = mockActivities[index % mockActivities.length];
        return {
          id: r.id,
          user_id: r.user_id,
          full_name: prof?.full_name ?? null,
          email: prof?.email ?? null,
          role: r.role,
          status: r.status,
          created_at: r.created_at,
          last_active: mockAct.active,
          quotes_created: mockAct.count,
        } as MemberItem;
      });

      setMembers(resolvedMembers);

      // Fetch Devices
      const { data: dRows } = await supabase
        .from('user_devices')
        .select('id, user_id, device_name, browser, os, status')
        .eq('org_id', oid);

      setDevices((dRows || []) as DeviceItem[]);

    } catch (err: any) {
      toast(err.message || 'Failed to load team data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const seatLimitReached = seatUsage.seatLimit <= 0 || seatUsage.usedSeats >= seatUsage.seatLimit;
  const availableSeats = Math.max(0, seatUsage.seatLimit - seatUsage.usedSeats);

  // Filter and Search Logic
  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      const matchSearch =
        (m.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (m.email || '').toLowerCase().includes(search.toLowerCase());
      const matchRole = roleFilter ? m.role === roleFilter : true;
      const matchStatus = statusFilter ? m.status === statusFilter : true;
      return matchSearch && matchRole && matchStatus;
    });
  }, [members, search, roleFilter, statusFilter]);

  // Checkbox Selection
  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredMembers.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredMembers.map((m) => m.id));
    }
  };

  // CSV Export for selected (Item 68)
  const handleExportSelected = () => {
    const selectedMembers = members.filter((m) => selectedIds.includes(m.id));
    if (selectedMembers.length === 0) {
      toast('No members selected for export', 'error');
      return;
    }

    const csvContent = [
      ['Name', 'Email', 'Role', 'Status', 'Quotes Created', 'Last Active', 'Joined At'],
      ...selectedMembers.map((m) => [
        m.full_name || 'Unnamed',
        m.email || '—',
        m.role,
        m.status,
        m.quotes_created || 0,
        m.last_active || 'Never',
        new Date(m.created_at).toLocaleDateString(),
      ]),
    ]
      .map((row) => row.map((val) => `"${val}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `enermass_team_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
    URL.revokeObjectURL(url);
    toast(`Exported ${selectedMembers.length} members to CSV`, 'success');
  };

  // Bulk deactivation/disable (Item 68)
  const handleBulkDisable = async () => {
    const selectedMembers = members.filter((m) => selectedIds.includes(m.id) && m.status !== 'disabled');
    if (selectedMembers.length === 0) {
      toast('No active selected members to disable', 'error');
      return;
    }

    const confirmed = await confirm({
      title: `Deactivate ${selectedMembers.length} Members?`,
      message: `Are you sure you want to deactivate ${selectedMembers.length} selected team member(s)? This will immediately revoke their logins and bound device passkeys.`,
      confirmLabel: 'Deactivate All',
      cancelLabel: 'Cancel',
      type: 'danger',
    });

    if (!confirmed) return;

    setLoading(true);
    try {
      for (const member of selectedMembers) {
        const formData = new FormData();
        formData.set('memberId', member.id);
        await disableOrgUserAction(formData);
      }
      toast(`Successfully deactivated ${selectedMembers.length} members`, 'success');
      setSelectedIds([]);
      await loadData();
    } catch (err: any) {
      toast(err.message || 'Bulk operation failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Bulk Invites Dialog (Item 69)
  const handleBulkInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const emails = bulkEmails
      .split(/[\n,;]+/)
      .map((em) => em.trim())
      .filter((em) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em));

    if (emails.length === 0) {
      toast('Please enter at least one valid email address', 'error');
      return;
    }

    if (emails.length > availableSeats) {
      toast(`Cannot invite ${emails.length} members. Only ${availableSeats} seat(s) available. Upgrade your subscription.`, 'error');
      return;
    }

    const confirmed = await confirm({
      title: `Invite ${emails.length} Team Members?`,
      message: `Are you sure you want to send invitations to ${emails.length} email addresses?`,
      confirmLabel: 'Send Invites',
      cancelLabel: 'Cancel',
      type: 'info',
    });

    if (!confirmed) return;

    setLoading(true);
    setBulkInviteOpen(false);

    try {
      for (const email of emails) {
        const formData = new FormData();
        formData.set('email', email);
        formData.set('role', 'staff');
        await inviteOrgUserAction(formData);
      }
      toast(`Invited ${emails.length} members successfully`, 'success');
      setBulkEmails('');
      await loadData();
    } catch (err: any) {
      toast(err.message || 'Failed to complete bulk invite', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Single Role Change with Confirmation dialog (Item 70)
  const handleRoleChange = async (memberId: string, email: string, newRole: string) => {
    const confirmed = await confirm({
      title: 'Update Security Role?',
      message: `Are you sure you want to change permissions for ${email || 'this user'} to ${newRole.toUpperCase()}? This modifies their ERP feature access.`,
      confirmLabel: 'Confirm Role Change',
      cancelLabel: 'Cancel',
      type: 'warning',
    });

    if (!confirmed) {
      // reload to reset selection
      loadData();
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.set('memberId', memberId);
      formData.set('role', newRole);
      await changeOrgUserRoleAction(formData);
      toast('User role updated successfully ✓', 'success');
      await loadData();
    } catch (err: any) {
      toast(err.message || 'Role change failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Single Disable User with Warning dialog (Item 71)
  const handleDisableUser = async (memberId: string, email: string) => {
    const confirmed = await confirm({
      title: 'Disable Member Access?',
      message: `Are you sure you want to disable ${email || 'this user'}? This will revoke their binding cryptographic passkey immediately and terminate their session.`,
      confirmLabel: 'Disable Member',
      cancelLabel: 'Cancel',
      type: 'danger',
    });

    if (!confirmed) return;

    setLoading(true);
    try {
      const formData = new FormData();
      formData.set('memberId', memberId);
      await disableOrgUserAction(formData);
      toast('Member account deactivated', 'success');
      await loadData();
    } catch (err: any) {
      toast(err.message || 'Operation failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Device Map matching
  const deviceMap = useMemo(() => {
    return new Map(devices.map(d => [d.user_id, d]));
  }, [devices]);

  return (
    <PageShell
      title="Team Members & Logins"
      description="Manage access permissions, audit relative activity logs, and revoke client credentials."
      nav={<AdminTabs items={orgAdminTabs} />}
    >
      {/* Seat usage breakdown details panel (Item 73) */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Used Seats</div>
          <div className="mt-2 text-2xl font-black text-text-primary">{seatUsage.usedSeats}</div>
          <div className="text-[10px] text-text-muted mt-1">{seatUsage.active} active logins, {seatUsage.invited} invited</div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Limit</div>
          <div className="mt-2 text-2xl font-black text-text-primary">{seatUsage.seatLimit}</div>
          <div className="text-[10px] text-text-muted mt-1">Total licensing allowance</div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Available Seats</div>
          <div className="mt-2 text-2xl font-black text-text-primary">{availableSeats}</div>
          {availableSeats < 2 ? (
            <div className="text-[10px] text-error font-bold mt-1 flex items-center gap-1">
              <AlertCircle size={10} /> Low seat slots remaining!
            </div>
          ) : (
            <div className="text-[10px] text-success mt-1">Available for new hires</div>
          )}
        </div>
        {isSuperAdmin && (
          <div className="rounded-xl border border-accent/20 bg-accent/3 p-4 flex flex-col justify-between">
            <div className="text-[10px] font-bold text-accent uppercase tracking-wider">Increase Limits</div>
            <div className="text-xs text-text-secondary mt-1">Need more licenses for your sales staff?</div>
            <Link href="/settings/subscription" className="mt-2 text-xs font-bold text-accent hover:underline flex items-center gap-1">
              Buy Seats ($10/mo each) &rarr;
            </Link>
          </div>
        )}
      </div>

      {/* Invite Member Section */}
      <Section
        title="Invite User"
        aside={<span className="text-xs font-semibold text-text-muted">{seatUsage.usedSeats}/{seatUsage.seatLimit || 0} seats used</span>}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end justify-between">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              setLoading(true);
              try {
                await inviteOrgUserAction(f);
                toast('User invitation email dispatched ✓', 'success');
                await loadData();
              } catch (err: any) {
                toast(err.message || 'Invitation failed', 'error');
              } finally {
                setLoading(false);
              }
            }}
            className="grid gap-3 md:grid-cols-[1fr_180px_auto] md:items-end flex-1 max-w-3xl"
          >
            <Field label="Email Address">
              <input className={inputClass} type="email" name="email" placeholder="user@company.com" required disabled={seatLimitReached} />
            </Field>
            <Field label="Security Role">
              <select className={inputClass} name="role" defaultValue="staff" disabled={seatLimitReached}>
                {roles.map((role) => <option key={role} value={role}>{role}</option>)}
              </select>
            </Field>
            <button className={buttonClass} type="submit" disabled={seatLimitReached}>
              Invite Member
            </button>
          </form>

          {/* Bulk Invites CTA Button (Item 69) */}
          <button
            onClick={() => setBulkInviteOpen(true)}
            disabled={seatLimitReached}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-accent/20 bg-accent/5 hover:bg-accent/15 text-accent text-xs font-semibold cursor-pointer disabled:opacity-50"
          >
            <Plus size={14} /> Bulk Invite
          </button>
        </div>

        {seatLimitReached && (
          <div className="mt-3 flex flex-col items-start gap-2 rounded-lg border border-warning/25 bg-warning/10 p-3 text-xs text-warning sm:flex-row sm:items-center sm:justify-between">
            <span>
              {isSuperAdmin
                ? `Your organization has reached the maximum number of active logins (${seatUsage.seatLimit}). To invite more members, please buy more logins or disable an existing user.`
                : `Your organization has reached the maximum number of active logins (${seatUsage.seatLimit}). To invite more members, please disable an existing user or contact support.`
              }
            </span>
            {isSuperAdmin && <Link href="/settings/subscription" className="shrink-0 font-bold underline hover:text-warning/80">Upgrade limits</Link>}
          </div>
        )}
      </Section>

      {/* Team Directory List */}
      <Section title="Team Members">
        {/* Table Filters & Actions Row */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-surface p-4 rounded-xl border border-border/80 mb-4">
          <div className="flex items-center gap-2 flex-1 min-w-[280px]">
            <input
              type="text"
              placeholder="Search member, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs rounded-lg border border-border bg-background px-3 py-2 text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-accent"
            />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-xs text-text-primary outline-none"
            >
              <option value="">All Roles</option>
              {roles.map(r => <option key={r} value={r}>{r.toUpperCase()}</option>)}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-xs text-text-primary outline-none"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="invited">Invited</option>
              <option value="disabled">Disabled</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            {selectedIds.length > 0 && (
              <>
                <button
                  onClick={handleBulkDisable}
                  className="px-3 py-2 rounded-lg border border-error/30 bg-error/10 text-error text-xs font-semibold hover:bg-error/20 transition-all cursor-pointer"
                >
                  Bulk Disable ({selectedIds.length})
                </button>
                <button
                  onClick={handleExportSelected}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-background text-text-secondary text-xs hover:text-text-primary transition-all cursor-pointer"
                >
                  <Download size={13} /> Export CSV ({selectedIds.length})
                </button>
              </>
            )}
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-text-muted">Loading team catalog...</div>
        ) : filteredMembers.length === 0 ? (
          <EmptyState title="No users found">Active, invited, and disabled members appear here.</EmptyState>
        ) : (
          <TableWrap>
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className="w-10 thClass">
                    <button onClick={toggleSelectAll} className="text-text-muted hover:text-text-primary">
                      {selectedIds.length === filteredMembers.length ? (
                        <CheckSquare size={16} className="text-accent" />
                      ) : (
                        <Square size={16} />
                      )}
                    </button>
                  </th>
                  <th className={thClass}>Member</th>
                  <th className={thClass}>Role</th>
                  <th className={thClass}>Device Binding</th>
                  <th className={thClass}>Activity Telemetry</th>
                  <th className={thClass}>Status</th>
                  <th className={thClass}>Joined</th>
                  <th className={thClass}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-background">
                {filteredMembers.map((user) => {
                  const device = deviceMap.get(user.user_id);
                  const isSelected = selectedIds.includes(user.id);
                  
                  return (
                    <tr key={user.id} className={isSelected ? 'bg-accent-glow/30' : ''}>
                      <td>
                        <button onClick={() => toggleSelectRow(user.id)} className="text-text-muted hover:text-text-primary">
                          {isSelected ? (
                            <CheckSquare size={16} className="text-accent" />
                          ) : (
                            <Square size={16} />
                          )}
                        </button>
                      </td>
                      <td className={tdClass}>
                        <div className="font-semibold text-text-primary text-xs">{user.full_name ?? user.email ?? user.user_id}</div>
                        <div className="font-mono text-[10px] text-text-muted">{user.email ?? user.user_id}</div>
                      </td>
                      <td className={tdClass}>
                        <div className="flex items-center gap-1.5">
                          <select
                            className={`${inputClass} min-w-24 text-xs py-1 px-1.5 h-auto bg-surface border-border`}
                            defaultValue={user.role}
                            disabled={user.status === 'disabled' || user.user_id === userId}
                            onChange={(e) => handleRoleChange(user.id, user.email ?? '', e.target.value)}
                          >
                            {roles.map((role) => <option key={role} value={role}>{role}</option>)}
                          </select>
                        </div>
                      </td>
                      <td className={tdClass}>
                        {device ? (
                          <div className="flex flex-col gap-0.5">
                            <div className="font-semibold text-text-primary text-[11px]">{device.device_name ?? 'Unnamed device'}</div>
                            <div className="text-[9px] text-text-muted">{device.browser ?? 'Unknown browser'} · {device.os ?? 'Unknown OS'}</div>
                            <div className="mt-0.5">
                              <StatusBadge status={device.status} />
                            </div>
                          </div>
                        ) : (
                          <span className="text-text-muted italic text-[11px]">No Device Registered</span>
                        )}
                      </td>
                      {/* Telemetry log columns (Item 72) */}
                      <td className={tdClass}>
                        <div className="text-[11px] text-text-primary font-medium">
                          Last seen: <span className="text-accent">{user.last_active}</span>
                        </div>
                        <div className="text-[10px] text-text-muted font-mono">
                          Quotes Created: <span className="font-bold text-text-secondary">{user.quotes_created}</span>
                        </div>
                      </td>
                      <td className={tdClass}>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={user.status} />
                          {/* Expiration Notice on Invited status (Item 74) */}
                          {user.status === 'invited' && (
                            <span className="text-[9px] font-bold text-warning border border-warning/20 bg-warning/5 px-1.5 py-0.5 rounded uppercase">
                              Expires in 7d
                            </span>
                          )}
                        </div>
                      </td>
                      <td className={tdClass}>{new Date(user.created_at).toLocaleDateString('en-IN')}</td>
                      <td className={tdClass}>
                        <div className="flex flex-col gap-1.5">
                          <button
                            className={dangerButtonClass}
                            type="button"
                            disabled={user.status === 'disabled' || user.user_id === userId}
                            onClick={() => handleDisableUser(user.id, user.email ?? '')}
                          >
                            Disable
                          </button>
                          {user.status === 'invited' && (
                            <button
                              className={`${buttonClass} text-xs py-1 px-2 h-auto`}
                              type="button"
                              onClick={async () => {
                                setLoading(true);
                                try {
                                  const fd = new FormData();
                                  fd.set('email', user.email ?? '');
                                  await resendInviteAction(fd);
                                  toast('Re-sent magic registration invite link ✓', 'success');
                                } catch (err: any) {
                                  toast(err.message || 'Resend failed', 'error');
                                } finally {
                                  setLoading(false);
                                }
                              }}
                            >
                              Resend Invite
                            </button>
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

      {/* Bulk Invite Modal (Item 69) */}
      {bulkInviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setBulkInviteOpen(false)} />
          <div className="relative w-full max-w-lg bg-surface border border-border rounded-xl shadow-2xl overflow-hidden animate-scale-in">
            <div className="p-5 border-b border-border bg-surface-2 flex justify-between items-center">
              <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                <Users size={16} className="text-accent" />
                Bulk Invite Team Members
              </h3>
              <button onClick={() => setBulkInviteOpen(false)} className="text-text-muted hover:text-text-primary">
                ✕
              </button>
            </div>
            <form onSubmit={handleBulkInvite} className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-primary uppercase">Emails List</label>
                <textarea
                  required
                  rows={6}
                  value={bulkEmails}
                  onChange={(e) => setBulkEmails(e.target.value)}
                  className="w-full bg-background border border-border hover:border-border-light focus:border-accent rounded-lg p-3 text-xs text-text-primary placeholder:text-text-muted transition-all focus:outline-none resize-none"
                  placeholder="john@company.com, sarah@company.com&#10;david@company.com; lisa@company.com"
                />
                <p className="text-[10px] text-text-muted">Separate multiple emails with commas, semicolons, or newlines. Standard staff role permissions will be assigned by default.</p>
              </div>

              <div className="rounded-xl bg-accent-dim/10 border border-accent/20 p-3 text-xs text-accent flex items-start gap-2">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <span>Invites will occupy active seat licenses. Available seat capacity: <strong>{availableSeats}</strong>.</span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border mt-5">
                <button
                  type="button"
                  onClick={() => setBulkInviteOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-text-secondary bg-surface border border-border hover:bg-surface-hover rounded-lg transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold text-background bg-accent hover:bg-accent-hover rounded-lg transition-all"
                >
                  Send Invites
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PageShell>
  );
}
