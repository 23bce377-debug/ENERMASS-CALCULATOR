'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/Toast';
import { formatINR } from '@/lib/engine/calculator';
import {
  Settings, Search, Save, RefreshCw, Edit3, Check, X,
  Clock, TrendingUp, TrendingDown, History, AlertTriangle
} from 'lucide-react';

interface RateMasterItem {
  id: string;
  org_id: string;
  bom_item_id?: string | null;
  item_name: string;
  override_rate: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface AuditEntry {
  id: string;
  item_name: string;
  old_rate: number;
  new_rate: number;
  changed_at: string;
  reason?: string;
}

export default function RateMasterPage() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [rates, setRates] = useState<RateMasterItem[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'rates' | 'history'>('rates');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRate, setEditRate] = useState('');
  const [editReason, setEditReason] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        setUserId(session.user.id);
        const { data: profile, error: profileError } = await supabase.from('profiles').select('org_id').eq('id', session.user.id).maybeSingle();
        if (profileError) {
          toast(`Failed to resolve organisation: ${profileError.message}`, 'error');
          return;
        }
        if (profile?.org_id) setOrgId(profile.org_id);
      }
    });
  }, []);

  const fetchData = async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const [ratesRes, auditRes] = await Promise.all([
        supabase.from('rate_master').select('*').eq('org_id', orgId).eq('is_active', true).order('item_name'),
        supabase.from('rate_master_audit_log').select('*').eq('org_id', orgId).order('changed_at', { ascending: false }).limit(100),
      ]);
      if (ratesRes.error) throw ratesRes.error;
      setRates(ratesRes.data || []);
      setAuditLog(auditRes.data || []);
    } catch (err: any) {
      toast(err.message || 'Failed to load rate master', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (orgId) fetchData(); }, [orgId]);

  const handleStartEdit = (item: RateMasterItem) => {
    setEditingId(item.id);
    setEditRate(String(item.override_rate));
    setEditReason('');
  };

  const handleSaveRate = async (item: RateMasterItem) => {
    const newRate = parseFloat(editRate);
    if (isNaN(newRate) || newRate < 0) {
      toast('Invalid rate value', 'error');
      return;
    }
    setSaving(true);
    try {
      // Log audit entry manually before update (in case trigger fails)
      const { error } = await supabase.from('rate_master').update({
        override_rate: newRate,
        updated_at: new Date().toISOString(),
      }).eq('id', item.id);
      if (error) throw error;

      // Update the audit log entry just created by the trigger to supply reason and actor
      await supabase.from('rate_master_audit_log')
        .update({
          reason: editReason || null,
          changed_by: userId,
        })
        .eq('rate_master_id', item.id)
        .eq('old_rate', item.override_rate)
        .eq('new_rate', newRate)
        .is('reason', null)
        .is('changed_by', null);

      toast(`Rate for "${item.item_name}" updated to ${formatINR(newRate)}`, 'success');
      setEditingId(null);
      fetchData();
    } catch (err: any) {
      toast(err.message || 'Failed to save rate', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditRate('');
    setEditReason('');
  };

  const filteredRates = useMemo(() =>
    rates.filter(r => r.item_name.toLowerCase().includes(searchQuery.toLowerCase())),
    [rates, searchQuery]);

  const stats = useMemo(() => ({
    total: rates.length,
    recentChanges: auditLog.filter(a => new Date(a.changed_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length,
  }), [rates, auditLog]);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <main className="flex-1 p-4 md:p-6 max-w-6xl mx-auto w-full space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-text-primary flex items-center gap-2">
              <Settings className="text-accent" size={24} /> Rate Master
            </h1>
            <p className="text-sm text-text-muted mt-0.5">
              Configure per-item override rates for BOM pricing. Changes are logged for audit.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-background border border-border rounded-xl p-1">
              {(['rates', 'history'] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeTab === tab ? 'bg-accent text-background shadow' : 'text-text-muted hover:text-text-primary'}`}>
                  {tab === 'rates' ? 'Override Rates' : 'Change History'}
                </button>
              ))}
            </div>
            <button onClick={fetchData} className="p-2.5 rounded-xl border border-border hover:border-accent hover:text-accent cursor-pointer transition-all">
              <RefreshCw size={15} />
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="bg-surface border border-border/40 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent-dim text-accent flex items-center justify-center shrink-0">
              <Settings size={18} />
            </div>
            <div>
              <p className="text-[9px] font-bold text-text-muted uppercase tracking-widest">Active Rate Overrides</p>
              <h4 className="text-xl font-black text-text-primary font-mono mt-0.5">{stats.total}</h4>
            </div>
          </div>
          <div className="bg-surface border border-border/40 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
              <History size={18} />
            </div>
            <div>
              <p className="text-[9px] font-bold text-text-muted uppercase tracking-widest">Changes in 7 Days</p>
              <h4 className="text-xl font-black text-text-primary font-mono mt-0.5">{stats.recentChanges}</h4>
            </div>
          </div>
          <div className="col-span-2 md:col-span-1 bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 flex items-start gap-3">
            <AlertTriangle size={18} className="text-amber-500 mt-0.5 shrink-0" />
            <p className="text-[10px] text-amber-600">
              Rate overrides directly affect all new quote calculations. Changes are permanent and audited. Coordinate with Finance before modifying.
            </p>
          </div>
        </div>

        {/* Rates Table */}
        {activeTab === 'rates' && (
          <div className="bg-surface border border-border/40 rounded-2xl shadow-md overflow-hidden">
            <div className="p-4 border-b border-border">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input type="text" placeholder="Search rate items..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-lg bg-background border border-border text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent" />
              </div>
            </div>

            {loading ? (
              <div className="text-center py-20 text-xs text-text-muted animate-pulse font-mono uppercase tracking-widest">Loading Rate Master...</div>
            ) : filteredRates.length === 0 ? (
              <div className="text-center py-20 text-xs text-text-muted flex flex-col items-center gap-2">
                <Settings size={32} className="text-text-muted/30" />
                <p>No rate overrides configured for this organization.</p>
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-background/80 border-b border-border text-[10px] uppercase tracking-wider text-text-muted font-bold">
                    <th className="px-4 py-3 text-left">Item Name</th>
                    <th className="px-4 py-3 text-right">Override Rate (₹)</th>
                    <th className="px-4 py-3 text-left">Last Updated</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRates.map(item => (
                    <tr key={item.id} className="border-b border-border/30 hover:bg-surface-hover/20 transition-colors">
                      <td className="px-4 py-3 font-bold text-text-primary">{item.item_name}</td>
                      <td className="px-4 py-3 text-right">
                        {editingId === item.id ? (
                          <div className="flex flex-col items-end gap-1.5">
                            <input
                              type="number"
                              value={editRate}
                              onChange={e => setEditRate(e.target.value)}
                              className="w-36 px-2 py-1.5 border border-accent rounded bg-background text-text-primary focus:outline-none font-mono text-right"
                              autoFocus
                            />
                            <input
                              type="text"
                              value={editReason}
                              onChange={e => setEditReason(e.target.value)}
                              placeholder="Reason for change (optional)"
                              className="w-52 px-2 py-1 border border-border/50 rounded bg-background text-text-muted text-[10px] focus:outline-none"
                            />
                          </div>
                        ) : (
                          <span className="font-mono font-bold text-accent">{formatINR(item.override_rate)}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-text-muted">
                        <div className="flex items-center gap-1">
                          <Clock size={10} />
                          {new Date(item.updated_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {editingId === item.id ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button onClick={() => handleSaveRate(item)} disabled={saving}
                              className="px-2.5 py-1.5 bg-emerald-500 text-white text-[10px] font-bold rounded hover:bg-emerald-600 cursor-pointer flex items-center gap-1 disabled:opacity-50">
                              <Check size={11} /> Save
                            </button>
                            <button onClick={handleCancelEdit}
                              className="px-2.5 py-1.5 bg-background border border-border text-text-muted text-[10px] font-bold rounded hover:border-red-500 hover:text-red-500 cursor-pointer flex items-center gap-1">
                              <X size={11} /> Cancel
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => handleStartEdit(item)}
                            className="px-2.5 py-1.5 bg-accent/10 border border-accent/20 text-accent text-[10px] font-bold rounded hover:bg-accent/20 cursor-pointer flex items-center gap-1 ml-auto">
                            <Edit3 size={11} /> Edit Rate
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Audit History Tab */}
        {activeTab === 'history' && (
          <div className="bg-surface border border-border/40 rounded-2xl shadow-md overflow-hidden">
            <div className="p-4 border-b border-border">
              <h3 className="font-black text-text-primary text-xs uppercase tracking-widest flex items-center gap-1.5">
                <History size={14} className="text-accent" /> Rate Change Audit Log
              </h3>
            </div>
            {auditLog.length === 0 ? (
              <div className="text-center py-20 text-xs text-text-muted flex flex-col items-center gap-2">
                <History size={32} className="text-text-muted/30" />
                <p>No rate changes recorded yet.</p>
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-background/80 border-b border-border text-[10px] uppercase tracking-wider text-text-muted font-bold">
                    <th className="px-4 py-3 text-left">Item Name</th>
                    <th className="px-4 py-3 text-right">Old Rate</th>
                    <th className="px-4 py-3 text-right">New Rate</th>
                    <th className="px-4 py-3 text-center">Change</th>
                    <th className="px-4 py-3 text-left">Reason</th>
                    <th className="px-4 py-3 text-left">Changed At</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLog.map(log => {
                    const delta = ((log.new_rate - log.old_rate) / (log.old_rate || 1)) * 100;
                    const isIncrease = delta > 0;
                    return (
                      <tr key={log.id} className="border-b border-border/30 hover:bg-surface-hover/20 transition-colors">
                        <td className="px-4 py-3 font-bold text-text-primary">{log.item_name}</td>
                        <td className="px-4 py-3 text-right font-mono text-text-muted line-through">{formatINR(log.old_rate)}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-accent">{formatINR(log.new_rate)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${isIncrease ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                            {isIncrease ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
                            {Math.abs(delta).toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-text-muted">{(log as any).reason || '—'}</td>
                        <td className="px-4 py-3 text-text-secondary">
                          {new Date(log.changed_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
