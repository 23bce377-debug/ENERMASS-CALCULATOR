'use client';

import { useState, useMemo } from 'react';
import { useCalculatorStore } from '@/lib/store/calculatorStore';
import { SYSTEMS } from '@/lib/data/bom';
import { formatINR } from '@/lib/engine/calculator';
import { BarChart3, RotateCcw, Search, ToggleLeft, ToggleRight } from 'lucide-react';

// ─── Collect Unique BOM Descriptions ────────────────────────────────────────────

interface BomDescEntry {
  description: string;
  defaultRate: number; // average across all systems
  systems: number;     // how many systems use this item
}

function getUniqueBomDescriptions(): BomDescEntry[] {
  const map = new Map<string, { totalRate: number; count: number }>();

  for (const sys of SYSTEMS) {
    for (const item of sys.items) {
      const existing = map.get(item.description);
      if (existing) {
        existing.totalRate += item.ratePerUnit;
        existing.count += 1;
      } else {
        map.set(item.description, { totalRate: item.ratePerUnit, count: 1 });
      }
    }
  }

  return Array.from(map.entries()).map(([description, { totalRate, count }]) => ({
    description,
    defaultRate: totalRate / count,
    systems: count,
  }));
}

// ─── Main Page ──────────────────────────────────────────────────────────────────

export default function RateMasterPage() {
  const rateMaster = useCalculatorStore((s) => s.rateMaster);
  const setRateMaster = useCalculatorStore((s) => s.setRateMaster);

  const [search, setSearch] = useState('');

  const allDescriptions = useMemo(() => getUniqueBomDescriptions(), []);

  const activeCount = useMemo(
    () => Object.values(rateMaster).filter((v) => v.active).length,
    [rateMaster],
  );

  const filtered = useMemo(() => {
    if (!search) return allDescriptions;
    const q = search.toLowerCase();
    return allDescriptions.filter((d) => d.description.toLowerCase().includes(q));
  }, [allDescriptions, search]);

  const handleResetAll = () => {
    if (!confirm('Reset all rate master overrides?')) return;
    useCalculatorStore.setState({ rateMaster: {} });
  };

  const handleToggle = (desc: string) => {
    const current = rateMaster[desc];
    const defaultEntry = allDescriptions.find((d) => d.description === desc);
    if (current) {
      setRateMaster(desc, current.rate, !current.active);
    } else {
      setRateMaster(desc, defaultEntry?.defaultRate ?? 0, true);
    }
  };

  const handleRateChange = (desc: string, value: string) => {
    const num = parseFloat(value);
    if (isNaN(num)) return;
    const current = rateMaster[desc];
    setRateMaster(desc, num, current?.active ?? false);
  };

  return (
    <div className="p-4 md:p-6 space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-3">
            <BarChart3 size={24} className="text-accent" />
            Rate Master
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Global rate overrides applied across all systems
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Active counter */}
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-glow border border-accent/20">
            <span className="text-lg font-bold text-accent">{activeCount}</span>
            <span className="text-xs text-text-muted">active / {allDescriptions.length} total</span>
          </div>
          <button
            onClick={handleResetAll}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-surface border border-border text-sm text-text-secondary hover:text-error hover:border-error/30 transition-all"
          >
            <RotateCcw size={14} /> Reset All
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          type="text"
          placeholder="Search descriptions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-surface border border-border text-sm text-text-primary placeholder:text-text-muted focus:border-accent/50 focus:ring-1 focus:ring-accent/20 outline-none transition-all"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-hover/50 border-b border-border">
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted">Description</th>
              <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted hidden sm:table-cell">Systems</th>
              <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted">Default Rate</th>
              <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted w-[220px] min-w-[220px]">
                Master Rate
              </th>
              <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted">Active</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((entry) => {
              const master = rateMaster[entry.description];
              const isActive = master?.active ?? false;
              const masterRate = master?.rate ?? entry.defaultRate;

              return (
                <tr
                  key={entry.description}
                  className={`border-b border-border/50 transition-colors ${isActive ? 'bg-accent-glow/30' : 'hover:bg-surface-hover/30'}`}
                >
                  <td className="px-4 py-3">
                    <span className={`font-medium ${isActive ? 'text-accent' : 'text-text-primary'}`}>
                      {entry.description}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-text-muted hidden sm:table-cell">
                    {entry.systems}
                  </td>
                  <td className="px-4 py-3 text-right text-text-secondary font-mono">
                    {formatINR(entry.defaultRate)}
                  </td>
                  <td className="px-4 py-3 text-right w-[220px] min-w-[220px]">
                    <input
                      type="number"
                      value={masterRate}
                      onChange={(e) => handleRateChange(entry.description, e.target.value)}
                      min={0}
                      step={10}
                      className={`w-full min-w-[180px] md:min-w-[210px] text-right px-3 py-1.5 rounded-lg bg-background border text-sm font-mono outline-none transition-all
                        ${isActive
                          ? 'border-accent/40 text-accent focus:border-accent focus:ring-1 focus:ring-accent/20'
                          : 'border-border text-text-secondary focus:border-border-light'
                        }`}
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleToggle(entry.description)}
                      className="transition-all hover:scale-110"
                      aria-label={isActive ? 'Deactivate' : 'Activate'}
                    >
                      {isActive ? (
                        <ToggleRight size={28} className="text-accent" />
                      ) : (
                        <ToggleLeft size={28} className="text-text-muted" />
                      )}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
