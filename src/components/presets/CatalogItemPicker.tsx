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
  
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    getCatalogItems(category, search)
      .then(data => {
        if (mounted) setItems(data);
      })
      .catch((err) => {
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
          Add {category.replace(/_/g, ' ')}
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
          placeholder={`Search ${category.replace(/_/g, ' ')} by brand or model...`}
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
          <p className="text-xs text-text-muted text-center py-8">No active catalog items found.</p>
        )}
      </div>
    </div>
  );
}
