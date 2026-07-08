'use client';

import { useEffect, useMemo, useState } from 'react';
import { Box, Plus, Save, Search, Trash2 } from 'lucide-react';
import {
  deleteBomPreset,
  getBomPresetWithItems,
  listBomPresets,
  saveBomPresetWithItems,
  type BomPresetSummary,
  type LineItem,
} from '@/lib/actions/presets';
import { CatalogItemPicker } from '@/components/presets/CatalogItemPicker';
import { gstRateToPercent, normalizeGstRate } from '@/lib/utils/gst';
import {
  EXCEL_BOM_SUBCATEGORIES,
  TOP_CATEGORY_LABELS,
  defaultSubcategoryForItem,
  functionalCategoryFromTop,
  isBomItemSubcategory,
  normalizeFunctionalCategory,
  topCategoryFromFunctional,
  type PresetTopCategory,
} from '@/lib/presetTaxonomy';

const CORE_CATEGORIES = ['panel', 'inverter', 'battery', 'structure'];
const BOM_CATEGORIES = [
  'bom_item',
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
  bom_item: 'BOM Items',
  dc_protection: 'DC Protection',
  ac_protection: 'AC Protection',
  cable: 'Cables',
  earthing: 'Earthing',
  civil: 'Civil',
  logistics: 'Logistics',
  accessory: 'Accessories',
  miscellaneous: 'Miscellaneous',
};

function normalizeCategory(category: string | null | undefined) {
  const normalized = normalizeFunctionalCategory(category);
  if (normalized === 'bom_item') return 'accessory';
  return BOM_CATEGORIES.includes(normalized) ? normalized : 'miscellaneous';
}

function newItemFromCatalog(catalogItem: any, pickerCategory: string, sortOrder: number): LineItem {
  const category = normalizeCategory(catalogItem.category ?? pickerCategory);
  const subcategory = catalogItem.subcategory || defaultSubcategoryForItem({
    topCategory: catalogItem.topCategory,
    category,
    brand: catalogItem.brand,
    model: catalogItem.model,
    categoryName: catalogItem.categoryName,
  });
  return {
    id: `bom_master_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    category,
    topCategory: isBomItemSubcategory(subcategory) ? 'bom_item' : catalogItem.topCategory ?? topCategoryFromFunctional(category),
    subcategory,
    catalogItemId: catalogItem.id,
    catalogType: catalogItem.catalogType ?? catalogItem.type ?? 'custom',
    skuCode: catalogItem.skuCode ?? catalogItem.sku_code ?? '',
    description: catalogItem.description || catalogItem.name || [catalogItem.brand, catalogItem.model].filter(Boolean).join(' ') || 'Catalog item',
    brand: catalogItem.brand ?? '',
    model: catalogItem.model ?? '',
    specificationDetails: catalogItem.specificationDetails ?? catalogItem.specification_details ?? '',
    unit: catalogItem.unit ?? 'Nos',
    quantity: Number(catalogItem.defaultQty ?? catalogItem.quantity ?? 1),
    unitRate: Number(catalogItem.defaultRate ?? catalogItem.unitRate ?? catalogItem.rate ?? 0),
    gstPct: normalizeGstRate(catalogItem.gstPct ?? catalogItem.gst_pct ?? catalogItem.gstRate, 0.18),
    isIncluded: catalogItem.isIncluded ?? true,
    isSurveyDependent: catalogItem.isSurveyDependent ?? false,
    sortOrder,
  };
}

function emptyLineItem(sortOrder: number): LineItem {
  return {
    id: `bom_custom_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    category: 'miscellaneous',
    topCategory: 'miscellaneous',
    subcategory: 'Miscellaneous',
    catalogType: 'custom',
    description: '',
    brand: '',
    model: '',
    specificationDetails: '',
    unit: 'Nos',
    quantity: 1,
    unitRate: 0,
    gstPct: 0.18,
    isIncluded: true,
    isSurveyDependent: false,
    sortOrder,
  };
}

function formatMoney(value: number) {
  return value.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

export function BomPresetMaster() {
  const [presets, setPresets] = useState<BomPresetSummary[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState<string | false>(false);
  const [itemSearch, setItemSearch] = useState('');

  const selectedPreset = useMemo(
    () => presets.find((preset) => preset.id === selectedPresetId) ?? null,
    [presets, selectedPresetId],
  );

  const total = lineItems.reduce((sum, item) => {
    if (item.isSurveyDependent || !item.isIncluded) return sum;
    return sum + Number(item.quantity || 0) * Number(item.unitRate || 0);
  }, 0);

  async function refreshPresets(selectId?: string | null) {
    const rows = await listBomPresets();
    setPresets(rows);
    if (selectId === null) {
      setSelectedPresetId('');
      setLoading(false);
      return;
    }
    const nextId = selectId || selectedPresetId || rows[0]?.id || '';
    setSelectedPresetId(rows.some((preset) => preset.id === nextId) ? nextId : rows[0]?.id || '');
    setLoading(false);
  }

  async function loadPreset(presetId: string) {
    if (!presetId) {
      startNewPreset();
      return;
    }

    setLoading(true);
    setNotice(null);
    try {
      const preset = await getBomPresetWithItems(presetId);
      setSelectedPresetId(presetId);
      setName(preset.name);
      setDescription(preset.description ?? '');
      setLineItems(preset.lineItems.map((item, index) => ({ ...item, sortOrder: index })));
    } catch (err) {
      console.error('Failed to load BOM preset:', err);
      setNotice(err instanceof Error ? err.message : 'Failed to load BOM preset.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    listBomPresets()
      .then((rows) => {
        if (cancelled) return;
        setPresets(rows);
        const firstId = rows[0]?.id || '';
        setSelectedPresetId(firstId);
        if (!firstId) return undefined;
        return getBomPresetWithItems(firstId).then((preset) => {
          if (cancelled) return;
          setName(preset.name);
          setDescription(preset.description ?? '');
          setLineItems(preset.lineItems.map((item, index) => ({ ...item, sortOrder: index })));
        });
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('Failed to load BOM presets:', err);
          setNotice(err instanceof Error ? err.message : 'Failed to load BOM presets.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function updateItem(id: string, field: keyof LineItem, value: any) {
    setLineItems((items) => items.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  }

  function removeItem(id: string) {
    setLineItems((items) => items.filter((item) => item.id !== id).map((item, index) => ({ ...item, sortOrder: index })));
  }

  function addCatalogItem(catalogItem: any, pickerCategory: string) {
    const itemCategory = normalizeCategory(catalogItem.category ?? pickerCategory);
    if (CORE_CATEGORIES.includes(itemCategory)) {
      setNotice('Panels, inverters, batteries, and structures belong in Core Components, not BOM presets.');
      setPickerOpen(false);
      return;
    }
    setLineItems((items) => [...items, newItemFromCatalog({ ...catalogItem, category: itemCategory }, pickerCategory, items.length)]);
    setItemSearch('');
    setPickerOpen(false);
  }

  function addCustomItem() {
    setLineItems((items) => [...items, emptyLineItem(items.length)]);
  }

  function startNewPreset() {
    setSelectedPresetId('');
    setName('');
    setDescription('');
    setLineItems([]);
    setNotice(null);
  }

  async function savePreset() {
    if (!name.trim()) {
      setNotice('Enter a BOM preset name before saving.');
      return;
    }
    if (lineItems.length === 0) {
      setNotice('Add at least one BOM item before saving.');
      return;
    }

    setSaving(true);
    setNotice(null);
    try {
      const savedId = await saveBomPresetWithItems({
        presetId: selectedPresetId || null,
        name: name.trim(),
        description: description.trim(),
        lineItems: lineItems.map((item, index) => ({ ...item, sortOrder: index })),
      });
      await refreshPresets(savedId);
      await loadPreset(savedId);
      setNotice(selectedPresetId ? 'BOM preset updated.' : 'BOM preset created.');
    } catch (err) {
      console.error('Failed to save BOM preset:', err);
      setNotice(err instanceof Error ? err.message : 'Failed to save BOM preset.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteSelectedPreset() {
    if (!selectedPreset) {
      setNotice('Select a BOM preset before deleting.');
      return;
    }
    if (!confirm(`Delete BOM preset "${selectedPreset.name}"? System presets that already used it will not change.`)) {
      return;
    }

    setSaving(true);
    setNotice(null);
    try {
      await deleteBomPreset(selectedPreset.id);
      startNewPreset();
      await refreshPresets(null);
      setNotice('BOM preset deleted.');
    } catch (err) {
      console.error('Failed to delete BOM preset:', err);
      setNotice(err instanceof Error ? err.message : 'Failed to delete BOM preset.');
    } finally {
      setSaving(false);
    }
  }

  function renderPicker(category: string, align: 'left' | 'right' = 'right', initialSearch = '', initialSubcategory = 'all') {
    if (pickerOpen !== category) return null;
    return (
      <div className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} top-full z-50 mt-2`}>
        <CatalogItemPicker
          category={category}
          onSelect={addCatalogItem}
          onClose={() => setPickerOpen(false)}
          excludeCategories={CORE_CATEGORIES}
          initialSearch={initialSearch}
          initialSubcategory={initialSubcategory}
          searchPlaceholder="Search by item, SKU, category, specs, unit, or rate..."
        />
      </div>
    );
  }

  return (
    <main className="space-y-4 rounded-xl border border-border bg-surface p-4 shadow-sm">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-dim text-accent">
            <Box size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-text-primary">BOM Preset Master</h2>
            <p className="text-sm text-text-muted">Create reusable non-core BOM item sets for system presets.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={startNewPreset}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-bold text-text-secondary hover:border-accent/40 hover:text-accent"
          >
            <Plus size={14} /> New
          </button>
          {selectedPresetId && (
            <button
              type="button"
              onClick={deleteSelectedPreset}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-500 hover:bg-red-500/20 disabled:opacity-50"
            >
              <Trash2 size={14} /> Delete
            </button>
          )}
          <button
            type="button"
            onClick={savePreset}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-xs font-bold text-background hover:bg-accent-hover disabled:opacity-50"
          >
            <Save size={14} /> {saving ? 'Saving...' : selectedPresetId ? 'Save Changes' : 'Create Set'}
          </button>
        </div>
      </div>

      {notice && (
        <div className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold text-text-secondary">
          {notice}
        </div>
      )}

      <section className="grid gap-3 lg:grid-cols-[280px_minmax(0,1fr)_minmax(0,1fr)]">
        <label className="grid gap-1">
          <span className="text-xs font-bold uppercase tracking-wider text-text-muted">Saved Set</span>
          <select
            value={selectedPresetId}
            onChange={(event) => loadPreset(event.target.value)}
            disabled={loading}
            className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-text-primary outline-none focus:border-accent disabled:opacity-60"
          >
            <option value="">New BOM preset</option>
            {presets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name} ({preset.itemCount})
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1">
          <span className="text-xs font-bold uppercase tracking-wider text-text-muted">Preset Name *</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Standard residential protection kit"
            className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-text-primary outline-none focus:border-accent"
          />
        </label>
        <label className="grid gap-1">
          <span className="text-xs font-bold uppercase tracking-wider text-text-muted">Description</span>
          <input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Where this set should be used"
            className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-text-primary outline-none focus:border-accent"
          />
        </label>
      </section>

      <section className="rounded-xl border border-border bg-background/60 p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-text-muted">Items</p>
            <p className="text-sm text-text-secondary">
              {lineItems.length} item(s), INR {formatMoney(total)}
            </p>
          </div>
          <div className="flex flex-1 flex-col gap-2 lg:max-w-3xl lg:flex-row lg:items-center lg:justify-end">
            <div className="relative min-w-[min(100%,22rem)] flex-1 lg:max-w-xl">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                value={itemSearch}
                onFocus={() => setPickerOpen('all')}
                onChange={(event) => {
                  setItemSearch(event.target.value);
                  setPickerOpen('all');
                }}
                placeholder="Search BOM items by name, SKU, category, unit, rate..."
                className="w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-3 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-accent"
              />
              {renderPicker('all', 'left', itemSearch)}
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => setPickerOpen(pickerOpen === 'all' ? false : 'all')}
                className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-xs font-bold text-accent hover:bg-accent/20"
              >
                Browse All
              </button>
            </div>
            <button
              type="button"
              onClick={addCustomItem}
              className="rounded-lg border border-border bg-surface px-3 py-2 text-xs font-bold text-text-secondary hover:border-accent/40 hover:text-accent"
            >
              Add Custom Item
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-dashed border-border bg-background/45 p-3">
        <p className="mb-3 text-xs font-bold uppercase tracking-wider text-text-muted">Add by category / subcategory</p>
        <div className="relative flex flex-wrap gap-2">
          {EXCEL_BOM_SUBCATEGORIES.map((subcategory) => {
            const key = `bom_item:${subcategory}`;
            return (
              <div key={subcategory} className="relative">
                <button
                  type="button"
                  onClick={() => setPickerOpen(pickerOpen === key ? false : key)}
                  className="rounded-lg border border-border bg-surface px-3 py-2 text-xs font-bold text-text-secondary hover:border-accent/40 hover:text-accent"
                >
                  + {subcategory}
                </button>
                {pickerOpen === key && (
                  <div className="absolute left-0 top-full z-50 mt-2">
                    <CatalogItemPicker
                      category="bom_item"
                      onSelect={addCatalogItem}
                      onClose={() => setPickerOpen(false)}
                      excludeCategories={CORE_CATEGORIES}
                      initialSubcategory={subcategory}
                      searchPlaceholder="Search by item, SKU, subcategory, specs, unit, or rate..."
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-border">
        <div className="hidden grid-cols-[minmax(220px,1fr)_140px_180px_82px_90px_120px_90px_90px] gap-3 border-b border-border bg-background/70 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-text-muted xl:grid">
          <span>Item</span>
          <span>Category</span>
          <span>Subcategory</span>
          <span>Unit</span>
          <span>Qty</span>
          <span>Rate</span>
          <span>GST</span>
          <span>Action</span>
        </div>
        <div className="divide-y divide-border">
          {lineItems.map((item) => {
            const amount = Number(item.quantity || 0) * Number(item.unitRate || 0);
            const subcategoryListId = `bom-preset-subcategories-${String(item.id ?? item.description).replace(/[^a-zA-Z0-9_-]/g, '-')}`;
            return (
              <div key={item.id} className="grid gap-3 bg-background/45 p-3 xl:grid-cols-[minmax(220px,1fr)_140px_180px_82px_90px_120px_90px_90px] xl:items-center">
                <label className="grid gap-1">
                  <span className="xl:hidden text-[11px] font-bold uppercase tracking-wider text-text-muted">Item</span>
                  <input
                    value={item.description}
                    onChange={(event) => updateItem(item.id as string, 'description', event.target.value)}
                    placeholder="BOM item description"
                    className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-text-primary outline-none focus:border-accent"
                  />
                  <span className="text-xs text-text-muted">INR {formatMoney(amount)}</span>
                </label>
                <label className="grid gap-1">
                  <span className="xl:hidden text-[11px] font-bold uppercase tracking-wider text-text-muted">Category</span>
                  <select
                    value={item.topCategory ?? topCategoryFromFunctional(item.category)}
                    onChange={(event) => {
                      const nextTopCategory = event.target.value;
                      updateItem(item.id as string, 'topCategory', nextTopCategory);
                      updateItem(item.id as string, 'category', functionalCategoryFromTop(nextTopCategory, item.category));
                    }}
                    className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
                  >
                    {(['bom_item', 'miscellaneous'] as PresetTopCategory[]).map((category) => (
                      <option key={category} value={category}>{TOP_CATEGORY_LABELS[category]}</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1">
                  <span className="xl:hidden text-[11px] font-bold uppercase tracking-wider text-text-muted">Subcategory</span>
                  <input
                    value={item.subcategory || defaultSubcategoryForItem(item)}
                    onChange={(event) => updateItem(item.id as string, 'subcategory', event.target.value)}
                    list={subcategoryListId}
                    className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
                  />
                  <datalist id={subcategoryListId}>
                    {EXCEL_BOM_SUBCATEGORIES.map((subcategory) => (
                      <option key={subcategory} value={subcategory} />
                    ))}
                  </datalist>
                </label>
                <label className="grid gap-1">
                  <span className="xl:hidden text-[11px] font-bold uppercase tracking-wider text-text-muted">Unit</span>
                  <input
                    value={item.unit}
                    onChange={(event) => updateItem(item.id as string, 'unit', event.target.value)}
                    className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
                  />
                </label>
                <label className="grid gap-1">
                  <span className="xl:hidden text-[11px] font-bold uppercase tracking-wider text-text-muted">Qty</span>
                  <input
                    type="number"
                    min="0"
                    value={item.quantity}
                    onChange={(event) => updateItem(item.id as string, 'quantity', Number(event.target.value))}
                    className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
                  />
                </label>
                <label className="grid gap-1">
                  <span className="xl:hidden text-[11px] font-bold uppercase tracking-wider text-text-muted">Rate</span>
                  <input
                    type="number"
                    min="0"
                    value={item.unitRate}
                    onChange={(event) => updateItem(item.id as string, 'unitRate', Number(event.target.value))}
                    className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
                  />
                </label>
                <label className="grid gap-1">
                  <span className="xl:hidden text-[11px] font-bold uppercase tracking-wider text-text-muted">GST %</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={gstRateToPercent(item.gstPct, 0.18)}
                    onChange={(event) => updateItem(item.id as string, 'gstPct', normalizeGstRate(event.target.value, 0.18))}
                    className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => removeItem(item.id as string)}
                  className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-500 hover:bg-red-500/20"
                >
                  Remove
                </button>
              </div>
            );
          })}
          {lineItems.length === 0 && (
            <div className="p-10 text-center">
              <p className="text-sm font-semibold text-text-primary">No BOM items in this set yet.</p>
              <p className="mt-1 text-sm text-text-muted">Add a saved BOM item or create a custom line.</p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
