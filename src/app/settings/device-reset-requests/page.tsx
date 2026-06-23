'use client';

import { useEffect, useState, useMemo } from 'react';
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
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/Confirm';
import { supabase } from '@/lib/supabase/client';
import { CheckSquare, Square, Trash2, ShieldCheck, Mail, Search, Clock, Check, X, ShieldAlert, Eye } from 'lucide-react';
import { approveOrgDeviceResetAction, rejectOrgDeviceResetAction } from '../saasActions';

interface ResetRequest {
  id: string;
  org_id: string;
  user_id: string;
  status: string;
  requested_at: string;
  old_device_id: string | null;
  requested_device_info: {
    deviceName?: string;
    browser?: string;
    os?: string;
    userAgent?: string;
  } | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  // resolved client-side
  user_name?: string;
  user_email?: string;
  old_device_name?: string;
}

export default function DeviceResetRequestsPage() {
  const { toast } = useToast();
  const confirm = useConfirm();

  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<ResetRequest[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);

  // Load Requests
  const loadRequests = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('id', session.user.id)
        .single();
      
      if (!profile?.org_id) return;
      const orgId = profile.org_id;

      // Fetch Device Reset Requests
      const { data: rRows, error: rErr } = await supabase
        .from('device_reset_requests')
        .select('*')
        .eq('org_id', orgId);

      if (rErr) throw rErr;

      // Fetch User Profiles
      const uids = rRows.map((r) => r.user_id).filter(Boolean);
      const { data: pRows } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', uids);
      const profileMap = new Map(pRows?.map(p => [p.id, p]) ?? []);

      // Fetch User Devices (for old device name resolving)
      const oldDeviceIds = rRows.map((r) => r.old_device_id).filter(Boolean);
      let deviceMap = new Map<string, string>();
      if (oldDeviceIds.length > 0) {
        const { data: dRows } = await supabase
          .from('user_devices')
          .select('id, device_name')
          .in('id', oldDeviceIds);
        deviceMap = new Map(dRows?.map(d => [d.id, d.device_name ?? 'Unnamed Device']) ?? []);
      }

      const resolved = rRows.map((r) => {
        const prof = profileMap.get(r.user_id);
        return {
          ...r,
          user_name: prof?.full_name ?? 'Unknown User',
          user_email: prof?.email ?? '—',
          old_device_name: r.old_device_id ? (deviceMap.get(r.old_device_id) ?? 'Decommissioned Device') : 'No old device',
        } as ResetRequest;
      });

      setRequests(resolved);
    } catch (err: any) {
      toast(err.message || 'Failed to load device reset queue', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const pending = useMemo(() => requests.filter((r) => r.status === 'pending'), [requests]);

  // Filter and Search
  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      const info = r.requested_device_info;
      const deviceName = info?.deviceName || 'Unnamed Device';
      const matchSearch =
        (r.user_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (r.user_email || '').toLowerCase().includes(search.toLowerCase()) ||
        deviceName.toLowerCase().includes(search.toLowerCase());
      
      const matchStatus = statusFilter ? r.status === statusFilter : true;
      return matchSearch && matchStatus;
    });
  }, [requests, search, statusFilter]);

  // Selection Checkboxes
  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredRequests.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredRequests.map((r) => r.id));
    }
  };

  // Bulk actions: Approve / Reject (Item 85)
  const handleBulkAction = async (action: 'approve' | 'reject') => {
    const targets = requests.filter((r) => selectedIds.includes(r.id) && r.status === 'pending');
    if (targets.length === 0) {
      toast('No pending selected requests found.', 'error');
      return;
    }

    const confirmed = await confirm({
      title: `${action === 'approve' ? 'Approve' : 'Reject'} ${targets.length} Device Resets?`,
      message: `Are you sure you want to ${action} hardware device access keys for ${targets.length} user(s)? ${
        action === 'approve' ? 'This revokes their old device bindings and authorizes new log-ins.' : 'This rejects and keeps old device bindings.'
      }`,
      confirmLabel: action === 'approve' ? 'Approve Resets' : 'Reject Resets',
      cancelLabel: 'Cancel',
      type: action === 'approve' ? 'warning' : 'danger',
    });

    if (!confirmed) return;

    setProcessing(true);
    let successCount = 0;
    try {
      const actionFn = action === 'approve' ? approveOrgDeviceResetAction : rejectOrgDeviceResetAction;
      for (const req of targets) {
        const fd = new FormData();
        fd.set('requestId', req.id);
        await actionFn(fd);
        successCount++;
      }
      toast(`Successfully ${action}d ${successCount} reset requests. Users notified of binding resets ✓`, 'success');
      setSelectedIds([]);
      await loadRequests();
    } catch (err: any) {
      toast(err.message || 'Bulk operation failed', 'error');
    } finally {
      setProcessing(false);
    }
  };

  // Auto-Cleanup requests > 7 days (Item 86)
  const handleCleanupExpired = async () => {
    const expiredRequests = requests.filter((r) => {
      if (r.status !== 'pending') return false;
      const createdDate = new Date(r.requested_at);
      const diffTime = Math.abs(new Date().getTime() - createdDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays > 7;
    });

    if (expiredRequests.length === 0) {
      toast('No pending reset requests older than 7 days found.', 'info');
      return;
    }

    const confirmed = await confirm({
      title: `Archive ${expiredRequests.length} Expired Resets?`,
      message: `Are you sure you want to reject and archive ${expiredRequests.length} requests older than 7 days?`,
      confirmLabel: 'Archive Now',
      cancelLabel: 'Cancel',
      type: 'warning',
    });

    if (!confirmed) return;

    setProcessing(true);
    let count = 0;
    try {
      for (const req of expiredRequests) {
        const fd = new FormData();
        fd.set('requestId', req.id);
        await rejectOrgDeviceResetAction(fd);
        count++;
      }
      toast(`Archived ${count} expired device reset requests`, 'success');
      await loadRequests();
    } catch {
      toast('Failed to complete cleanup', 'error');
    } finally {
      setProcessing(false);
    }
  };

  // Single Action with Email notice feedback (Item 87)
  const handleSingleAction = async (id: string, email: string, action: 'approve' | 'reject') => {
    setProcessing(true);
    try {
      const fd = new FormData();
      fd.set('requestId', id);
      const actionFn = action === 'approve' ? approveOrgDeviceResetAction : rejectOrgDeviceResetAction;
      await actionFn(fd);
      
      toast(`${action === 'approve' ? 'Approved' : 'Rejected'} reset. Access updates dispatched to ${email || 'user'} ✓`, 'success');
      await loadRequests();
    } catch (err: any) {
      toast(err.message || 'Operation failed.', 'error');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <PageShell
      title="Device Reset Requests"
      description="Approve or reject requests from users seeking to override bound hardware keys."
      nav={<AdminTabs items={orgAdminTabs} />}
    >
      {pending.length > 0 && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between gap-4">
          <p className="text-sm font-semibold text-amber-300">
            ⚠ {pending.length} pending device reset request{pending.length > 1 ? 's' : ''} require{pending.length === 1 ? 's' : ''} admin action.
          </p>
          <button
            onClick={handleCleanupExpired}
            disabled={processing}
            className="px-3 py-1.5 rounded-lg border border-amber-500/30 hover:bg-amber-500/10 text-amber-200 text-xs font-semibold cursor-pointer"
          >
            Archive Requests &gt; 7 Days
          </button>
        </div>
      )}

      <Section title="Reset Queue">
        {/* Filters */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-surface p-4 rounded-xl border border-border mb-4">
          <div className="flex items-center gap-2 flex-1 min-w-[280px]">
            <div className="relative flex-1 max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                placeholder="Search user, device label..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-lg bg-background border border-border text-xs text-text-primary outline-none focus:border-accent"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-xs text-text-primary outline-none font-semibold"
            >
              <option value="pending">Pending Queue</option>
              <option value="approved">Approved Resets</option>
              <option value="rejected">Rejected Resets</option>
              <option value="cancelled">Cancelled Resets</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            {selectedIds.length > 0 && (
              <>
                <button
                  onClick={() => handleBulkAction('approve')}
                  disabled={processing}
                  className="px-3 py-2 rounded-lg bg-success text-background text-xs font-bold hover:bg-success/90 transition-all cursor-pointer disabled:opacity-50"
                >
                  Approve Selected ({selectedIds.length})
                </button>
                <button
                  onClick={() => handleBulkAction('reject')}
                  disabled={processing}
                  className="px-3 py-2 rounded-lg border border-error/30 bg-error/10 text-error text-xs font-semibold hover:bg-error/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  Reject Selected ({selectedIds.length})
                </button>
              </>
            )}
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-text-muted">Loading reset requests...</div>
        ) : filteredRequests.length === 0 ? (
          <EmptyState title="No device reset requests">
            Pending user hardware reset requests appear here for visibility.
          </EmptyState>
        ) : (
          <TableWrap>
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className="w-10 thClass">
                    <button onClick={toggleSelectAll} className="text-text-muted hover:text-text-primary">
                      {selectedIds.length === filteredRequests.length ? (
                        <CheckSquare size={16} className="text-accent" />
                      ) : (
                        <Square size={16} />
                      )}
                    </button>
                  </th>
                  <th className={thClass}>User</th>
                  <th className={thClass}>Requested Device Info</th>
                  <th className={thClass}>Old Device binding</th>
                  <th className={thClass}>Requested At</th>
                  {/* Audit Details column (Item 88) */}
                  <th className={thClass}>Resolution Audit</th>
                  <th className={`${thClass} text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-background">
                {filteredRequests.map((request) => {
                  const isSelected = selectedIds.includes(request.id);
                  const isPending = request.status === 'pending';
                  const info = request.requested_device_info;

                  return (
                    <tr key={request.id} className={isSelected ? 'bg-accent-glow/30' : ''}>
                      <td>
                        <button onClick={() => toggleSelectRow(request.id)} className="text-text-muted hover:text-text-primary">
                          {isSelected ? (
                            <CheckSquare size={16} className="text-accent" />
                          ) : (
                            <Square size={16} />
                          )}
                        </button>
                      </td>
                      <td className={tdClass}>
                        <div className="font-semibold text-text-primary text-xs">{request.user_name}</div>
                        <div className="font-mono text-[10px] text-text-muted">{request.user_email}</div>
                      </td>
                      <td className={tdClass}>
                        <div className="text-text-primary text-xs font-semibold">{info?.deviceName ?? 'Unnamed device'}</div>
                        <div className="text-[10px] text-text-muted mt-0.5">
                          {info?.browser ?? 'Unknown Browser'} · {info?.os ?? 'Unknown OS'}
                        </div>
                      </td>
                      <td className={`${tdClass} text-xs text-text-muted`}>{request.old_device_name}</td>
                      <td className={`${tdClass} text-xs text-text-muted`}>{formatDateTime(request.requested_at)}</td>
                      
                      {/* Audit Details (Item 88) */}
                      <td className={`${tdClass} text-xs`}>
                        {request.status === 'approved' ? (
                          <div className="text-success font-medium">
                            Approved by <span className="underline">Admin</span>
                            <span className="block text-[9px] text-text-muted font-mono">{formatDateTime(request.reviewed_at)}</span>
                          </div>
                        ) : request.status === 'rejected' ? (
                          <div className="text-error font-medium">
                            Denied by <span className="underline">Admin</span>
                            <span className="block text-[9px] text-text-muted font-mono">{formatDateTime(request.reviewed_at)}</span>
                          </div>
                        ) : request.status === 'cancelled' ? (
                          <div className="text-text-muted italic">
                            Cancelled by User
                            <span className="block text-[9px] text-text-muted font-mono">{formatDateTime(request.reviewed_at)}</span>
                          </div>
                        ) : (
                          <span className="text-text-muted italic">Pending Review</span>
                        )}
                      </td>
                      
                      <td className={`${tdClass} text-right`}>
                        {isPending ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleSingleAction(request.id, request.user_email ?? '', 'approve')}
                              disabled={processing}
                              className="px-2.5 py-1.5 rounded-lg bg-success text-background text-xs font-bold hover:bg-success/90 transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50 font-semibold"
                            >
                              <Check size={12} /> Approve
                            </button>
                            <button
                              onClick={() => handleSingleAction(request.id, request.user_email ?? '', 'reject')}
                              disabled={processing}
                              className="px-2.5 py-1.5 rounded-lg border border-border text-text-secondary text-xs hover:text-error hover:border-error/30 transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                            >
                              <X size={12} /> Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-text-muted italic flex justify-end items-center gap-1">
                            <ShieldCheck size={12} className="text-success" /> Reviewed
                          </span>
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
