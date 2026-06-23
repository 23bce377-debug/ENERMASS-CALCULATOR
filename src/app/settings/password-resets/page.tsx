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
import { CheckSquare, Square, Trash2, ShieldCheck, Mail, Search, Clock, Check, X, ShieldAlert } from 'lucide-react';

interface ResetRequest {
  id: string;
  user_id: string;
  status: string;
  requested_at: string;
  expires_at: string;
  user_email: string | null;
  user_name: string | null;
  approved_by: string | null;
  approved_at: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
}

export default function OrgPasswordResetsPage() {
  const { toast } = useToast();
  const confirm = useConfirm();

  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<ResetRequest[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending_admin_approval');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);

  // Load requests
  const loadRequests = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/settings/password-resets');
      if (res.ok) {
        const data = await res.json() as { requests: ResetRequest[] };
        setRequests(data.requests || []);
      } else {
        toast('Failed to load password resets list.', 'error');
      }
    } catch {
      toast('Network error loading requests.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const pending = useMemo(() => requests.filter((r) => r.status === 'pending_admin_approval'), [requests]);

  // Filter and Search Logic
  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      const matchSearch =
        (r.user_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (r.user_email || '').toLowerCase().includes(search.toLowerCase());
      
      const matchStatus = statusFilter ? r.status === statusFilter : true;
      return matchSearch && matchStatus;
    });
  }, [requests, search, statusFilter]);

  // Checkbox selection
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
    const targets = requests.filter((r) => selectedIds.includes(r.id) && r.status === 'pending_admin_approval');
    if (targets.length === 0) {
      toast('No pending selected requests found.', 'error');
      return;
    }

    const confirmed = await confirm({
      title: `${action === 'approve' ? 'Approve' : 'Reject'} ${targets.length} Requests?`,
      message: `Are you sure you want to ${action} password resets for ${targets.length} selected user(s)? ${
        action === 'approve' ? 'This will dispatch Supabase magic recovery links to their emails.' : 'This will deny reset requests.'
      }`,
      confirmLabel: action === 'approve' ? 'Approve & Send Emails' : 'Reject Requests',
      cancelLabel: 'Cancel',
      type: action === 'approve' ? 'warning' : 'danger',
    });

    if (!confirmed) return;

    setProcessing(true);
    let successCount = 0;

    try {
      for (const req of targets) {
        const res = await fetch(`/api/settings/password-resets/${req.id}/${action}`, { method: 'POST' });
        if (res.ok) {
          successCount++;
        }
      }
      toast(`Successfully ${action}d ${successCount} password reset requests. Email notifications dispatched ✓`, 'success');
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
      if (r.status !== 'pending_admin_approval') return false;
      const expiry = new Date(r.expires_at);
      const isExpired = expiry < new Date();
      
      // Or check if created > 7 days ago
      const createdDate = new Date(r.requested_at);
      const diffTime = Math.abs(new Date().getTime() - createdDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return isExpired || diffDays > 7;
    });

    if (expiredRequests.length === 0) {
      toast('No expired pending requests older than 7 days found.', 'info');
      return;
    }

    const confirmed = await confirm({
      title: `Archive ${expiredRequests.length} Expired Requests?`,
      message: `Rejects and archives ${expiredRequests.length} requests that have expired or are older than 7 days. Users will need to submit new reset requests.`,
      confirmLabel: 'Clean Up Now',
      cancelLabel: 'Cancel',
      type: 'warning',
    });

    if (!confirmed) return;

    setProcessing(true);
    let count = 0;
    try {
      for (const req of expiredRequests) {
        const res = await fetch(`/api/settings/password-resets/${req.id}/reject`, { method: 'POST' });
        if (res.ok) {
          count++;
        }
      }
      toast(`Archived ${count} expired password reset requests`, 'success');
      await loadRequests();
    } catch {
      toast('Failed to complete cleanup archive', 'error');
    } finally {
      setProcessing(false);
    }
  };

  // Single Actions
  const handleSingleAction = async (id: string, email: string, action: 'approve' | 'reject') => {
    setProcessing(true);
    try {
      const res = await fetch(`/api/settings/password-resets/${id}/${action}`, { method: 'POST' });
      if (res.ok) {
        toast(`${action === 'approve' ? 'Approved' : 'Rejected'} password reset. Email notification dispatched to ${email || 'user'} ✓`, 'success');
        await loadRequests();
      } else {
        const d = await res.json() as { error?: string };
        toast(d.error || 'Operation failed.', 'error');
      }
    } catch {
      toast('Network error during review.', 'error');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <PageShell
      title="Reset Password Approval"
      description="Review and authorize password reset credentials for team members."
      nav={<AdminTabs items={orgAdminTabs} />}
    >
      {pending.length > 0 && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between gap-4">
          <p className="text-sm font-semibold text-amber-300">
            ⚠ {pending.length} pending password reset request{pending.length > 1 ? 's' : ''} require{pending.length === 1 ? 's' : ''} your approval.
          </p>
          <button
            onClick={handleCleanupExpired}
            disabled={processing}
            className="px-3 py-1.5 rounded-lg border border-amber-500/30 hover:bg-amber-500/10 text-amber-200 text-xs font-semibold cursor-pointer"
          >
            Archive Expired Requests
          </button>
        </div>
      )}

      <Section title="Requests Queue">
        {/* Filters Row */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-surface p-4 rounded-xl border border-border mb-4">
          <div className="flex items-center gap-2 flex-1 min-w-[280px]">
            <div className="relative flex-1 max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                placeholder="Search user email..."
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
              <option value="pending_admin_approval">Pending Approvals</option>
              <option value="link_sent">Approved (Emails Sent)</option>
              <option value="rejected">Rejected Requests</option>
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
          <EmptyState title="No reset requests found">
            Pending user password requests will appear here for your review.
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
                  <th className={thClass}>Status</th>
                  <th className={thClass}>Requested At</th>
                  <th className={thClass}>Expires</th>
                  {/* Audit details header (Item 88) */}
                  <th className={thClass}>Resolution Audit</th>
                  <th className={`${thClass} text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-background">
                {filteredRequests.map((req) => {
                  const isSelected = selectedIds.includes(req.id);
                  const isPending = req.status === 'pending_admin_approval';

                  return (
                    <tr key={req.id} className={isSelected ? 'bg-accent-glow/30' : ''}>
                      <td>
                        <button onClick={() => toggleSelectRow(req.id)} className="text-text-muted hover:text-text-primary">
                          {isSelected ? (
                            <CheckSquare size={16} className="text-accent" />
                          ) : (
                            <Square size={16} />
                          )}
                        </button>
                      </td>
                      <td className={tdClass}>
                        <div className="font-semibold text-text-primary text-xs">{req.user_name ?? 'Unknown user'}</div>
                        <div className="font-mono text-[10px] text-text-muted">{req.user_email ?? req.user_id}</div>
                      </td>
                      <td className={tdClass}>
                        <StatusBadge status={req.status} />
                      </td>
                      <td className={`${tdClass} text-xs text-text-muted`}>{formatDateTime(req.requested_at)}</td>
                      <td className={`${tdClass} text-xs text-text-muted`}>{formatDateTime(req.expires_at)}</td>
                      {/* Audit Details cell (Item 88) */}
                      <td className={`${tdClass} text-xs`}>
                        {req.status === 'link_sent' || req.status === 'approved' ? (
                          <div className="text-success font-medium">
                            Approved by <span className="underline">Admin</span>
                            <span className="block text-[9px] text-text-muted font-mono">{formatDateTime(req.approved_at)}</span>
                          </div>
                        ) : req.status === 'rejected' ? (
                          <div className="text-error font-medium">
                            Denied by <span className="underline">Admin</span>
                            <span className="block text-[9px] text-text-muted font-mono">{formatDateTime(req.rejected_at)}</span>
                          </div>
                        ) : (
                          <span className="text-text-muted italic">Pending Review</span>
                        )}
                      </td>
                      <td className={`${tdClass} text-right`}>
                        {isPending ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleSingleAction(req.id, req.user_email ?? '', 'approve')}
                              disabled={processing}
                              className="px-2.5 py-1.5 rounded-lg bg-success text-background text-xs font-bold hover:bg-success/90 transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                            >
                              <Check size={12} /> Approve
                            </button>
                            <button
                              onClick={() => handleSingleAction(req.id, req.user_email ?? '', 'reject')}
                              disabled={processing}
                              className="px-2.5 py-1.5 rounded-lg border border-border text-text-secondary text-xs hover:text-error hover:border-error/30 transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                            >
                              <X size={12} /> Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-text-muted italic flex justify-end items-center gap-1">
                            <ShieldCheck size={12} className="text-success" /> Checked
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
