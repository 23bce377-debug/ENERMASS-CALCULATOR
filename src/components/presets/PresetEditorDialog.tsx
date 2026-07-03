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
  mode?: 'create' | 'edit' | 'duplicate';
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

const CORE_CATEGORIES = ['panel', 'inverter', 'battery'];

const CATEGORY_LABELS: Record<string, string> = {
  all: 'All Saved Items',
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

const SYSTEM_TYPE_OPTIONS = [
  { value: 'on_grid', label: 'On-Grid' },
  { value: '3_phase', label: '3-Phase' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'micro_inverter', label: 'Micro' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'upgrade', label: 'Upgrade' },
];

const STAGES = [
  { id: 'details', label: 'Basics', hint: 'Name, state, goal wattage' },
  { id: 'core', label: 'Core Components', hint: 'Panel, inverter, batteries' },
  { id: 'bom', label: 'BOM Items', hint: 'All saved DB items' },
  { id: 'review', label: 'Review', hint: 'Final check and save' },
] as const;

type StageId = (typeof STAGES)[number]['id'];

function normalizeCategory(category: string | null | undefined) {
  if (!category || category === 'other' || category === 'all') return 'miscellaneous';
  return category;
}

function newBlankItem(catalogItem: any, category: string, sortOrder: number): LineItem {
  const itemCategory = normalizeCategory(catalogItem.category ?? category);

  return {
    id: `temp_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    category: itemCategory,
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

function itemTitle(item: LineItem) {
  const sourceName = [item.brand, item.model].filter(Boolean).join(' ').trim();
  return sourceName || item.description || 'Untitled item';
}

function PresetItemEditor({
  item,
  onUpdate,
  onRemove,
}: {
  item: LineItem;
  onUpdate: (field: keyof LineItem, value: any) => void;
  onRemove: () => void;
}) {
  const amount = item.isSurveyDependent ? null : Number(item.quantity || 0) * Number(item.unitRate || 0);

  return (
    <div className={`rounded-xl border p-3 transition-colors ${item.isIncluded ? 'border-border bg-background/60' : 'border-border/60 bg-background/30 opacity-75'}`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
        <label className="flex-1 min-w-0">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-text-muted">Description</span>
          <input
            value={item.description}
            onChange={(event) => onUpdate('description', event.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-text-primary outline-none focus:border-accent"
          />
          {(item.brand || item.model || item.skuCode) && (
            <p className="mt-1 truncate text-xs text-text-muted">
              {[item.brand, item.model, item.skuCode].filter(Boolean).join(' - ')}
            </p>
          )}
        </label>

        <label className="w-full lg:w-44">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-text-muted">Category</span>
          <select
            value={normalizeCategory(item.category)}
            onChange={(event) => onUpdate('category', event.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
          >
            {CATEGORY_ORDER.map((category) => (
              <option key={category} value={category}>
                {CATEGORY_LABELS[category]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-[84px_92px_120px_90px_130px]">
        <label>
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-text-muted">Unit</span>
          <input
            value={item.unit}
            onChange={(event) => onUpdate('unit', event.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-2 py-2 text-sm text-text-primary outline-none focus:border-accent"
          />
        </label>
        <label>
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-text-muted">Qty</span>
          <input
            type="number"
            min="0"
            value={item.isSurveyDependent ? '' : item.quantity}
            disabled={item.isSurveyDependent}
            onChange={(event) => onUpdate('quantity', Number(event.target.value) || 0)}
            placeholder={item.isSurveyDependent ? 'TBD' : '0'}
            className="w-full rounded-lg border border-border bg-surface px-2 py-2 text-sm text-text-primary outline-none focus:border-accent disabled:opacity-50"
          />
        </label>
        <label>
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-text-muted">Rate</span>
          <input
            type="number"
            min="0"
            value={item.unitRate}
            onChange={(event) => onUpdate('unitRate', Number(event.target.value) || 0)}
            className="w-full rounded-lg border border-border bg-surface px-2 py-2 text-sm text-text-primary outline-none focus:border-accent"
          />
        </label>
        <label>
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-text-muted">GST %</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={gstRateToPercent(item.gstPct, 0.18)}
            onChange={(event) => onUpdate('gstPct', normalizeGstRate(event.target.value, 0.18))}
            className="w-full rounded-lg border border-border bg-surface px-2 py-2 text-sm text-text-primary outline-none focus:border-accent"
          />
        </label>
        <div className="rounded-lg border border-border bg-surface px-3 py-2">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-text-muted">Amount</span>
          <span className="text-sm font-bold text-text-primary">
            {amount === null ? 'TBD' : `INR ${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
          </span>
        </div>
      </div>

      <textarea
        value={item.specificationDetails ?? ''}
        onChange={(event) => onUpdate('specificationDetails', event.target.value)}
        rows={2}
        className="mt-3 w-full resize-none rounded-lg border border-border bg-surface px-3 py-2 text-xs text-text-primary outline-none focus:border-accent"
        placeholder="Quote PDF specification details, warranty notes, standards..."
      />

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-3">
        <div className="flex flex-wrap gap-3 text-xs font-semibold text-text-secondary">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={item.isIncluded}
              onChange={(event) => onUpdate('isIncluded', event.target.checked)}
              className="h-4 w-4 accent-accent"
            />
            Included in preset
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={item.isSurveyDependent}
              onChange={(event) => onUpdate('isSurveyDependent', event.target.checked)}
              className="h-4 w-4 accent-accent"
            />
            Survey dependent
          </label>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="rounded-lg px-3 py-1.5 text-xs font-bold text-red-500 hover:bg-red-500/10"
          aria-label={`Remove ${itemTitle(item)}`}
        >
          Remove
        </button>
      </div>
    </div>
  );
}

export function PresetEditorDialog({
  presetId,
  open,
  onClose,
  onSaved,
  mode,
  initialData,
  onSaveLocal,
}: PresetEditorDialogProps) {
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [name, setName] = useState('');
  const [capacityKw, setCapacityKw] = useState('');
  const [systemType, setSystemType] = useState('on_grid');
  const [stateId, setStateId] = useState('');
  const [states, setStates] = useState<PresetStateOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [addPickerOpen, setAddPickerOpen] = useState<string | false>(false);
  const [activeStage, setActiveStage] = useState<StageId>('details');
  const [mounted, setMounted] = useState(false);

  const dialogMode = mode ?? (presetId ? 'edit' : 'create');
  const parsedCapacity = Number(capacityKw);
  const hasValidBasics = name.trim().length > 0 && Number.isFinite(parsedCapacity) && parsedCapacity > 0 && Boolean(stateId);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;

    setActiveStage('details');
    setAddPickerOpen(false);
    getPresetStates()
      .then((loadedStates) => {
        setStates(loadedStates);
        setStateId((current) => current || loadedStates[0]?.id || '');
      })
      .catch((err) => {
        console.error('Failed to load preset states:', err);
        setStates([]);
      });

    if (initialData) {
      setName(dialogMode === 'duplicate' && initialData.name && !initialData.name.toLowerCase().includes('copy')
        ? `${initialData.name} Copy`
        : initialData.name ?? '');
      setCapacityKw(initialData.capacity_kw ? String(Number(initialData.capacity_kw)) : '');
      setSystemType(SYSTEM_TYPE_OPTIONS.some((option) => option.value === initialData.system_type) ? initialData.system_type : 'on_grid');
      setStateId(initialData.state_id ?? '');
      setLineItems((initialData.lineItems ?? []).map((item, index) => ({
        ...item,
        id: dialogMode === 'duplicate' ? `copy_${Date.now()}_${index}` : item.id,
        category: normalizeCategory(item.category),
        sortOrder: index,
      })));
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
        setName(dialogMode === 'duplicate' && data.name && !String(data.name).toLowerCase().includes('copy')
          ? `${data.name} Copy`
          : data.name ?? '');
        setCapacityKw(data.capacity_kw ? String(Number(data.capacity_kw)) : '');
        setSystemType(data.system_type ?? 'on_grid');
        setStateId(data.state_id ?? '');
        setLineItems((data.lineItems ?? []).map((item: LineItem, index: number) => ({
          ...item,
          id: dialogMode === 'duplicate' ? `copy_${Date.now()}_${index}` : item.id,
          category: normalizeCategory(item.category),
          sortOrder: index,
        })));
      })
      .catch((err) => {
        console.error('Failed to load preset:', err);
        alert('Failed to load preset.');
      })
      .finally(() => setLoading(false));
  }, [open, presetId, initialData, dialogMode]);

  const grouped = useMemo(() => {
    const groups: Record<string, LineItem[]> = {};
    for (const category of CATEGORY_ORDER) {
      groups[category] = lineItems.filter((item) => normalizeCategory(item.category) === category);
    }
    return groups;
  }, [lineItems]);

  const bomItems = useMemo(
    () => lineItems.filter((item) => !CORE_CATEGORIES.includes(normalizeCategory(item.category))),
    [lineItems],
  );

  const totalCost = lineItems
    .filter((item) => item.isIncluded && !item.isSurveyDependent)
    .reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitRate || 0), 0);
  const surveyPendingCount = lineItems.filter((item) => item.isIncluded && item.isSurveyDependent).length;
  const includedCount = lineItems.filter((item) => item.isIncluded).length;

  function updateItem(id: string, field: keyof LineItem, value: any) {
    setLineItems((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  }

  function removeItem(id: string) {
    setLineItems((prev) => prev.filter((item) => item.id !== id).map((item, index) => ({ ...item, sortOrder: index })));
  }

  function addItemFromCatalog(catalogItem: any, category: string) {
    setLineItems((prev) => [...prev, newBlankItem(catalogItem, category, prev.length)]);
    setAddPickerOpen(false);
  }

  function goToNextStage() {
    const currentIndex = STAGES.findIndex((stage) => stage.id === activeStage);
    if (currentIndex < STAGES.length - 1) {
      setActiveStage(STAGES[currentIndex + 1].id);
    }
  }

  function goToPreviousStage() {
    const currentIndex = STAGES.findIndex((stage) => stage.id === activeStage);
    if (currentIndex > 0) {
      setActiveStage(STAGES[currentIndex - 1].id);
    }
  }

  async function handleSave() {
    if (!name.trim()) {
      setActiveStage('details');
      alert('Please enter a preset name.');
      return;
    }
    if (!Number.isFinite(parsedCapacity) || parsedCapacity <= 0) {
      setActiveStage('details');
      alert('Please enter a valid goal wattage/capacity.');
      return;
    }
    if (!stateId) {
      setActiveStage('details');
      alert('Please select a state for this preset.');
      return;
    }

    setSaving(true);
    try {
      const normalizedLineItems = lineItems.map((item, index) => ({
        ...item,
        category: normalizeCategory(item.category),
        sortOrder: index,
      }));
      if (onSaveLocal) {
        await onSaveLocal({
          name: name.trim(),
          systemType,
          capacityKw: parsedCapacity,
          stateId,
          lineItems: normalizedLineItems,
        });
        onSaved(presetId, name.trim());
        onClose();
        return;
      }

      const savedId = await savePresetWithComponents(dialogMode === 'duplicate' ? '' : presetId, {
        name: name.trim(),
        systemType,
        capacityKw: parsedCapacity,
        stateId,
        lineItems: normalizedLineItems,
      });
      onSaved(savedId, name.trim());
      onClose();
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Failed to save preset.');
    } finally {
      setSaving(false);
    }
  }

  function renderPicker(category: string, align: 'left' | 'right' = 'right') {
    if (addPickerOpen !== category) return null;

    return (
      <div className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} top-full z-50 mt-2`}>
        <CatalogItemPicker
          category={category}
          onSelect={addItemFromCatalog}
          onClose={() => setAddPickerOpen(false)}
        />
      </div>
    );
  }

  if (!mounted || !open) return null;

  const stageIndex = STAGES.findIndex((stage) => stage.id === activeStage);
  const title = dialogMode === 'duplicate'
    ? 'Duplicate Preset'
    : dialogMode === 'edit'
      ? 'Edit Preset'
      : 'Create Detailed Preset';
  const primaryLabel = saving
    ? 'Saving...'
    : dialogMode === 'duplicate'
      ? 'Create Duplicate'
      : dialogMode === 'edit'
        ? 'Save Preset'
        : 'Create Preset';

  return createPortal(
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-3 sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        aria-label="Close preset editor"
        onClick={onClose}
      />

      <div className="relative flex h-[94vh] w-full max-w-[min(96vw,92rem)] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl">
        <div className="border-b border-border bg-background/75 px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-text-primary">{title}</h2>
              <p className="text-xs text-text-muted">
                Stage-wise preset setup with state, goal wattage, core components, and complete BOM control.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-text-muted hover:bg-surface-hover hover:text-text-primary"
              aria-label="Close preset editor"
            >
              x
            </button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[290px_minmax(0,1fr)]">
          <aside className="border-b border-border bg-background/45 p-4 lg:border-b-0 lg:border-r lg:p-5">
            <div className="flex gap-2 overflow-x-auto lg:block lg:space-y-2 lg:overflow-visible">
              {STAGES.map((stage, index) => {
                const isActive = activeStage === stage.id;
                return (
                  <button
                    type="button"
                    key={stage.id}
                    onClick={() => setActiveStage(stage.id)}
                    className={`flex min-w-[210px] items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors lg:w-full ${
                      isActive
                        ? 'border-accent bg-accent/15 text-accent'
                        : 'border-border bg-surface text-text-muted hover:border-border-light hover:text-text-primary'
                    }`}
                  >
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-bold ${
                      isActive ? 'border-accent bg-accent text-background' : 'border-border bg-background text-text-secondary'
                    }`}>
                      {index + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-bold uppercase tracking-wide">{stage.label}</span>
                      <span className="block text-xs text-text-muted">{stage.hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 hidden rounded-xl border border-border bg-surface p-4 text-sm lg:block">
              <p className="text-xs font-bold uppercase tracking-wider text-text-muted">Current preset</p>
              <p className="mt-2 truncate font-bold text-text-primary">{name.trim() || 'Untitled preset'}</p>
              <p className="mt-1 text-text-muted">{capacityKw || '0'} kW</p>
              <p className="mt-1 text-text-muted">{states.find((state) => state.id === stateId)?.state_name || 'Select a state'}</p>
              <div className="mt-3 border-t border-border pt-3 text-xs text-text-muted">
                {includedCount} included item(s)
                <br />
                INR {totalCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </div>
            </div>
          </aside>

          <main className="min-h-0 overflow-y-auto p-5 lg:p-6">
            {loading ? (
              <div className="py-20 text-center text-sm text-text-muted">Loading preset...</div>
            ) : (
              <>
              {activeStage === 'details' && (
                <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
                  <section className="space-y-4 rounded-xl border border-border bg-background/45 p-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-accent">Stage 1</p>
                      <h3 className="text-xl font-bold text-text-primary">Preset basics</h3>
                      <p className="text-sm text-text-muted">
                        Set the name, state, and goal wattage first. These stay editable later too.
                      </p>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="md:col-span-2">
                        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-text-muted">Preset Name *</span>
                        <input
                          value={name}
                          onChange={(event) => setName(event.target.value)}
                          className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm font-semibold text-text-primary outline-none focus:border-accent"
                          placeholder="Kerala 5 kW Standard"
                        />
                      </label>

                      <label>
                        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-text-muted">Goal Wattage / Capacity (kW) *</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={capacityKw}
                          onChange={(event) => setCapacityKw(event.target.value)}
                          className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text-primary outline-none focus:border-accent"
                          placeholder="5"
                        />
                      </label>

                      <label>
                        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-text-muted">Preset State *</span>
                        <select
                          value={stateId}
                          onChange={(event) => setStateId(event.target.value)}
                          className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text-primary outline-none focus:border-accent"
                        >
                          <option value="" disabled>Select state</option>
                          {states.map((state) => (
                            <option key={state.id} value={state.id}>
                              {state.state_name}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <div>
                      <span className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-text-muted">Preset Type</span>
                      <div className="flex flex-wrap gap-2">
                        {SYSTEM_TYPE_OPTIONS.map((option) => (
                          <button
                            type="button"
                            key={option.value}
                            onClick={() => setSystemType(option.value)}
                            className={`rounded-lg border px-3 py-2 text-xs font-bold transition-colors ${
                              systemType === option.value
                                ? 'border-accent bg-accent text-background'
                                : 'border-border bg-surface text-text-muted hover:text-text-primary'
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </section>

                  <aside className="rounded-xl border border-border bg-background/45 p-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-text-muted">What gets saved</p>
                    <div className="mt-3 space-y-3 text-sm">
                      <div className="rounded-lg bg-surface p-3">
                        <p className="text-text-muted">Preset name</p>
                        <p className="font-bold text-text-primary">{name.trim() || 'Not set'}</p>
                      </div>
                      <div className="rounded-lg bg-surface p-3">
                        <p className="text-text-muted">Goal wattage</p>
                        <p className="font-bold text-text-primary">{capacityKw || 'Not set'} kW</p>
                      </div>
                      <div className="rounded-lg bg-surface p-3">
                        <p className="text-text-muted">State scope</p>
                        <p className="font-bold text-text-primary">
                          {states.find((state) => state.id === stateId)?.state_name || 'Select a state'}
                        </p>
                      </div>
                    </div>
                  </aside>
                </div>
              )}

              {activeStage === 'core' && (
                <div className="space-y-5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-accent">Stage 2</p>
                      <h3 className="text-xl font-bold text-text-primary">Core components</h3>
                      <p className="text-sm text-text-muted">
                        Pick saved panels, inverters, and batteries from DB. Batteries can stay empty for non-hybrid presets.
                      </p>
                    </div>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setAddPickerOpen(addPickerOpen === 'all' ? false : 'all')}
                        className="rounded-lg border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-bold text-accent hover:bg-accent/20"
                      >
                        + Add Any Saved Item
                      </button>
                      {renderPicker('all')}
                    </div>
                  </div>

                  {CORE_CATEGORIES.map((category) => {
                    const items = grouped[category] ?? [];
                    return (
                      <section key={category} className="space-y-3 rounded-xl border border-border bg-background/45 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <h4 className="text-sm font-bold uppercase tracking-wider text-text-secondary">{CATEGORY_LABELS[category]}</h4>
                            <p className="text-xs text-text-muted">{items.length} selected</p>
                          </div>
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setAddPickerOpen(addPickerOpen === category ? false : category)}
                              className="rounded-lg bg-accent px-3 py-2 text-xs font-bold text-background hover:bg-accent-hover"
                            >
                              + Add {CATEGORY_LABELS[category]}
                            </button>
                            {renderPicker(category)}
                          </div>
                        </div>
                        {items.length > 0 ? (
                          <div className="space-y-3">
                            {items.map((item) => (
                              <PresetItemEditor
                                key={item.id}
                                item={item}
                                onUpdate={(field, value) => updateItem(item.id as string, field, value)}
                                onRemove={() => removeItem(item.id as string)}
                              />
                            ))}
                          </div>
                        ) : (
                          <div className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-text-muted">
                            No {CATEGORY_LABELS[category].toLowerCase()} selected yet.
                          </div>
                        )}
                      </section>
                    );
                  })}
                </div>
              )}

              {activeStage === 'bom' && (
                <div className="space-y-5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-accent">Stage 3</p>
                      <h3 className="text-xl font-bold text-text-primary">Detailed BOM items</h3>
                      <p className="text-sm text-text-muted">
                        Add every protection, structure, cable, civil, logistics, accessory, and custom item needed in the preset.
                      </p>
                    </div>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setAddPickerOpen(addPickerOpen === 'all' ? false : 'all')}
                        className="rounded-lg border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-bold text-accent hover:bg-accent/20"
                      >
                        + Browse All Saved Items
                      </button>
                      {renderPicker('all')}
                    </div>
                  </div>

                  <section className="rounded-xl border border-dashed border-border bg-background/45 p-4">
                    <p className="mb-3 text-xs font-bold uppercase tracking-wider text-text-muted">Add by BOM category</p>
                    <div className="relative flex flex-wrap gap-2">
                      {CATEGORY_ORDER.filter((category) => !CORE_CATEGORIES.includes(category)).map((category) => (
                        <div key={category} className="relative">
                          <button
                            type="button"
                            onClick={() => setAddPickerOpen(addPickerOpen === category ? false : category)}
                            className="rounded-lg border border-border bg-surface px-3 py-2 text-xs font-bold text-text-secondary hover:border-accent/40 hover:text-accent"
                          >
                            + {CATEGORY_LABELS[category]}
                          </button>
                          {renderPicker(category, 'left')}
                        </div>
                      ))}
                    </div>
                  </section>

                  {bomItems.length > 0 ? (
                    CATEGORY_ORDER.filter((category) => !CORE_CATEGORIES.includes(category)).map((category) => {
                      const items = grouped[category] ?? [];
                      if (items.length === 0) return null;
                      return (
                        <section key={category} className="space-y-3">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-text-muted">{CATEGORY_LABELS[category]}</h4>
                          {items.map((item) => (
                            <PresetItemEditor
                              key={item.id}
                              item={item}
                              onUpdate={(field, value) => updateItem(item.id as string, field, value)}
                              onRemove={() => removeItem(item.id as string)}
                            />
                          ))}
                        </section>
                      );
                    })
                  ) : (
                    <div className="rounded-xl border border-dashed border-border bg-background/45 p-10 text-center text-sm text-text-muted">
                      No extra BOM items yet. Add saved DB items or custom items using the controls above.
                    </div>
                  )}
                </div>
              )}

              {activeStage === 'review' && (
                <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
                  <aside className="space-y-3 rounded-xl border border-border bg-background/45 p-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-accent">Stage 4</p>
                      <h3 className="text-xl font-bold text-text-primary">Review preset</h3>
                    </div>
                    <div className="grid gap-3 text-sm">
                      <div className="rounded-lg bg-surface p-3">
                        <p className="text-text-muted">Name</p>
                        <p className="font-bold text-text-primary">{name.trim() || 'Not set'}</p>
                      </div>
                      <div className="rounded-lg bg-surface p-3">
                        <p className="text-text-muted">State</p>
                        <p className="font-bold text-text-primary">{states.find((state) => state.id === stateId)?.state_name || 'Select a state'}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-lg bg-surface p-3">
                          <p className="text-text-muted">Capacity</p>
                          <p className="font-bold text-text-primary">{capacityKw || '0'} kW</p>
                        </div>
                        <div className="rounded-lg bg-surface p-3">
                          <p className="text-text-muted">Items</p>
                          <p className="font-bold text-text-primary">{includedCount}/{lineItems.length}</p>
                        </div>
                      </div>
                      <div className="rounded-lg bg-surface p-3">
                        <p className="text-text-muted">Estimated BOM Cost</p>
                        <p className="font-bold text-text-primary">INR {totalCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                        {surveyPendingCount > 0 && <p className="mt-1 text-xs text-amber-600">{surveyPendingCount} survey-dependent item(s)</p>}
                      </div>
                    </div>
                  </aside>

                  <section className="space-y-4">
                    {CATEGORY_ORDER.map((category) => {
                      const items = (grouped[category] ?? []).filter((item) => item.isIncluded);
                      if (items.length === 0) return null;
                      return (
                        <div key={category} className="rounded-xl border border-border bg-background/45 p-4">
                          <div className="mb-3 flex items-center justify-between">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-text-muted">{CATEGORY_LABELS[category]}</h4>
                            <span className="text-xs font-semibold text-text-muted">{items.length} item(s)</span>
                          </div>
                          <div className="divide-y divide-border/60">
                            {items.map((item) => (
                              <div key={item.id} className="flex items-center justify-between gap-4 py-2 text-sm">
                                <div className="min-w-0">
                                  <p className="truncate font-semibold text-text-primary">{itemTitle(item)}</p>
                                  <p className="text-xs text-text-muted">
                                    {item.isSurveyDependent ? 'Survey dependent' : `${item.quantity} ${item.unit} x INR ${Number(item.unitRate || 0).toLocaleString('en-IN')}`}
                                  </p>
                                </div>
                                <p className="shrink-0 font-bold text-text-secondary">
                                  {item.isSurveyDependent ? 'TBD' : `INR ${(Number(item.quantity || 0) * Number(item.unitRate || 0)).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    {lineItems.length === 0 && (
                      <div className="rounded-xl border border-dashed border-border bg-background/45 p-10 text-center text-sm text-text-muted">
                        This preset has no BOM items yet. Add core components and BOM items before using it for quotations.
                      </div>
                    )}
                  </section>
                </div>
              )}
              </>
            )}
          </main>
        </div>

        <div className="flex flex-col gap-3 border-t border-border bg-background/75 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="text-sm text-text-muted">
            <span className="font-semibold text-text-secondary">{STAGES[stageIndex]?.label}</span>
            <span className="mx-2">-</span>
            {STAGES[stageIndex]?.hint}
            <span className="ml-3 hidden font-semibold text-text-primary sm:inline">
              {includedCount} included item(s), INR {totalCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </span>
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
              onClick={goToPreviousStage}
              disabled={stageIndex === 0}
              className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-text-secondary hover:bg-surface-hover hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
            >
              Back
            </button>
            {activeStage !== 'review' ? (
              <button
                type="button"
                onClick={goToNextStage}
                disabled={activeStage === 'details' && !hasValidBasics}
                className="rounded-lg bg-accent px-5 py-2 text-sm font-bold text-background hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                Continue
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || loading || !hasValidBasics}
                className="rounded-lg bg-accent px-5 py-2 text-sm font-bold text-background hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {primaryLabel}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
