'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase/client';
import { ProcurementORM, type ProcurementPO, type ShortfallItem } from '@/backend/orm/procurement';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/Confirm';
import { formatINR } from '@/lib/engine/calculator';
import {
  ShoppingCart, Package, FileText, Clock, CheckCircle2, AlertTriangle,
  Plus, Search, RefreshCw, X, ArrowRight, ChevronRight, Truck,
  BarChart3, Building, Wrench, Eye
} from 'lucide-react';
import { useOnceClick } from '@/lib/hooks/useOnceClick';

const PR_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  pending: 'Pending Approval',
  approved: 'Approved',
  rejected: 'Rejected',
  po_generated: 'PO Generated',
};

const PR_STATUS_STYLES: Record<string, string> = {
  draft: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
  pending: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  approved: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  rejected: 'bg-red-500/10 text-red-500 border-red-500/20',
  po_generated: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
};

const PO_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  sent: 'Sent to Vendor',
  acknowledged: 'Acknowledged',
  partial: 'Partially Received',
  received: 'Fully Received',
  cancelled: 'Cancelled',
};

export default function ProcurementPage() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'pr' | 'po' | 'shortfall'>('pr');
  const [prs, setPRs] = useState<ProcurementPO[]>([]);
  const [pos, setPOs] = useState<ProcurementPO[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<ProcurementPO | null>(null);
  const [poItems, setPoItems] = useState<any[]>([]);
  const [isPRModalOpen, setIsPRModalOpen] = useState(false);
  const [isGRNModalOpen, setIsGRNModalOpen] = useState(false);
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  const [vendors, setVendors] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [shortfallItems, setShortfallItems] = useState<ShortfallItem[]>([]);
  const [shortfallProject, setShortfallProject] = useState<string>('');
  const [shortfallLoading, setShortfallLoading] = useState(false);

  // PR Form
  const [prVendorId, setPrVendorId] = useState('');
  const [prProjectId, setPrProjectId] = useState('');
  const [prNotes, setPrNotes] = useState('');
  const [prItems, setPrItems] = useState([
    { item_description: '', category: '', qty: 1, unit: 'Nos', estimated_rate: 0 }
  ]);

  // GRN Form
  const [grnItems, setGrnItems] = useState<any[]>([]);

  // Convert PR to PO form
  const [convertVendorId, setConvertVendorId] = useState('');
  const [convertDeliveryDate, setConvertDeliveryDate] = useState('');
  const [convertItems, setConvertItems] = useState<any[]>([]);

  const { toast } = useToast();
  const confirm = useConfirm();

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        setUserId(session.user.id);
        const { data: profile } = await supabase
          .from('profiles')
          .select('org_id')
          .eq('id', session.user.id)
          .single();
        if (profile?.org_id) setOrgId(profile.org_id);
      }
    });
  }, []);

  const fetchData = async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const [prData, poData, vendorData, projectData] = await Promise.all([
        ProcurementORM.getPRs(orgId),
        ProcurementORM.getPOs(orgId),
        (supabase as any).from('vendors').select('id, name').eq('org_id', orgId),
        (supabase as any).from('epc_projects').select('id, project_number, status').eq('org_id', orgId).not('status', 'in', '("closed","cancelled")'),
      ]);
      setPRs(prData);
      setPOs(poData);
      setVendors(vendorData.data || []);
      setProjects(projectData.data || []);
    } catch (err: any) {
      toast(err.message || 'Failed to load procurement data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (orgId) fetchData(); }, [orgId]);

  const handleSelectItem = async (item: ProcurementPO) => {
    setSelectedItem(item);
    try {
      const items = await ProcurementORM.getPOItems(item.id);
      setPoItems(items);
      // Pre-fill GRN form
      setGrnItems(items.map(i => ({
        catalog_item_id: i.catalog_item_id,
        item_description: i.item_description || `Item #${i.id.slice(0, 8)}`,
        unit: i.unit,
        qty_ordered: Number(i.qty_ordered),
        qty_received: Number(i.qty_received),
        qty_to_receive: Math.max(0, Number(i.qty_ordered) - Number(i.qty_received)),
      })));
      // Pre-fill convert form
      setConvertItems(items.map(i => ({
        id: i.id,
        item_description: i.item_description || `Item`,
        qty_ordered: Number(i.qty_ordered),
        unit: i.unit,
        unit_price: Number(i.estimated_rate || i.unit_price || 0),
        gst_pct: 0.18,
      })));
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleCreatePR = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId) return;
    try {
      await ProcurementORM.createPR(orgId, {
        vendor_id: prVendorId || undefined,
        project_id: prProjectId || undefined,
        requested_by: userId || undefined,
        notes: prNotes,
        items: prItems.filter(i => i.item_description.trim()),
      });
      toast('Purchase Request created!', 'success');
      setIsPRModalOpen(false);
      setPrItems([{ item_description: '', category: '', qty: 1, unit: 'Nos', estimated_rate: 0 }]);
      setPrNotes('');
      fetchData();
    } catch (err: any) {
      toast(err.message || 'Failed to create PR', 'error');
    }
  };

  const handleApprovePR = async (id: string) => {
    const confirmed = await confirm({
      title: 'Approve Purchase Request?',
      message: 'This will mark the PR as approved and allow conversion to a Purchase Order.',
      confirmLabel: 'Approve',
      cancelLabel: 'Cancel',
      type: 'info',
    });
    if (!confirmed) return;
    try {
      await ProcurementORM.approvePR(id);
      toast('Purchase Request approved!', 'success');
      fetchData();
    } catch (err: any) {
      toast(err.message || 'Failed to approve PR', 'error');
    }
  };

  const handleRejectPR = async (id: string) => {
    const confirmed = await confirm({
      title: 'Reject Purchase Request?',
      message: 'This will close the PR. This action cannot be undone.',
      confirmLabel: 'Reject PR',
      type: 'danger',
    });
    if (!confirmed) return;
    try {
      await ProcurementORM.rejectPR(id);
      toast('Purchase Request rejected.', 'success');
      fetchData();
    } catch (err: any) {
      toast(err.message || 'Failed to reject PR', 'error');
    }
  };

  const handleConvertToPO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || !convertVendorId) return;
    try {
      await ProcurementORM.convertToFullPO(selectedItem.id, {
        vendor_id: convertVendorId,
        delivery_date: convertDeliveryDate || undefined,
        items: convertItems,
      });
      toast('PR converted to Purchase Order!', 'success');
      setIsConvertModalOpen(false);
      setSelectedItem(null);
      fetchData();
    } catch (err: any) {
      toast(err.message || 'Failed to convert to PO', 'error');
    }
  };

  const _handleCreateGRN = async () => {
    if (!selectedItem || !orgId) return;
    try {
      const itemsToReceive = grnItems.filter(i => Number(i.qty_to_receive) > 0);
      if (itemsToReceive.length === 0) {
        toast('No items with quantity to receive', 'error');
        return;
      }
      const idempotencyKey = `grn_${selectedItem.id}_${Date.now()}`;
      const res = await ProcurementORM.createGRN(orgId, selectedItem.id, itemsToReceive.map(i => ({
        catalog_item_id: i.catalog_item_id,
        item_description: i.item_description,
        qty_received: Number(i.qty_to_receive),
        unit: i.unit,
      })), idempotencyKey);
      
      if (res.duplicate) {
        toast('GRN already processed.', 'info');
      } else {
        toast('GRN processed and inventory updated!', 'success');
      }
      setIsGRNModalOpen(false);
      fetchData();
    } catch (err: any) {
      toast(err.message || 'Failed to process GRN', 'error');
    }
  };

  const { handler: handleCreateGRNSubmit, loading: isGRNLoading } = useOnceClick(_handleCreateGRN);

  const handleCreateGRN = (e: React.FormEvent) => {
    e.preventDefault();
    handleCreateGRNSubmit();
  };

  const handleLoadShortfall = async () => {
    if (!shortfallProject || !orgId) return;
    setShortfallLoading(true);
    try {
      const items = await ProcurementORM.getShortfallForProject(shortfallProject, orgId);
      setShortfallItems(items);
    } catch (err: any) {
      toast(err.message || 'Failed to load shortfall report', 'error');
    } finally {
      setShortfallLoading(false);
    }
  };

  // Stats
  const stats = useMemo(() => ({
    totalPRs: prs.length,
    pendingPRs: prs.filter(p => p.pr_status === 'pending').length,
    approvedPRs: prs.filter(p => p.pr_status === 'approved').length,
    activePOs: pos.filter(p => !['received', 'cancelled'].includes(p.status)).length,
    totalPOValue: pos.reduce((s, p) => s + Number(p.total_amount), 0),
  }), [prs, pos]);

  const filteredPRs = prs.filter(p =>
    p.po_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.vendor?.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredPOs = pos.filter(p =>
    p.po_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.vendor?.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <main className="flex-1 p-4 md:p-6 max-w-7xl mx-auto w-full space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-text-primary flex items-center gap-2">
              <ShoppingCart className="text-accent" size={24} />
              Procurement Management
            </h1>
            <p className="text-sm text-text-muted mt-0.5">Manage Purchase Requests, Purchase Orders, GRNs, and material shortfalls.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-background border border-border rounded-xl p-1">
              {(['pr', 'po', 'shortfall'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeTab === tab ? 'bg-accent text-background shadow' : 'text-text-muted hover:text-text-primary'}`}
                >
                  {tab === 'pr' ? 'Purchase Requests' : tab === 'po' ? 'Purchase Orders' : 'Shortfall Report'}
                </button>
              ))}
            </div>
            {activeTab === 'pr' && (
              <button
                onClick={() => setIsPRModalOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-background text-xs font-bold transition-all shadow-md shadow-accent/15 cursor-pointer"
              >
                <Plus size={16} />
                New Purchase Request
              </button>
            )}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: 'Total PRs', value: stats.totalPRs, icon: FileText, color: 'accent' },
            { label: 'Pending Approval', value: stats.pendingPRs, icon: Clock, color: 'amber-500' },
            { label: 'Approved PRs', value: stats.approvedPRs, icon: CheckCircle2, color: 'blue-500' },
            { label: 'Active POs', value: stats.activePOs, icon: Package, color: 'purple-500' },
            { label: 'Total PO Value', value: formatINR(stats.totalPOValue), icon: BarChart3, color: 'emerald-500', isText: true },
          ].map((card) => (
            <div key={card.label} className="bg-surface border border-border/40 rounded-2xl p-4 shadow-md card-hover flex items-center gap-3 relative overflow-hidden group">
              <div className={`absolute right-0 top-0 w-16 h-16 bg-${card.color}/5 rounded-full blur-xl group-hover:bg-${card.color}/10 transition-all`} />
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

        {/* Main Content */}
        <div className="flex flex-col lg:flex-row gap-6">

          {/* Left: List */}
          <div className="flex-1 bg-surface border border-border/40 rounded-2xl shadow-md overflow-hidden">
            <div className="p-4 border-b border-border flex items-center gap-3">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="text"
                  placeholder={activeTab === 'shortfall' ? 'Select a project to analyse...' : 'Search by PO number or vendor...'}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-lg bg-background border border-border text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                />
              </div>
              <button onClick={fetchData} className="p-2 rounded-lg border border-border hover:border-accent hover:text-accent transition-all cursor-pointer">
                <RefreshCw size={14} />
              </button>
            </div>

            {/* PR Tab */}
            {activeTab === 'pr' && (
              <div className="overflow-x-auto">
                {loading ? (
                  <div className="text-center py-20 text-xs text-text-muted animate-pulse font-mono uppercase tracking-widest">Loading Purchase Requests...</div>
                ) : filteredPRs.length === 0 ? (
                  <div className="text-center py-20 text-xs text-text-muted flex flex-col items-center gap-2">
                    <Package size={32} className="text-text-muted/30" />
                    <p>No purchase requests. Click "New Purchase Request" to start.</p>
                  </div>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-background/80 border-b border-border text-[10px] uppercase tracking-wider text-text-muted font-bold">
                        <th className="px-4 py-3">PR Number</th>
                        <th className="px-4 py-3">Project</th>
                        <th className="px-4 py-3 text-right">Est. Value</th>
                        <th className="px-4 py-3 text-center">Status</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPRs.map(pr => (
                        <tr
                          key={pr.id}
                          onClick={() => handleSelectItem(pr)}
                          className={`border-b border-border/30 hover:bg-surface-hover/30 cursor-pointer transition-colors ${selectedItem?.id === pr.id ? 'bg-accent/5' : ''}`}
                        >
                          <td className="px-4 py-3 font-mono font-bold text-accent">{pr.po_number}</td>
                          <td className="px-4 py-3 text-text-secondary">{pr.project?.project_number || '—'}</td>
                          <td className="px-4 py-3 text-right font-mono font-bold">{formatINR(pr.total_amount)}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-semibold border ${PR_STATUS_STYLES[pr.pr_status]}`}>
                              {PR_STATUS_LABELS[pr.pr_status]}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                            <div className="flex justify-end gap-1.5">
                              {pr.pr_status === 'pending' && (
                                <>
                                  <button
                                    onClick={() => handleApprovePR(pr.id)}
                                    className="px-2 py-1 text-[9px] font-bold bg-blue-500/10 border border-blue-500/20 text-blue-500 rounded hover:bg-blue-500/20 transition-all cursor-pointer"
                                  >Approve</button>
                                  <button
                                    onClick={() => handleRejectPR(pr.id)}
                                    className="px-2 py-1 text-[9px] font-bold bg-red-500/10 border border-red-500/20 text-red-500 rounded hover:bg-red-500/20 transition-all cursor-pointer"
                                  >Reject</button>
                                </>
                              )}
                              {pr.pr_status === 'approved' && (
                                <button
                                  onClick={() => { handleSelectItem(pr); setIsConvertModalOpen(true); }}
                                  className="px-2 py-1 text-[9px] font-bold bg-accent/10 border border-accent/20 text-accent rounded hover:bg-accent/20 transition-all cursor-pointer flex items-center gap-1"
                                >
                                  <ArrowRight size={10} /> Generate PO
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* PO Tab */}
            {activeTab === 'po' && (
              <div className="overflow-x-auto">
                {loading ? (
                  <div className="text-center py-20 text-xs text-text-muted animate-pulse font-mono uppercase tracking-widest">Loading Purchase Orders...</div>
                ) : filteredPOs.length === 0 ? (
                  <div className="text-center py-20 text-xs text-text-muted flex flex-col items-center gap-2">
                    <Truck size={32} className="text-text-muted/30" />
                    <p>No purchase orders yet. Approve a PR and convert it to a PO.</p>
                  </div>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-background/80 border-b border-border text-[10px] uppercase tracking-wider text-text-muted font-bold">
                        <th className="px-4 py-3">PO Number</th>
                        <th className="px-4 py-3">Vendor</th>
                        <th className="px-4 py-3 text-right">Amount (incl. GST)</th>
                        <th className="px-4 py-3">Delivery Date</th>
                        <th className="px-4 py-3 text-center">Status</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPOs.map(po => (
                        <tr
                          key={po.id}
                          onClick={() => handleSelectItem(po)}
                          className={`border-b border-border/30 hover:bg-surface-hover/30 cursor-pointer transition-colors ${selectedItem?.id === po.id ? 'bg-accent/5' : ''}`}
                        >
                          <td className="px-4 py-3 font-mono font-bold text-accent">{po.po_number}</td>
                          <td className="px-4 py-3 font-bold text-text-primary">{po.vendor?.name || '—'}</td>
                          <td className="px-4 py-3 text-right font-mono font-bold">{formatINR(po.total_amount)}</td>
                          <td className="px-4 py-3 text-text-secondary">{po.delivery_date || '—'}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-semibold border ${PR_STATUS_STYLES.approved}`}>
                              {PO_STATUS_LABELS[po.status] || po.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                            {po.status !== 'received' && po.status !== 'cancelled' && (
                              <button
                                onClick={() => { handleSelectItem(po); setIsGRNModalOpen(true); }}
                                className="px-2 py-1 text-[9px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded hover:bg-emerald-500/20 cursor-pointer"
                              >
                                Receive GRN
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

            {/* Shortfall Report Tab */}
            {activeTab === 'shortfall' && (
              <div className="p-4 space-y-4">
                <div className="flex items-center gap-3">
                  <select
                    value={shortfallProject}
                    onChange={e => setShortfallProject(e.target.value)}
                    className="flex-1 px-3 py-2 border border-border rounded-lg bg-background text-xs text-text-primary focus:outline-none focus:border-accent"
                  >
                    <option value="">-- Select Project to Analyse --</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.project_number} ({p.status})</option>
                    ))}
                  </select>
                  <button
                    onClick={handleLoadShortfall}
                    disabled={!shortfallProject || shortfallLoading}
                    className="px-4 py-2 bg-accent hover:bg-accent-hover text-background text-xs font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {shortfallLoading ? 'Analysing...' : 'Analyse Shortfall'}
                  </button>
                </div>

                {shortfallItems.length === 0 && !shortfallLoading && (
                  <div className="text-center py-16 text-xs text-text-muted flex flex-col items-center gap-2">
                    <BarChart3 size={32} className="text-text-muted/30" />
                    <p>Select a project to see its material shortfall vs. current stock.</p>
                  </div>
                )}

                {shortfallItems.length > 0 && (
                  <>
                    <div className="flex items-center gap-2 text-xs text-amber-500 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                      <AlertTriangle size={14} />
                      <span className="font-bold">{shortfallItems.length} material shortfall(s) detected.</span>
                      <span className="text-text-muted">Create a PR for these items to initiate procurement.</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-background/80 border-b border-border text-[10px] uppercase tracking-wider text-text-muted font-bold">
                            <th className="px-4 py-3">Material</th>
                            <th className="px-4 py-3">Category</th>
                            <th className="px-4 py-3 text-right">BOM Required</th>
                            <th className="px-4 py-3 text-right">In Stock</th>
                            <th className="px-4 py-3 text-right">Shortfall</th>
                            <th className="px-4 py-3">Unit</th>
                          </tr>
                        </thead>
                        <tbody>
                          {shortfallItems.map((item, i) => (
                            <tr key={i} className="border-b border-border/30">
                              <td className="px-4 py-3 font-bold text-text-primary">{item.item_description}</td>
                              <td className="px-4 py-3 text-text-secondary">{item.category}</td>
                              <td className="px-4 py-3 text-right font-mono">{item.qty_needed.toFixed(2)}</td>
                              <td className="px-4 py-3 text-right font-mono text-emerald-500">{item.qty_in_stock.toFixed(2)}</td>
                              <td className="px-4 py-3 text-right font-mono font-bold text-red-500">{item.shortfall.toFixed(2)}</td>
                              <td className="px-4 py-3 text-text-muted">{item.unit}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex justify-end">
                      <button
                        onClick={() => {
                          setPrProjectId(shortfallProject);
                          setPrItems(shortfallItems.map(i => ({
                            item_description: i.item_description,
                            category: i.category,
                            qty: i.shortfall,
                            unit: i.unit,
                            estimated_rate: 0,
                          })));
                          setIsPRModalOpen(true);
                        }}
                        className="flex items-center gap-1.5 px-4 py-2 bg-accent hover:bg-accent-hover text-background text-xs font-bold rounded-lg cursor-pointer transition-colors"
                      >
                        <Plus size={14} />
                        Create PR for Shortfall Items
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Right: Details */}
          {selectedItem && activeTab !== 'shortfall' && (
            <div className="w-full lg:w-80 shrink-0 bg-surface border border-border/40 rounded-2xl p-4 shadow-md h-fit space-y-4">
              <h3 className="font-black text-text-primary text-xs uppercase tracking-widest flex items-center gap-1.5">
                <Eye size={14} className="text-accent" />
                {activeTab === 'pr' ? 'PR Details' : 'PO Details'}
              </h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between border-b border-border/30 pb-2">
                  <span className="text-text-muted">Reference #</span>
                  <span className="font-mono font-bold text-accent">{selectedItem.po_number}</span>
                </div>
                <div className="flex justify-between border-b border-border/30 pb-2">
                  <span className="text-text-muted">Vendor</span>
                  <span className="font-bold">{selectedItem.vendor?.name || 'Not assigned'}</span>
                </div>
                <div className="flex justify-between border-b border-border/30 pb-2">
                  <span className="text-text-muted">Project</span>
                  <span>{selectedItem.project?.project_number || '—'}</span>
                </div>
                <div className="flex justify-between border-b border-border/30 pb-2">
                  <span className="text-text-muted">Total Value</span>
                  <span className="font-mono font-bold">{formatINR(selectedItem.total_amount)}</span>
                </div>
                <div className="flex justify-between border-b border-border/30 pb-2">
                  <span className="text-text-muted">Items</span>
                  <span className="font-mono">{poItems.length} items</span>
                </div>
              </div>

              {/* PO Items */}
              {poItems.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Line Items</p>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {poItems.map((item: any, i) => (
                      <div key={i} className="flex justify-between items-center p-2 bg-background/50 rounded-lg text-[10px]">
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-text-primary truncate">{item.item_description || `Item ${i + 1}`}</div>
                          <div className="text-text-muted">{Number(item.qty_received || 0).toFixed(0)} / {Number(item.qty_ordered || 0).toFixed(0)} {item.unit} received</div>
                        </div>
                        <div className="font-mono font-bold text-accent ml-2">{formatINR(Number(item.qty_ordered || 0) * Number(item.unit_price || 0))}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedItem.notes && (
                <div className="p-3 bg-background/50 border border-border/40 rounded-lg text-xs text-text-secondary">
                  <p className="font-bold text-text-muted text-[10px] uppercase tracking-wider mb-1">Notes</p>
                  {selectedItem.notes}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* ── Create PR Modal ───────────────────────────────── */}
      {isPRModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-2xl shadow-2xl animate-fade-in overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
              <h3 className="font-black text-text-primary text-sm uppercase tracking-widest flex items-center gap-1.5">
                <Package size={16} className="text-accent" /> New Purchase Request
              </h3>
              <button onClick={() => setIsPRModalOpen(false)} className="p-1 rounded hover:bg-surface-hover text-text-muted cursor-pointer">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreatePR} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-5 space-y-4 text-xs overflow-y-auto flex-1">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="font-bold text-text-secondary">Vendor (Optional)</label>
                    <select value={prVendorId} onChange={e => setPrVendorId(e.target.value)}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background text-text-primary focus:outline-none focus:border-accent">
                      <option value="">-- Select Vendor --</option>
                      {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-bold text-text-secondary">Linked Project</label>
                    <select value={prProjectId} onChange={e => setPrProjectId(e.target.value)}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background text-text-primary focus:outline-none focus:border-accent">
                      <option value="">-- Select Project --</option>
                      {projects.map(p => <option key={p.id} value={p.id}>{p.project_number}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <label className="font-bold text-text-secondary">Notes</label>
                    <textarea rows={2} value={prNotes} onChange={e => setPrNotes(e.target.value)} placeholder="Reason for procurement..."
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background text-text-primary focus:outline-none focus:border-accent" />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-text-primary">Line Items</p>
                    <button type="button" onClick={() => setPrItems([...prItems, { item_description: '', category: '', qty: 1, unit: 'Nos', estimated_rate: 0 }])}
                      className="text-accent text-[10px] flex items-center gap-1 cursor-pointer hover:underline">
                      <Plus size={10} /> Add Item
                    </button>
                  </div>
                  {prItems.map((item, i) => (
                    <div key={i} className="grid grid-cols-12 gap-1.5 items-center">
                      <input value={item.item_description} onChange={e => { const n = [...prItems]; n[i].item_description = e.target.value; setPrItems(n); }}
                        placeholder="Material description" className="col-span-4 px-2 py-1.5 border border-border rounded bg-background text-text-primary focus:outline-none focus:border-accent" />
                      <input value={item.category} onChange={e => { const n = [...prItems]; n[i].category = e.target.value; setPrItems(n); }}
                        placeholder="Category" className="col-span-2 px-2 py-1.5 border border-border rounded bg-background text-text-primary focus:outline-none focus:border-accent" />
                      <input type="number" value={item.qty} onChange={e => { const n = [...prItems]; n[i].qty = Number(e.target.value); setPrItems(n); }}
                        placeholder="Qty" className="col-span-2 px-2 py-1.5 border border-border rounded bg-background text-text-primary focus:outline-none focus:border-accent font-mono" />
                      <input value={item.unit} onChange={e => { const n = [...prItems]; n[i].unit = e.target.value; setPrItems(n); }}
                        placeholder="Unit" className="col-span-1 px-2 py-1.5 border border-border rounded bg-background text-text-primary focus:outline-none focus:border-accent" />
                      <input type="number" value={item.estimated_rate} onChange={e => { const n = [...prItems]; n[i].estimated_rate = Number(e.target.value); setPrItems(n); }}
                        placeholder="Est. Rate" className="col-span-2 px-2 py-1.5 border border-border rounded bg-background text-text-primary focus:outline-none focus:border-accent font-mono" />
                      <button type="button" onClick={() => setPrItems(prItems.filter((_, j) => j !== i))}
                        className="text-red-500 cursor-pointer hover:text-red-400">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end text-xs font-bold text-text-muted">
                  Est. Total: <span className="ml-2 text-accent font-mono">{formatINR(prItems.reduce((s, i) => s + i.qty * i.estimated_rate, 0))}</span>
                </div>
              </div>
              <div className="p-4 border-t border-border flex justify-end gap-3 shrink-0">
                <button type="button" onClick={() => setIsPRModalOpen(false)} className="px-4 py-2 border border-border rounded-lg text-xs font-bold text-text-secondary hover:bg-surface-hover cursor-pointer">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-accent hover:bg-accent-hover text-background text-xs font-bold rounded-lg cursor-pointer">Submit PR</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Convert PR to PO Modal ────────────────────────── */}
      {isConvertModalOpen && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-2xl shadow-2xl animate-fade-in overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
              <h3 className="font-black text-text-primary text-sm uppercase tracking-widest flex items-center gap-1.5">
                <ArrowRight size={16} className="text-accent" /> Convert {selectedItem.po_number} to Purchase Order
              </h3>
              <button onClick={() => setIsConvertModalOpen(false)} className="p-1 rounded hover:bg-surface-hover text-text-muted cursor-pointer">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleConvertToPO} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-5 space-y-4 text-xs overflow-y-auto flex-1">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5 col-span-2">
                    <label className="font-bold text-text-secondary">Assign Vendor *</label>
                    <select required value={convertVendorId} onChange={e => setConvertVendorId(e.target.value)}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background text-text-primary focus:outline-none focus:border-accent">
                      <option value="">-- Select Vendor --</option>
                      {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-bold text-text-secondary">Expected Delivery Date</label>
                    <input type="date" value={convertDeliveryDate} onChange={e => setConvertDeliveryDate(e.target.value)}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background text-text-primary focus:outline-none focus:border-accent" />
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="font-bold text-text-primary">Finalize Rates per Item</p>
                  {convertItems.map((item, i) => (
                    <div key={i} className="grid grid-cols-12 gap-1.5 items-center">
                      <div className="col-span-5 text-text-primary font-bold truncate">{item.item_description}</div>
                      <div className="col-span-2 font-mono text-text-secondary text-center">{item.qty_ordered} {item.unit}</div>
                      <div className="col-span-4">
                        <input type="number" value={item.unit_price} onChange={e => { const n = [...convertItems]; n[i].unit_price = Number(e.target.value); setConvertItems(n); }}
                          placeholder="Final rate (₹)" className="w-full px-2 py-1.5 border border-border rounded bg-background text-text-primary focus:outline-none focus:border-accent font-mono" />
                      </div>
                      <div className="col-span-1 text-text-muted text-center text-[10px]">18% GST</div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end text-xs font-bold text-text-muted">
                  Total (incl. GST): <span className="ml-2 text-accent font-mono">{formatINR(convertItems.reduce((s, i) => s + i.qty_ordered * i.unit_price * 1.18, 0))}</span>
                </div>
              </div>
              <div className="p-4 border-t border-border flex justify-end gap-3 shrink-0">
                <button type="button" onClick={() => setIsConvertModalOpen(false)} className="px-4 py-2 border border-border rounded-lg text-xs font-bold text-text-secondary hover:bg-surface-hover cursor-pointer">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-accent hover:bg-accent-hover text-background text-xs font-bold rounded-lg cursor-pointer">Generate Purchase Order</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── GRN Modal ─────────────────────────────────────── */}
      {isGRNModalOpen && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-xl shadow-2xl animate-fade-in overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
              <h3 className="font-black text-text-primary text-sm uppercase tracking-widest flex items-center gap-1.5">
                <Truck size={16} className="text-accent" /> Receive Goods — {selectedItem.po_number}
              </h3>
              <button onClick={() => setIsGRNModalOpen(false)} className="p-1 rounded hover:bg-surface-hover text-text-muted cursor-pointer">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateGRN} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-5 space-y-3 text-xs overflow-y-auto flex-1">
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-500 text-[10px]">
                  <AlertTriangle size={12} className="inline mr-1" />
                  Goods Receipt Note (GRN) is idempotent — submitting twice for the same items will not duplicate stock.
                </div>
                {grnItems.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-background/50 border border-border/40 rounded-lg">
                    <div className="flex-1">
                      <div className="font-bold text-text-primary">{item.item_description}</div>
                      <div className="text-text-muted text-[10px]">Ordered: {item.qty_ordered} | Already received: {item.qty_received}</div>
                    </div>
                    <div className="w-28">
                      <input
                        type="number"
                        min={0}
                        max={item.qty_ordered - item.qty_received}
                        value={item.qty_to_receive}
                        onChange={e => { const n = [...grnItems]; n[i].qty_to_receive = Number(e.target.value); setGrnItems(n); }}
                        className="w-full px-2 py-1.5 border border-border rounded bg-background text-text-primary focus:outline-none focus:border-accent font-mono text-right"
                      />
                      <span className="text-[10px] text-text-muted ml-1">{item.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-4 border-t border-border flex justify-end gap-3 shrink-0">
                <button type="button" disabled={isGRNLoading} onClick={() => setIsGRNModalOpen(false)} className="px-4 py-2 border border-border rounded-lg text-xs font-bold text-text-secondary hover:bg-surface-hover cursor-pointer disabled:opacity-50">Cancel</button>
                <button type="submit" disabled={isGRNLoading} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg cursor-pointer flex items-center gap-1.5 disabled:opacity-50">
                  <CheckCircle2 size={14} />
                  {isGRNLoading ? 'Processing...' : 'Process GRN & Update Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
