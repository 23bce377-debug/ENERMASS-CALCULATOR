'use client';

import { useState, useEffect, useMemo } from 'react';
import { X, Plus, Trash2, Save, Loader2, Info, Search } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { Select } from '@/components/ui/Select';
import { formatINR } from '@/lib/engine/calculator';
import { useCalculatorStore } from '@/lib/store/calculatorStore';
import type { BundlePreset, BundlePresetItem } from '@/lib/types/bundle';
import { TAX_CONSTANTS } from '@/lib/tax-constants';
import CatalogPickerModal from './CatalogPickerModal';

interface BundlePresetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  orgId: string;
  vendors: any[];
  preset?: BundlePreset;
  isDuplicate?: boolean;
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

export default function BundlePresetModal({
  isOpen,
  onClose,
  onSuccess,
  orgId,
  vendors,
  preset,
  isDuplicate = false,
}: BundlePresetModalProps) {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [effectivePrice, setEffectivePrice] = useState('0');
  const [allocationStrategy, setAllocationStrategy] = useState<'proportional_cost' | 'proportional_qty' | 'manual'>('proportional_cost');
  const [notes, setNotes] = useState('');
  const [gstPct, setGstPct] = useState(String(TAX_CONSTANTS.COMMERCIAL_GST_RATE));
  const [items, setItems] = useState<Partial<BundlePresetItem>[]>([
    { item_description: '', category: 'solar_panels', qty: 1, unit: 'Nos', base_cost: 0, allocated_cost_override: 0, gst_pct: TAX_CONSTANTS.COMMERCIAL_GST_RATE }
  ]);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const { toast } = useToast();

  // Load master equipment lists from Zustand store
  const dbPanels = useCalculatorStore(s => s.dbPanels);
  const dbInverters = useCalculatorStore(s => s.dbInverters);
  const dbBatteries = useCalculatorStore(s => s.dbBatteries);
  const dbMeters = useCalculatorStore(s => s.dbMeters);
  const dbStructures = useCalculatorStore(s => s.dbStructures);

  // Compile autocomplete suggestions list from masters catalog
  const catalogSuggestions = useMemo(() => {
    const suggestions: Array<{ name: string; category: string; cost: number; gst: number; unit: string }> = [];

    dbPanels.forEach(p => {
      suggestions.push({
        name: `${p.brand} ${p.model} ${p.wattage || ''}W Panel`,
        category: 'solar_panels',
        cost: Number(p.ratePerWatt || 0) * Number(p.wattage || 1),
        gst: Number(p.gst_pct || TAX_CONSTANTS.RESIDENTIAL_GST_RATE),
        unit: 'Nos'
      });
    });

    dbInverters.forEach(inv => {
      suggestions.push({
        name: `${inv.brand} ${inv.model} ${inv.capacityKW || ''}kW Inverter`,
        category: 'power_electronics',
        cost: Number(inv.rate || 0),
        gst: Number(inv.gst_pct || 0.12),
        unit: 'Nos'
      });
    });

    dbBatteries.forEach(bat => {
      suggestions.push({
        name: `${bat.brand} ${bat.model} ${bat.capacityKWh || ''}kWh Battery`,
        category: 'power_electronics',
        cost: Number(bat.rate || 0),
        gst: Number(bat.gst_pct || 0.12),
        unit: 'Nos'
      });
    });

    dbMeters.forEach(m => {
      suggestions.push({
        name: `${m.meter_type === 'solar_meter' ? 'Solar' : 'Net'} Meter ${m.brand || ''} ${m.model || ''}`,
        category: 'metering',
        cost: Number(m.rate || 0),
        gst: Number(m.gst_pct || TAX_CONSTANTS.COMMERCIAL_GST_RATE),
        unit: 'Nos'
      });
    });

    dbStructures.forEach(st => {
      suggestions.push({
        name: `${st.name} Structure (${st.material || ''})`,
        category: 'mounting_structure',
        cost: Number(st.flat_rate || 0),
        gst: Number(st.gst_pct || TAX_CONSTANTS.COMMERCIAL_GST_RATE),
        unit: 'Set'
      });
    });

    return suggestions;
  }, [dbPanels, dbInverters, dbBatteries, dbMeters, dbStructures]);

  // Prepopulate form if editing or duplicating
  useEffect(() => {
    if (preset) {
      setName(isDuplicate ? `${preset.name} (Copy)` : preset.name);
      setVendorId(preset.vendor_id || '');
      setEffectivePrice(preset.effective_bundle_price.toString());
      setAllocationStrategy(preset.allocation_strategy);
      setNotes(preset.notes || '');
      setGstPct(preset.gst_pct?.toString() || String(TAX_CONSTANTS.COMMERCIAL_GST_RATE));
      
      if (preset.bundle_preset_items) {
        setItems(preset.bundle_preset_items.map(item => ({
          item_description: item.item_description,
          category: item.category,
          qty: item.qty,
          unit: item.unit,
          base_cost: item.base_cost,
          allocated_cost_override: item.allocated_cost_override || 0,
          gst_pct: item.gst_pct
        })));
      }
    }
  }, [preset, isDuplicate]);

  if (!isOpen) return null;

  const addItem = () => {
    setItems([...items, { item_description: '', category: 'solar_panels', qty: 1, unit: 'Nos', base_cost: 0, allocated_cost_override: 0, gst_pct: TAX_CONSTANTS.COMMERCIAL_GST_RATE }]);
  };

  const removeItem = (index: number) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof BundlePresetItem, value: any) => {
    setItems(prev => {
      const newItems = [...prev];
      newItems[index] = { ...newItems[index], [field]: value };
      return newItems;
    });
  };

  const selectCatalogItem = (index: number, sugName: string) => {
    const sug = catalogSuggestions.find(s => s.name === sugName);
    if (sug) {
      updateItem(index, 'item_description', sug.name);
      updateItem(index, 'category', sug.category);
      updateItem(index, 'base_cost', sug.cost);
      updateItem(index, 'gst_pct', sug.gst);
      updateItem(index, 'unit', sug.unit);
    }
  };

  const handlePickerSelect = (selectedItem: any) => {
    // check if there's an empty row we can use
    const emptyRowIndex = items.findIndex(it => !it.item_description && !it.base_cost);
    if (emptyRowIndex !== -1) {
      updateItem(emptyRowIndex, 'item_description', selectedItem.name);
      updateItem(emptyRowIndex, 'category', selectedItem.category);
      updateItem(emptyRowIndex, 'base_cost', selectedItem.cost);
      updateItem(emptyRowIndex, 'gst_pct', selectedItem.gst);
      updateItem(emptyRowIndex, 'unit', selectedItem.unit);
    } else {
      setItems([...items, { 
        item_description: selectedItem.name, 
        category: selectedItem.category as any, 
        qty: 1, 
        unit: selectedItem.unit, 
        base_cost: selectedItem.cost, 
        allocated_cost_override: 0, 
        gst_pct: selectedItem.gst 
      }]);
    }
  };

  // Calculate sum of base costs or overrides
  const totalBaseCost = items.reduce((sum, item) => sum + ((item.base_cost || 0) * (item.qty || 0)), 0);
  const totalManualOverride = items.reduce((sum, item) => sum + ((item.allocated_cost_override || 0) * (item.qty || 0)), 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name) return toast('Please enter a bundle preset name', 'error');
    if (items.some(it => !it.item_description || !it.qty)) {
      return toast('Please enter description and quantity for all items', 'error');
    }

    setLoading(true);
    try {
      const payload = {
        name,
        vendor_id: vendorId ? vendorId : null,
        effective_bundle_price: parseFloat(effectivePrice) || 0,
        allocation_strategy: allocationStrategy,
        notes: notes || null,
        gst_pct: parseFloat(gstPct),
        items: items.map(item => ({
          item_description: item.item_description,
          category: item.category,
          qty: Number(item.qty),
          unit: item.unit || 'Nos',
          base_cost: Number(item.base_cost || 0),
          allocated_cost_override: Number(item.allocated_cost_override || 0),
          gst_pct: Number(item.gst_pct ?? 0.18)
        }))
      };

      if (preset?.id && !isDuplicate) {
        const res = await fetch(`/api/bundles/${preset.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Failed to update bundle preset');
        }
        toast('Bundle preset updated successfully', 'success');
      } else {
        const res = await fetch('/api/bundles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Failed to create bundle preset');
        }
        toast('Bundle preset created successfully', 'success');
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error saving bundle preset:', err);
      toast(err.message || 'Failed to save bundle preset', 'error');
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
            {preset && !isDuplicate ? 'Edit Bundle Preset' : 'New Bundle Preset'}
          </h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors cursor-pointer">
            <X size={20} />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Bundle Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg bg-background border border-border text-sm text-text-primary outline-none focus:border-accent/50 transition-all"
                placeholder="e.g. Tier-1 Solar Panels & Inverters Package"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Vendor (Optional)</label>
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
              <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Bundle Base GST %</label>
              <Select
                value={gstPct}
                onChange={setGstPct}
                options={[
                  { value: '0', label: '0%' },
                  { value: String(TAX_CONSTANTS.RESIDENTIAL_GST_RATE), label: '5%' },
                  { value: '0.12', label: '12%' },
                  { value: String(TAX_CONSTANTS.COMMERCIAL_GST_RATE), label: '18%' },
                  { value: '0.28', label: '28%' },
                ]}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Effective Bundle Price (Base) *</label>
              <input
                type="number"
                required
                min="0"
                value={effectivePrice}
                onChange={e => setEffectivePrice(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg bg-background border border-border text-sm text-text-primary font-mono text-right outline-none focus:border-accent/50 transition-all"
                placeholder="₹0"
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Cost Allocation Strategy</label>
              <Select
                value={allocationStrategy}
                onChange={(v) => setAllocationStrategy(v as any)}
                options={[
                  { value: 'proportional_cost', label: 'Proportional by Catalog Base Cost' },
                  { value: 'proportional_qty', label: 'Proportional by Item Quantity' },
                  { value: 'manual', label: 'Manual Cost Allocation Overrides' },
                ]}
              />
            </div>

            <div className="space-y-1.5 md:col-span-4">
              <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Notes</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                className="w-full px-4 py-2 rounded-lg bg-background border border-border text-sm text-text-primary outline-none focus:border-accent/50 transition-all resize-none"
                placeholder="Add package details, terms, or notes..."
              />
            </div>
          </div>

          {/* Allocation Info Box */}
          <div className="p-3.5 bg-background/50 border border-border rounded-xl flex items-start gap-2.5 text-xs text-text-secondary leading-relaxed">
            <Info size={16} className="text-accent shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-text-primary uppercase tracking-wide mr-1.5">Cost Allocation Summary:</span>
              {allocationStrategy === 'proportional_cost' ? (
                <>
                  Distributes the effective price of <strong>{formatINR(Number(effectivePrice) || 0)}</strong> proportionally using catalog base costs. 
                  Current sum of child base costs: <strong>{formatINR(totalBaseCost)}</strong>.
                </>
              ) : allocationStrategy === 'proportional_qty' ? (
                <>
                  Distributes the effective price of <strong>{formatINR(Number(effectivePrice) || 0)}</strong> proportionally across items using their quantities.
                </>
              ) : (
                <>
                  Applies explicit manual values to each row. In case the manual total (<strong>{formatINR(totalManualOverride)}</strong>) 
                  differs from the bundle price (<strong>{formatINR(Number(effectivePrice) || 0)}</strong>), allocations will scale automatically.
                </>
              )}
            </div>
          </div>

          {/* Preset Child Items Grid */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">Bundle Package Items</h3>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsPickerOpen(true)}
                  className="flex items-center gap-1.5 text-xs font-bold text-accent hover:text-accent-hover transition-colors cursor-pointer"
                >
                  <Search size={14} /> Browse Database
                </button>
                <button
                  type="button"
                  onClick={addItem}
                  className="flex items-center gap-1.5 text-xs font-bold text-accent hover:text-accent-hover transition-colors cursor-pointer"
                >
                  <Plus size={14} /> Add Line Item
                </button>
              </div>
            </div>

            <div className="overflow-x-auto border border-border rounded-xl">
              <table className="w-full text-left border-collapse min-w-[950px]">
                <thead>
                  <tr className="bg-surface-hover/50 text-[10px] font-bold text-text-muted uppercase tracking-widest border-b border-border">
                    <th className="px-3 py-3">Catalog Autocomplete / Description</th>
                    <th className="px-3 py-3 w-40">Category</th>
                    <th className="px-3 py-3 w-20 text-right">Qty</th>
                    <th className="px-3 py-3 w-20 text-center">Unit</th>
                    <th className="px-3 py-3 w-28 text-right">Catalog Base Cost</th>
                    {allocationStrategy === 'manual' && (
                      <th className="px-3 py-3 w-32 text-right">Manual Override</th>
                    )}
                    <th className="px-3 py-3 w-20 text-right">GST %</th>
                    <th className="px-3 py-3 w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map((item, idx) => (
                    <tr key={idx} className="bg-background/50 text-xs">
                      {/* Autocomplete selector */}
                      <td className="px-2 py-2">
                        <div className="relative">
                          <input
                            type="text"
                            list={`catalog-list-${idx}`}
                            value={item.item_description}
                            onChange={e => {
                              updateItem(idx, 'item_description', e.target.value);
                              // Try autocomplete
                              selectCatalogItem(idx, e.target.value);
                            }}
                            className="w-full px-3 py-1.5 rounded bg-surface border border-border outline-none focus:border-accent/50 text-text-primary font-medium"
                            placeholder="Type item description or choose from catalog..."
                          />
                          <datalist id={`catalog-list-${idx}`}>
                            {catalogSuggestions.map((s, sIdx) => (
                              <option key={sIdx} value={s.name} />
                            ))}
                          </datalist>
                        </div>
                      </td>

                      {/* Category select */}
                      <td className="px-2 py-2">
                        <Select
                          size="sm"
                          value={item.category || 'solar_panels'}
                          onChange={(v) => updateItem(idx, 'category', v)}
                          options={CATEGORIES}
                        />
                      </td>

                      {/* Qty */}
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          min="0.01"
                          step="any"
                          required
                          value={item.qty || ''}
                          onChange={e => updateItem(idx, 'qty', parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1.5 rounded bg-surface border border-border text-right outline-none focus:border-accent/50 font-mono text-text-primary"
                        />
                      </td>

                      {/* Unit */}
                      <td className="px-2 py-2">
                        <input
                          type="text"
                          value={item.unit || 'Nos'}
                          onChange={e => updateItem(idx, 'unit', e.target.value)}
                          className="w-full px-1 py-1.5 rounded bg-surface border border-border text-center outline-none focus:border-accent/50 text-text-primary"
                        />
                      </td>

                      {/* Base cost */}
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          min="0"
                          value={item.base_cost || ''}
                          onChange={e => updateItem(idx, 'base_cost', parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1.5 rounded bg-surface border border-border text-right outline-none focus:border-accent/50 font-mono text-text-primary"
                        />
                      </td>

                      {/* Manual cost override */}
                      {allocationStrategy === 'manual' && (
                        <td className="px-2 py-2">
                          <input
                            type="number"
                            min="0"
                            value={item.allocated_cost_override || ''}
                            onChange={e => updateItem(idx, 'allocated_cost_override', parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1.5 rounded bg-surface border border-border text-right outline-none focus:border-accent/50 font-mono text-text-primary"
                            placeholder="Override cost"
                          />
                        </td>
                      )}

                      {/* GST */}
                      <td className="px-2 py-2">
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

                      {/* Remove item button */}
                      <td className="px-2 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          className="text-text-muted hover:text-error transition-colors p-1.5 cursor-pointer"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </form>

        {/* Modal Buttons */}
        <div className="p-6 border-t border-border shrink-0 flex gap-3 bg-surface-hover/20">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm font-bold text-text-secondary hover:bg-surface-hover transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-accent text-background text-sm font-bold hover:bg-accent-hover transition-all disabled:opacity-50 cursor-pointer shadow-md shadow-accent/10"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            {preset && !isDuplicate ? 'Save Changes' : 'Save Bundle Preset'}
          </button>
        </div>
      </div>

      <CatalogPickerModal
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        onSelect={handlePickerSelect}
      />
    </div>
  );
}
