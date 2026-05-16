'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { SYSTEMS, type SolarSystem } from '@/lib/data/bom';
import { calculateSystem, formatINR } from '@/lib/engine/calculator';
import { useCalculatorStore } from '@/lib/store/calculatorStore';
import {
  Cpu, Zap, ArrowRight, GitCompare, X, Search,
  ChevronDown, Sun, Battery,
} from 'lucide-react';

// ─── Category Badge ─────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  'on-grid': 'On-Grid',
  '3-phase': '3-Phase',
  'micro-inverter': 'Micro',
  hybrid: 'Hybrid',
  upgrade: 'Upgrade',
  commercial: 'Commercial',
};

function CategoryBadge({ category }: { category: string }) {
  return (
    <span className={`badge-${category} inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider`}>
      {CATEGORY_LABELS[category] ?? category}
    </span>
  );
}

// ─── System Card ────────────────────────────────────────────────────────────────

interface SystemCardProps {
  system: SolarSystem;
  selected: boolean;
  compareMode: boolean;
  onToggleCompare: () => void;
  onQuickCalc: () => void;
}

function SystemCard({ system, selected, compareMode, onToggleCompare, onQuickCalc }: SystemCardProps) {
  return (
    <div
      className={`group relative bg-surface rounded-xl border transition-all duration-300 overflow-hidden
        ${selected
          ? 'border-accent shadow-lg shadow-accent/10 ring-1 ring-accent/20'
          : 'border-border hover:border-border-light hover:shadow-lg hover:shadow-black/20'
        }`}
    >
      {/* Compare checkbox */}
      {compareMode && (
        <button
          onClick={onToggleCompare}
          className={`absolute top-3 right-3 z-10 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all
            ${selected
              ? 'bg-accent border-accent text-background'
              : 'border-border-light bg-surface hover:border-accent/50'
            }`}
        >
          {selected && <span className="text-xs font-bold">✓</span>}
        </button>
      )}

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0">
            <CategoryBadge category={system.category} />
            <h3 className="text-sm font-bold text-text-primary mt-2 truncate">{system.name}</h3>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="bg-background/60 rounded-lg p-2.5">
            <p className="text-[10px] uppercase tracking-wider text-text-muted">Capacity</p>
            <p className="text-sm font-bold text-text-primary mt-0.5">{system.capacityKW} kW</p>
          </div>
          <div className="bg-background/60 rounded-lg p-2.5">
            <p className="text-[10px] uppercase tracking-wider text-text-muted">Panels</p>
            <p className="text-sm font-bold text-text-primary mt-0.5">{system.panelQty} × {system.panelWattage}W</p>
          </div>
          <div className="bg-background/60 rounded-lg p-2.5">
            <p className="text-[10px] uppercase tracking-wider text-text-muted">Margin</p>
            <p className="text-sm font-bold text-text-primary mt-0.5">{(system.targetMarginPct * 100).toFixed(0)}%</p>
          </div>
          <div className="bg-background/60 rounded-lg p-2.5">
            <p className="text-[10px] uppercase tracking-wider text-text-muted">BOM Items</p>
            <p className="text-sm font-bold text-text-primary mt-0.5">{system.items.length}</p>
          </div>
        </div>

        {/* Quick Calculate */}
        <button
          onClick={onQuickCalc}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
            bg-accent/10 text-accent text-sm font-semibold
            hover:bg-accent/20 transition-all group/btn"
        >
          <Zap size={14} />
          Quick Calculate
          <ArrowRight size={14} className="transition-transform group-hover/btn:translate-x-0.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Comparison Panel ───────────────────────────────────────────────────────────

function ComparisonPanel({ systemIds, onClose }: { systemIds: string[]; onClose: () => void }) {
  const results = useMemo(() => {
    return systemIds.map((id) => {
      const system = SYSTEMS.find((s) => s.id === id)!;
      try {
        const calc = calculateSystem({
          systemId: id,
          state: 'Gujarat',
          projectType: 'residential',
        });
        return { system, calc, error: null };
      } catch (err) {
        return { system, calc: null, error: (err as Error).message };
      }
    });
  }, [systemIds]);

  return (
    <div className="bg-surface border border-border rounded-2xl p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
          <GitCompare size={20} className="text-accent" />
          System Comparison
        </h2>
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors">
          <X size={18} />
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-wider text-text-muted">Metric</th>
              {results.map((r) => (
                <th key={r.system.id} className="text-right px-3 py-2 text-xs font-semibold uppercase tracking-wider text-accent">
                  {r.system.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { label: 'Capacity (kW)', fn: (r: typeof results[0]) => `${r.system.capacityKW}` },
              { label: 'Panels', fn: (r: typeof results[0]) => `${r.system.panelQty} × ${r.system.panelWattage}W` },
              { label: 'Margin', fn: (r: typeof results[0]) => `${(r.system.targetMarginPct * 100).toFixed(0)}%` },
              { label: 'Cost (excl GST)', fn: (r: typeof results[0]) => r.calc ? formatINR(r.calc.costBeforeGST) : '—' },
              { label: 'MRP (incl GST)', fn: (r: typeof results[0]) => r.calc ? formatINR(r.calc.mrpInclGST) : '—' },
              { label: 'Final Price', fn: (r: typeof results[0]) => r.calc ? formatINR(r.calc.finalCustomerPrice) : '—' },
              { label: '₹/kW', fn: (r: typeof results[0]) => r.calc ? formatINR(r.calc.perKWinclGST) : '—' },
              { label: 'Subsidy', fn: (r: typeof results[0]) => r.calc ? formatINR(r.calc.subsidyAmount) : '—' },
              { label: 'Customer Pays', fn: (r: typeof results[0]) => r.calc ? formatINR(r.calc.beneficiaryContribution) : '—' },
              { label: 'Annual Gen (kWh)', fn: (r: typeof results[0]) => r.calc ? `${r.calc.annualGenerationKWh.toFixed(0)}` : '—' },
              { label: 'Payback (yrs)', fn: (r: typeof results[0]) => r.calc ? (r.calc.paybackYears === Infinity ? '—' : r.calc.paybackYears.toFixed(1)) : '—' },
            ].map((row) => (
              <tr key={row.label} className="border-b border-border/50 hover:bg-surface-hover/30">
                <td className="px-3 py-2.5 text-text-secondary">{row.label}</td>
                {results.map((r) => (
                  <td key={r.system.id} className="px-3 py-2.5 text-right font-mono text-text-primary">{row.fn(r)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────────

export default function SystemsPage() {
  const router = useRouter();
  const selectSystem = useCalculatorStore((s) => s.selectSystem);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [compareMode, setCompareMode] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);

  const categories = useMemo(() => {
    const cats = new Set(SYSTEMS.map((s) => s.category));
    return ['all', ...Array.from(cats)];
  }, []);

  const filtered = useMemo(() => {
    let result = SYSTEMS;
    if (categoryFilter !== 'all') {
      result = result.filter((s) => s.category === categoryFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((s) =>
        s.name.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q)
      );
    }
    return result;
  }, [search, categoryFilter]);

  const handleQuickCalc = (systemId: string) => {
    selectSystem(systemId);
    router.push('/calculator');
  };

  const handleToggleCompare = (systemId: string) => {
    setCompareIds((prev) => {
      if (prev.includes(systemId)) return prev.filter((id) => id !== systemId);
      if (prev.length >= 3) return prev; // max 3
      return [...prev, systemId];
    });
  };

  return (
    <div className="p-4 md:p-6 space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-3">
            <Cpu size={24} className="text-accent" />
            System Browser
          </h1>
          <p className="text-sm text-text-muted mt-1">{SYSTEMS.length} solar systems available</p>
        </div>
        <button
          onClick={() => { setCompareMode(!compareMode); setCompareIds([]); }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all
            ${compareMode
              ? 'bg-accent text-background'
              : 'bg-surface border border-border text-text-secondary hover:text-text-primary hover:border-border-light'
            }`}
        >
          <GitCompare size={16} />
          {compareMode ? `Comparing (${compareIds.length}/3)` : 'Compare Mode'}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Search systems..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-surface border border-border text-sm text-text-primary placeholder:text-text-muted focus:border-accent/50 focus:ring-1 focus:ring-accent/20 outline-none transition-all"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all
                ${categoryFilter === cat
                  ? 'bg-accent text-background'
                  : 'bg-surface border border-border text-text-secondary hover:text-text-primary hover:border-border-light'
                }`}
            >
              {cat === 'all' ? 'All' : CATEGORY_LABELS[cat] ?? cat}
            </button>
          ))}
        </div>
      </div>

      {/* Comparison Panel */}
      {compareMode && compareIds.length >= 2 && (
        <ComparisonPanel
          systemIds={compareIds}
          onClose={() => { setCompareMode(false); setCompareIds([]); }}
        />
      )}

      {/* Card Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map((system) => (
          <SystemCard
            key={system.id}
            system={system}
            selected={compareIds.includes(system.id)}
            compareMode={compareMode}
            onToggleCompare={() => handleToggleCompare(system.id)}
            onQuickCalc={() => handleQuickCalc(system.id)}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Sun size={48} className="text-text-muted/30 mb-4" />
          <p className="text-text-muted text-lg">No systems match your filter</p>
        </div>
      )}
    </div>
  );
}
