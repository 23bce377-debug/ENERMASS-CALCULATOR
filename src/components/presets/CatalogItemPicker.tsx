'use client';
import { useEffect, useState } from 'react';
import { getCatalogItems } from '@/lib/actions/presets';

interface CatalogItemPickerProps {
  category: string;
  onSelect: (item: any, category: string) => void;
  onClose: () => void;
}

export function CatalogItemPicker({ category, onSelect, onClose }: CatalogItemPickerProps) {
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [customDescription, setCustomDescription] = useState('');
  const [customSpecification, setCustomSpecification] = useState('');
  const [customUnit, setCustomUnit] = useState('Nos');
  const [customQty, setCustomQty] = useState('1');
  const [customRate, setCustomRate] = useState('');

  const categoryLabel = category.replace(/_/g, ' ');

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
        if (mounted) setItems(data);
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
  }, [category, search]);

  return (
    <div className="w-[min(92vw,28rem)] overflow-hidden rounded-xl border border-border bg-surface shadow-2xl">
      <div className="flex items-center justify-between border-b border-border bg-background/70 px-3 py-2">
        <p className="text-xs font-bold uppercase tracking-wider text-text-muted">
          Add {categoryLabel}
        </p>
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
          placeholder={`Search ${categoryLabel} by brand or model...`}
          className="w-full bg-background text-text-primary text-sm px-3 py-2.5 rounded-lg border border-border focus:border-accent outline-none placeholder:text-text-muted"
        />
      </div>
      <div className="max-h-80 overflow-y-auto p-1">
        {loading ? (
          <p className="text-xs text-text-muted text-center py-8">Loading catalog...</p>
        ) : error ? (
          <p className="text-xs text-red-500 text-center py-8">{error}</p>
        ) : items.map(item => (
          <button
            key={item.id}
            type="button"
            onClick={() => { onSelect(item, category); onClose(); }}
            className="w-full rounded-lg px-3 py-3 text-left transition-colors hover:bg-surface-hover focus:bg-surface-hover focus:outline-none"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-text-primary">{item.description}</p>
                <p className="mt-0.5 text-xs text-text-muted">
                  {[item.brand, item.model].filter(Boolean).join(' ') || item.unit || 'Catalog item'}
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
        {!loading && items.length === 0 && (
          <p className="text-xs text-text-muted text-center py-6">No active catalog items found.</p>
        )}
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
