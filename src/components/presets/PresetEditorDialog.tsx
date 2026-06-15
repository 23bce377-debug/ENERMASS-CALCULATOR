'use client';
import { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { getPresetWithComponents, savePresetWithComponents, LineItem } from '@/lib/actions/presets';
import { CatalogItemPicker } from './CatalogItemPicker';

interface PresetEditorDialogProps {
  presetId: string;
  open: boolean;
  onClose: () => void;
  onSaved: (presetId: string, presetName: string) => void;
}

export function PresetEditorDialog({
  presetId, open, onClose, onSaved
}: PresetEditorDialogProps) {
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [name, setName] = useState('');
  const [systemType, setSystemType] = useState('on_grid');
  const [saving, setSaving] = useState(false);
  const [addPickerOpen, setAddPickerOpen] = useState<string | false>(false);
  const [addPickerCategory, setAddPickerCategory] = useState('');
  const [mounted, setMounted] = useState(false);

  console.log('PresetEditorDialog initialized: open =', open, 'presetId =', presetId, 'mounted =', mounted);

  useEffect(() => {
    console.log('PresetEditorDialog useEffect: setting mounted to true');
    setMounted(true);
  }, []);

  useEffect(() => {
    console.log('PresetEditorDialog useEffect: checking open & presetId. open =', open, 'presetId =', presetId);
    if (!open || !presetId) return;
    console.log('PresetEditorDialog calling getPresetWithComponents for presetId:', presetId);
    getPresetWithComponents(presetId).then((data: any) => {
      console.log('getPresetWithComponents resolved successfully. data =', data);
      if (!data) {
        console.warn('getPresetWithComponents returned null/undefined for presetId:', presetId);
        return;
      }
      setName(data.name);
      setSystemType(data.system_type ?? 'on_grid');
      setLineItems(data.lineItems ?? []);
    }).catch(err => {
      console.error('getPresetWithComponents threw an error:', err);
      // fallback if not found
    });
  }, [open, presetId]);

  const grouped = useMemo(() => {
    const CATEGORY_ORDER = [
      'panel', 'inverter', 'battery', 'structure',
      'dc_protection', 'ac_protection', 'cable',
      'earthing', 'civil', 'logistics', 'accessory', 'other'
    ];
    const CATEGORY_LABELS: Record<string, string> = {
      panel: 'Panels',
      inverter: 'Inverter',
      battery: 'Battery',
      structure: 'Mounting Structure',
      dc_protection: 'DC Protection',
      ac_protection: 'AC Protection',
      cable: 'Cables & Conduit',
      earthing: 'Earthing',
      civil: 'Civil Works',
      logistics: 'Logistics & Handling',
      accessory: 'Accessories',
      other: 'Other',
    };
    const groups: Record<string, { label: string; items: LineItem[] }> = {};
    for (const cat of CATEGORY_ORDER) {
      const items = lineItems.filter(i => i.category === cat && i.isIncluded);
      if (items.length > 0) {
        groups[cat] = { label: CATEGORY_LABELS[cat], items };
      }
    }
    return groups;
  }, [lineItems]);

  const totalCost = lineItems
    .filter(i => i.isIncluded && !i.isSurveyDependent)
    .reduce((sum, i) => sum + (i.quantity * i.unitRate), 0);

  const surveyPendingCount = lineItems.filter(i => i.isIncluded && i.isSurveyDependent).length;

  function updateItem(id: string, field: string, value: any) {
    setLineItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
  }

  function removeItem(id: string) {
    setLineItems(prev => prev.filter(i => i.id !== id));
  }

  function addItemFromCatalog(catalogItem: any, category: string) {
    const newItem: LineItem = {
      id: `temp_${Date.now()}`,
      category,
      catalogItemId: catalogItem.id,
      catalogType: catalogItem.type === 'panel' || catalogItem.type === 'inverter'
        ? 'equipment' : 'bom_template',
      skuCode: catalogItem.skuCode ?? '',
      description: catalogItem.description,
      brand: catalogItem.brand ?? '',
      model: catalogItem.model ?? '',
      unit: catalogItem.unit ?? 'units',
      quantity: catalogItem.defaultQty ?? 1,
      unitRate: catalogItem.defaultRate ?? 0,
      isIncluded: true,
      isSurveyDependent: catalogItem.isSurveyDependent ?? false,
      sortOrder: lineItems.length,
    };
    setLineItems(prev => [...prev, newItem]);
    setAddPickerOpen(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await savePresetWithComponents(presetId, {
        name, systemType,
        lineItems: lineItems.map((item, i) => ({ ...item, sortOrder: i })),
      });
      onSaved(presetId, name);
      onClose();
    } catch (err) {
      console.error(err);
      alert('Failed to save preset.');
    } finally {
      setSaving(false);
    }
  }

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-[#1a1a1a] border border-[#2a2a2a] shadow-2xl flex flex-col rounded-xl overflow-hidden max-h-[90vh] text-white">
        
        {/* HEADER */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a] shrink-0">
          <div className="flex items-center gap-3 flex-1">
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="bg-transparent text-white font-semibold text-lg border-none outline-none focus:outline-none border-b border-transparent focus:border-[#f0a500] transition-colors pb-0.5 min-w-0 flex-1"
              placeholder="Preset name..."
            />
          </div>
          <div className="flex items-center gap-2 ml-4 shrink-0">
            {['on_grid', 'off_grid', 'hybrid'].map(t => (
              <button key={t}
                onClick={() => setSystemType(t)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  systemType === t
                    ? 'bg-[#f0a500]/20 text-[#f0a500] border border-[#f0a500]/40'
                    : 'text-[#666] border border-[#333] hover:border-[#555]'
                }`}>
                {t === 'on_grid' ? 'On-Grid' : t === 'off_grid' ? 'Off-Grid' : 'Hybrid'}
              </button>
            ))}
          </div>
        </div>

        {/* BODY */}
        <div className="overflow-y-auto px-6 py-4 space-y-5 flex-1 relative">
          {Object.entries(grouped).map(([category, { label, items }]) => (
            <div key={category}>
              {/* Category header */}
              <div className="flex items-center justify-between mb-2 relative">
                <span className="text-[10px] font-semibold tracking-widest text-[#555] uppercase">{label}</span>
                <div className="relative">
                  <button
                    onClick={() => { setAddPickerCategory(category); setAddPickerOpen(addPickerOpen === category ? false : category); }}
                    className="text-[10px] text-[#f0a500]/70 hover:text-[#f0a500] transition-colors flex items-center gap-1">
                    + Add
                  </button>
                  {addPickerOpen === category && (
                    <div className="absolute right-0 top-full mt-1 z-50">
                      <CatalogItemPicker 
                        category={category} 
                        onSelect={addItemFromCatalog} 
                        onClose={() => setAddPickerOpen(false)} 
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Column headers */}
              <div className="grid items-center mb-1 px-2" style={{ gridTemplateColumns: '1fr 80px 100px 80px 28px' }}>
                <span className="text-[10px] text-[#444]">Component</span>
                <span className="text-[10px] text-[#444] text-center">Qty</span>
                <span className="text-[10px] text-[#444] text-right">Rate (₹)</span>
                <span className="text-[10px] text-[#444] text-right">Total</span>
                <span />
              </div>

              {/* Item rows */}
              <div className="space-y-1">
                {items.map(item => (
                  <div key={item.id} className="grid items-center gap-2 px-2 py-2 rounded bg-[#111] border border-[#222] hover:border-[#333] transition-colors group" style={{ gridTemplateColumns: '1fr 80px 100px 80px 28px' }}>
                    
                    {/* Description */}
                    <div className="min-w-0">
                      <p className="text-sm text-white truncate">{item.description}</p>
                      {item.brand && (
                        <p className="text-[10px] text-[#555] truncate">
                          {item.brand}{item.model ? ` ${item.model}` : ''}
                        </p>
                      )}
                      {item.isSurveyDependent && (
                        <span className="text-[9px] text-amber-400/80">Survey required</span>
                      )}
                    </div>

                    {/* Quantity */}
                    <div className="flex items-center justify-center gap-0.5">
                      <button
                        onClick={() => updateItem(item.id as string, 'quantity', Math.max(0, (item.quantity || 0) - 1))}
                        className="w-5 h-5 flex items-center justify-center text-[#555] hover:text-white hover:bg-[#2a2a2a] rounded transition-colors text-xs">
                        -
                      </button>
                      <input
                        type="number"
                        value={item.isSurveyDependent ? '' : item.quantity}
                        disabled={item.isSurveyDependent}
                        onChange={e => updateItem(item.id as string, 'quantity', parseFloat(e.target.value) || 0)}
                        className="w-10 text-center text-sm bg-transparent text-white border-b border-[#333] focus:border-[#f0a500] outline-none disabled:text-[#444] disabled:border-[#222] [appearance:textfield]"
                        placeholder={item.isSurveyDependent ? '—' : '0'}
                      />
                      <button
                        onClick={() => updateItem(item.id as string, 'quantity', (item.quantity || 0) + 1)}
                        className="w-5 h-5 flex items-center justify-center text-[#555] hover:text-white hover:bg-[#2a2a2a] rounded transition-colors text-xs">
                        +
                      </button>
                    </div>

                    {/* Rate */}
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[#555] text-xs pointer-events-none">₹</span>
                      <input
                        type="number"
                        value={item.unitRate}
                        onChange={e => updateItem(item.id as string, 'unitRate', parseFloat(e.target.value) || 0)}
                        className="w-full pl-5 pr-1 py-1 text-right text-sm bg-[#0d0d0d] text-white rounded border border-[#2a2a2a] focus:border-[#f0a500] outline-none [appearance:textfield]"
                      />
                    </div>

                    {/* Line total */}
                    <div className="text-right text-xs text-[#888]">
                      {item.isSurveyDependent
                        ? <span className="text-amber-500/60">TBD</span>
                        : `₹${(item.quantity * item.unitRate).toLocaleString('en-IN', {maximumFractionDigits: 0})}`
                      }
                    </div>

                    {/* Remove */}
                    <button
                      onClick={() => removeItem(item.id as string)}
                      className="w-7 h-7 flex items-center justify-center rounded text-[#444] hover:text-red-400 hover:bg-red-400/10 opacity-0 group-hover:opacity-100 transition-all">
                      ×
                    </button>
                  </div>
                ))}
              </div>

              {/* "Add to this section" if empty */}
              {items.length === 0 && (
                <div className="relative">
                  <button
                    onClick={() => { setAddPickerCategory(category); setAddPickerOpen(addPickerOpen === category ? false : category); }}
                    className="w-full py-2 border border-dashed border-[#2a2a2a] rounded text-xs text-[#444] hover:border-[#f0a500]/40 hover:text-[#f0a500]/60 transition-colors">
                    + Add {label} component
                  </button>
                  {addPickerOpen === category && (
                    <div className="absolute right-0 top-full mt-1 z-50">
                      <CatalogItemPicker 
                        category={category} 
                        onSelect={addItemFromCatalog} 
                        onClose={() => setAddPickerOpen(false)} 
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Add a new category section */}
          <div className="pt-2 border-t border-[#1e1e1e] pb-10">
            <p className="text-xs text-[#444] mb-2">Add component from catalog:</p>
            <div className="flex flex-wrap gap-1.5 relative">
              {[
                ['panel', 'Panel'],
                ['inverter', 'Inverter'],
                ['battery', 'Battery'],
                ['structure', 'Structure'],
                ['dc_protection', 'DC Protection'],
                ['ac_protection', 'AC Protection'],
                ['cable', 'Cables'],
                ['earthing', 'Earthing'],
                ['civil', 'Civil'],
                ['logistics', 'Logistics'],
                ['accessory', 'Accessory'],
              ].map(([cat, label]) => (
                <button key={cat}
                  onClick={() => { setAddPickerCategory(cat); setAddPickerOpen(addPickerOpen === cat ? false : cat); }}
                  className="px-2.5 py-1 text-xs border border-[#2a2a2a] rounded text-[#555] hover:border-[#f0a500]/40 hover:text-[#f0a500]/60 transition-colors">
                  + {label}
                </button>
              ))}
              {addPickerOpen && ['panel', 'inverter', 'battery', 'structure', 'dc_protection', 'ac_protection', 'cable', 'earthing', 'civil', 'logistics', 'accessory'].includes(addPickerOpen) && !grouped[addPickerOpen] && (
                <div className="absolute left-0 bottom-full mb-1 z-50">
                  <CatalogItemPicker 
                    category={addPickerOpen} 
                    onSelect={addItemFromCatalog} 
                    onClose={() => setAddPickerOpen(false)} 
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#2a2a2a] shrink-0 bg-[#1a1a1a]">
          <div className="text-sm text-[#555]">
            Est. BOM Cost:
            <span className="text-white font-medium ml-1.5">
              ₹{totalCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </span>
            {surveyPendingCount > 0 && (
              <span className="text-amber-500/70 text-xs ml-2">
                + {surveyPendingCount} survey-pending items
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button onClick={onClose}
              className="px-4 py-2 text-sm text-[#666] hover:text-white transition-colors">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving}
              className="px-5 py-2 text-sm font-medium rounded bg-[#f0a500] text-black hover:bg-[#f0a500]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
