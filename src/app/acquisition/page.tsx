'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase/client';
import { type Vendor, type InventorySummary } from '@/backend/orm/acquisition';
import type { BundlePreset } from '@/lib/types/bundle';
import { useQueryClient } from '@tanstack/react-query';
import {
  useInventoryQuery,
  useAcquisitionsQuery,
  useVendorsQuery,
  useBundlePresetsQuery,
  useMarkAsReceivedMutation,
  useDeleteVendorMutation,
  useDeletePresetMutation
} from '@/lib/hooks/useAcquisitions';
import { revalidateMasterCache } from '@/app/actions/revalidateMasters';
import { 
  ShoppingCart, Plus, Package, Users, CheckCircle2, Clock, 
  Trash2, Box, Search, Filter, Mail, Phone, MapPin, 
  ChevronDown, PenSquare, Copy, Layers, ListCollapse 
} from 'lucide-react';
import { formatINR } from '@/lib/engine/calculator';
import VendorModal from '@/components/acquisition/VendorModal';
import AcquisitionModal from '@/components/acquisition/AcquisitionModal';
import BundlePresetModal from '@/components/acquisition/BundlePresetModal';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/Confirm';
import { Select } from '@/components/ui/Select';

export default function AcquisitionPage() {
  const [activeTab, setActiveTab] = useState<'inventory' | 'acquisitions' | 'vendors' | 'presets'>('inventory');
  const [orgId, setOrgId] = useState<string | null>(null);

  const queryClient = useQueryClient();

  // Queries
  const { data: inventory = [], isLoading: inventoryLoading } = useInventoryQuery(orgId);
  const { data: acquisitions = [], isLoading: acquisitionsLoading } = useAcquisitionsQuery(orgId);
  const { data: vendors = [], isLoading: vendorsLoading } = useVendorsQuery(orgId);
  const { data: presets = [], isLoading: presetsLoading } = useBundlePresetsQuery(orgId);

  const loading = inventoryLoading || acquisitionsLoading || vendorsLoading || presetsLoading;

  // Mutations
  const markAsReceivedMutation = useMarkAsReceivedMutation();
  const deleteVendorMutation = useDeleteVendorMutation();
  const deletePresetMutation = useDeletePresetMutation();
  
  // Search and Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modals state
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);
  const [isAcqModalOpen, setIsAcqModalOpen] = useState(false);
  const [isBundleModalOpen, setIsBundleModalOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | undefined>(undefined);
  const [selectedPreset, setSelectedPreset] = useState<BundlePreset | undefined>(undefined);
  const [isDuplicatePreset, setIsDuplicatePreset] = useState(false);

  const { toast } = useToast();
  const confirm = useConfirm();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        supabase.from('profiles').select('org_id').eq('id', session.user.id).single()
          .then(({ data }: any) => {
            if (data?.org_id) {
              setOrgId(data.org_id);
            }
          });
      }
    });
  }, []);

  // Reset filters on tab switch
  useEffect(() => {
    setSearchQuery('');
    setCategoryFilter('all');
    setStatusFilter('all');
  }, [activeTab]);

  const invalidateAll = async () => {
    try {
      await revalidateMasterCache();
    } catch (err) {
      console.error('Failed to revalidate master cache:', err);
    }
    queryClient.invalidateQueries({ queryKey: ['inventory', orgId] });
    queryClient.invalidateQueries({ queryKey: ['acquisitions', orgId] });
    queryClient.invalidateQueries({ queryKey: ['vendors', orgId] });
    queryClient.invalidateQueries({ queryKey: ['bundlePresets', orgId] });
  };

  async function handleMarkAsReceived(acqId: string) {
    if (!orgId) return;
    const confirmed = await confirm({
      title: 'Confirm Goods Receipt?',
      message: 'By marking this purchase as received, you are confirming that the items have arrived. This will automatically update your inventory stock and recalculate weighted average costs. This action cannot be undone.',
      confirmLabel: 'Confirm Receipt',
      cancelLabel: 'Cancel',
      type: 'info'
    });

    if (confirmed) {
      try {
        await markAsReceivedMutation.mutateAsync({ acqId, orgId });
        toast('Inventory updated successfully', 'success');
      } catch (err) {
        toast('Failed to update inventory', 'error');
      }
    }
  }

  async function handleDeleteVendor(id: string, name: string) {
    if (!orgId) return;
    const confirmed = await confirm({
      title: 'Delete Vendor?',
      message: `Are you sure you want to delete "${name}"? This action cannot be undone and will fail if they have active purchase histories in your system.`,
      confirmLabel: 'Delete Vendor',
      cancelLabel: 'Cancel',
      type: 'danger'
    });

    if (confirmed) {
      try {
        await deleteVendorMutation.mutateAsync({ id });
        queryClient.invalidateQueries({ queryKey: ['vendors', orgId] });
        toast('Vendor deleted successfully', 'success');
      } catch (err) {
        toast('Failed to delete vendor. They might have associated records.', 'error');
      }
    }
  }

  async function handleDeletePreset(id: string, name: string) {
    if (!orgId) return;
    const confirmed = await confirm({
      title: 'Delete Bundle Preset?',
      message: `Are you sure you want to delete the preset "${name}"? This action cannot be undone. Existing acquisitions utilizing this preset will retain their snapshots.`,
      confirmLabel: 'Delete Preset',
      cancelLabel: 'Cancel',
      type: 'danger'
    });

    if (confirmed) {
      try {
        await deletePresetMutation.mutateAsync({ id });
        queryClient.invalidateQueries({ queryKey: ['bundlePresets', orgId] });
        toast('Bundle preset deleted successfully', 'success');
      } catch (err) {
        toast('Failed to delete bundle preset', 'error');
      }
    }
  }

  // Memoized filter handlers
  const filteredInventory = useMemo(() => {
    return inventory.filter(item => {
      const matchesSearch = item.item_description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [inventory, searchQuery, categoryFilter]);

  const filteredAcquisitions = useMemo(() => {
    return acquisitions.filter((acq: any) => {
      const matchesSearch = 
        (acq.invoice_number?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
        (acq.vendors?.name?.toLowerCase() || '').includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || acq.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [acquisitions, searchQuery, statusFilter]);

  const filteredVendors = useMemo(() => {
    return vendors.filter(vendor => {
      return (
        vendor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (vendor.contact_person?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
        (vendor.email?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
        (vendor.phone?.toLowerCase() || '').includes(searchQuery.toLowerCase())
      );
    });
  }, [vendors, searchQuery]);

  const filteredPresets = useMemo(() => {
    return presets.filter(preset => {
      return (
        preset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (preset.vendors?.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
        (preset.allocation_strategy?.toLowerCase() || '').includes(searchQuery.toLowerCase())
      );
    });
  }, [presets, searchQuery]);

  function getCategoryBadgeClass(category: string) {
    const cat = category?.toLowerCase();
    if (cat === 'solar_panels') return 'badge-on-grid';
    if (cat === 'inverters') return 'badge-3-phase';
    if (cat === 'structures') return 'badge-hybrid';
    if (cat === 'meters') return 'badge-micro-inverter';
    if (cat === 'cables') return 'badge-upgrade';
    if (cat === 'bos') return 'badge-commercial';
    return 'badge-custom';
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      
      <main className="flex-1 p-4 md:p-6 max-w-7xl mx-auto w-full space-y-6">
        
        {/* KPI Summary Widgets */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-surface border border-border/40 rounded-2xl p-5 shadow-md card-hover flex items-center gap-4 relative overflow-hidden group">
            <div className="absolute right-0 top-0 w-24 h-24 bg-accent/5 rounded-full blur-2xl group-hover:bg-accent/10 transition-all duration-300" />
            <div className="w-12 h-12 rounded-xl bg-accent-dim text-accent flex items-center justify-center border border-accent/20 shrink-0">
              <Package size={22} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Total Stock Value</p>
              <h4 className="text-2xl font-black text-text-primary font-mono mt-1">
                {formatINR(inventory.reduce((sum, item) => sum + (item.current_qty * item.weighted_avg_cost), 0))}
              </h4>
            </div>
          </div>

          <div className="bg-surface border border-border/40 rounded-2xl p-5 shadow-md card-hover flex items-center gap-4 relative overflow-hidden group">
            <div className="absolute right-0 top-0 w-24 h-24 bg-info/5 rounded-full blur-2xl group-hover:bg-info/10 transition-all duration-300" />
            <div className="w-12 h-12 rounded-xl bg-info/10 text-info flex items-center justify-center border border-info/20 shrink-0">
              <ShoppingCart size={22} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Pending Orders</p>
              <h4 className="text-2xl font-black text-text-primary font-mono mt-1">
                {acquisitions.filter((a: any) => a.status === 'pending').length}
              </h4>
            </div>
          </div>

          <div className="bg-surface border border-border/40 rounded-2xl p-5 shadow-md card-hover flex items-center gap-4 relative overflow-hidden group">
            <div className="absolute right-0 top-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl group-hover:bg-purple-500/10 transition-all duration-300" />
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center border border-purple-500/20 shrink-0">
              <Users size={22} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Active Vendors</p>
              <h4 className="text-2xl font-black text-text-primary font-mono mt-1">{vendors.length}</h4>
            </div>
          </div>
        </div>

        {/* Tab Switcher & Dynamic Tools */}
        <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
          <div className="flex gap-1 p-1 bg-surface/50 border border-border/50 rounded-xl shadow-lg backdrop-blur-sm">
            <button
              onClick={() => setActiveTab('inventory')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer
                ${activeTab === 'inventory' ? 'bg-accent text-background shadow-md shadow-accent/15' : 'text-text-muted hover:text-text-secondary'}`}
            >
              <Package size={18} />
              Inventory
            </button>
            <button
              onClick={() => setActiveTab('acquisitions')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer
                ${activeTab === 'acquisitions' ? 'bg-accent text-background shadow-md shadow-accent/15' : 'text-text-muted hover:text-text-secondary'}`}
            >
              <ShoppingCart size={18} />
              Purchases
            </button>
            <button
              onClick={() => setActiveTab('vendors')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer
                ${activeTab === 'vendors' ? 'bg-accent text-background shadow-md shadow-accent/15' : 'text-text-muted hover:text-text-secondary'}`}
            >
              <Users size={18} />
              Vendors
            </button>
            <button
              onClick={() => setActiveTab('presets')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer
                ${activeTab === 'presets' ? 'bg-accent text-background shadow-md shadow-accent/15' : 'text-text-muted hover:text-text-secondary'}`}
            >
              <Layers size={18} />
              Bundle Presets
            </button>
          </div>

          {/* Search & Actions Bar */}
          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto flex-1 lg:flex-initial lg:justify-end">
            <div className="relative flex-1 sm:w-80">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                placeholder={
                  activeTab === 'inventory'
                    ? "Search inventory items..."
                    : activeTab === 'acquisitions'
                    ? "Search by invoice # or vendor..."
                    : activeTab === 'vendors'
                    ? "Search vendors..."
                    : "Search bundle presets..."
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-surface border border-border text-sm text-text-primary placeholder:text-text-muted focus:border-accent/50 focus:ring-1 focus:ring-accent/20 outline-none transition-all"
              />
            </div>

            {activeTab === 'inventory' && (
              <Select
                value={categoryFilter}
                onChange={setCategoryFilter}
                options={[
                  { value: 'all', label: 'All Categories' },
                  { value: 'solar_panels', label: 'Solar Panels' },
                  { value: 'inverters', label: 'Inverters' },
                  { value: 'structures', label: 'Structures' },
                  { value: 'meters', label: 'Meters' },
                  { value: 'cables', label: 'Cables' },
                  { value: 'bos', label: 'BOS' },
                ]}
                className="w-full sm:w-auto min-w-[160px]"
              />
            )}

            {activeTab === 'acquisitions' && (
              <>
                <Select
                  value={statusFilter}
                  onChange={setStatusFilter}
                  options={[
                    { value: 'all', label: 'All Statuses' },
                    { value: 'pending', label: 'Pending' },
                    { value: 'received', label: 'Received' },
                  ]}
                  className="w-full sm:w-auto min-w-[140px]"
                />
                <button 
                  onClick={() => setIsAcqModalOpen(true)}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-accent text-background text-sm font-bold hover:bg-accent-hover transition-all shadow-md shadow-accent/15 cursor-pointer whitespace-nowrap"
                >
                  <Plus size={16} />
                  New Purchase
                </button>
              </>
            )}

            {activeTab === 'vendors' && (
              <button 
                onClick={() => { setSelectedVendor(undefined); setIsVendorModalOpen(true); }}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-accent text-background text-sm font-bold hover:bg-accent-hover transition-all shadow-md shadow-accent/15 cursor-pointer whitespace-nowrap"
              >
                <Plus size={16} />
                Add Vendor
              </button>
            )}

            {activeTab === 'presets' && (
              <button 
                onClick={() => { setSelectedPreset(undefined); setIsDuplicatePreset(false); setIsBundleModalOpen(true); }}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-accent text-background text-sm font-bold hover:bg-accent-hover transition-all shadow-md shadow-accent/15 cursor-pointer whitespace-nowrap"
              >
                <Plus size={16} />
                Create Preset
              </button>
            )}
          </div>
        </div>

        {/* Content Panel Area */}
        <div className="bg-surface border border-border/40 rounded-2xl overflow-hidden shadow-xl">
          
          {/* Inventory Summary Tab */}
          {activeTab === 'inventory' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-surface-hover/50 text-[10px] font-bold text-text-muted uppercase tracking-widest">
                    <th className="px-6 py-4">Item Description</th>
                    <th className="px-6 py-4">Category</th>
                    <th className="px-6 py-4 text-right">Current Stock</th>
                    <th className="px-6 py-4 text-right">Avg. Cost (WAC)</th>
                    <th className="px-6 py-4 text-right">Inventory Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-16 text-center text-text-muted font-mono uppercase tracking-wider animate-pulse">
                        Loading inventory records...
                      </td>
                    </tr>
                  ) : filteredInventory.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-16 text-center text-text-muted">
                        <Box size={40} className="mx-auto mb-3 opacity-20 text-accent" />
                        <span className="text-sm font-medium block">No matching inventory items found</span>
                        <span className="text-xs text-text-muted mt-1 block">Try adjusting your filters or search criteria</span>
                      </td>
                    </tr>
                  ) : (
                    filteredInventory.map((item) => (
                      <tr key={item.item_description} className="hover:bg-surface-hover/30 transition-colors group">
                        <td className="px-6 py-4 text-sm font-semibold text-text-primary group-hover:text-accent transition-colors">
                          {item.item_description}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${getCategoryBadgeClass(item.category || '')}`}>
                            {item.category?.replace('_', ' ') || 'General'}
                          </span>
                        </td>
                        <td className={`px-6 py-4 text-sm text-right font-mono font-bold ${item.current_qty <= 0 ? 'text-error' : 'text-text-primary'}`}>
                          {item.current_qty}
                        </td>
                        <td className="px-6 py-4 text-sm text-text-secondary text-right font-mono">
                          {formatINR(item.weighted_avg_cost)}
                        </td>
                        <td className="px-6 py-4 text-sm font-bold text-accent text-right font-mono">
                          {formatINR(item.current_qty * item.weighted_avg_cost)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Purchases History Tab */}
          {activeTab === 'acquisitions' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-surface-hover/50 text-[10px] font-bold text-text-muted uppercase tracking-widest">
                    <th className="px-6 py-4">Invoice Date</th>
                    <th className="px-6 py-4">Invoice #</th>
                    <th className="px-6 py-4">Vendor</th>
                    <th className="px-6 py-4 text-right">Total (Inc. GST)</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-16 text-center text-text-muted font-mono uppercase tracking-wider animate-pulse">
                        Loading purchase logs...
                      </td>
                    </tr>
                  ) : filteredAcquisitions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-16 text-center text-text-muted">
                        <ShoppingCart size={40} className="mx-auto mb-3 opacity-20 text-accent" />
                        <span className="text-sm font-medium block">No purchase transactions found</span>
                      </td>
                    </tr>
                  ) : (
                    filteredAcquisitions.map((acq) => (
                      <tr key={acq.id} className="hover:bg-surface-hover/30 transition-colors group">
                        <td className="px-6 py-4 text-sm text-text-secondary">
                          {new Date(acq.invoice_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="px-6 py-4 text-sm font-semibold text-text-primary font-mono">
                          {acq.invoice_number || 'N/A'}
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-text-primary group-hover:text-accent transition-colors">
                          {acq.vendors?.name || 'Unknown'}
                        </td>
                        <td className="px-6 py-4 text-sm font-bold text-text-primary text-right font-mono">
                          {formatINR(acq.total_amount)}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border
                            ${acq.status === 'received' ? 'bg-success/12 text-success border-success/20' : 'bg-warning/12 text-warning border-warning/20'}`}>
                            {acq.status === 'received' ? (
                              <>
                                <CheckCircle2 size={12} className="text-success" />
                                Received
                              </>
                            ) : (
                              <>
                                <Clock size={12} className="text-warning" />
                                Pending
                              </>
                            )}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {acq.status === 'pending' ? (
                            <button
                              onClick={() => handleMarkAsReceived(acq.id)}
                              className="px-3 py-1.5 rounded-lg bg-success/12 text-success border border-success/20 text-[10px] font-bold uppercase tracking-wider hover:bg-success hover:text-background transition-all shadow-sm hover:shadow-success/15 flex items-center gap-1 mx-auto cursor-pointer"
                            >
                              <CheckCircle2 size={12} />
                              Confirm Receipt
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-text-muted uppercase tracking-wider">
                              <CheckCircle2 size={12} className="text-success" />
                              Processed
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Vendors Tab Content */}
          {activeTab === 'vendors' && (
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {loading ? (
                <div className="col-span-full py-16 text-center text-text-muted font-mono uppercase tracking-wider animate-pulse">
                  Loading vendor contacts...
                </div>
              ) : filteredVendors.length === 0 && vendors.length > 0 ? (
                <div className="col-span-full py-16 text-center text-text-muted">
                  No matching vendors found for &quot;{searchQuery}&quot;
                </div>
              ) : (
                <>
                  {filteredVendors.map((vendor) => (
                    <div 
                      key={vendor.id} 
                      className="p-5 rounded-2xl border border-border/40 bg-surface/50 backdrop-blur-sm hover:border-accent/40 hover:shadow-lg hover:shadow-accent/5 transition-all duration-300 group flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-accent-dim text-accent flex items-center justify-center text-sm font-bold border border-accent/20 shrink-0">
                              {vendor.name.substring(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-bold text-text-primary group-hover:text-accent transition-colors text-sm truncate">
                                {vendor.name}
                              </h4>
                              {vendor.gst_number && (
                                <p className="text-[9px] font-mono text-text-muted mt-0.5 uppercase tracking-wider">
                                  GST: {vendor.gst_number}
                                </p>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => { setSelectedVendor(vendor); setIsVendorModalOpen(true); }}
                              className="p-1.5 rounded-lg hover:bg-accent/10 text-text-muted hover:text-accent transition-colors cursor-pointer"
                              title="Edit Vendor"
                            >
                              <PenSquare size={14} />
                            </button>
                            <button 
                              onClick={() => handleDeleteVendor(vendor.id, vendor.name)}
                              className="p-1.5 rounded-lg hover:bg-error/10 text-text-muted hover:text-error transition-colors cursor-pointer"
                              title="Delete Vendor"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                        
                        <div className="space-y-2.5 border-t border-border/20 pt-3 text-xs">
                          {vendor.contact_person && (
                            <div className="flex items-center gap-2.5 text-text-secondary">
                              <Users size={13} className="text-text-muted shrink-0" />
                              <span className="truncate">{vendor.contact_person}</span>
                            </div>
                          )}
                          {vendor.phone && (
                            <div className="flex items-center gap-2.5 text-text-secondary">
                              <Phone size={13} className="text-text-muted shrink-0" />
                              <span className="font-mono">{vendor.phone}</span>
                            </div>
                          )}
                          {vendor.email && (
                            <div className="flex items-center gap-2.5 text-text-secondary truncate">
                              <Mail size={13} className="text-text-muted shrink-0" />
                              <span className="truncate">{vendor.email}</span>
                            </div>
                          )}
                          {vendor.address && (
                            <div className="flex items-start gap-2.5 text-text-muted">
                              <MapPin size={13} className="text-text-muted mt-0.5 shrink-0" />
                              <span className="line-clamp-2 leading-relaxed">{vendor.address}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  <button 
                    onClick={() => { setSelectedVendor(undefined); setIsVendorModalOpen(true); }}
                    className="flex flex-col items-center justify-center p-6 min-h-[180px] rounded-2xl border border-dashed border-border/60 hover:border-accent hover:bg-accent/[0.02] transition-all duration-300 text-text-muted hover:text-accent group shadow-sm hover:shadow-lg hover:shadow-accent/2 cursor-pointer"
                  >
                    <div className="w-12 h-12 rounded-full border border-dashed border-border group-hover:border-accent flex items-center justify-center mb-3 group-hover:scale-110 transition-all duration-300">
                      <Plus size={20} />
                    </div>
                    <span className="text-sm font-bold">Add New Vendor</span>
                  </button>
                </>
              )}
            </div>
          )}

          {/* Bundle Presets Tab Content */}
          {activeTab === 'presets' && (
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {loading ? (
                <div className="col-span-full py-16 text-center text-text-muted font-mono uppercase tracking-wider animate-pulse">
                  Loading saved bundle presets...
                </div>
              ) : filteredPresets.length === 0 && presets.length > 0 ? (
                <div className="col-span-full py-16 text-center text-text-muted">
                  No matching presets found for &quot;{searchQuery}&quot;
                </div>
              ) : (
                <>
                  {filteredPresets.map((preset) => (
                    <div 
                      key={preset.id} 
                      className="p-5 rounded-2xl border border-border/40 bg-surface/50 backdrop-blur-sm hover:border-accent/40 hover:shadow-lg hover:shadow-accent/5 transition-all duration-300 group flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-accent-dim text-accent flex items-center justify-center text-sm font-bold border border-accent/20 shrink-0">
                              <Layers size={18} />
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-bold text-text-primary group-hover:text-accent transition-colors text-sm truncate">
                                {preset.name}
                              </h4>
                              <p className="text-[9px] font-mono text-text-muted mt-0.5 uppercase tracking-wider">
                                Vendor: {preset.vendors?.name || 'Any Supplier'}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => { setSelectedPreset(preset); setIsDuplicatePreset(true); setIsBundleModalOpen(true); }}
                              className="p-1.5 rounded-lg hover:bg-accent/10 text-text-muted hover:text-accent transition-colors cursor-pointer"
                              title="Duplicate Preset"
                            >
                              <Copy size={14} />
                            </button>
                            <button 
                              onClick={() => { setSelectedPreset(preset); setIsDuplicatePreset(false); setIsBundleModalOpen(true); }}
                              className="p-1.5 rounded-lg hover:bg-accent/10 text-text-muted hover:text-accent transition-colors cursor-pointer"
                              title="Edit Preset"
                            >
                              <PenSquare size={14} />
                            </button>
                            <button 
                              onClick={() => handleDeletePreset(preset.id, preset.name)}
                              className="p-1.5 rounded-lg hover:bg-error/10 text-text-muted hover:text-error transition-colors cursor-pointer"
                              title="Delete Preset"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                        
                        <div className="space-y-2.5 border-t border-border/20 pt-3">
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-text-muted font-medium">Effective Price:</span>
                            <span className="font-mono font-bold text-accent">{formatINR(preset.effective_bundle_price)}</span>
                          </div>
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-text-muted font-medium">Strategy:</span>
                            <span className="px-1.5 py-0.5 rounded bg-surface border border-border text-[9px] uppercase tracking-wider text-text-secondary font-semibold">
                              {preset.allocation_strategy?.replace('_', ' ')}
                            </span>
                          </div>
                          {preset.notes && (
                            <p className="text-[11px] text-text-muted line-clamp-2 italic leading-relaxed pt-1.5 border-t border-dashed border-border/20">
                              &ldquo;{preset.notes}&rdquo;
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  <button 
                    onClick={() => { setSelectedPreset(undefined); setIsDuplicatePreset(false); setIsBundleModalOpen(true); }}
                    className="flex flex-col items-center justify-center p-6 min-h-[180px] rounded-2xl border border-dashed border-border/60 hover:border-accent hover:bg-accent/[0.02] transition-all duration-300 text-text-muted hover:text-accent group shadow-sm hover:shadow-lg hover:shadow-accent/2 cursor-pointer"
                  >
                    <div className="w-12 h-12 rounded-full border border-dashed border-border group-hover:border-accent flex items-center justify-center mb-3 group-hover:scale-110 transition-all duration-300">
                      <Plus size={20} />
                    </div>
                    <span className="text-sm font-bold">Create Bundle Preset</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Modals */}
      {orgId && (
        <>
          <VendorModal 
            isOpen={isVendorModalOpen} 
            onClose={() => setIsVendorModalOpen(false)} 
            onSuccess={invalidateAll} 
            orgId={orgId}
            vendor={selectedVendor}
          />
          <AcquisitionModal
            isOpen={isAcqModalOpen}
            onClose={() => setIsAcqModalOpen(false)}
            onSuccess={invalidateAll}
            orgId={orgId}
            vendors={vendors}
            presets={presets}
          />
          <BundlePresetModal
            isOpen={isBundleModalOpen}
            onClose={() => setIsBundleModalOpen(false)}
            onSuccess={invalidateAll}
            orgId={orgId}
            vendors={vendors}
            preset={selectedPreset}
            isDuplicate={isDuplicatePreset}
          />
        </>
      )}
    </div>
  );
}
