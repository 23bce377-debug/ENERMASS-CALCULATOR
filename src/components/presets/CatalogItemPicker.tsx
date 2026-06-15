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
  
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    getCatalogItems(category, search).then(data => {
      if (mounted) {
        setItems(data);
        setLoading(false);
      }
    });
    return () => { mounted = false; };
  }, [category, search]);

  return (
    <div className="absolute z-[200] mt-1 left-0 w-80 bg-[#111] border border-[#2a2a2a] rounded-lg shadow-xl">
      <div className="p-2 border-b border-[#1e1e1e]">
        <input
          autoFocus
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={`Search ${category}...`}
          className="w-full bg-[#0d0d0d] text-white text-sm px-3 py-2
                     rounded border border-[#2a2a2a] focus:border-[#f0a500]
                     outline-none placeholder:text-[#444]"
        />
      </div>
      <div className="max-h-56 overflow-y-auto">
        {loading ? (
          <p className="text-xs text-[#444] text-center py-6">Loading...</p>
        ) : items.map(item => (
          <button key={item.id}
            onClick={() => { onSelect(item, category); onClose(); }}
            className="w-full text-left px-3 py-2.5 hover:bg-[#1a1a1a]
                       transition-colors border-b border-[#1a1a1a] last:border-0 block">
            <p className="text-sm text-white">{item.description}</p>
            <div className="flex items-center justify-between mt-0.5">
              <p className="text-[10px] text-[#555]">
                {item.brand} {item.unit && ` per ${item.unit}`}
              </p>
              {item.defaultRate > 0 && (
                <p className="text-[10px] text-[#888]">
                  ₹{item.defaultRate?.toLocaleString('en-IN')}
                </p>
              )}
            </div>
          </button>
        ))}
        {!loading && items.length === 0 && (
          <p className="text-xs text-[#444] text-center py-6">No items found</p>
        )}
      </div>
    </div>
  );
}
