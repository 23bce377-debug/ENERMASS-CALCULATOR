'use client';

import { useState, useMemo } from 'react';
import { X, Plus, Trash2, Save, Loader2, Calendar, Info, Layers, ChevronDown, ChevronUp } from 'lucide-react';
import { AcquisitionORM, type AcquisitionItem } from '@/backend/orm/acquisition';
import { useToast } from '@/components/ui/Toast';
import { Select } from '@/components/ui/Select';
import { formatINR } from '@/lib/engine/calculator';
import { allocateBundlePrice, type BundleAllocationItem } from '@/lib/engine/bundleAllocation';
import type { BundlePreset } from '@/lib/types/bundle';
import { TAX_CONSTANTS } from '@/lib/tax-constants';

interface AcquisitionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  orgId: string;
  vendors: any[];
  presets: BundlePreset[];
}

interface AppliedBundle {
  bundle_preset_id: string;
  name: string;
  qty: number;
  effective_bundle_price: number;
  allocation_strategy: 'proportional_cost' | 'proportional_qty' | 'manual';
  gst_pct: number;
  items: BundleAllocationItem[];
  isOpen: boolean;
}

const CATEGORIES = [
  { value: 'solar_panels', label: 'Solar Panels' },
  { value: 'power_electronics', label: 'Inverters / Power Electronics' },
  { value: 'mounting_structure', label: 'Mounting Structure' },
  { value: 'metering', label: 'Metering' },
  { value: 'electrical_protection', label: 'Electrical Protection' },
  { value: 'earthing', label: 'Earthing' },
  { value: 'cabling', label: 'Cabling' },
  { value: 'wiring', label: 'Wiring' },
  { value: 'services', label: 'Services' },
];

export default function AcquisitionModal({ isOpen, onClose, onSuccess, orgId, vendors, presets }: AcquisitionModalProps) {
  const [loading, setLoading] = useState(false);
  const [vendorId, setVendorId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  
  // Standard items state
  const [items, setItems] = useState<Partial<AcquisitionItem>[]>([
    { item_description: '', qty: 0, rate_per_unit: 0, gst_pct: TAX_CONSTANTS.COMMERCIAL_GST_RATE, unit: 'Nos', category: 'solar_panels' }
  ]);

  // Applied bundles state
  const [appliedBundles, setAppliedBundles] = useState<AppliedBundle[]>([]);

  const { toast } = useToast();

  // Filter active presets
  const activePresets = useMemo(() => {
    return presets.filter(p => p.is_active);
  }, [presets]);

  if (!isOpen) return null;

  // Standard items actions
  const addItem = () => {
    setItems([...items, { item_description: '', qty: 0, rate_per_unit: 0, gst_pct: TAX_CONSTANTS.COMMERCIAL_GST_RATE, unit: 'Nos', category: 'solar_panels' }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof AcquisitionItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  // Applied bundles actions
  const addBundle = () => {
    setAppliedBundles([
      ...appliedBundles,
      {
        bundle_preset_id: '',
        name: 'Select Preset...',
        qty: 1,
        effective_bundle_price: 0,
        allocation_strategy: 'proportional_cost',
        gst_pct: TAX_CONSTANTS.COMMERCIAL_GST_RATE,
        items: [],
        isOpen: true
      }
    ]);
  };

  const removeBundle = (index: number) => {
    setAppliedBundles(appliedBundles.filter((_, i) => i !== index));
  };

  const handleSelectPreset = (index: number, presetId: string) => {
    const selectedPreset = presets.find(p => p.id === presetId);
    if (!selectedPreset) return;

    const newBundles = [...appliedBundles];
    newBundles[index] = {
      ...newBundles[index],
      bundle_preset_id: presetId,
      name: selectedPreset.name,
      effective_bundle_price: selectedPreset.effective_bundle_price,
      allocation_strategy: selectedPreset.allocation_strategy,
      gst_pct: selectedPreset.gst_pct || TAX_CONSTANTS.COMMERCIAL_GST_RATE,
      items: (selectedPreset.bundle_preset_items || []).map(item => ({
        item_description: item.item_description,
        category: item.category,
        qty: item.qty,
        unit: item.unit,
        base_cost: item.base_cost,
        allocated_cost_override: item.allocated_cost_override || 0,
        gst_pct: item.gst_pct
      }))
    };
    setAppliedBundles(newBundles);
  };

  const updateBundleField = (index: number, field: keyof AppliedBundle, value: any) => {
    const newBundles = [...appliedBundles];
    newBundles[index] = { ...newBundles[index], [field]: value };
    setAppliedBundles(newBundles);
  };

  const updateBundleItem = (bundleIdx: number, itemIdx: number, field: keyof BundleAllocationItem, value: any) => {
    const newBundles = [...appliedBundles];
    const targetItems = [...newBundles[bundleIdx].items];
    targetItems[itemIdx] = { ...targetItems[itemIdx], [field]: value };
    newBundles[bundleIdx].items = targetItems;
    setAppliedBundles(newBundles);
  };

  const toggleBundleOpen = (index: number) => {
    const newBundles = [...appliedBundles];
    newBundles[index].isOpen = !newBundles[index].isOpen;
    setAppliedBundles(newBundles);
  };

  // Grand totals calculations
  const totals = useMemo(() => {
    const standardTotal = items.reduce((sum, item) => {
      const rate = item.rate_per_unit || 0;
      const q = item.qty || 0;
      const gst = item.gst_pct || 0;
      return sum + (q * rate * (1 + gst));
    }, 0);

    const bundlesTotal = appliedBundles.reduce((sum, b) => {
      if (!b.bundle_preset_id) return sum;
      try {
        const allocated = allocateBundlePrice(b.effective_bundle_price, b.items, b.allocation_strategy);
        const singleBundleTotal = allocated.reduce((acc, item) => acc + item.line_subtotal, 0);
        return sum + (b.qty * singleBundleTotal);
      } catch (err) {
        return sum;
      }
    }, 0);

    return {
      standard: standardTotal,
      bundles: bundlesTotal,
      grandTotal: standardTotal + bundlesTotal
    };
  }, [items, appliedBundles]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!vendorId) return toast('Please select a vendor', 'error');
    
    // Filter active standard items (only those that have description)
    const activeStandardItems = items.filter(it => it.item_description || it.qty || it.rate_per_unit);
    if (activeStandardItems.some(it => !it.item_description || !it.qty || !it.rate_per_unit)) {
      return toast('Please fill all standard item details, or delete empty rows', 'error');
    }

    // Validate bundles if any
    if (appliedBundles.some(b => !b.bundle_preset_id)) {
      return toast('Please select a preset for all bundle slots', 'error');
    }
    if (appliedBundles.some(b => b.items.length === 0)) {
      return toast('One or more of the selected bundles has no items inside it', 'error');
    }

    if (activeStandardItems.length === 0 && appliedBundles.length === 0) {
      return toast('Please add at least one standard item or bundle preset', 'error');
    }

    setLoading(true);
    try {
      await AcquisitionORM.create(
        {
          org_id: orgId,
          vendor_id: vendorId,
          invoice_number: invoiceNumber || undefined,
          invoice_date: invoiceDate,
          total_amount: totals.grandTotal,
          status: 'pending',
          notes: notes || undefined
        },
        activeStandardItems as AcquisitionItem[],
        appliedBundles.map(b => ({
          bundle_preset_id: b.bundle_preset_id,
          name: b.name,
          qty: b.qty,
          effective_bundle_price: b.effective_bundle_price,
          allocation_strategy: b.allocation_strategy,
          gst_pct: b.gst_pct,
          items: b.items
        }))
      );
      toast('Purchase order created successfully', 'success');
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error creating acquisition:', err);
      toast('Failed to create purchase order', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden animate-slide-up max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-border shrink-0">
          <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
            <Plus size={20} className="text-accent" />
            New Purchase Order
          </h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors cursor-pointer">
            <X size={20} />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Header Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Vendor *</label>
              <Select
                value={vendorId}
                onChange={setVendorId}
                placeholder="Select Vendor"
                options={[
                  { value: '', label: 'Select Vendor' },
                  ...vendors.map(v => ({ value: v.id, label: v.name }))
                ]}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Invoice Number</label>
              <input
                type="text"
                value={invoiceNumber}
                onChange={e => setInvoiceNumber(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg bg-background border border-border text-sm text-text-primary outline-none focus:border-accent/50 transition-all"
                placeholder="INV-2026-001"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Invoice Date</label>
              <div className="relative">
                <input
                  type="date"
                  required
                  value={invoiceDate}
                  onChange={e => setInvoiceDate(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-background border border-border text-sm text-text-primary outline-none focus:border-accent/50 transition-all"
                />
                <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              </div>
            </div>

            <div className="space-y-1.5 md:col-span-3">
              <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Notes / Memo</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={1}
                className="w-full px-4 py-2 rounded-lg bg-background border border-border text-sm text-text-primary outline-none focus:border-accent/50 transition-all resize-none"
                placeholder="Optional notes about this procurement order..."
              />
            </div>
          </div>

          {/* Standard Items Section */}
          <div className="space-y-3 pt-2">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                Standard Line Items
              </h3>
              <button
                type="button"
                onClick={addItem}
                className="flex items-center gap-1.5 text-xs font-bold text-accent hover:text-accent-hover transition-colors cursor-pointer"
              >
                <Plus size={14} /> Add Line Item
              </button>
            </div>

            {items.length === 0 ? (
              <div className="p-6 text-center text-xs text-text-muted border border-dashed border-border rounded-xl bg-background/20">
                No standard line items. Click &apos;Add Line Item&apos; or apply a bundle preset below.
              </div>
            ) : (
              <div className="overflow-x-auto border border-border rounded-xl">
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead>
                    <tr className="bg-surface-hover/50 text-[10px] font-bold text-text-muted uppercase tracking-widest border-b border-border">
                      <th className="px-4 py-3">Item Description</th>
                      <th className="px-4 py-3 w-40">Category</th>
                      <th className="px-4 py-3 w-20 text-right">Qty</th>
                      <th className="px-4 py-3 w-24 text-center">Unit</th>
                      <th className="px-4 py-3 w-28 text-right">Rate (Excl. GST)</th>
                      <th className="px-4 py-3 w-20 text-right">GST %</th>
                      <th className="px-4 py-3 w-28 text-right">Subtotal</th>
                      <th className="px-4 py-3 w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {items.map((item, idx) => {
                      const rate = item.rate_per_unit || 0;
                      const q = item.qty || 0;
                      const gst = item.gst_pct || 0;
                      const lineTotal = q * rate * (1 + gst);
                      return (
                        <tr key={idx} className="bg-background/50 text-xs">
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={item.item_description}
                              onChange={e => updateItem(idx, 'item_description', e.target.value)}
                              className="w-full px-3 py-1.5 rounded bg-surface border border-border outline-none focus:border-accent/50 text-text-primary font-medium"
                              placeholder="e.g. Adani 550W Panel"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Select
                              size="sm"
                              value={item.category || 'solar_panels'}
                              onChange={(v) => updateItem(idx, 'category', v)}
                              options={CATEGORIES}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min="0"
                              value={item.qty || ''}
                              onChange={e => updateItem(idx, 'qty', parseFloat(e.target.value) || 0)}
                              className="w-full px-3 py-1.5 rounded bg-surface border border-border text-right outline-none focus:border-accent/50 font-mono text-text-primary font-bold"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={item.unit || 'Nos'}
                              onChange={e => updateItem(idx, 'unit', e.target.value)}
                              className="w-full px-1 py-1.5 rounded bg-surface border border-border text-center outline-none focus:border-accent/50 text-text-primary"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min="0"
                              value={item.rate_per_unit || ''}
                              onChange={e => updateItem(idx, 'rate_per_unit', parseFloat(e.target.value) || 0)}
                              className="w-full px-3 py-1.5 rounded bg-surface border border-border text-right outline-none focus:border-accent/50 font-mono text-text-primary"
                              placeholder="₹0"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Select
                              size="sm"
                              value={String(item.gst_pct ?? TAX_CONSTANTS.COMMERCIAL_GST_RATE)}
                              onChange={(v) => updateItem(idx, 'gst_pct', parseFloat(v))}
                              options={[
                                { value: '0', label: '0%' },
                                { value: String(TAX_CONSTANTS.RESIDENTIAL_GST_RATE), label: '5%' },
                                { value: '0.12', label: '12%' },
                                { value: String(TAX_CONSTANTS.COMMERCIAL_GST_RATE), label: '18%' },
                                { value: '0.28', label: '28%' },
                              ]}
                            />
                          </td>
                          <td className="px-3 py-2 text-right font-bold text-text-secondary font-mono">
                            {formatINR(lineTotal)}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => removeItem(idx)}
                              className="text-text-muted hover:text-error transition-colors p-1.5 cursor-pointer"
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Applied Bundle Presets Section */}
          <div className="space-y-4 pt-2 border-t border-border/40">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider flex items-center gap-1.5">
                <Layers size={16} className="text-accent" />
                Applied Bundle Presets
              </h3>
              <button
                type="button"
                onClick={addBundle}
                className="flex items-center gap-1.5 text-xs font-bold text-accent hover:text-accent-hover transition-colors cursor-pointer"
              >
                <Plus size={14} /> Apply Bundle Preset
              </button>
            </div>

            {appliedBundles.length === 0 ? (
              <div className="p-8 text-center text-xs text-text-muted border border-dashed border-border rounded-xl bg-background/25 flex flex-col items-center justify-center gap-2">
                <Layers size={26} className="opacity-25 text-accent" />
                <span>No supplier packages applied to this purchase order.</span>
                <button
                  type="button"
                  onClick={addBundle}
                  className="mt-1 text-[10px] uppercase font-bold tracking-wider px-3 py-1.5 bg-accent-dim text-accent rounded-lg border border-accent/20 hover:bg-accent hover:text-background transition-all"
                >
                  Apply Preset
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {appliedBundles.map((b, bIdx) => {
                  let allocated: any[] = [];
                  let unitPriceInclGST = 0;
                  let hasError = false;

                  if (b.bundle_preset_id && b.items.length > 0) {
                    try {
                      allocated = allocateBundlePrice(b.effective_bundle_price, b.items, b.allocation_strategy);
                      unitPriceInclGST = allocated.reduce((sum, it) => sum + it.line_subtotal, 0);
                    } catch (err) {
                      hasError = true;
                    }
                  }

                  return (
                    <div 
                      key={bIdx}
                      className="border border-border/80 rounded-xl overflow-hidden bg-background/30 shadow-md transition-all hover:border-accent/30"
                    >
                      {/* Bundle Summary Header Bar */}
                      <div className="flex items-center justify-between px-4 py-3 bg-surface-hover/30 border-b border-border/50">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <button
                            type="button"
                            onClick={() => toggleBundleOpen(bIdx)}
                            className="text-text-muted hover:text-text-primary p-1 rounded hover:bg-surface transition-colors cursor-pointer shrink-0"
                          >
                            {b.isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                          
                          <div className="min-w-0 flex-1">
                            <span className="text-xs font-bold text-accent uppercase tracking-wider block sm:inline mr-2">
                              Bundle Preset #{bIdx + 1}
                            </span>
                            <span className="text-sm font-semibold text-text-primary truncate">
                              {b.name}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 shrink-0">
                          {b.bundle_preset_id && !hasError && (
                            <div className="text-right hidden md:block">
                              <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">Real-time Cost basis (Incl GST)</span>
                              <span className="text-xs font-mono font-bold text-text-primary">
                                {b.qty} × {formatINR(unitPriceInclGST)} = <span className="text-accent font-black">{formatINR(b.qty * unitPriceInclGST)}</span>
                              </span>
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => removeBundle(bIdx)}
                            className="p-1.5 rounded-lg hover:bg-error/10 text-text-muted hover:text-error transition-colors cursor-pointer"
                            title="Remove Bundle"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>

                      {/* Bundle Body */}
                      {b.isOpen && (
                        <div className="p-4 space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Select Preset *</label>
                              <Select
                                value={b.bundle_preset_id}
                                onChange={(v) => handleSelectPreset(bIdx, v)}
                                placeholder="Select a Preset..."
                                options={[
                                  { value: '', label: 'Select a Preset...' },
                                  ...activePresets.map(p => ({ value: p.id, label: p.name }))
                                ]}
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Purchase Quantity *</label>
                              <input
                                type="number"
                                required
                                min="1"
                                value={b.qty}
                                onChange={e => updateBundleField(bIdx, 'qty', parseInt(e.target.value) || 1)}
                                className="w-full px-3 py-1.5 rounded-lg bg-surface border border-border text-xs text-right font-mono font-bold text-text-primary outline-none focus:border-accent/50"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Purchase Unit Price (Base) *</label>
                              <input
                                type="number"
                                required
                                min="0"
                                value={b.effective_bundle_price}
                                onChange={e => updateBundleField(bIdx, 'effective_bundle_price', parseFloat(e.target.value) || 0)}
                                className="w-full px-3 py-1.5 rounded-lg bg-surface border border-border text-xs text-right font-mono text-text-primary outline-none focus:border-accent/50"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Override Strategy</label>
                              <Select
                                value={b.allocation_strategy}
                                onChange={(v) => updateBundleField(bIdx, 'allocation_strategy', v as any)}
                                options={[
                                  { value: 'proportional_cost', label: 'Proportional Cost' },
                                  { value: 'proportional_qty', label: 'Proportional Qty' },
                                  { value: 'manual', label: 'Manual overrides' },
                                ]}
                              />
                            </div>
                          </div>

                          {/* Sub-table showing allocation items */}
                          {b.bundle_preset_id && b.items.length > 0 && (
                            <div className="space-y-2 border-t border-border/30 pt-3">
                              <div className="flex justify-between items-center text-[10px] font-bold text-text-muted uppercase tracking-wider">
                                <span>Adjustable Package Child Items (Snapshot for PO)</span>
                                <span>Double click to edit details</span>
                              </div>

                              <div className="overflow-x-auto border border-border/40 rounded-lg">
                                <table className="w-full text-left border-collapse text-[11px] min-w-[700px]">
                                  <thead>
                                    <tr className="bg-surface-hover/20 text-text-muted uppercase tracking-wider text-[9px] font-bold border-b border-border/40">
                                      <th className="px-3 py-2">Item Description</th>
                                      <th className="px-3 py-2 w-28">Category</th>
                                      <th className="px-3 py-2 w-16 text-right">Qty/Pkg</th>
                                      <th className="px-3 py-2 w-20 text-right">Base Cost</th>
                                      {b.allocation_strategy === 'manual' && (
                                        <th className="px-3 py-2 w-24 text-right">Manual Split</th>
                                      )}
                                      <th className="px-3 py-2 w-16 text-right">GST %</th>
                                      <th className="px-3 py-2 w-24 text-right bg-accent-dim/10 text-accent font-black">Allocated Rate (Ex GST)</th>
                                      <th className="px-3 py-2 w-24 text-right">Total (Incl GST)</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-border/20 bg-background/10">
                                    {b.items.map((it, itIdx) => {
                                      const allocatedLine = allocated[itIdx] || { rate_per_unit: 0, line_subtotal: 0 };
                                      return (
                                        <tr key={itIdx} className="hover:bg-surface-hover/10">
                                          <td className="px-3 py-1.5 font-medium text-text-primary">
                                            <input
                                              type="text"
                                              value={it.item_description}
                                              onChange={e => updateBundleItem(bIdx, itIdx, 'item_description', e.target.value)}
                                              className="w-full bg-transparent border-b border-transparent focus:border-border outline-none px-1"
                                            />
                                          </td>
                                          <td className="px-3 py-1.5 text-text-secondary">
                                            <Select
                                              size="sm"
                                              value={it.category || 'solar_panels'}
                                              onChange={(v) => updateBundleItem(bIdx, itIdx, 'category', v)}
                                              options={CATEGORIES}
                                            />
                                          </td>
                                          <td className="px-3 py-1.5 text-right font-mono">
                                            <input
                                              type="number"
                                              value={it.qty}
                                              onChange={e => updateBundleItem(bIdx, itIdx, 'qty', parseFloat(e.target.value) || 0)}
                                              className="w-full text-right bg-transparent border-b border-transparent focus:border-border outline-none font-mono font-bold"
                                            />
                                          </td>
                                          <td className="px-3 py-1.5 text-right font-mono">
                                            <input
                                              type="number"
                                              value={it.base_cost}
                                              onChange={e => updateBundleItem(bIdx, itIdx, 'base_cost', parseFloat(e.target.value) || 0)}
                                              className="w-full text-right bg-transparent border-b border-transparent focus:border-border outline-none font-mono"
                                            />
                                          </td>
                                          {b.allocation_strategy === 'manual' && (
                                            <td className="px-3 py-1.5 text-right font-mono">
                                              <input
                                                type="number"
                                                value={it.allocated_cost_override || 0}
                                                onChange={e => updateBundleItem(bIdx, itIdx, 'allocated_cost_override', parseFloat(e.target.value) || 0)}
                                                className="w-full text-right bg-transparent border-b border-transparent focus:border-border outline-none font-mono font-bold text-accent"
                                              />
                                            </td>
                                          )}
                                          <td className="px-3 py-1.5 text-right font-mono text-text-secondary">
                                            <Select
                                              size="sm"
                                              value={String(it.gst_pct ?? TAX_CONSTANTS.ITC_ELIGIBLE_RATE)}
                                              onChange={(v) => updateBundleItem(bIdx, itIdx, 'gst_pct', parseFloat(v))}
                                              options={[
                                                { value: '0', label: '0%' },
                                                { value: String(TAX_CONSTANTS.RESIDENTIAL_GST_RATE), label: '5%' },
                                                { value: '0.12', label: '12%' },
                                                { value: String(TAX_CONSTANTS.COMMERCIAL_GST_RATE), label: '18%' },
                                                { value: '0.28', label: '28%' },
                                              ]}
                                            />
                                          </td>
                                          <td className="px-3 py-1.5 text-right font-mono font-black text-accent bg-accent-dim/5">
                                            {formatINR(allocatedLine.rate_per_unit || 0)}
                                          </td>
                                          <td className="px-3 py-1.5 text-right font-mono font-bold text-text-primary">
                                            {formatINR((allocatedLine.line_subtotal || 0) * b.qty)}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </form>

        {/* Footer Summary & Action Buttons */}
        <div className="px-6 py-4 border-t border-border shrink-0 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-surface-hover/20">
          <div className="flex flex-wrap gap-x-8 gap-y-1.5 text-xs text-text-secondary font-mono font-bold uppercase tracking-wider">
            {totals.standard > 0 && (
              <div>Standard Items: <span className="text-text-primary font-extrabold">{formatINR(totals.standard)}</span></div>
            )}
            {totals.bundles > 0 && (
              <div>Applied Bundles: <span className="text-text-primary font-extrabold">{formatINR(totals.bundles)}</span></div>
            )}
            <div className="text-sm">
              Grand Total: <span className="text-accent font-black text-lg">{formatINR(totals.grandTotal)}</span>
            </div>
          </div>

          <div className="flex gap-3 w-full md:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 md:flex-initial px-6 py-2.5 rounded-xl border border-border text-sm font-bold text-text-secondary hover:bg-surface-hover transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-accent text-background text-sm font-bold hover:bg-accent-hover transition-all disabled:opacity-50 cursor-pointer shadow-md shadow-accent/15"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              Create Purchase Order
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
