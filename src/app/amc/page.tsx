'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/Confirm';
import { formatINR } from '@/lib/engine/calculator';
import {
  FileText, Plus, Search, RefreshCw, X, Calendar,
  Wrench, Activity, Award, BarChart3, Bell, BellRing,
  Clock, CheckCircle, AlertTriangle, User, Phone, ChevronRight
} from 'lucide-react';
import { Select } from '@/components/ui/Select';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  active: 'Active',
  suspended: 'Suspended',
  expired: 'Expired',
  pending_renewal: 'Renewal Pending',
  cancelled: 'Cancelled'
};

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
  active: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  suspended: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  expired: 'bg-red-500/10 text-red-500 border-red-500/20',
  pending_renewal: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  cancelled: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
};

function daysUntil(dateStr: string): number {
  const date = new Date(dateStr);
  const now = new Date();
  return Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export default function AmcPage() {
  const [contracts, setContracts] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [visits, setVisits] = useState<any[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'contracts' | 'visits' | 'alerts'>('contracts');

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isVisitModalOpen, setIsVisitModalOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<any | null>(null);

  // Contract Form State
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [assetId, setAssetId] = useState('');
  const [amcPrice, setAmcPrice] = useState('');
  const [visitsPerYear, setVisitsPerYear] = useState('4');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Visit Form State
  const [visitDate, setVisitDate] = useState('');
  const [visitNotes, setVisitNotes] = useState('');
  const [visitType, setVisitType] = useState<'scheduled' | 'emergency'>('scheduled');

  const { toast } = useToast();
  const confirm = useConfirm();

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        setUserId(session.user.id);
        const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', session.user.id).single();
        if (profile?.org_id) setOrgId(profile.org_id);
      }
    });
  }, []);

  const fetchData = async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const [amcRes, assetsRes, visitsRes, profilesRes] = await Promise.all([
        supabase.from('field_amc_contracts').select('*, asset:field_customer_assets(brand, model, item_type, serial_number)').eq('org_id', orgId).order('created_at', { ascending: false }),
        supabase.from('field_customer_assets').select('*').eq('org_id', orgId),
        (supabase as any).from('field_amc_visits').select('*, contract:field_amc_contracts(contract_number, customer_name)').eq('org_id', orgId).order('visit_date', { ascending: true }),
        supabase.from('profiles').select('id, full_name, role').eq('org_id', orgId),
      ]);
      if (amcRes.error) throw amcRes.error;
      setContracts(amcRes.data || []);
      setAssets(assetsRes.data || []);
      setVisits(visitsRes.data || []);
      setTechnicians(profilesRes?.data || []);
    } catch (err: any) {
      // If visits table doesn't exist yet, still show contracts
      setContracts(contracts);
      console.warn('AMC visits table may not exist yet:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (orgId) fetchData(); }, [orgId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId) return;
    if (!startDate || !endDate) { toast('Enter contract start/end dates', 'error'); return; }
    try {
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const rand = Math.floor(1000 + Math.random() * 9000);
      const { error } = await supabase.from('field_amc_contracts').insert({
        org_id: orgId,
        contract_number: `AMC-${dateStr}-${rand}`,
        customer_name: customerName,
        customer_phone: customerPhone,
        asset_id: assetId || null,
        amc_price: parseFloat(amcPrice) || 0,
        visits_per_year: parseInt(visitsPerYear) || 4,
        completed_visits: 0,
        start_date: startDate,
        end_date: endDate,
        status: 'draft' as any
      });
      if (error) throw error;
      toast('AMC Contract created!', 'success');
      setIsModalOpen(false);
      setCustomerName(''); setCustomerPhone(''); setAssetId(''); setAmcPrice(''); setStartDate(''); setEndDate('');
      fetchData();
    } catch (err: any) {
      toast(err.message || 'Failed to create AMC contract', 'error');
    }
  };

  const handleRecordVisit = async (contractId: string) => {
    const contract = contracts.find(c => c.id === contractId);
    if (!contract) return;
    if (contract.completed_visits >= contract.visits_per_year) {
      toast('All scheduled visits completed for this period', 'info');
      return;
    }
    const confirmed = await confirm({
      title: 'Record Service Visit?',
      message: `Log a completed maintenance visit for ${contract.contract_number}?`,
      confirmLabel: 'Log Visit',
      cancelLabel: 'Cancel',
      type: 'info',
    });
    if (!confirmed) return;
    try {
      await supabase.from('field_amc_contracts').update({
        completed_visits: contract.completed_visits + 1,
        updated_at: new Date().toISOString()
      }).eq('id', contractId);

      // Try to log visit detail if table exists
      try {
        await (supabase as any).from('field_amc_visits').insert({
          org_id: orgId,
          contract_id: contractId,
          visit_date: new Date().toISOString().split('T')[0],
          visit_type: 'scheduled',
          conducted_by: userId,
          status: 'completed',
          notes: 'Maintenance visit recorded.',
        });
      } catch (e) { /* visits table optional */ }

      toast(`Visit recorded! (${contract.completed_visits + 1}/${contract.visits_per_year})`, 'success');
      fetchData();
    } catch (err: any) {
      toast(err.message || 'Failed to log visit', 'error');
    }
  };

  const handleScheduleVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContract || !orgId || !visitDate) return;
    try {
      await (supabase as any).from('field_amc_visits').insert({
        org_id: orgId,
        contract_id: selectedContract.id,
        visit_date: visitDate,
        visit_type: visitType,
        conducted_by: userId,
        status: 'scheduled',
        notes: visitNotes || null,
      });
      toast('Visit scheduled!', 'success');
      setIsVisitModalOpen(false);
      setVisitDate(''); setVisitNotes('');
      fetchData();
    } catch (err: any) {
      toast(err.message || 'Failed to schedule visit', 'error');
    }
  };

  const handleAssignTechnician = async (visitId: string, technicianId: string) => {
    try {
      await (supabase as any).from('field_amc_visits').update({ conducted_by: technicianId || null, updated_at: new Date().toISOString() }).eq('id', visitId);
      toast('Technician assigned successfully', 'success');
      fetchData();
    } catch (err: any) {
      toast(err.message || 'Failed to assign technician', 'error');
    }
  };

  const handleAssignTechnician = async (visitId: string, technicianId: string) => {
    try {
      await (supabase as any).from('field_amc_visits').update({ conducted_by: technicianId || null, updated_at: new Date().toISOString() }).eq('id', visitId);
      toast('Technician assigned successfully', 'success');
      fetchData();
    } catch (err: any) {
      toast(err.message || 'Failed to assign technician', 'error');
    }
  };

  const handleUpdateStatus = async (contractId: string, newStatus: string) => {
    try {
      await supabase.from('field_amc_contracts').update({ status: newStatus as any, updated_at: new Date().toISOString() }).eq('id', contractId);
      toast(`Status updated to ${STATUS_LABELS[newStatus]}`, 'success');
      fetchData();
    } catch (err: any) {
      toast(err.message || 'Failed to update status', 'error');
    }
  };

  const filteredContracts = useMemo(() =>
    contracts.filter(c => {
      const text = searchQuery.toLowerCase();
      const matches = c.contract_number.toLowerCase().includes(text) || c.customer_name.toLowerCase().includes(text) || (c.customer_phone || '').includes(text);
      const statusOk = statusFilter === 'all' || c.status === statusFilter;
      return matches && statusOk;
    }), [contracts, searchQuery, statusFilter]);

  const stats = useMemo(() => ({
    total: contracts.length,
    active: contracts.filter(c => c.status === 'active').length,
    pendingRenewal: contracts.filter(c => c.status === 'pending_renewal').length,
    expiringThisMonth: contracts.filter(c => {
      const days = daysUntil(c.end_date);
      return days >= 0 && days <= 30;
    }).length,
    totalRevenue: contracts.filter(c => c.status === 'active').reduce((s, c) => s + Number(c.amc_price), 0),
  }), [contracts]);

  const renewalAlerts = useMemo(() =>
    contracts.filter(c => c.status === 'active' && daysUntil(c.end_date) <= 30 && daysUntil(c.end_date) >= 0)
      .sort((a, b) => daysUntil(a.end_date) - daysUntil(b.end_date)),
    [contracts]);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <main className="flex-1 p-4 md:p-6 max-w-7xl mx-auto w-full space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-text-primary">Annual Maintenance Contracts (AMC)</h1>
            <p className="text-sm text-text-muted mt-0.5">Manage SLA contracts, schedule service visits, and track recurring revenue.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-background border border-border rounded-xl p-1">
              {(['contracts', 'visits', 'alerts'] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer relative ${activeTab === tab ? 'bg-accent text-background shadow' : 'text-text-muted hover:text-text-primary'}`}>
                  {tab === 'contracts' ? 'Contracts' : tab === 'visits' ? 'Visit Log' : 'Renewal Alerts'}
                  {tab === 'alerts' && renewalAlerts.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center">{renewalAlerts.length}</span>
                  )}
                </button>
              ))}
            </div>
            {activeTab === 'contracts' && (
              <button onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-background text-xs font-bold transition-all shadow-md shadow-accent/15 cursor-pointer">
                <Plus size={16} /> Create AMC Contract
              </button>
            )}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: 'Total Contracts', value: stats.total, icon: FileText, color: 'accent' },
            { label: 'Active SLAs', value: stats.active, icon: Activity, color: 'emerald-500' },
            { label: 'Renewals Pending', value: stats.pendingRenewal, icon: Calendar, color: 'purple-500' },
            { label: 'Expiring This Month', value: stats.expiringThisMonth, icon: AlertTriangle, color: 'amber-500' },
            { label: 'Active AMC Revenue', value: formatINR(stats.totalRevenue), icon: BarChart3, color: 'teal-500', isText: true },
          ].map(card => (
            <div key={card.label} className="bg-surface border border-border/40 rounded-2xl p-4 shadow-md card-hover flex items-center gap-3 relative overflow-hidden group">
              <div className={`absolute right-0 top-0 w-16 h-16 bg-${card.color}/5 rounded-full blur-xl`} />
              <div className={`w-10 h-10 rounded-xl bg-${card.color === 'accent' ? 'accent-dim text-accent' : `${card.color}/10 text-${card.color}`} flex items-center justify-center shrink-0`}>
                <card.icon size={18} />
              </div>
              <div>
                <p className="text-[9px] font-bold text-text-muted uppercase tracking-widest">{card.label}</p>
                <h4 className="text-lg font-black text-text-primary font-mono mt-0.5">{card.value}</h4>
              </div>
            </div>
          ))}
        </div>

        {/* Contracts Tab */}
        {activeTab === 'contracts' && (
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="flex-1 bg-surface border border-border/40 rounded-2xl p-4 shadow-md space-y-4">
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                  <input type="text" placeholder="Search by contract #, client, phone..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 rounded-lg bg-background border border-border text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent" />
                </div>
                <Select value={statusFilter} onChange={setStatusFilter}
                  options={[{ value: 'all', label: 'All' }, ...Object.entries(STATUS_LABELS).map(([v, l]) => ({ value: v, label: l }))]}
                  className="text-xs min-w-[140px]" />
                <button onClick={fetchData} className="p-2 rounded-lg border border-border hover:border-accent hover:text-accent cursor-pointer">
                  <RefreshCw size={14} />
                </button>
              </div>

              {loading ? (
                <div className="text-center py-20 text-xs text-text-muted animate-pulse font-mono uppercase tracking-widest">Loading AMC contracts...</div>
              ) : filteredContracts.length === 0 ? (
                <div className="text-center py-20 text-xs text-text-muted flex flex-col items-center gap-2">
                  <FileText size={32} className="text-text-muted/30" />
                  <p>No contracts match current filters.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-background/80 border-b border-border text-[10px] uppercase tracking-wider text-text-muted font-bold">
                        <th className="px-4 py-3">Contract #</th>
                        <th className="px-4 py-3">Customer</th>
                        <th className="px-4 py-3 text-right">Value</th>
                        <th className="px-4 py-3 text-center">Visits</th>
                        <th className="px-4 py-3">Expiry</th>
                        <th className="px-4 py-3 text-center">Status</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredContracts.map(c => {
                        const days = daysUntil(c.end_date);
                        const isExpiringSoon = days >= 0 && days <= 30;
                        return (
                          <tr key={c.id} onClick={() => setSelectedContract(c)}
                            className={`border-b border-border/30 hover:bg-surface-hover/30 cursor-pointer transition-colors ${selectedContract?.id === c.id ? 'bg-accent/5' : ''}`}>
                            <td className="px-4 py-3 font-mono font-bold text-accent">{c.contract_number}</td>
                            <td className="px-4 py-3">
                              <div className="font-bold text-text-primary">{c.customer_name}</div>
                              <div className="text-[10px] text-text-muted flex items-center gap-1 mt-0.5"><Phone size={10} /> {c.customer_phone || '—'}</div>
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-bold">{formatINR(c.amc_price)}</td>
                            <td className="px-4 py-3 text-center">
                              <div className="font-mono font-bold">{c.completed_visits} / {c.visits_per_year}</div>
                              <div className="w-16 h-1.5 bg-background border border-border/40 rounded-full mx-auto mt-1 overflow-hidden">
                                <div className="h-full bg-accent" style={{ width: `${(c.completed_visits / c.visits_per_year) * 100}%` }} />
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-text-secondary">{c.end_date}</div>
                              {isExpiringSoon && (
                                <div className="text-[9px] text-amber-500 flex items-center gap-0.5 mt-0.5">
                                  <Bell size={9} /> Expires in {days}d
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-semibold border ${STATUS_STYLES[c.status]}`}>
                                {STATUS_LABELS[c.status]}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-1.5">
                                {c.status === 'active' && (
                                  <>
                                    <button onClick={() => handleRecordVisit(c.id)}
                                      className="px-2 py-1 bg-accent/10 border border-accent/20 text-accent text-[9px] font-bold rounded hover:bg-accent/20 cursor-pointer">
                                      Log Visit
                                    </button>
                                    <button onClick={() => { setSelectedContract(c); setIsVisitModalOpen(true); }}
                                      className="px-2 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-500 text-[9px] font-bold rounded hover:bg-blue-500/20 cursor-pointer">
                                      Schedule
                                    </button>
                                  </>
                                )}
                                <select value={c.status} onChange={e => handleUpdateStatus(c.id, e.target.value)}
                                  className="bg-background border border-border text-[10px] rounded px-1.5 py-1 text-text-secondary outline-none focus:border-accent">
                                  {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                                </select>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Contract Details */}
            {selectedContract && (
              <div className="w-full lg:w-80 shrink-0 bg-surface border border-border/40 rounded-2xl p-4 shadow-md h-fit space-y-4">
                <h3 className="font-black text-text-primary text-xs uppercase tracking-widest flex items-center gap-1.5">
                  <Award size={14} className="text-accent" /> SLA Details
                </h3>
                <div className="space-y-2 text-xs">
                  {[
                    ['Contract #', selectedContract.contract_number],
                    ['Customer', selectedContract.customer_name],
                    ['Phone', selectedContract.customer_phone],
                    ['AMC Price', formatINR(selectedContract.amc_price)],
                    ['Visits/Year', `${selectedContract.visits_per_year} visits`],
                    ['Completed', `${selectedContract.completed_visits} visits`],
                    ['Start Date', selectedContract.start_date],
                    ['Expiry Date', selectedContract.end_date],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between border-b border-border/30 pb-2">
                      <span className="text-text-muted">{label}</span>
                      <span className="font-bold text-text-primary">{value}</span>
                    </div>
                  ))}
                </div>
                {selectedContract.asset && (
                  <div className="p-3 bg-background/50 border border-border/40 rounded-xl">
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block mb-1">Plant Asset</span>
                    <div className="font-bold text-text-secondary">{selectedContract.asset.brand} {selectedContract.asset.model}</div>
                    <div className="text-[10px] text-text-muted">{selectedContract.asset.item_type} · S/N: {selectedContract.asset.serial_number || 'N/A'}</div>
                  </div>
                )}
                {selectedContract.status === 'active' && (
                  <div className="space-y-2">
                    <button onClick={() => handleRecordVisit(selectedContract.id)}
                      className="w-full flex items-center justify-center gap-1.5 py-2.5 px-4 bg-accent hover:bg-accent-hover text-background text-xs font-bold rounded-lg cursor-pointer">
                      <Wrench size={14} /> Record Maintenance Visit
                    </button>
                    <button onClick={() => setIsVisitModalOpen(true)}
                      className="w-full flex items-center justify-center gap-1.5 py-2.5 px-4 bg-blue-500/10 border border-blue-500/20 text-blue-500 text-xs font-bold rounded-lg cursor-pointer hover:bg-blue-500/20">
                      <Calendar size={14} /> Schedule Future Visit
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Visit Log Tab */}
        {activeTab === 'visits' && (
          <div className="bg-surface border border-border/40 rounded-2xl p-4 shadow-md">
            <h3 className="font-black text-text-primary text-xs uppercase tracking-widest mb-4 flex items-center gap-1.5">
              <Activity size={14} className="text-accent" /> Service Visit History
            </h3>
            {visits.length === 0 ? (
              <div className="text-center py-20 text-xs text-text-muted flex flex-col items-center gap-2">
                <Wrench size={32} className="text-text-muted/30" />
                <p>No visits logged yet. Use "Log Visit" on a contract to start tracking.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-background/80 border-b border-border text-[10px] uppercase tracking-wider text-text-muted font-bold">
                      <th className="px-4 py-3">Contract</th>
                      <th className="px-4 py-3">Customer</th>
                      <th className="px-4 py-3">Visit Date</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Technician</th>
                      <th className="px-4 py-3 text-center">Status / SLA</th>
                      <th className="px-4 py-3">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visits.map((v: any) => {
                      const isOverdue = v.status === 'scheduled' && daysUntil(v.visit_date) < 0;
                      return (
                      <tr key={v.id} className="border-b border-border/30 hover:bg-surface-hover/30 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-accent">{v.contract?.contract_number || '—'}</td>
                        <td className="px-4 py-3 font-bold text-text-primary">{v.contract?.customer_name || '—'}</td>
                        <td className="px-4 py-3 text-text-secondary">{v.visit_date}</td>
                        <td className="px-4 py-3 capitalize text-text-secondary">{v.visit_type}</td>
                        <td className="px-4 py-3">
                          <select 
                            value={v.conducted_by || ''} 
                            onChange={(e) => handleAssignTechnician(v.id, e.target.value)}
                            className="bg-background border border-border text-[10px] rounded px-1.5 py-1 outline-none text-text-secondary max-w-[120px]"
                          >
                            <option value="">Unassigned</option>
                            {technicians.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                          </select>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-semibold border ${v.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : isOverdue ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'}`}>
                            {isOverdue ? 'SLA OVERDUE' : v.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-text-muted max-w-xs truncate">{v.notes || '—'}</td>
                      </tr>
                    );})}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Renewal Alerts Tab */}
        {activeTab === 'alerts' && (
          <div className="space-y-4">
            {renewalAlerts.length === 0 ? (
              <div className="bg-surface border border-border/40 rounded-2xl p-16 shadow-md text-center text-xs text-text-muted flex flex-col items-center gap-2">
                <CheckCircle size={32} className="text-emerald-500/50" />
                <p>No contracts expiring in the next 30 days. </p>
              </div>
            ) : (
              <>
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-2 text-xs text-amber-500">
                  <BellRing size={14} />
                  <span className="font-bold">{renewalAlerts.length} contract(s) expiring within 30 days.</span>
                  <span className="text-text-muted">Contact customers to discuss renewal.</span>
                </div>
                {renewalAlerts.map(c => {
                  const days = daysUntil(c.end_date);
                  return (
                    <div key={c.id} className="bg-surface border border-amber-500/30 rounded-2xl p-4 shadow-md flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center border font-mono font-black text-sm ${days <= 7 ? 'bg-red-500/10 text-red-500 border-red-500/30' : 'bg-amber-500/10 text-amber-500 border-amber-500/30'}`}>
                          {days}d
                        </div>
                        <div>
                          <div className="font-black text-text-primary text-sm">{c.customer_name}</div>
                          <div className="text-xs text-text-muted font-mono">{c.contract_number}</div>
                          <div className="text-xs text-text-secondary mt-0.5">Expires: {c.end_date} · Value: {formatINR(c.amc_price)}</div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleUpdateStatus(c.id, 'pending_renewal')}
                          className="px-3 py-1.5 text-xs font-bold bg-purple-500/10 border border-purple-500/20 text-purple-500 rounded-lg hover:bg-purple-500/20 cursor-pointer">
                          Mark for Renewal
                        </button>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}
      </main>

      {/* Create Contract Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-lg shadow-2xl animate-fade-in overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-black text-text-primary text-sm uppercase tracking-widest flex items-center gap-1.5">
                <FileText size={16} className="text-accent" /> New AMC Contract
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 rounded hover:bg-surface-hover text-text-muted cursor-pointer"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-text-secondary font-bold">Client Full Name *</label>
                  <input required value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="e.g. Rajesh Kumar"
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-text-primary focus:outline-none focus:border-accent" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-text-secondary font-bold">Client Phone *</label>
                  <input required value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="10-digit mobile"
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-text-primary focus:outline-none focus:border-accent" />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <label className="text-text-secondary font-bold">Plant Asset (Optional)</label>
                  <select value={assetId} onChange={e => setAssetId(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-text-primary focus:outline-none focus:border-accent">
                    <option value="">-- Select Asset --</option>
                    {assets.map(a => <option key={a.id} value={a.id}>[{a.item_type?.toUpperCase()}] {a.brand} {a.model}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-text-secondary font-bold">Annual Price (excl. GST) *</label>
                  <input required type="number" value={amcPrice} onChange={e => setAmcPrice(e.target.value)} placeholder="₹ INR value"
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-text-primary focus:outline-none focus:border-accent font-mono" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-text-secondary font-bold">Visits Per Year</label>
                  <select value={visitsPerYear} onChange={e => setVisitsPerYear(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-text-primary focus:outline-none focus:border-accent">
                    <option value="1">1 (Annual)</option>
                    <option value="2">2 (Semi-Annual)</option>
                    <option value="4">4 (Quarterly)</option>
                    <option value="12">12 (Monthly)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-text-secondary font-bold">Start Date *</label>
                  <input required type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-text-primary focus:outline-none focus:border-accent" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-text-secondary font-bold">End Date *</label>
                  <input required type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-text-primary focus:outline-none focus:border-accent" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-3 border-t border-border/40">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-border rounded-lg font-bold text-text-secondary hover:bg-surface-hover cursor-pointer">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-accent hover:bg-accent-hover text-background font-bold rounded-lg cursor-pointer">Create AMC Contract</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Schedule Visit Modal */}
      {isVisitModalOpen && selectedContract && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-md shadow-2xl animate-fade-in overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-black text-text-primary text-sm uppercase tracking-widest flex items-center gap-1.5">
                <Calendar size={16} className="text-accent" /> Schedule Service Visit
              </h3>
              <button onClick={() => setIsVisitModalOpen(false)} className="p-1 rounded hover:bg-surface-hover text-text-muted cursor-pointer"><X size={18} /></button>
            </div>
            <form onSubmit={handleScheduleVisit} className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-background/60 border border-border/40 rounded-lg">
                <span className="text-[10px] text-text-muted font-bold uppercase">Contract</span>
                <div className="font-bold text-accent font-mono">{selectedContract.contract_number}</div>
                <div className="text-text-secondary">{selectedContract.customer_name}</div>
              </div>
              <div className="space-y-1.5">
                <label className="font-bold text-text-secondary">Visit Date *</label>
                <input required type="date" value={visitDate} onChange={e => setVisitDate(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-text-primary focus:outline-none focus:border-accent" />
              </div>
              <div className="space-y-1.5">
                <label className="font-bold text-text-secondary">Visit Type</label>
                <select value={visitType} onChange={e => setVisitType(e.target.value as any)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-text-primary focus:outline-none focus:border-accent">
                  <option value="scheduled">Scheduled Maintenance</option>
                  <option value="emergency">Emergency Call-Out</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="font-bold text-text-secondary">Notes</label>
                <textarea rows={3} value={visitNotes} onChange={e => setVisitNotes(e.target.value)} placeholder="Work to be done..."
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-text-primary focus:outline-none focus:border-accent" />
              </div>
              <div className="flex justify-end gap-3 pt-3 border-t border-border/40">
                <button type="button" onClick={() => setIsVisitModalOpen(false)} className="px-4 py-2 border border-border rounded-lg font-bold text-text-secondary hover:bg-surface-hover cursor-pointer">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-accent hover:bg-accent-hover text-background font-bold rounded-lg cursor-pointer">Schedule Visit</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
