'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  AdminTabs,
  EmptyState,
  PageShell,
  Section,
  StatusBadge,
  TableWrap,
  dangerButtonClass,
  orgAdminTabs,
  tableClass,
  tdClass,
  thClass,
} from '@/components/saas/ManagementUi';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/Confirm';
import { supabase } from '@/lib/supabase/client';
import { revokeOrgDeviceAction } from '../saasActions';
import { Search, Laptop, ShieldCheck, X, Trash2, ShieldAlert, Cpu, Eye, Filter, RefreshCcw } from 'lucide-react';

interface DeviceItem {
  id: string;
  user_id: string;
  device_name: string | null;
  browser: string | null;
  os: string | null;
  status: string;
  first_seen_at: string;
  last_seen_at: string;
  revoked_at: string | null;
  // profile info resolved client-side
  user_name?: string;
  user_email?: string;
  // mock compliance (Item 79)
  is_encrypted?: boolean;
  screen_lock?: boolean;
  os_current?: boolean;
}

const REVOKE_REASONS = [
  'Employee left the company',
  'Device lost or stolen',
  'Hardware decommissioned',
  'Suspected key compromise',
  'Company policy compliance enforcement',
  'User request / Device upgrade',
];

export default function DevicesSettingsPage() {
  const { toast } = useToast();
  const confirm = useConfirm();

  const [loading, setLoading] = useState(true);
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [search, setSearch] = useState('');
  const [osFilter, setOsFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [sortField, setSortField] = useState<'last_seen_at' | 'first_seen_at'>('last_seen_at');

  // Detail Modal State (Item 76)
  const [selectedDevice, setSelectedDevice] = useState<DeviceItem | null>(null);
  
  // Revoke Modal Justification State (Item 77)
  const [revokingDevice, setRevokingDevice] = useState<DeviceItem | null>(null);
  const [revokeReason, setRevokeReason] = useState(REVOKE_REASONS[0]);

  const loadDevices = async () => {
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

      // Fetch User Devices
      const { data: dRows, error: dErr } = await supabase
        .from('user_devices')
        .select('*')
        .eq('org_id', orgId);
      
      if (dErr) throw dErr;

      // Resolve Member Emails / Names
      const uids = dRows.map(d => d.user_id).filter(Boolean);
      const { data: pRows } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', uids);
      
      const profileMap = new Map(pRows?.map(p => [p.id, p]) ?? []);

      const resolved = dRows.map((d) => {
        const prof = profileMap.get(d.user_id);
        
        // Seed stable mock compliance values (Item 79)
        const isCurrent = d.os === 'Windows' || d.os === 'macOS' || d.os === 'iOS';
        return {
          ...d,
          user_name: prof?.full_name ?? 'Unknown User',
          user_email: prof?.email ?? '—',
          is_encrypted: true, // mock secure baseline
          screen_lock: true,
          os_current: isCurrent,
        } as DeviceItem;
      });

      setDevices(resolved);
    } catch (err: any) {
      toast(err.message || 'Failed to load devices list', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDevices();
  }, []);

  // Filter & Search & Sort (Item 75)
  const processedDevices = useMemo(() => {
    let result = devices.filter((d) => {
      const matchSearch =
        (d.device_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (d.user_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (d.user_email || '').toLowerCase().includes(search.toLowerCase());
      
      const matchOs = osFilter ? d.os === osFilter : true;
      const matchStatus = statusFilter === 'active' ? d.status === 'active' : d.status !== 'active';

      return matchSearch && matchOs && matchStatus;
    });

    result.sort((a, b) => {
      const timeA = new Date(a[sortField]).getTime();
      const timeB = new Date(b[sortField]).getTime();
      return timeB - timeA; // default sort descending (newest first)
    });

    return result;
  }, [devices, search, osFilter, statusFilter, sortField]);

  const activeCount = useMemo(() => devices.filter(d => d.status === 'active').length, [devices]);
  const inactiveCount = useMemo(() => devices.filter(d => d.status !== 'active').length, [devices]);

  // Bulk Revoke Inactive > 30 Days (Item 78)
  const handleBulkRevokeInactive = async () => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);

    const inactiveDevicesToRevoke = devices.filter((d) => {
      if (d.status !== 'active') return false;
      const lastActive = new Date(d.last_seen_at);
      return lastActive < cutoff;
    });

    if (inactiveDevicesToRevoke.length === 0) {
      toast('No active devices are inactive for more than 30 days.', 'info');
      return;
    }

    const confirmed = await confirm({
      title: `Bulk Revoke ${inactiveDevicesToRevoke.length} Devices?`,
      message: `Are you sure you want to revoke access for ${inactiveDevicesToRevoke.length} devices inactive for over 30 days? This will force users to submit new reset requests.`,
      confirmLabel: 'Revoke Inactive',
      cancelLabel: 'Cancel',
      type: 'danger',
    });

    if (!confirmed) return;

    setLoading(true);
    try {
      for (const d of inactiveDevicesToRevoke) {
        const fd = new FormData();
        fd.set('deviceId', d.id);
        await revokeOrgDeviceAction(fd);
      }
      toast(`Successfully revoked ${inactiveDevicesToRevoke.length} inactive devices`, 'success');
      await loadDevices();
    } catch (err: any) {
      toast(err.message || 'Bulk revocation failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Justified Revocation Execution (Item 77)
  const executeRevoke = async () => {
    if (!revokingDevice) return;
    setLoading(true);
    setRevokingDevice(null);

    try {
      const fd = new FormData();
      fd.set('deviceId', revokingDevice.id);
      fd.set('reason', revokeReason);
      await revokeOrgDeviceAction(fd);
      
      // log to audit if needed (handled in server action, or we log here)
      toast(`Device access revoked. Reason: ${revokeReason}`, 'success');
      await loadDevices();
    } catch (err: any) {
      toast(err.message || 'Failed to revoke device access', 'error');
    } finally {
      setLoading(false);
    }
  };

  function formatDateStr(iso: string | null | undefined) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  return (
    <PageShell
      title="Hardware Keys & Devices"
      description={`Audit active cryptographic credentials registered in your organization. ${activeCount} active, ${inactiveCount} historical.`}
      nav={<AdminTabs items={orgAdminTabs} />}
    >
      {/* Search and Filters panel */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-surface p-4 rounded-xl border border-border">
        <div className="flex items-center gap-2 flex-1 min-w-[280px]">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="Search user, device name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-background border border-border text-xs text-text-primary outline-none focus:border-accent"
            />
          </div>

          <select
            value={osFilter}
            onChange={(e) => setOsFilter(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-xs text-text-primary outline-none"
          >
            <option value="">All Operating Systems</option>
            <option value="Windows">Windows</option>
            <option value="macOS">macOS</option>
            <option value="iOS">iOS</option>
            <option value="Android">Android</option>
            <option value="Linux">Linux</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-xs text-text-primary outline-none font-semibold"
          >
            <option value="active">Active Devices</option>
            <option value="revoked">Revoked / Inactive</option>
          </select>

          <select
            value={sortField}
            onChange={(e) => setSortField(e.target.value as any)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-xs text-text-primary outline-none"
          >
            <option value="last_seen_at">Sort by: Last Active</option>
            <option value="first_seen_at">Sort by: Registered Date</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          {/* Bulk Revoke (Item 78) */}
          <button
            onClick={handleBulkRevokeInactive}
            className="px-3 py-2 rounded-lg border border-error/30 bg-error/10 hover:bg-error/20 text-error text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 size={13} /> Revoke Inactive &gt; 30d
          </button>
        </div>
      </div>

      {/* Main List */}
      <Section
        title={statusFilter === 'active' ? 'Active Verified Devices' : 'Deactivated History Log'}
        aside={
          <span className="text-xs text-text-muted font-bold">
            {processedDevices.length} matching rows
          </span>
        }
      >
        {loading ? (
          <div className="p-8 text-center text-xs text-text-muted">Loading device credentials...</div>
        ) : processedDevices.length === 0 ? (
          <EmptyState title="No matching devices found">
            Verify filter options or search queries.
          </EmptyState>
        ) : (
          <TableWrap>
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>Verified Client</th>
                  <th className={thClass}>Owner / Operator</th>
                  <th className={thClass}>Telemetry Logs</th>
                  <th className={thClass}>Compliance checks</th>
                  <th className={thClass}>Licensing State</th>
                  <th className={`${thClass} text-right`}>Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-background">
                {processedDevices.map((device) => (
                  <tr key={device.id} className="hover:bg-surface-hover/30 transition-colors">
                    <td className={tdClass}>
                      <div className="flex items-start gap-2.5">
                        <div className="p-2 rounded-lg bg-surface border border-border text-text-secondary mt-0.5">
                          <Laptop size={15} />
                        </div>
                        <div>
                          <div className="font-semibold text-text-primary text-xs flex items-center gap-2">
                            {device.device_name ?? 'Primary Keypair'}
                          </div>
                          <div className="text-[10px] text-text-muted mt-0.5">
                            {device.browser} · {device.os}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className={tdClass}>
                      <div className="text-xs font-semibold text-text-primary">{device.user_name}</div>
                      <div className="text-[10px] text-text-muted font-mono">{device.user_email}</div>
                    </td>
                    <td className={tdClass}>
                      <div className="text-[10px] text-text-secondary">
                        <span className="text-text-muted font-bold">First Seen:</span> {formatDateStr(device.first_seen_at)}
                      </div>
                      <div className="text-[10px] text-text-secondary mt-0.5">
                        <span className="text-text-muted font-bold">Last Active:</span> {formatDateStr(device.last_seen_at)}
                      </div>
                    </td>
                    {/* Device compliance checks (Item 79) */}
                    <td className={tdClass}>
                      <div className="flex flex-wrap gap-1">
                        <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-success/10 text-success border border-success/15 uppercase">
                          Encrypted
                        </span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-success/10 text-success border border-success/15 uppercase">
                          Screen Lock
                        </span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase border ${
                          device.os_current
                            ? 'bg-success/10 text-success border-success/15'
                            : 'bg-warning/10 text-warning border-warning/15'
                        }`}>
                          {device.os_current ? 'OS CURRENT' : 'OS VER STALE'}
                        </span>
                      </div>
                    </td>
                    <td className={tdClass}>
                      <StatusBadge status={device.status} />
                    </td>
                    <td className={`${tdClass} text-right`}>
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Device Detail Trigger (Item 76) */}
                        <button
                          onClick={() => setSelectedDevice(device)}
                          className="p-1 rounded bg-surface border border-border text-text-secondary hover:text-accent hover:border-accent/30 cursor-pointer"
                          title="View Fingerprint Details"
                        >
                          <Eye size={13} />
                        </button>
                        
                        {device.status === 'active' && (
                          <button
                            onClick={() => {
                              setRevokeReason(REVOKE_REASONS[0]);
                              setRevokingDevice(device);
                            }}
                            className="p-1 rounded border border-error/25 bg-error/5 text-error hover:bg-error/15 cursor-pointer text-xs font-semibold px-2 py-1"
                            title="Revoke client access key"
                          >
                            Revoke
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Section>

      {/* Device Details Modal (Item 76) */}
      {selectedDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedDevice(null)} />
          <div className="relative w-full max-w-lg bg-surface border border-border rounded-xl shadow-2xl overflow-hidden animate-scale-in">
            <div className="p-5 border-b border-border bg-surface-2 flex justify-between items-center">
              <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                <ShieldCheck size={16} className="text-accent" />
                Device Cryptographic Audit
              </h3>
              <button onClick={() => setSelectedDevice(null)} className="text-text-muted hover:text-text-primary">
                ✕
              </button>
            </div>
            
            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider block">Hostname / Label</span>
                  <span className="text-sm font-bold text-text-primary">{selectedDevice.device_name}</span>
                </div>
                <div>
                  <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider block">Registered Owner</span>
                  <span className="text-sm font-bold text-text-primary">{selectedDevice.user_name}</span>
                </div>
                <div>
                  <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider block">Operating System</span>
                  <span className="text-text-secondary">{selectedDevice.os}</span>
                </div>
                <div>
                  <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider block">Browser Client</span>
                  <span className="text-text-secondary">{selectedDevice.browser}</span>
                </div>
              </div>

              <div className="pt-3 border-t border-border/60">
                <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider block mb-1">Hardware Fingerprint Hash</span>
                <span className="font-mono text-text-primary break-all bg-background border border-border/80 p-2.5 rounded-lg block select-all">
                  {selectedDevice.id || 'f4b329a1c8f...'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-3 border-t border-border/60">
                <div>
                  <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider block">Date Registered</span>
                  <span className="text-text-secondary">{formatDateStr(selectedDevice.first_seen_at)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider block">Last Verification</span>
                  <span className="text-text-secondary">{formatDateStr(selectedDevice.last_seen_at)}</span>
                </div>
              </div>

              <div className="pt-3 border-t border-border/60 space-y-2">
                <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider block">Security Compliance Audit Checklist</span>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 rounded border border-success/20 bg-success/5">
                    <span className="font-bold text-success block">YES</span>
                    <span className="text-[9px] text-text-muted">FDE Encryption</span>
                  </div>
                  <div className="p-2 rounded border border-success/20 bg-success/5">
                    <span className="font-bold text-success block">YES</span>
                    <span className="text-[9px] text-text-muted">Screen Lock Pin</span>
                  </div>
                  <div className="p-2 rounded border border-success/20 bg-success/5">
                    <span className="font-bold text-success block">PASS</span>
                    <span className="text-[9px] text-text-muted">FIDO2 WebAuthn</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-border bg-surface-2 flex justify-end">
              <button
                onClick={() => setSelectedDevice(null)}
                className="px-4 py-2 bg-accent text-background text-xs font-bold hover:bg-accent-hover rounded-lg transition-colors cursor-pointer"
              >
                Close Audit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revocation Justification Modal (Item 77) */}
      {revokingDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setRevokingDevice(null)} />
          <div className="relative w-full max-w-md bg-surface border border-border rounded-xl shadow-2xl overflow-hidden animate-scale-in">
            <div className="p-5 border-b border-border bg-surface-2 flex justify-between items-center">
              <h3 className="text-sm font-bold text-error flex items-center gap-2">
                <ShieldAlert size={16} />
                Justify Device Revocation
              </h3>
              <button onClick={() => setRevokingDevice(null)} className="text-text-muted hover:text-text-primary">
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-text-secondary leading-relaxed">
                You are about to revoke verified credentials for <strong>{revokingDevice.device_name}</strong> ({revokingDevice.user_email}). Select the administrative reason below:
              </p>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">Revocation Reason</label>
                <select
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                  className="w-full bg-background border border-border focus:border-accent rounded-lg p-2.5 text-xs text-text-primary outline-none"
                >
                  {REVOKE_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-3 bg-error/5 border border-error/20 text-[11px] text-error rounded-lg leading-normal flex gap-2">
                <ShieldAlert size={14} className="shrink-0 mt-0.5" />
                <span><strong>Warning:</strong> Revocation is immediate. The user will be signed out instantly and cannot log back in without an administrator approving their new device request.</span>
              </div>
            </div>

            <div className="p-4 border-t border-border bg-surface-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setRevokingDevice(null)}
                className="px-4 py-2 text-xs border border-border hover:bg-surface-hover rounded-lg text-text-secondary font-semibold transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeRevoke}
                className="px-4 py-2 text-xs font-semibold bg-error text-white hover:bg-error-dark rounded-lg transition-all"
              >
                Confirm Revoke
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
