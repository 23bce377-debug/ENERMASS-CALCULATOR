'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase/client';
import { 
  ShieldCheck, AlertTriangle, CheckCircle, Clock, 
  Search, Filter, Plus, X, ArrowUpDown, RefreshCw,
  Building2, HardDrive, FileText, ClipboardList
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/Confirm';
import { Select } from '@/components/ui/Select';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  under_review: 'Under Review',
  approved: 'Approved',
  rejected: 'Rejected',
  resolved: 'Resolved'
};

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
  submitted: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  under_review: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  approved: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  rejected: 'bg-red-500/10 text-red-500 border-red-500/20',
  resolved: 'bg-teal-500/10 text-teal-500 border-teal-500/20'
};

export default function WarrantyPage() {
  const [claims, setClaims] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters & UI State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState<any | null>(null);

  // Form State
  const [assetId, setAssetId] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [issueDescription, setIssueDescription] = useState('');
  const [vendorRmaNumber, setVendorRmaNumber] = useState('');

  const { toast } = useToast();
  const confirm = useConfirm();

  // Load Session and context
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
      // Fetch Claims
      const { data: claimsData, error: claimsErr } = await supabase
        .from('proc_warranty_claims')
        .select(`
          *,
          asset:field_customer_assets(brand, model, item_type, serial_number),
          vendor:vendors(name)
        `)
        .eq('org_id', orgId)
        .order('created_at', { ascending: false });

      if (claimsErr) throw claimsErr;
      setClaims(claimsData || []);

      // Fetch Assets
      const { data: assetsData } = await supabase
        .from('field_customer_assets')
        .select('*')
        .eq('org_id', orgId);
      setAssets(assetsData || []);

      // Fetch Vendors
      const { data: vendorsData } = await supabase
        .from('vendors')
        .select('*')
        .eq('org_id', orgId);
      setVendors(vendorsData || []);

    } catch (err: any) {
      console.error(err);
      toast(err.message || 'Failed to load warranty claims data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (orgId) {
      fetchData();
    }
  }, [orgId]);

  // Log Warranty Claim Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId) return;

    if (!assetId || !vendorId) {
      toast('Please select both an asset and a vendor', 'error');
      return;
    }

    try {
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const rand = Math.floor(1000 + Math.random() * 9000);
      const generatedClaimNum = `WTY-${dateStr}-${rand}`;

      const payload = {
        org_id: orgId,
        asset_id: assetId,
        vendor_id: vendorId,
        claim_number: generatedClaimNum,
        issue_description: issueDescription || null,
        vendor_rma_number: vendorRmaNumber || null,
        status: 'draft' as any,
        submitted_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('proc_warranty_claims')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;

      toast(`Warranty claim ${generatedClaimNum} logged as Draft!`, 'success');
      setIsModalOpen(false);
      
      // Reset form
      setAssetId('');
      setVendorId('');
      setIssueDescription('');
      setVendorRmaNumber('');

      fetchData();
    } catch (err: any) {
      toast(err.message || 'Failed to create warranty claim', 'error');
    }
  };

  // Transition status
  const handleUpdateStatus = async (claimId: string, newStatus: string) => {
    const claim = claims.find(c => c.id === claimId);
    if (!claim) return;

    const confirmed = await confirm({
      title: 'Update Claim Status?',
      message: `Change warranty claim status to "${STATUS_LABELS[newStatus]}"?`,
      confirmLabel: 'Update Status',
      cancelLabel: 'Cancel',
      type: 'info'
    });

    if (confirmed) {
      try {
        const updates: any = { 
          status: newStatus as any,
          updated_at: new Date().toISOString()
        };

        if (newStatus === 'submitted' && !claim.submitted_at) {
          updates.submitted_at = new Date().toISOString();
        } else if (newStatus === 'resolved') {
          updates.resolved_at = new Date().toISOString();
        }

        const { error } = await supabase
          .from('proc_warranty_claims')
          .update(updates)
          .eq('id', claimId);

        if (error) throw error;

        toast(`Claim ${claim.claim_number} updated to ${STATUS_LABELS[newStatus]}`, 'success');
        if (selectedClaim?.id === claimId) {
          setSelectedClaim(null);
        }
        fetchData();
      } catch (err: any) {
        toast(err.message || 'Failed to update claim status', 'error');
      }
    }
  };

  // Filter Claims
  const filteredClaims = useMemo(() => {
    return claims.filter(c => {
      const text = searchQuery.toLowerCase();
      const matchesSearch = 
        c.claim_number.toLowerCase().includes(text) ||
        (c.asset?.brand || '').toLowerCase().includes(text) ||
        (c.asset?.model || '').toLowerCase().includes(text) ||
        (c.vendor?.name || '').toLowerCase().includes(text) ||
        (c.issue_description || '').toLowerCase().includes(text);
      
      const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [claims, searchQuery, statusFilter]);

  // Claims Statistics
  const stats = useMemo(() => {
    const total = claims.length;
    const active = claims.filter(c => ['submitted', 'under_review'].includes(c.status)).length;
    const resolved = claims.filter(c => c.status === 'resolved').length;
    const approved = claims.filter(c => c.status === 'approved').length;
    return { total, active, resolved, approved };
  }, [claims]);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <main className="flex-1 p-4 md:p-6 max-w-7xl mx-auto w-full space-y-6">
        
        {/* Header section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-text-primary">Warranty Logistics & Claims</h1>
            <p className="text-sm text-text-muted mt-0.5">Track, log, and resolve equipment RMA claims with suppliers.</p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-background text-xs font-bold transition-all shadow-md shadow-accent/15 cursor-pointer"
          >
            <Plus size={16} />
            Log Warranty Claim
          </button>
        </div>

        {/* KPI Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          <div className="bg-surface border border-border/40 rounded-2xl p-5 shadow-md card-hover flex items-center gap-4 relative overflow-hidden group">
            <div className="absolute right-0 top-0 w-24 h-24 bg-accent/5 rounded-full blur-2xl group-hover:bg-accent/10 transition-all duration-300" />
            <div className="w-12 h-12 rounded-xl bg-accent-dim text-accent flex items-center justify-center border border-accent/20 shrink-0">
              <ClipboardList size={22} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Total Claims</p>
              <h4 className="text-2xl font-black text-text-primary font-mono mt-1">{stats.total}</h4>
            </div>
          </div>

          <div className="bg-surface border border-border/40 rounded-2xl p-5 shadow-md card-hover flex items-center gap-4 relative overflow-hidden group">
            <div className="absolute right-0 top-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl group-hover:bg-amber-500/10 transition-all duration-300" />
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center border border-amber-500/20 shrink-0">
              <Clock size={22} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Active RMA</p>
              <h4 className="text-2xl font-black text-text-primary font-mono mt-1">{stats.active}</h4>
            </div>
          </div>

          <div className="bg-surface border border-border/40 rounded-2xl p-5 shadow-md card-hover flex items-center gap-4 relative overflow-hidden group">
            <div className="absolute right-0 top-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-all duration-300" />
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center border border-emerald-500/20 shrink-0">
              <ShieldCheck size={22} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Approved Credits</p>
              <h4 className="text-2xl font-black text-text-primary font-mono mt-1">{stats.approved}</h4>
            </div>
          </div>

          <div className="bg-surface border border-border/40 rounded-2xl p-5 shadow-md card-hover flex items-center gap-4 relative overflow-hidden group">
            <div className="absolute right-0 top-0 w-24 h-24 bg-teal-500/5 rounded-full blur-2xl group-hover:bg-teal-500/10 transition-all duration-300" />
            <div className="w-12 h-12 rounded-xl bg-teal-500/10 text-teal-500 flex items-center justify-center border border-teal-500/20 shrink-0">
              <CheckCircle size={22} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Closed / Resolved</p>
              <h4 className="text-2xl font-black text-text-primary font-mono mt-1">{stats.resolved}</h4>
            </div>
          </div>
        </div>

        {/* Filters and List view layout */}
        <div className="flex flex-col lg:flex-row gap-6">
          
          {/* Claims List View */}
          <div className="flex-1 bg-surface border border-border/40 rounded-2xl p-4 shadow-md space-y-4">
            
            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="text"
                  placeholder="Search by RMA, item brand, or vendor..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-lg bg-background border border-border text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                />
              </div>

              <Select
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { value: 'all', label: 'All Claim States' },
                  { value: 'draft', label: 'Draft' },
                  { value: 'submitted', label: 'Submitted' },
                  { value: 'under_review', label: 'Under Review' },
                  { value: 'approved', label: 'Approved' },
                  { value: 'rejected', label: 'Rejected' },
                  { value: 'resolved', label: 'Resolved' }
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

            {/* Claims Table */}
            {loading ? (
              <div className="text-center py-20 text-xs text-text-muted font-mono uppercase tracking-widest animate-pulse">
                Fetching warranty logs...
              </div>
            ) : filteredClaims.length === 0 ? (
              <div className="text-center py-20 text-xs text-text-muted">
                <ShieldCheck size={40} className="mx-auto text-text-muted/30 mb-2" />
                No claims match current criteria.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="bg-background/80 border-b border-border text-[10px] uppercase tracking-wider text-text-muted font-bold">
                      <th className="px-4 py-3">Claim Ref #</th>
                      <th className="px-4 py-3">Asset Item</th>
                      <th className="px-4 py-3">Supplier/Vendor</th>
                      <th className="px-4 py-3">RMA #</th>
                      <th className="px-4 py-3">Logged Date</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredClaims.map((claim) => (
                      <tr 
                        key={claim.id} 
                        onClick={() => setSelectedClaim(claim)}
                        className={`border-b border-border/30 hover:bg-surface-hover/30 transition-colors cursor-pointer
                          ${selectedClaim?.id === claim.id ? 'bg-accent-glow' : ''}`}
                      >
                        <td className="px-4 py-3 font-mono font-bold text-accent">{claim.claim_number}</td>
                        <td className="px-4 py-3">
                          <div className="font-bold text-text-primary">
                            {claim.asset?.brand} {claim.asset?.model}
                          </div>
                          <div className="text-[10px] text-text-muted uppercase">
                            {claim.asset?.item_type} · S/N: {claim.asset?.serial_number || 'N/A'}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-text-secondary font-medium">{claim.vendor?.name}</td>
                        <td className="px-4 py-3 font-mono text-text-secondary">{claim.vendor_rma_number || 'Pending'}</td>
                        <td className="px-4 py-3 text-text-muted">{new Date(claim.created_at).toLocaleDateString('en-IN')}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-semibold border ${STATUS_STYLES[claim.status]}`}>
                            {STATUS_LABELS[claim.status]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                          <Select
                            value={claim.status}
                            onChange={(val) => handleUpdateStatus(claim.id, val)}
                            options={[
                              { value: 'draft', label: 'Draft' },
                              { value: 'submitted', label: 'Submitted' },
                              { value: 'under_review', label: 'Under Review' },
                              { value: 'approved', label: 'Approved' },
                              { value: 'rejected', label: 'Rejected' },
                              { value: 'resolved', label: 'Resolved' }
                            ]}
                            size="sm"
                            className="w-28 text-left"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

          </div>

          {/* Details Sidebar / Panel */}
          <div className="w-full lg:w-96 shrink-0 bg-surface border border-border/40 rounded-2xl p-4 shadow-md h-fit space-y-4">
            <h3 className="font-black text-text-primary text-xs uppercase tracking-widest flex items-center gap-1.5">
              <Building2 size={14} className="text-accent" />
              Claim Audit Logs & Resolution
            </h3>
            
            {selectedClaim ? (
              <div className="space-y-4 text-xs">
                <div className="space-y-2">
                  <div className="flex justify-between border-b border-border/30 pb-2">
                    <span className="text-text-muted">Claim ID</span>
                    <span className="font-mono font-bold text-accent">{selectedClaim.claim_number}</span>
                  </div>
                  <div className="flex justify-between border-b border-border/30 pb-2">
                    <span className="text-text-muted">Item Type</span>
                    <span className="capitalize">{selectedClaim.asset?.item_type || '—'}</span>
                  </div>
                  <div className="flex justify-between border-b border-border/30 pb-2">
                    <span className="text-text-muted">Brand / Model</span>
                    <span>{selectedClaim.asset?.brand} {selectedClaim.asset?.model}</span>
                  </div>
                  <div className="flex justify-between border-b border-border/30 pb-2">
                    <span className="text-text-muted">Serial Number</span>
                    <span className="font-mono">{selectedClaim.asset?.serial_number || '—'}</span>
                  </div>
                  <div className="flex justify-between border-b border-border/30 pb-2">
                    <span className="text-text-muted">Supplier</span>
                    <span>{selectedClaim.vendor?.name}</span>
                  </div>
                  <div className="flex justify-between border-b border-border/30 pb-2">
                    <span className="text-text-muted">RMA Number</span>
                    <span className="font-mono">{selectedClaim.vendor_rma_number || 'Not Provided'}</span>
                  </div>
                  <div className="flex justify-between border-b border-border/30 pb-2">
                    <span className="text-text-muted">Logged Date</span>
                    <span>{new Date(selectedClaim.created_at).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between border-b border-border/30 pb-2">
                    <span className="text-text-muted">Resolution Date</span>
                    <span>{selectedClaim.resolved_at ? new Date(selectedClaim.resolved_at).toLocaleDateString('en-IN') : 'Open Claim'}</span>
                  </div>
                </div>

                <div className="p-3 bg-background/50 border border-border/40 rounded-xl space-y-1">
                  <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">Description of Issue</span>
                  <p className="text-text-secondary leading-relaxed">{selectedClaim.issue_description || 'No description logged.'}</p>
                </div>

                {selectedClaim.status === 'draft' && (
                  <button
                    onClick={() => handleUpdateStatus(selectedClaim.id, 'submitted')}
                    className="w-full py-2 bg-accent hover:bg-accent-hover text-background text-xs font-bold rounded-lg cursor-pointer transition-colors"
                  >
                    Submit Claim to Supplier
                  </button>
                )}
              </div>
            ) : (
              <div className="text-center py-20 text-text-muted flex flex-col items-center justify-center space-y-2">
                <AlertTriangle size={32} className="text-text-muted/30" />
                <p className="text-xs">Select a warranty claim row to view the full resolution audit ledger.</p>
              </div>
            )}
          </div>

        </div>

      </main>

      {/* Log Claim Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-lg shadow-2xl animate-fade-in overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-black text-text-primary text-sm uppercase tracking-widest flex items-center gap-1.5">
                <ShieldCheck size={16} className="text-accent" />
                Log Supplier RMA Claim
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="text-text-secondary font-bold">Select Customer Asset *</label>
                <Select
                  value={assetId}
                  onChange={(val) => setAssetId(val)}
                  placeholder="-- Choose Asset --"
                  options={[
                    { value: '', label: '-- Choose Asset --' },
                    ...assets.map(asset => ({
                      value: asset.id,
                      label: `[${asset.item_type.toUpperCase()}] ${asset.brand} ${asset.model} (S/N: ${asset.serial_number || 'N/A'})`
                    }))
                  ]}
                  className="w-full"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-text-secondary font-bold">Select Supplier / Vendor *</label>
                <Select
                  value={vendorId}
                  onChange={(val) => setVendorId(val)}
                  placeholder="-- Choose Supplier --"
                  options={[
                    { value: '', label: '-- Choose Supplier --' },
                    ...vendors.map(vendor => ({
                      value: vendor.id,
                      label: `${vendor.name} ${vendor.contact_person ? `(${vendor.contact_person})` : ''}`
                    }))
                  ]}
                  className="w-full"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-text-secondary font-bold">Supplier RMA Code (If Issued)</label>
                <input
                  type="text"
                  placeholder="e.g. RMA-987213"
                  value={vendorRmaNumber}
                  onChange={(e) => setVendorRmaNumber(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-text-secondary font-bold">Description of Technical Failure *</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Describe failure code, physical defects, electrical output anomalies, etc."
                  value={issueDescription}
                  onChange={(e) => setIssueDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                />
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
                  Create Draft Claim
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
