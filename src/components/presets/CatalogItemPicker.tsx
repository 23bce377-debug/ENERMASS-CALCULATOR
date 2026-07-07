'use client';
import { useEffect, useMemo, useState } from 'react';
import { getCatalogItems } from '@/lib/actions/presets';
import {
  FUNCTIONAL_CATEGORY_LABELS,
  PRESET_TOP_CATEGORIES,
  TOP_CATEGORY_LABELS,
  defaultSubcategoryForItem,
  normalizeFunctionalCategory,
  topCategoryFromFunctional,
  type PresetTopCategory,
} from '@/lib/presetTaxonomy';

interface CatalogItemPickerProps {
  category: string;
  onSelect: (item: any, category: string) => void;
  onClose: () => void;
  excludeCategories?: string[];
  initialSearch?: string;
  initialSubcategory?: string;
  searchPlaceholder?: string;
}

const TOP_CATEGORY_ORDER: PresetTopCategory[] = [...PRESET_TOP_CATEGORIES];

function displayLabel(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
}

function getItemTopCategory(item: any): PresetTopCategory {
  return (item.topCategory ?? topCategoryFromFunctional(item.category)) as PresetTopCategory;
}

function getItemFunctionalCategory(item: any) {
  return normalizeFunctionalCategory(item.category ?? item.type);
}

function getItemSubcategory(item: any) {
  return item.subcategory || item.categoryName || defaultSubcategoryForItem(item) || 'Uncategorized';
}

function itemMatchesSearch(item: any, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  const haystack = [
    item.description,
    item.brand,
    item.model,
    item.skuCode,
    item.sku_code,
    item.unit,
    item.defaultRate,
    item.subcategory,
    item.categoryName,
    item.category,
    item.topCategory,
    item.specificationDetails,
  ]
    .filter((part) => part !== null && part !== undefined)
    .join(' ')
    .toLowerCase();

  return normalized
    .split(/\s+/)
    .filter(Boolean)
    .every((token) => haystack.includes(token));
}

export function CatalogItemPicker({
  category,
  onSelect,
  onClose,
  excludeCategories = [],
  initialSearch = '',
  initialSubcategory = 'all',
  searchPlaceholder,
}: CatalogItemPickerProps) {
  const [search, setSearch] = useState(initialSearch);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTopCategory, setActiveTopCategory] = useState<string>('all');
  const [activeSubcategory, setActiveSubcategory] = useState(initialSubcategory || 'all');
  const [customDescription, setCustomDescription] = useState('');
  const [customSpecification, setCustomSpecification] = useState('');
  const [customUnit, setCustomUnit] = useState('Nos');
  const [customQty, setCustomQty] = useState('1');
  const [customRate, setCustomRate] = useState('');

  const normalizedPickerCategory = normalizeFunctionalCategory(category);
  const isAllPicker = category === 'all';
  const showCategoryPane = isAllPicker;
  const categoryLabel = FUNCTIONAL_CATEGORY_LABELS[category] || FUNCTIONAL_CATEGORY_LABELS[normalizedPickerCategory] || displayLabel(category);
  const excludedCategoriesKey = excludeCategories.join('|');

  useEffect(() => {
    setSearch(initialSearch);
  }, [initialSearch]);

  useEffect(() => {
    setActiveSubcategory(initialSubcategory || 'all');
  }, [initialSubcategory]);

  useEffect(() => {
    if (!isAllPicker) {
      setActiveTopCategory(topCategoryFromFunctional(category));
    } else {
      setActiveTopCategory('all');
    }
  }, [category, isAllPicker]);

  const excluded = useMemo(
    () => new Set(excludedCategoriesKey ? excludedCategoriesKey.split('|').map(normalizeFunctionalCategory) : []),
    [excludedCategoriesKey],
  );

  const availableTopCategories = useMemo(() => {
    const present = new Set<PresetTopCategory>();
    for (const item of items) {
      const functionalCategory = getItemFunctionalCategory(item);
      const topCategory = getItemTopCategory(item);
      if (!excluded.has(functionalCategory) && !excluded.has(topCategory)) {
        present.add(topCategory);
      }
    }
    return TOP_CATEGORY_ORDER.filter((topCategory) => present.has(topCategory));
  }, [excluded, items]);

  const selectedTopCategory = useMemo(() => {
    if (activeTopCategory !== 'all' && availableTopCategories.includes(activeTopCategory as PresetTopCategory)) {
      return activeTopCategory as PresetTopCategory;
    }
    if (!isAllPicker) return topCategoryFromFunctional(category);
    return 'all';
  }, [activeTopCategory, availableTopCategories, category, isAllPicker]);

  const topFilteredItems = useMemo(() => {
    return items.filter((item) => {
      const topCategory = getItemTopCategory(item);
      const functionalCategory = getItemFunctionalCategory(item);
      if (excluded.has(functionalCategory) || excluded.has(topCategory)) return false;
      if (selectedTopCategory !== 'all' && topCategory !== selectedTopCategory) return false;
      return itemMatchesSearch(item, search);
    });
  }, [excluded, items, search, selectedTopCategory]);

  const subcategories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of topFilteredItems) {
      const subcategory = getItemSubcategory(item);
      counts.set(subcategory, (counts.get(subcategory) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([name, count]) => ({ name, count }));
  }, [topFilteredItems]);

  const visibleItems = useMemo(() => {
    return topFilteredItems
      .filter((item) => {
        if (activeSubcategory !== 'all' && getItemSubcategory(item) !== activeSubcategory) return false;
        return true;
      })
      .sort((a, b) => String(a.description || '').localeCompare(String(b.description || '')));
  }, [activeSubcategory, topFilteredItems]);

  useEffect(() => {
    if (activeSubcategory === 'all') return;
    if (!subcategories.some((subcategory) => subcategory.name === activeSubcategory)) {
      setActiveSubcategory('all');
    }
  }, [activeSubcategory, subcategories]);

  const customTopCategory = selectedTopCategory === 'all'
    ? topCategoryFromFunctional(category)
    : selectedTopCategory;
  const customFunctionalCategory = customTopCategory === 'bom_item'
    ? normalizeFunctionalCategory(category) === 'miscellaneous' ? 'miscellaneous' : 'accessory'
    : customTopCategory;

  function addCustomItem() {
    const description = customDescription.trim() || search.trim();
    const quantity = Number(customQty);
    const rate = Number(customRate);

    if (!description) {
      setError('Enter an item name before adding it.');
      return;
    }

    onSelect({
      type: 'custom',
      catalogType: 'custom',
      category: customFunctionalCategory,
      topCategory: customTopCategory,
      subcategory: activeSubcategory !== 'all' ? activeSubcategory : defaultSubcategoryForItem({ topCategory: customTopCategory, category: customFunctionalCategory }),
      description,
      specificationDetails: customSpecification.trim(),
      brand: '',
      model: '',
      unit: customUnit.trim() || 'Nos',
      defaultQty: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
      defaultRate: Number.isFinite(rate) && rate >= 0 ? rate : 0,
      isSurveyDependent: false,
    }, category);
    onClose();
  }
  
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    getCatalogItems(category, search)
      .then((data: any[]) => {
        if (!mounted) return;
        setItems(data.filter((item) => {
          const functionalCategory = getItemFunctionalCategory(item);
          const topCategory = getItemTopCategory(item);
          return !excluded.has(functionalCategory) && !excluded.has(topCategory);
        }));
      })
      .catch((err: unknown) => {
        if (!mounted) return;
        setItems([]);
        setError(err instanceof Error ? err.message : 'Could not load catalog items.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, [category, search, excluded]);

  return (
    <div className={`${showCategoryPane ? 'w-[min(94vw,46rem)]' : 'w-[min(94vw,38rem)]'} overflow-hidden rounded-xl border border-border bg-surface shadow-2xl`}>
      <div className="flex items-center justify-between border-b border-border bg-background/70 px-3 py-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-text-muted">Add {categoryLabel}</p>
          <p className="mt-0.5 text-[11px] text-text-muted">
            {showCategoryPane ? 'Pick category, subcategory, then item.' : 'Pick subcategory, then item.'}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-2 py-1 text-xs font-semibold text-text-muted hover:bg-surface-hover hover:text-text-primary"
        >
          Close
        </button>
      </div>
      <div className="p-3 border-b border-border">
        <input
          autoFocus
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={searchPlaceholder || `Search ${categoryLabel} by name, SKU, category, specs...`}
          className="w-full bg-background text-text-primary text-sm px-3 py-2.5 rounded-lg border border-border focus:border-accent outline-none placeholder:text-text-muted"
        />
      </div>
      <div className={`${showCategoryPane ? 'grid md:grid-cols-[180px_minmax(0,1fr)]' : 'block'} min-h-0 border-b border-border`}>
        {showCategoryPane && (
          <aside className="border-b border-border bg-background/45 p-2 md:border-b-0 md:border-r">
            <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-text-muted">Category</p>
            <div className="flex gap-1 overflow-x-auto md:block md:space-y-1 md:overflow-visible">
              <button
                type="button"
                onClick={() => {
                  setActiveTopCategory('all');
                  setActiveSubcategory('all');
                }}
                className={`shrink-0 rounded-lg px-3 py-2 text-left text-xs font-bold md:w-full ${
                  selectedTopCategory === 'all'
                    ? 'bg-accent text-background'
                    : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                }`}
              >
                All categories
              </button>
              {availableTopCategories.map((topCategory) => (
                <button
                  key={topCategory}
                  type="button"
                  onClick={() => {
                    setActiveTopCategory(topCategory);
                    setActiveSubcategory('all');
                  }}
                  className={`shrink-0 rounded-lg px-3 py-2 text-left text-xs font-bold md:w-full ${
                    selectedTopCategory === topCategory
                      ? 'bg-accent text-background'
                      : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                  }`}
                >
                  {TOP_CATEGORY_LABELS[topCategory]}
                </button>
              ))}
            </div>
          </aside>
        )}

        <section className="min-w-0">
          <div className="border-b border-border bg-background/30 p-2">
            <p className="px-1 py-1 text-[10px] font-bold uppercase tracking-wider text-text-muted">
              {showCategoryPane ? 'Subcategory' : 'Browse subcategories'}
            </p>
            <div className="flex gap-1 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setActiveSubcategory('all')}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-bold ${
                  activeSubcategory === 'all'
                    ? 'border-accent bg-accent/15 text-accent'
                    : 'border-border bg-surface text-text-secondary hover:border-accent/40 hover:text-accent'
                }`}
              >
                All ({topFilteredItems.length})
              </button>
              {subcategories.map((subcategory) => (
                <button
                  key={subcategory.name}
                  type="button"
                  onClick={() => setActiveSubcategory(subcategory.name)}
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-bold ${
                    activeSubcategory === subcategory.name
                      ? 'border-accent bg-accent/15 text-accent'
                      : 'border-border bg-surface text-text-secondary hover:border-accent/40 hover:text-accent'
                  }`}
                >
                  {subcategory.name} ({subcategory.count})
                </button>
              ))}
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto p-1">
            {loading ? (
              <p className="text-xs text-text-muted text-center py-8">Loading catalog...</p>
            ) : error ? (
              <p className="text-xs text-red-500 text-center py-8">{error}</p>
            ) : visibleItems.map(item => (
              <button
                key={`${item.catalogType ?? item.type}:${item.id}`}
                type="button"
                onClick={() => { onSelect(item, getItemFunctionalCategory(item)); onClose(); }}
                className="w-full rounded-lg px-3 py-3 text-left transition-colors hover:bg-surface-hover focus:bg-surface-hover focus:outline-none"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-text-primary">{item.description}</p>
                    <p className="mt-0.5 text-xs text-text-muted">
                      {[item.brand, item.model].filter(Boolean).join(' ') || item.unit || 'Catalog item'}
                    </p>
                    <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-accent">
                      {showCategoryPane
                        ? `${TOP_CATEGORY_LABELS[getItemTopCategory(item)] || displayLabel(getItemTopCategory(item))} / ${getItemSubcategory(item)}`
                        : getItemSubcategory(item)}
                    </p>
                  </div>
                  {item.defaultRate > 0 && (
                    <p className="shrink-0 rounded-md bg-background px-2 py-1 text-xs font-semibold text-text-secondary">
                      INR {item.defaultRate?.toLocaleString('en-IN')}
                    </p>
                  )}
                </div>
              </button>
            ))}
            {!loading && visibleItems.length === 0 && (
              <p className="text-xs text-text-muted text-center py-6">No active catalog items found for this category.</p>
            )}
          </div>
        </section>
      </div>
      <div className="border-t border-border bg-background/60 p-3">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-text-muted">Add custom item</p>
        <div className="grid gap-2">
          <input
            value={customDescription}
            onChange={(event) => setCustomDescription(event.target.value)}
            placeholder={search.trim() || `${categoryLabel} item name`}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
          />
          <textarea
            value={customSpecification}
            onChange={(event) => setCustomSpecification(event.target.value)}
            rows={2}
            placeholder="Specification details for quote PDF"
            className="w-full resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
          />
          <div className="grid grid-cols-[1fr_82px_96px] gap-2">
            <input
              value={customUnit}
              onChange={(event) => setCustomUnit(event.target.value)}
              placeholder="Unit"
              className="min-w-0 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
            />
            <input
              type="number"
              min="0"
              value={customQty}
              onChange={(event) => setCustomQty(event.target.value)}
              placeholder="Qty"
              className="min-w-0 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
            />
            <input
              type="number"
              min="0"
              value={customRate}
              onChange={(event) => setCustomRate(event.target.value)}
              placeholder="Rate"
              className="min-w-0 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
            />
          </div>
          <button
            type="button"
            onClick={addCustomItem}
            className="rounded-lg bg-accent px-3 py-2 text-xs font-bold text-background hover:bg-accent-hover"
          >
            Add Custom {categoryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
