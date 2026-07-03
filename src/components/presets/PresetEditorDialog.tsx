'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  getPresetStates,
  getPresetWithComponents,
  savePresetWithComponents,
  type LineItem,
  type PresetStateOption,
} from '@/lib/actions/presets';
import { CatalogItemPicker } from './CatalogItemPicker';
import { gstRateToPercent, normalizeGstRate } from '@/lib/utils/gst';

interface PresetEditorDialogProps {
  presetId: string;
  open: boolean;
  onClose: () => void;
  onSaved: (presetId: string, presetName: string) => void;
  initialData?: {
    id: string;
    name: string;
    system_type: string;
    capacity_kw: number;
    state_id?: string | null;
    lineItems: LineItem[];
  };
  onSaveLocal?: (updates: {
    name: string;
    systemType: string;
    capacityKw: number;
    stateId?: string | null;
    lineItems: LineItem[];
  }) => void | Promise<void>;
}

const CATEGORY_ORDER = [
  'panel',
  'inverter',
  'battery',
  'structure',
  'dc_protection',
  'ac_protection',
  'cable',
  'earthing',
  'civil',
  'logistics',
  'accessory',
  'miscellaneous',
];

const CATEGORY_LABELS: Record<string, string> = {
  panel: 'Panels',
  inverter: 'Inverters',
  battery: 'Batteries',
  structure: 'Mounting Structure',
  dc_protection: 'DC Protection',
  ac_protection: 'AC Protection',
  cable: 'Cables',
  earthing: 'Earthing',
  civil: 'Civil Works',
  logistics: 'Logistics',
  accessory: 'Accessories',
  miscellaneous: 'Miscellaneous',
};

function normalizeCategory(category: string) {
  return category === 'other' ? 'miscellaneous' : category;
}

const SYSTEM_TYPE_OPTIONS = [
  { value: 'on_grid', label: 'On-Grid' },
  { value: '3_phase', label: '3-Phase' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'micro_inverter', label: 'Micro' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'upgrade', label: 'Upgrade' },
];

function newBlankItem(catalogItem: any, category: string, sortOrder: number): LineItem {
  return {
    id: `temp_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    category,
    catalogItemId: catalogItem.id,
    catalogType: catalogItem.catalogType ?? (['panel', 'inverter', 'battery'].includes(catalogItem.type) ? 'equipment' : 'bom_template'),
    skuCode: catalogItem.skuCode ?? '',
    description: catalogItem.description,
    brand: catalogItem.brand ?? '',
    model: catalogItem.model ?? '',
    specificationDetails: catalogItem.specificationDetails ?? '',
    unit: catalogItem.unit ?? 'Nos',
    quantity: catalogItem.defaultQty ?? 1,
    unitRate: catalogItem.defaultRate ?? 0,
    gstPct: catalogItem.gstPct ?? catalogItem.gst_pct,
    isIncluded: true,
    isSurveyDependent: catalogItem.isSurveyDependent ?? false,
    sortOrder,
  };
}

export function PresetEditorDialog({ presetId, open, onClose, onSaved, initialData, onSaveLocal }: PresetEditorDialogProps) {
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [name, setName] = useState('');
  const [capacityKw, setCapacityKw] = useState('');
  const [systemType, setSystemType] = useState('on_grid');
  const [stateId, setStateId] = useState('');
  const [states, setStates] = useState<PresetStateOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [addPickerOpen, setAddPickerOpen] = useState<string | false>(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;

    setAddPickerOpen(false);
    getPresetStates().then(setStates).catch((err) => {
      console.error('Failed to load preset states:', err);
      setStates([]);
    });

    if (initialData) {
      setName(initialData.name ?? '');
      setCapacityKw(initialData.capacity_kw ? String(Number(initialData.capacity_kw)) : '');
      setSystemType(SYSTEM_TYPE_OPTIONS.some((option) => option.value === initialData.system_type) ? initialData.system_type : 'on_grid');
      setStateId(initialData.state_id ?? '');
      setLineItems(initialData.lineItems ?? []);
      return;
    }

    if (!presetId) {
      setName('');
      setCapacityKw('');
      setSystemType('on_grid');
      setStateId('');
      setLineItems([]);
      return;
    }

    setLoading(true);
    getPresetWithComponents(presetId)
      .then((data: any) => {
        if (!data) return;
        setName(data.name ?? '');
        setCapacityKw(data.capacity_kw ? String(Number(data.capacity_kw)) : '');
        setSystemType(data.system_type ?? 'on_grid');
        setStateId(data.state_id ?? '');
        setLineItems(data.lineItems ?? []);
      })
      .catch((err) => {
        console.error('Failed to load preset:', err);
        alert('Failed to load preset.');
      })
      .finally(() => setLoading(false));
  }, [open, presetId, initialData]);

  const grouped = useMemo(() => {
    const groups: Record<string, { label: string; items: LineItem[] }> = {};
    for (const category of CATEGORY_ORDER) {
      const items = lineItems.filter((item) => normalizeCategory(item.category) === category && item.isIncluded);
      if (items.length > 0) groups[category] = { label: CATEGORY_LABELS[category], items };
    }
    return groups;
  }, [lineItems]);

  const totalCost = lineItems
    .filter((item) => item.isIncluded && !item.isSurveyDependent)
    .reduce((sum, item) => sum + item.quantity * item.unitRate, 0);
  const surveyPendingCount = lineItems.filter((item) => item.isIncluded && item.isSurveyDependent).length;

  function updateItem(id: string, field: keyof LineItem, value: any) {
    setLineItems((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  }

  function removeItem(id: string) {
    setLineItems((prev) => prev.filter((item) => item.id !== id));
  }

  function addItemFromCatalog(catalogItem: any, category: string) {
    setLineItems((prev) => [...prev, newBlankItem(catalogItem, normalizeCategory(category), prev.length)]);
    setAddPickerOpen(false);
  }

  async function handleSave() {
    const parsedCapacity = Number(capacityKw);
    if (!name.trim()) {
      alert('Please enter a preset name.');
      return;
    }
    if (!Number.isFinite(parsedCapacity) || parsedCapacity <= 0) {
      alert('Please enter a valid capacity.');
      return;
    }

    setSaving(true);
    try {
      const normalizedLineItems = lineItems.map((item, index) => ({ ...item, sortOrder: index }));
      if (onSaveLocal) {
        await onSaveLocal({
          name: name.trim(),
          systemType,
          capacityKw: parsedCapacity,
          stateId: stateId || null,
          lineItems: normalizedLineItems,
        });
        onSaved(presetId, name.trim());
        onClose();
        return;
      }

      const savedId = await savePresetWithComponents(presetId, {
        name: name.trim(),
        systemType,
        capacityKw: parsedCapacity,
        stateId: stateId || null,
        lineItems: normalizedLineItems,
      });
      onSaved(savedId, name.trim());
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
      <button
        type="button"
        className="absolute inset-0 bg-black/45 backdrop-blur-sm"
        aria-label="Close preset editor"
        onClick={onClose}
      />

      <div className="relative w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-xl border border-border bg-surface shadow-2xl flex flex-col">
        <div className="px-5 py-4 border-b border-border bg-background/70">
          <div className="flex flex-col lg:flex-row lg:items-end gap-3">
            <label className="flex-1 min-w-0">
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-1">Preset Name</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-text-primary outline-none focus:border-accent"
                placeholder="Kerala 5 kW Standard"
              />
            </label>

            <label className="w-full lg:w-32">
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-1">Capacity</span>
              <input
                type="number"
                value={capacityKw}
                onChange={(event) => setCapacityKw(event.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
                placeholder="5"
              />
            </label>

            <label className="w-full lg:w-56">
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-1">State</span>
              <select
                value={stateId}
                onChange={(event) => setStateId(event.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
              >
                <option value="">Global preset</option>
                {states.map((state) => (
                  <option key={state.id} value={state.id}>
                    {state.state_name}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex rounded-lg border border-border bg-surface p-1">
              {SYSTEM_TYPE_OPTIONS.map((option) => (
                <button
                  type="button"
                  key={option.value}
                  onClick={() => setSystemType(option.value)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                    systemType === option.value
                      ? 'bg-accent text-background'
                      : 'text-text-muted hover:bg-surface-hover hover:text-text-primary'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {loading ? (
            <div className="py-16 text-center text-sm text-text-muted">Loading preset...</div>
          ) : (
            <>
              {Object.entries(grouped).map(([category, { label, items }]) => (
                <section key={category} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-text-muted">{label}</h3>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setAddPickerOpen(addPickerOpen === category ? false : category)}
                        className="text-xs font-semibold text-accent hover:text-accent-hover"
                      >
                        + Add
                      </button>
                      {addPickerOpen === category && (
                        <div className="absolute right-0 top-full mt-2 z-50">
                          <CatalogItemPicker
                            category={category}
                            onSelect={addItemFromCatalog}
                            onClose={() => setAddPickerOpen(false)}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="grid gap-2 rounded-lg border border-border bg-background/60 p-3 md:grid-cols-[minmax(0,1fr)_90px_120px_90px_95px_36px] md:items-center"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-text-primary">
                            {(item.brand || item.model)
                              ? [item.brand, item.model].filter(Boolean).join(' ')
                              : item.description}
                          </p>
                          {(item.brand || item.model) && (
                            <p className="truncate text-xs text-text-muted">
                              {item.description}
                            </p>
                          )}
                          <textarea
                            value={item.specificationDetails ?? ''}
                            onChange={(event) => updateItem(item.id as string, 'specificationDetails', event.target.value)}
                            rows={2}
                            className="mt-2 w-full resize-none rounded-md border border-border bg-surface px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent"
                            placeholder="Specification details for quote PDF"
                          />
                        </div>

                        <input
                          type="number"
                          value={item.isSurveyDependent ? '' : item.quantity}
                          disabled={item.isSurveyDependent}
                          onChange={(event) => updateItem(item.id as string, 'quantity', Number(event.target.value) || 0)}
                          className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-text-primary outline-none focus:border-accent disabled:opacity-50"
                          placeholder={item.isSurveyDependent ? 'TBD' : 'Qty'}
                        />

                        <input
                          type="number"
                          value={item.unitRate}
                          onChange={(event) => updateItem(item.id as string, 'unitRate', Number(event.target.value) || 0)}
                          className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-text-primary outline-none focus:border-accent"
                          placeholder="Rate"
                        />

                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={gstRateToPercent(item.gstPct, 0.18)}
                          onChange={(event) => updateItem(item.id as string, 'gstPct', normalizeGstRate(event.target.value, 0.18))}
                          className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-text-primary outline-none focus:border-accent"
                          placeholder="GST %"
                        />

                        <div className="text-sm font-semibold text-text-secondary md:text-right">
                          {item.isSurveyDependent ? 'TBD' : `INR ${(item.quantity * item.unitRate).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
                        </div>

                        <button
                          type="button"
                          onClick={() => removeItem(item.id as string)}
                          className="h-9 rounded-md text-text-muted hover:bg-red-500/10 hover:text-red-500"
                          aria-label={`Remove ${item.description}`}
                        >
                          x
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              ))}

              <section className="rounded-lg border border-dashed border-border bg-background/50 p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">Add Component</p>
                <div className="relative flex flex-wrap gap-2">
                  {CATEGORY_ORDER.map((category) => (
                    <button
                      type="button"
                      key={category}
                      onClick={() => setAddPickerOpen(addPickerOpen === category ? false : category)}
                      className="rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold text-text-secondary hover:border-accent/40 hover:text-accent"
                    >
                      + {CATEGORY_LABELS[category]}
                    </button>
                  ))}
                  {addPickerOpen && !grouped[addPickerOpen] && (
                    <div className="absolute left-0 bottom-full mb-2 z-50">
                      <CatalogItemPicker
                        category={addPickerOpen}
                        onSelect={addItemFromCatalog}
                        onClose={() => setAddPickerOpen(false)}
                      />
                    </div>
                  )}
                </div>
              </section>
            </>
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-border bg-background/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-text-muted">
            Est. BOM Cost:
            <span className="ml-2 font-semibold text-text-primary">
              INR {totalCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </span>
            {surveyPendingCount > 0 && <span className="ml-2 text-xs text-amber-600">+ {surveyPendingCount} survey-pending</span>}
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-text-secondary hover:bg-surface-hover hover:text-text-primary"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || loading}
              className="rounded-lg bg-accent px-5 py-2 text-sm font-bold text-background hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Saving...' : presetId ? 'Save Changes' : 'Create Preset'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
