'use client';

import { useState, useMemo, useRef } from 'react';
import { useSettings } from '@/lib/hooks/useSettings';
import { useCalculatorStore } from '@/lib/store/calculatorStore';
import { SYSTEMS, type SolarSystem } from '@/lib/data/bom';
import {
  Bookmark, Trash2, Edit3, Plus, ArrowRight, Zap, Component,
  Search, X, Upload, CheckCircle2, AlertCircle, Loader2,
  Filter, Star, SlidersHorizontal,
} from 'lucide-react';
import Link from 'next/link';
import { useConfirm } from '@/components/ui/Confirm';
import { useToast } from '@/components/ui/Toast';

// ─── Category Config ──────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  custom:           { label: 'Custom',        color: '#C6973F', bg: 'rgba(198,151,63,0.12)' },
  'on-grid':        { label: 'On-Grid',       color: '#22c55e', bg: 'rgba(34,197,94,0.12)'  },
  '3-phase':        { label: '3-Phase',       color: '#6366f1', bg: 'rgba(99,102,241,0.12)' },
  'micro-inverter': { label: 'Micro-Inverter',color: '#0ea5e9', bg: 'rgba(14,165,233,0.12)' },
  hybrid:           { label: 'Hybrid',        color: '#a855f7', bg: 'rgba(168,85,247,0.12)' },
  upgrade:          { label: 'Upgrade',       color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
  commercial:       { label: 'Commercial',    color: '#14b8a6', bg: 'rgba(20,184,166,0.12)' },
};

const FILTER_TABS = [
  { key: 'all', label: 'All' },
  { key: 'custom', label: '⭐ Custom' },
  { key: 'on-grid', label: 'On-Grid' },
  { key: '3-phase', label: '3-Phase' },
  { key: 'micro-inverter', label: 'Micro' },
  { key: 'hybrid', label: 'Hybrid' },
  { key: 'upgrade', label: 'Upgrade' },
  { key: 'commercial', label: 'Commercial' },
];

function CategoryBadge({ category }: { category: string }) {
  const cfg = CATEGORY_CONFIG[category] ?? { label: category, color: '#888', bg: 'rgba(128,128,128,0.12)' };
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider shrink-0"
      style={{ color: cfg.color, background: cfg.bg }}
    >
      {cfg.label}
    </span>
  );
}

// ─── Inline Rename Input ──────────────────────────────────────────────────────

function InlineRename({ value, onSave, onCancel }: {
  value: string; onSave: (v: string) => void; onCancel: () => void
}) {
  const [v, setV] = useState(value);
  const ref = useRef<HTMLInputElement>(null);

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (v.trim()) onSave(v.trim()); }}
      className="flex items-center gap-1.5 flex-1 min-w-0"
    >
      <input
        ref={ref}
        autoFocus
        value={v}
        onChange={(e) => setV(e.target.value)}
        className="flex-1 min-w-0 px-2 py-1 rounded bg-background border border-accent/50 text-sm font-semibold
          text-text-primary outline-none focus:ring-1 focus:ring-accent/30"
      />
      <button type="submit" className="shrink-0 text-success hover:text-success/80 cursor-pointer">
        <CheckCircle2 size={15} />
      </button>
      <button type="button" onClick={onCancel} className="shrink-0 text-text-muted hover:text-error cursor-pointer">
        <X size={15} />
      </button>
    </form>
  );
}

// ─── Preset Card ──────────────────────────────────────────────────────────────

function PresetCard({
  sys, isCustom, onRename, onDelete, onLoad
}: {
  sys: SolarSystem;
  isCustom: boolean;
  onRename: (id: string, newName: string) => void;
  onDelete: (id: string) => void;
  onLoad: (id: string) => void;
}) {
  const [renaming, setRenaming] = useState(false);

  return (
    <div className={`group relative flex flex-col rounded-xl border transition-all duration-200
      hover:border-border-light hover:shadow-lg hover:shadow-black/20
      ${isCustom
        ? 'bg-background border-accent/20 hover:border-accent/40'
        : 'bg-background border-border'
      }`}
    >
      {/* Gold left accent for custom */}
      {isCustom && (
        <div className="absolute left-0 top-4 bottom-4 w-0.5 rounded-r-full bg-accent" />
      )}

      <div className="p-4 flex-1">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            {renaming ? (
              <InlineRename
                value={sys.name}
                onSave={(v) => { onRename(sys.id, v); setRenaming(false); }}
                onCancel={() => setRenaming(false)}
              />
            ) : (
              <h3
                className="text-sm font-bold text-text-primary truncate leading-tight cursor-default"
                title={sys.name}
              >
                {sys.name}
              </h3>
            )}
          </div>
          <CategoryBadge category={sys.category} />
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-2 flex-wrap mt-1.5">
          <span className="text-xs text-text-muted">
            <span className="font-semibold text-text-secondary">{sys.capacityKW} kW</span>
          </span>
          <span className="text-text-muted/40">·</span>
          <span className="text-xs text-text-muted">
            {sys.panelQty} × {sys.panelWattage}W
          </span>
          <span className="text-text-muted/40">·</span>
          <span className="text-xs text-text-muted">
            {(sys.targetMarginPct * 100).toFixed(0)}% margin
          </span>
        </div>

        {/* Equipment tags */}
        {sys.defaultEquipment && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {Object.entries(sys.defaultEquipment.panelMix ?? {}).map(([id, qty]) => (
              <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px]
                bg-surface-hover border border-border text-text-muted font-mono truncate max-w-[140px]">
                {qty}× Panel
              </span>
            ))}
            {Object.entries(sys.defaultEquipment.inverterMix ?? {}).map(([id, qty]) => (
              <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px]
                bg-surface-hover border border-border text-text-muted font-mono truncate max-w-[140px]">
                {qty}× Inverter
              </span>
            ))}
            {Object.entries(sys.defaultEquipment.batteryMix ?? {}).map(([id, qty]) => (
              <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px]
                bg-surface-hover border border-border text-text-muted font-mono truncate max-w-[140px]">
                {qty}× Battery
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-4 pb-3 pt-2 border-t border-border/50 flex items-center justify-between gap-2">
        <button
          onClick={() => onLoad(sys.id)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
            bg-accent/10 border border-accent/20 text-accent text-xs font-semibold
            hover:bg-accent/20 transition-all cursor-pointer"
        >
          <ArrowRight size={11} />
          Load
        </button>

        {isCustom && !renaming && (
          <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => setRenaming(true)}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-surface hover:bg-surface-hover
                border border-border text-xs text-text-secondary hover:text-text-primary transition-all cursor-pointer"
            >
              <Edit3 size={11} /> Rename
            </button>
            <button
              onClick={() => onDelete(sys.id)}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-surface hover:bg-error/10
                border border-border hover:border-error/30 text-xs text-text-secondary hover:text-error transition-all cursor-pointer"
            >
              <Trash2 size={11} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PresetsPage() {
  const { settings, setSettings, commitToDb, isSyncing } = useSettings();
  const selectSystem = useCalculatorStore((s) => s.selectSystem);
  const confirm = useConfirm();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [commitStatus, setCommitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [commitMsg, setCommitMsg] = useState('');

  const [customSystemError, setCustomSystemError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [customSystemDraft, setCustomSystemDraft] = useState({
    name: '',
    baseSystemId: SYSTEMS[0]?.id ?? '',
    capacityKW: '',
    panelWattage: '',
    panelQty: '',
    targetMarginPct: '20',
  });

  const customSystems = settings.customSystems ?? [];
  const dbSystems = useCalculatorStore((s) => s.dbSystems);

  // Merge all systems: custom first, then DB systems, then built-in
  const allSystems = useMemo(() => {
    const builtIn = dbSystems.length > 0 ? dbSystems : SYSTEMS;
    return [...customSystems, ...builtIn];
  }, [customSystems, dbSystems]);

  // Filter + search
  const visibleSystems = useMemo(() => {
    let list = allSystems;

    // Filter tab
    if (activeFilter !== 'all') {
      list = list.filter((s) => s.category === activeFilter);
    }

    // Search
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((s) =>
        s.name.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        String(s.capacityKW).includes(q) ||
        String(s.panelWattage).includes(q)
      );
    }

    // Always put custom first
    return [...list].sort((a, b) => {
      if (a.category === 'custom' && b.category !== 'custom') return -1;
      if (b.category === 'custom' && a.category !== 'custom') return 1;
      return 0;
    });
  }, [allSystems, activeFilter, search]);

  // Count badges for tabs
  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { all: allSystems.length };
    for (const sys of allSystems) {
      counts[sys.category] = (counts[sys.category] ?? 0) + 1;
    }
    return counts;
  }, [allSystems]);

  // ─── Handlers ───────────────────────────────────────────────────────────────

  const handleAddCustomSystem = () => {
    const name = customSystemDraft.name.trim();
    const capacityKW = parseFloat(customSystemDraft.capacityKW);
    const panelQty = parseInt(customSystemDraft.panelQty, 10);
    const panelWattage = parseInt(customSystemDraft.panelWattage, 10);
    const targetMarginPct = parseFloat(customSystemDraft.targetMarginPct);
    const template = SYSTEMS[0]; // minimal BOM base

    if (!name) return setCustomSystemError('System name is required.');
    if (!Number.isFinite(capacityKW) || capacityKW <= 0) return setCustomSystemError('Capacity must be > 0.');
    if (!Number.isFinite(panelQty) || panelQty <= 0) return setCustomSystemError('Panel quantity must be > 0.');
    if (!Number.isFinite(panelWattage) || panelWattage <= 0) return setCustomSystemError('Panel wattage must be > 0.');
    if (!Number.isFinite(targetMarginPct) || targetMarginPct < 0) return setCustomSystemError('Target margin must be ≥ 0.');

    const items = template.items.map((item) =>
      item.description.toUpperCase() === 'PANEL'
        ? { ...item, qty: panelQty }
        : { ...item },
    );

    const customSystem: SolarSystem = {
      id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name,
      category: 'custom',
      capacityKW,
      panelWattage,
      panelQty,
      targetMarginPct: targetMarginPct / 100,
      items,
    };

    setSettings({ customSystems: [...customSystems, customSystem] });
    setCustomSystemError(null);
    setCustomSystemDraft({ name: '', baseSystemId: SYSTEMS[0]?.id ?? '', capacityKW: '', panelWattage: '', panelQty: '', targetMarginPct: '20' });
    setFormOpen(false);
    toast(`Preset "${name}" added locally. Press Commit to sync to DB.`, 'success');
  };

  const removeCustomSystem = async (id: string) => {
    const sys = customSystems.find((s) => s.id === id);
    const confirmed = await confirm({
      title: 'Delete Preset?',
      message: `Delete "${sys?.name}"? This removes it from local storage. Press Commit to sync the deletion to DB.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Keep',
      type: 'danger',
    });
    if (!confirmed) return;
    setSettings({ customSystems: customSystems.filter((s) => s.id !== id) });
    toast('Preset deleted locally. Commit to sync to DB.', 'success');
  };

  const renamePreset = (id: string, newName: string) => {
    setSettings({
      customSystems: customSystems.map((s) => s.id === id ? { ...s, name: newName } : s)
    });
  };

  const loadPreset = (id: string) => {
    selectSystem(id);
    toast('Preset loaded into Calculator', 'success');
  };

  const handleCommit = async () => {
    setCommitStatus('idle');
    const err = await commitToDb();
    if (err) {
      setCommitStatus('error');
      setCommitMsg(err);
      toast(`Commit failed: ${err}`, 'error');
    } else {
      setCommitStatus('success');
      setCommitMsg(`${customSystems.length} preset(s) synced to DB`);
      toast(`Committed — ${customSystems.length} custom preset(s) pushed to DB ✓`, 'success');
      setTimeout(() => setCommitStatus('idle'), 4000);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-6 space-y-5 animate-fade-in max-w-6xl">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-text-primary flex items-center gap-2.5">
            <Bookmark size={20} className="text-accent" />
            Presets
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            {customSystems.length} custom · {allSystems.length - customSystems.length} built-in
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Add preset */}
          <button
            onClick={() => setFormOpen(!formOpen)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg
              border border-border bg-surface text-sm font-medium text-text-secondary
              hover:text-text-primary hover:border-border-light transition-all cursor-pointer"
          >
            <Plus size={14} />
            New Preset
          </button>

          {/* Commit to DB */}
          <button
            id="btn-commit-presets"
            onClick={handleCommit}
            disabled={isSyncing || customSystems.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg
              bg-accent text-background text-sm font-semibold
              hover:bg-accent-hover transition-all cursor-pointer
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSyncing
              ? <><Loader2 size={14} className="animate-spin" /> Committing...</>
              : commitStatus === 'success'
              ? <><CheckCircle2 size={14} /> Committed!</>
              : commitStatus === 'error'
              ? <><AlertCircle size={14} /> Failed</>
              : <><Upload size={14} /> Commit to DB</>
            }
          </button>
        </div>
      </div>

      {/* Commit error banner */}
      {commitStatus === 'error' && commitMsg && (
        <div className="px-4 py-3 rounded-lg bg-error/10 border border-error/30 text-xs text-error flex items-center gap-2">
          <AlertCircle size={13} />
          {commitMsg}
        </div>
      )}

      {/* New preset form (collapsible) */}
      {formOpen && (
        <div className="rounded-xl border border-accent/30 bg-surface p-5 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-text-primary flex items-center gap-2">
              <Plus size={14} className="text-accent" />
              New Custom Preset
            </h2>
            <button onClick={() => { setFormOpen(false); setCustomSystemError(null); }}
              className="text-text-muted hover:text-text-primary cursor-pointer">
              <X size={16} />
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="col-span-2 sm:col-span-3 space-y-1">
              <label className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Preset Name *</label>
              <input
                type="text"
                value={customSystemDraft.name}
                onChange={(e) => setCustomSystemDraft({ ...customSystemDraft, name: e.target.value })}
                className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-sm outline-none focus:border-accent/50"
                placeholder="e.g. 7.5 KWp Rooftop Residential"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Capacity (kW) *</label>
              <input
                type="number" min={0} step={0.01}
                value={customSystemDraft.capacityKW}
                onChange={(e) => setCustomSystemDraft({ ...customSystemDraft, capacityKW: e.target.value })}
                className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-sm outline-none focus:border-accent/50"
                placeholder="7.50"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Panel Wattage *</label>
              <input
                type="number" min={0} step={1}
                value={customSystemDraft.panelWattage}
                onChange={(e) => setCustomSystemDraft({ ...customSystemDraft, panelWattage: e.target.value })}
                className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-sm outline-none focus:border-accent/50"
                placeholder="620"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Panel Qty *</label>
              <input
                type="number" min={1} step={1}
                value={customSystemDraft.panelQty}
                onChange={(e) => setCustomSystemDraft({ ...customSystemDraft, panelQty: e.target.value })}
                className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-sm outline-none focus:border-accent/50"
                placeholder="12"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Target Margin %</label>
              <input
                type="number" min={0} step={0.5}
                value={customSystemDraft.targetMarginPct}
                onChange={(e) => setCustomSystemDraft({ ...customSystemDraft, targetMarginPct: e.target.value })}
                className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-sm outline-none focus:border-accent/50"
                placeholder="20"
              />
            </div>
          </div>
          {customSystemError && (
            <p className="text-xs text-error mt-3 flex items-center gap-1.5">
              <AlertCircle size={12} /> {customSystemError}
            </p>
          )}
          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={handleAddCustomSystem}
              className="px-5 py-2.5 rounded-lg bg-accent text-background text-sm font-bold
                hover:bg-accent-hover transition-colors cursor-pointer"
            >
              Add Preset
            </button>
            <p className="text-xs text-text-muted">
              Stays local until you press <strong className="text-accent">Commit to DB</strong>
            </p>
          </div>
        </div>
      )}

      {/* Search + Filter row */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
          <input
            id="presets-search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, capacity, wattage..."
            className="w-full pl-9 pr-9 py-2.5 rounded-lg bg-surface border border-border
              text-sm text-text-primary placeholder:text-text-muted
              focus:outline-none focus:border-accent/50 transition-all"
          />
          {search && (
            <button onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary cursor-pointer">
              <X size={13} />
            </button>
          )}
        </div>

        {/* Filter tabs — scrollable */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 shrink-0">
          {FILTER_TABS.filter(t => t.key === 'all' || (tabCounts[t.key] ?? 0) > 0).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                transition-all cursor-pointer whitespace-nowrap
                ${activeFilter === tab.key
                  ? 'bg-accent text-background'
                  : 'bg-surface border border-border text-text-secondary hover:text-text-primary hover:border-border-light'
                }`}
            >
              {tab.label}
              {tabCounts[tab.key] != null && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full
                  ${activeFilter === tab.key ? 'bg-background/20 text-background' : 'bg-surface-hover text-text-muted'}`}>
                  {tabCounts[tab.key]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      {visibleSystems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center
          border-2 border-dashed border-border/50 rounded-xl bg-surface/50">
          <Search size={32} className="text-text-muted/30 mb-3" />
          <p className="text-sm font-medium text-text-primary">No presets found</p>
          <p className="text-xs text-text-muted mt-1">
            {search ? `No results for "${search}" — try a different term` : 'Add your first custom preset above'}
          </p>
        </div>
      ) : (
        <>
          {/* Custom presets section header */}
          {(activeFilter === 'all' || activeFilter === 'custom') && customSystems.length > 0 && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Star size={13} className="text-accent" />
                <span className="text-xs font-bold uppercase tracking-widest text-accent">
                  Custom Presets
                </span>
                <span className="text-[10px] text-text-muted">(local · commit to sync)</span>
              </div>
              <div className="flex-1 h-px bg-accent/20" />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {visibleSystems.map((sys) => {
              const isCustom = customSystems.some((c) => c.id === sys.id);
              return (
                <PresetCard
                  key={sys.id}
                  sys={sys}
                  isCustom={isCustom}
                  onRename={renamePreset}
                  onDelete={removeCustomSystem}
                  onLoad={loadPreset}
                />
              );
            })}
          </div>

          {/* Built-in section divider when custom + built-in both visible */}
          {activeFilter === 'all' && customSystems.length > 0 && visibleSystems.some((s) => s.category !== 'custom') && (
            <div className="flex items-center gap-3 pt-2">
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={13} className="text-text-muted" />
                <span className="text-xs font-bold uppercase tracking-widest text-text-muted">
                  Built-in Systems
                </span>
              </div>
              <div className="flex-1 h-px bg-border" />
            </div>
          )}
        </>
      )}

      {/* Helper tip */}
      <div className="p-4 rounded-xl border border-dashed border-accent/20 bg-accent/5 flex items-start gap-3">
        <div className="p-1.5 rounded-lg bg-accent/10 shrink-0 mt-0.5">
          <Zap size={14} className="text-accent" />
        </div>
        <div>
          <p className="text-xs font-bold text-accent mb-0.5">Save from Calculator</p>
          <p className="text-xs text-text-muted">
            Build a full system with exact panels, inverters and batteries in the Calculator, then hit{' '}
            <strong className="text-text-secondary">Save Configuration as Preset</strong> to capture it as a custom preset.
          </p>
          <Link href="/calculator"
            className="inline-flex items-center gap-1 mt-2 text-xs font-semibold text-text-secondary hover:text-accent transition-colors">
            Open Calculator <ArrowRight size={11} />
          </Link>
        </div>
      </div>

    </div>
  );
}
