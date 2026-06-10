'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase/client';
import { 
  FileText, Plus, Search, Filter, RefreshCw, X, Calendar, 
  User, Phone, Wrench, ShieldCheck, Activity, Award, BarChart3
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/Confirm';
import { Select } from '@/components/ui/Select';
import { formatINR } from '@/lib/engine/calculator';

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

export default function AmcPage() {
  const [contracts, setContracts] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters & UI State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<any | null>(null);

  // Form State
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [assetId, setAssetId] = useState('');
  const [amcPrice, setAmcPrice] = useState('');
  const [visitsPerYear, setVisitsPerYear] = useState('4');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const { toast } = useToast();
  const confirm = useConfirm();

  // Fetch Session Context
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('org_id')
          .eq('id', session.user.id)
          .single();
        if (profile?.org_id) {
          setOrgId(profile.org_id);
        }
      }
    });
  }, []);

  // Fetch Page Data
  const fetchData = async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      // Fetch AMC Contracts
      const { data: amcData, error: amcErr } = await supabase
        .from('field_amc_contracts')
        .select(`
          *,
          asset:field_customer_assets(brand, model, item_type, serial_number)
        `)
        .eq('org_id', orgId)
        .order('created_at', { ascending: false });

      if (amcErr) throw amcErr;
      setContracts(amcData || []);

      // Fetch Customer Assets
      const { data: assetsData } = await supabase
        .from('field_customer_assets')
        .select('*')
        .eq('org_id', orgId);
      setAssets(assetsData || []);

    } catch (err: any) {
      console.error(err);
      toast(err.message || 'Failed to load AMC contracts data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (orgId) {
      fetchData();
    }
  }, [orgId]);

  // Create AMC Contract
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId) return;

    if (!startDate || !endDate) {
      toast('Please enter contract start and end dates', 'error');
      return;
    }

    try {
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const rand = Math.floor(1000 + Math.random() * 9000);
      const generatedContractNum = `AMC-${dateStr}-${rand}`;

      const payload = {
        org_id: orgId,
        contract_number: generatedContractNum,
        customer_name: customerName,
        customer_phone: customerPhone,
        asset_id: assetId || null,
        amc_price: parseFloat(amcPrice) || 0,
        visits_per_year: parseInt(visitsPerYear) || 4,
        completed_visits: 0,
        start_date: startDate,
        end_date: endDate,
        status: 'draft' as any
      };

      const { error } = await supabase
        .from('field_amc_contracts')
        .insert(payload);

      if (error) throw error;

      toast(`AMC Contract ${generatedContractNum} created as Draft!`, 'success');
      setIsModalOpen(false);

      // Reset Form
      setCustomerName('');
      setCustomerPhone('');
      setAssetId('');
      setAmcPrice('');
      setVisitsPerYear('4');
      setStartDate('');
      setEndDate('');

      fetchData();
    } catch (err: any) {
      toast(err.message || 'Failed to create AMC contract', 'error');
    }
  };

  // Record completed visit
  const handleRecordVisit = async (contractId: string) => {
    const contract = contracts.find(c => c.id === contractId);
    if (!contract) return;

    if (contract.completed_visits >= contract.visits_per_year) {
      toast('All scheduled maintenance visits completed for this period', 'info');
      return;
    }

    const confirmed = await confirm({
      title: 'Record Service Visit?',
      message: `Do you want to log a completed service audit for contract: ${contract.contract_number}? This increments the visits count.`,
      confirmLabel: 'Log Visit',
      cancelLabel: 'Cancel',
      type: 'info'
    });

    if (confirmed) {
      try {
        const nextCompleted = contract.completed_visits + 1;
        const { error } = await supabase
          .from('field_amc_contracts')
          .update({ 
            completed_visits: nextCompleted,
            updated_at: new Date().toISOString()
          })
          .eq('id', contractId);

        if (error) throw error;

        toast(`Service visit recorded successfully! (${nextCompleted}/${contract.visits_per_year})`, 'success');
        if (selectedContract?.id === contractId) {
          setSelectedContract({
            ...selectedContract,
            completed_visits: nextCompleted
          });
        }
        fetchData();
      } catch (err: any) {
        toast(err.message || 'Failed to increment visit count', 'error');
      }
    }
  };

  // Update contract status
  const handleUpdateStatus = async (contractId: string, newStatus: string) => {
    const contract = contracts.find(c => c.id === contractId);
    if (!contract) return;

    try {
      const { error } = await supabase
        .from('field_amc_contracts')
        .update({ 
          status: newStatus as any,
          updated_at: new Date().toISOString()
        })
        .eq('id', contractId);

      if (error) throw error;

      toast(`Contract status transitioned to ${STATUS_LABELS[newStatus]}`, 'success');
      if (selectedContract?.id === contractId) {
        setSelectedContract({ ...selectedContract, status: newStatus });
      }
      fetchData();
    } catch (err: any) {
      toast(err.message || 'Failed to update contract status', 'error');
    }
  };

  // Filters
  const filteredContracts = useMemo(() => {
    return contracts.filter(c => {
      const text = searchQuery.toLowerCase();
      const matchesSearch = 
        c.contract_number.toLowerCase().includes(text) ||
        c.customer_name.toLowerCase().includes(text) ||
        c.customer_phone.toLowerCase().includes(text) ||
        (c.asset?.brand || '').toLowerCase().includes(text) ||
        (c.asset?.model || '').toLowerCase().includes(text);
      
      const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [contracts, searchQuery, statusFilter]);

  // Statistics
  const stats = useMemo(() => {
    const total = contracts.length;
    const active = contracts.filter(c => c.status === 'active').length;
    const pendingRenewal = contracts.filter(c => c.status === 'pending_renewal').length;
    const totalRevenue = contracts
      .filter(c => c.status === 'active')
      .reduce((sum, c) => sum + Number(c.amc_price), 0);

    return { total, active, pendingRenewal, totalRevenue };
  }, [contracts]);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <main className="flex-1 p-4 md:p-6 max-w-7xl mx-auto w-full space-y-6">
        
        {/* Header section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-text-primary">Annual Maintenance Contracts (AMC)</h1>
            <p className="text-sm text-text-muted mt-0.5">Manage SLA contracts, log scheduled site maintenance, and track recurring revenue.</p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-background text-xs font-bold transition-all shadow-md shadow-accent/15 cursor-pointer"
          >
            <Plus size={16} />
            Create AMC Contract
          </button>
        </div>

        {/* Dashboard Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          <div className="bg-surface border border-border/40 rounded-2xl p-5 shadow-md card-hover flex items-center gap-4 relative overflow-hidden group">
            <div className="absolute right-0 top-0 w-24 h-24 bg-accent/5 rounded-full blur-2xl group-hover:bg-accent/10 transition-all duration-300" />
            <div className="w-12 h-12 rounded-xl bg-accent-dim text-accent flex items-center justify-center border border-accent/20 shrink-0">
              <FileText size={22} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Total Contracts</p>
              <h4 className="text-2xl font-black text-text-primary font-mono mt-1">{stats.total}</h4>
            </div>
          </div>

          <div className="bg-surface border border-border/40 rounded-2xl p-5 shadow-md card-hover flex items-center gap-4 relative overflow-hidden group">
            <div className="absolute right-0 top-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-all duration-300" />
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center border border-emerald-500/20 shrink-0">
              <Activity size={22} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Active SLAs</p>
              <h4 className="text-2xl font-black text-text-primary font-mono mt-1">{stats.active}</h4>
            </div>
          </div>

          <div className="bg-surface border border-border/40 rounded-2xl p-5 shadow-md card-hover flex items-center gap-4 relative overflow-hidden group">
            <div className="absolute right-0 top-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl group-hover:bg-purple-500/10 transition-all duration-300" />
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center border border-purple-500/20 shrink-0">
              <Calendar size={22} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Renewals Pending</p>
              <h4 className="text-2xl font-black text-text-primary font-mono mt-1">{stats.pendingRenewal}</h4>
            </div>
          </div>

          <div className="bg-surface border border-border/40 rounded-2xl p-5 shadow-md card-hover flex items-center gap-4 relative overflow-hidden group">
            <div className="absolute right-0 top-0 w-24 h-24 bg-teal-500/5 rounded-full blur-2xl group-hover:bg-teal-500/10 transition-all duration-300" />
            <div className="w-12 h-12 rounded-xl bg-teal-500/10 text-teal-500 flex items-center justify-center border border-teal-500/20 shrink-0">
              <BarChart3 size={22} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Active AMC MRR</p>
              <h4 className="text-2xl font-black text-text-primary font-mono mt-1">{formatINR(stats.totalRevenue)}</h4>
            </div>
          </div>
        </div>

        {/* Operational Workspace */}
        <div className="flex flex-col lg:flex-row gap-6">
          
          {/* Contracts Ledger (Left) */}
          <div className="flex-1 bg-surface border border-border/40 rounded-2xl p-4 shadow-md space-y-4">
            
            {/* Table filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="text"
                  placeholder="Search by contract #, client name, or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-lg bg-background border border-border text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                />
              </div>

              <Select
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { value: 'all', label: 'All Status' },
                  { value: 'draft', label: 'Draft' },
                  { value: 'active', label: 'Active' },
                  { value: 'suspended', label: 'Suspended' },
                  { value: 'expired', label: 'Expired' },
                  { value: 'pending_renewal', label: 'Renewal Pending' },
                  { value: 'cancelled', label: 'Cancelled' }
                ]}
                className="text-xs min-w-[150px]"
              />

              <button
                onClick={fetchData}
                className="flex items-center justify-center gap-1.5 p-2 rounded-lg border border-border text-xs hover:border-accent hover:text-accent transition-all cursor-pointer"
              >
                <RefreshCw size={14} />
              </button>
            </div>

            {/* Contracts Table */}
            {loading ? (
              <div className="text-center py-20 text-xs text-text-muted font-mono uppercase tracking-widest animate-pulse">
                Fetching SLA records...
              </div>
            ) : filteredContracts.length === 0 ? (
              <div className="text-center py-20 text-xs text-text-muted">
                <FileText size={40} className="mx-auto text-text-muted/30 mb-2" />
                No contracts match current filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="bg-background/80 border-b border-border text-[10px] uppercase tracking-wider text-text-muted font-bold">
                      <th className="px-4 py-3">Contract Ref #</th>
                      <th className="px-4 py-3">Customer Client</th>
                      <th className="px-4 py-3 text-right">Value (INR)</th>
                      <th className="px-4 py-3 text-center">Visits Tracker</th>
                      <th className="px-4 py-3">Contract Window</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredContracts.map((c) => (
                      <tr 
                        key={c.id} 
                        onClick={() => setSelectedContract(c)}
                        className={`border-b border-border/30 hover:bg-surface-hover/30 transition-colors cursor-pointer
                          ${selectedContract?.id === c.id ? 'bg-accent-glow' : ''}`}
                      >
                        <td className="px-4 py-3 font-mono font-bold text-accent">{c.contract_number}</td>
                        <td className="px-4 py-3">
                          <div className="font-bold text-text-primary">{c.customer_name}</div>
                          <div className="text-[10px] text-text-muted flex items-center gap-1.5 mt-0.5">
                            <Phone size={10} /> {c.customer_phone || '—'}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-text-primary">{formatINR(c.amc_price)}</td>
                        <td className="px-4 py-3 text-center">
                          <div className="font-mono font-bold">
                            {c.completed_visits} / {c.visits_per_year}
                          </div>
                          <div className="w-16 h-1.5 bg-background border border-border/40 rounded-full mx-auto mt-1 overflow-hidden">
                            <div 
                              className="h-full bg-accent transition-all duration-300"
                              style={{ width: `${(c.completed_visits / c.visits_per_year) * 100}%` }}
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-text-secondary">
                          <div className="text-[10px]">{c.start_date} to</div>
                          <div className="font-bold">{c.end_date}</div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-semibold border ${STATUS_STYLES[c.status]}`}>
                            {STATUS_LABELS[c.status]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            {c.status === 'active' && (
                              <button
                                onClick={() => handleRecordVisit(c.id)}
                                title="Log Maintenance Visit"
                                className="px-2 py-1 bg-accent/10 border border-accent/20 text-accent font-bold text-[9px] rounded hover:bg-accent/20 transition-all cursor-pointer"
                              >
                                Log Visit
                              </button>
                            )}
                            <select
                              value={c.status}
                              onChange={(e) => handleUpdateStatus(c.id, e.target.value)}
                              className="bg-background border border-border text-[10px] rounded px-1.5 py-1 text-text-secondary outline-none focus:border-accent"
                            >
                              <option value="draft">Draft</option>
                              <option value="active">Active</option>
                              <option value="suspended">Suspended</option>
                              <option value="expired">Expired</option>
                              <option value="pending_renewal">Renewal Pending</option>
                              <option value="cancelled">Cancelled</option>
                            </select>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

          </div>

          {/* Details Section (Right) */}
          <div className="w-full lg:w-96 shrink-0 bg-surface border border-border/40 rounded-2xl p-4 shadow-md h-fit space-y-4">
            <h3 className="font-black text-text-primary text-xs uppercase tracking-widest flex items-center gap-1.5">
              <Award size={14} className="text-accent" />
              SLA Details & Maintenance Tracker
            </h3>

            {selectedContract ? (
              <div className="space-y-4 text-xs">
                <div className="space-y-2">
                  <div className="flex justify-between border-b border-border/30 pb-2">
                    <span className="text-text-muted">Contract Code</span>
                    <span className="font-mono font-bold text-accent">{selectedContract.contract_number}</span>
                  </div>
                  <div className="flex justify-between border-b border-border/30 pb-2">
                    <span className="text-text-muted">Client Name</span>
                    <span className="font-bold">{selectedContract.customer_name}</span>
                  </div>
                  <div className="flex justify-between border-b border-border/30 pb-2">
                    <span className="text-text-muted">Client Phone</span>
                    <span>{selectedContract.customer_phone}</span>
                  </div>
                  <div className="flex justify-between border-b border-border/30 pb-2">
                    <span className="text-text-muted">AMC Price</span>
                    <span className="font-mono font-bold">{formatINR(selectedContract.amc_price)}</span>
                  </div>
                  <div className="flex justify-between border-b border-border/30 pb-2">
                    <span className="text-text-muted">Scheduled Visits</span>
                    <span className="font-mono">{selectedContract.visits_per_year} per year</span>
                  </div>
                  <div className="flex justify-between border-b border-border/30 pb-2">
                    <span className="text-text-muted">Visits Logged</span>
                    <span className="font-mono font-bold text-text-primary">{selectedContract.completed_visits} visits</span>
                  </div>
                  <div className="flex justify-between border-b border-border/30 pb-2">
                    <span className="text-text-muted">Contract Active</span>
                    <span>{selectedContract.start_date}</span>
                  </div>
                  <div className="flex justify-between border-b border-border/30 pb-2">
                    <span className="text-text-muted">Contract Expiry</span>
                    <span className="font-bold text-text-primary">{selectedContract.end_date}</span>
                  </div>
                </div>

                {selectedContract.asset && (
                  <div className="p-3 bg-background/50 border border-border/40 rounded-xl space-y-1.5">
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">Associated Plant Asset</span>
                    <div className="font-bold text-text-secondary">
                      {selectedContract.asset.brand} {selectedContract.asset.model}
                    </div>
                    <div className="text-[10px] text-text-muted uppercase">
                      Type: {selectedContract.asset.item_type} · S/N: {selectedContract.asset.serial_number || 'N/A'}
                    </div>
                  </div>
                )}

                {selectedContract.status === 'active' && (
                  <button
                    onClick={() => handleRecordVisit(selectedContract.id)}
                    className="w-full flex items-center justify-center gap-1.5 py-2.5 px-4 bg-accent hover:bg-accent-hover text-background text-xs font-bold rounded-lg cursor-pointer transition-colors"
                  >
                    <Wrench size={14} />
                    Record Maintenance Audit Visit
                  </button>
                )}
              </div>
            ) : (
              <div className="text-center py-20 text-text-muted flex flex-col items-center justify-center space-y-2">
                <Wrench size={32} className="text-text-muted/30" />
                <p className="text-xs">Select an AMC contract row to view service logs and asset associations.</p>
              </div>
            )}
          </div>

        </div>

      </main>

      {/* Create AMC Contract Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-lg shadow-2xl animate-fade-in overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-black text-text-primary text-sm uppercase tracking-widest flex items-center gap-1.5">
                <FileText size={16} className="text-accent" />
                Setup Annual Maintenance Contract
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-text-secondary font-bold">Client Full Name *</label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. Rajesh Kumar"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-text-primary focus:outline-none focus:border-accent"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-text-secondary font-bold">Client Contact Phone *</label>
                  <input
                    required
                    type="text"
                    placeholder="10-digit mobile number"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-text-primary focus:outline-none focus:border-accent"
                  />
                </div>

                <div className="space-y-1.5 col-span-2">
                  <label className="text-text-secondary font-bold">Select Active Plant Asset (Optional)</label>
                  <select
                    value={assetId}
                    onChange={(e) => setAssetId(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-text-primary focus:outline-none focus:border-accent"
                  >
                    <option value="">-- Choose Asset --</option>
                    {assets.map(asset => (
                      <option key={asset.id} value={asset.id}>
                        [{asset.item_type.toUpperCase()}] {asset.brand} {asset.model} (S/N: {asset.serial_number || 'N/A'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-text-secondary font-bold">Annual Contract Price (excl. GST) *</label>
                  <input
                    required
                    type="number"
                    placeholder="₹ INR value"
                    value={amcPrice}
                    onChange={(e) => setAmcPrice(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-text-primary focus:outline-none focus:border-accent font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-text-secondary font-bold">Scheduled Audits Per Year *</label>
                  <select
                    value={visitsPerYear}
                    onChange={(e) => setVisitsPerYear(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-text-primary focus:outline-none focus:border-accent"
                  >
                    <option value="1">1 Visit (Annual)</option>
                    <option value="2">2 Visits (Semi-Annual)</option>
                    <option value="4">4 Visits (Quarterly)</option>
                    <option value="12">12 Visits (Monthly)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-text-secondary font-bold">Contract Start Date *</label>
                  <input
                    required
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-text-primary focus:outline-none focus:border-accent"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-text-secondary font-bold">Contract Expiry Date *</label>
                  <input
                    required
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-text-primary focus:outline-none focus:border-accent"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-border/40">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-border hover:bg-surface-hover rounded-lg font-bold text-text-secondary transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-accent hover:bg-accent-hover text-background font-bold rounded-lg transition-colors cursor-pointer"
                >
                  Save Draft SLA
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
