'use client';

import { useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSettings } from '@/lib/hooks/useSettings';
import { SYSTEMS, type SolarSystem } from '@/lib/data/bom';
import { SystemORM } from '@/backend/orm/system';
import { calculateSystem, formatINR } from '@/lib/engine/calculator';
import { useCalculatorStore } from '@/lib/store/calculatorStore';
import {
  Cpu, Zap, ArrowRight, GitCompare, X, Search,
  Plus, Upload, CheckCircle2, AlertCircle, Loader2,
  Trash2, Edit3, Sun
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/Confirm';
import { PresetEditorDialog } from '@/components/presets/PresetEditorDialog';
import type { LineItem } from '@/lib/actions/presets';

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

function categoryFromBomDescription(description: string) {
  const value = description.toLowerCase();
  if (value.includes('panel') || value.includes('module')) return 'panel';
  if (value.includes('inverter') || value.includes('communication')) return 'inverter';
  if (value.includes('battery')) return 'battery';
  if (value.includes('structure') || value.includes('mount')) return 'structure';
  if (value.includes('dcdb') || value.includes('dc protection') || value.includes('isolator') || value.includes('lightning') || value.includes('l/a')) return 'dc_protection';
  if (value.includes('acdb') || value.includes('ac protection') || value.includes('meter box')) return 'ac_protection';
  if (value.includes('cable') || value.includes('mc4') || value.includes('copper') || value.includes('wiring pipe')) return 'cable';
  if (value.includes('earth') || value.includes('gi strip') || value.includes('chamber')) return 'earthing';
  if (value.includes('civil') || value.includes('foundation') || value.includes('concrete')) return 'civil';
  if (value.includes('logistic') || value.includes('transport') || value.includes('freight')) return 'logistics';
  if (value.includes('accessor') || value.includes('meter') || value.includes('wifi') || value.includes('monitor')) return 'accessory';
  return 'other';
}

function systemTypeFromCategory(category: SolarSystem['category']) {
  const mapped = category.replace(/-/g, '_');
  return mapped === 'custom' ? 'on_grid' : mapped;
}

function localPresetToEditorData(system: SolarSystem) {
  const store = useCalculatorStore.getState();

  return {
    id: system.id,
    name: system.name,
    system_type: systemTypeFromCategory(system.category),
    capacity_kw: system.capacityKW,
    state_id: system.stateId ?? null,
    lineItems: system.items.map((item, index): LineItem => {
      let brand = (item as any).brand || '';
      let model = (item as any).model || '';
      let catalogItemId = (item as any).catalogItemId || item.sourceItemId || null;
      let catalogType = (item as any).catalogType || 'custom';

      const sourceTable = item.sourceTable;
      const sourceItemId = item.sourceItemId;

      if (sourceTable && sourceItemId) {
        if (sourceTable === 'eq_panels') {
          const p = store.dbPanels?.find((x: any) => x.id === sourceItemId);
          if (p) {
            brand = p.brand || '';
            model = p.model || '';
            catalogType = 'equipment';
          }
        } else if (sourceTable === 'eq_inverters') {
          const inv = store.dbInverters?.find((x: any) => x.id === sourceItemId);
          if (inv) {
            brand = inv.brand || '';
            model = inv.model || '';
            catalogType = 'equipment';
          }
        } else if (sourceTable === 'eq_batteries') {
          const bat = store.dbBatteries?.find((x: any) => x.id === sourceItemId);
          if (bat) {
            brand = bat.brand || '';
            model = bat.model || '';
            catalogType = 'equipment';
          }
        } else if (sourceTable === 'eq_meters') {
          const met = store.dbMeters?.find((x: any) => x.id === sourceItemId);
          if (met) {
            brand = met.brand || '';
            model = met.model || '';
            catalogType = 'equipment';
          }
        } else if (sourceTable === 'eq_lightning_arresters') {
          const la = store.dbLAs?.find((x: any) => x.id === sourceItemId);
          if (la) {
            brand = la.brand || '';
            model = la.model || '';
            catalogType = 'equipment';
          }
        } else if (sourceTable === 'eq_mounting_structures') {
          const str = store.dbStructures?.find((x: any) => x.id === sourceItemId);
          if (str) {
            brand = str.material || '';
            model = str.roof_mount_type || '';
            catalogType = 'eq_structure';
          }
        } else if (sourceTable === 'bom_template_items') {
          const bom = store.dbStructureParts?.find((x: any) => x.id === sourceItemId);
          if (bom) {
            catalogType = 'bom_template';
          }
        }
      }

      // If we don't have brand/model, but we have sourceLabel, use it
      if (!brand && !model && item.sourceLabel && item.sourceLabel !== item.description) {
        brand = item.sourceLabel;
      }

      return {
        id: item.id || `${system.id}_${index}`,
        category: (item as any).category ?? categoryFromBomDescription(item.description),
        catalogItemId,
        catalogType,
        skuCode: (item as any).skuCode ?? '',
        description: item.description,
        brand,
        model,
        unit: item.unit ?? 'Nos',
        quantity: Number(item.qty || 0),
        unitRate: Number(item.ratePerUnit || 0),
        gstPct: item.gstPct,
        isIncluded: true,
        isSurveyDependent: false,
        sortOrder: index,
      };
    }),
  };
}

function editorLineItemToBomItem(item: LineItem) {
  return {
    description: item.description,
    unit: item.unit || 'Nos',
    qty: Number(item.quantity || 0),
    ratePerUnit: Number(item.unitRate || 0),
    gstPct: item.gstPct ?? 0.18,
    category: item.category,
    catalogItemId: item.catalogItemId,
    catalogType: item.catalogType,
    skuCode: item.skuCode,
    brand: item.brand,
    model: item.model,
  };
}

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

// ─── System Card ────────────────────────────────────────────────────────────────

interface SystemCardProps {
  system: SolarSystem;
  selected: boolean;
  compareMode: boolean;
  isCustom: boolean;
  onToggleCompare: () => void;
  onQuickCalc: () => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

function SystemCard({ system, selected, compareMode, isCustom, onToggleCompare, onQuickCalc, onEdit, onDelete }: SystemCardProps) {
  return (
    <div
      className={`group relative flex flex-col bg-surface rounded-xl border transition-all duration-300 overflow-hidden
        ${selected
          ? 'border-accent shadow-lg shadow-accent/10 ring-1 ring-accent/20'
          : isCustom
            ? 'border-accent/30 hover:border-accent/60 hover:shadow-lg hover:shadow-black/20'
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

      {/* Gold left accent for custom */}
      {isCustom && (
        <div className="absolute left-0 top-4 bottom-4 w-0.5 rounded-r-full bg-accent" />
      )}

      <div className="p-5 flex-1">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0 pr-8">
            <CategoryBadge category={system.category} />
            <h3 className="text-sm font-bold text-text-primary mt-2 truncate" title={system.name}>{system.name}</h3>
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
      </div>

      {/* Actions */}
      <div className="px-5 pb-4 flex items-center justify-between gap-2 mt-auto">
        <button
          onClick={onQuickCalc}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg
            bg-accent/10 text-accent text-xs font-semibold
            hover:bg-accent/20 transition-all group/btn"
        >
          <Zap size={14} />
          Quick Calculate
          <ArrowRight size={14} className="transition-transform group-hover/btn:translate-x-0.5" />
        </button>

        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {onEdit && (
            <button
              onClick={() => onEdit(system.id)}
              className="p-2 rounded-lg bg-surface hover:bg-surface-hover border border-border text-text-secondary hover:text-text-primary transition-all cursor-pointer"
              title="Edit preset"
            >
              <Edit3 size={14} />
            </button>
          )}
          <button
            onClick={() => onDelete?.(system.id)}
            className="p-2 rounded-lg bg-surface hover:bg-error/10 border border-border hover:border-error/30 text-text-secondary hover:text-error transition-all cursor-pointer"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Comparison Panel ───────────────────────────────────────────────────────────

function ComparisonPanel({ systemIds, onClose }: { systemIds: string[]; onClose: () => void }) {
  const dbLoaded = useCalculatorStore((s) => s.dbLoaded);
  const dbSystems = useCalculatorStore((s) => s.dbSystems);
  const dbStateData = useCalculatorStore((s) => s.dbStateData);
  const dbSlabs = useCalculatorStore((s) => s.dbSlabs);
  const dbStructureAccessoryRates = useCalculatorStore((s) => s.dbStructureAccessoryRates);
  const dbPanels = useCalculatorStore((s) => s.dbPanels);
  const dbInverters = useCalculatorStore((s) => s.dbInverters);
  const dbBatteries = useCalculatorStore((s) => s.dbBatteries);
  const dbMeters = useCalculatorStore((s) => s.dbMeters);
  const dbLAs = useCalculatorStore((s) => s.dbLAs);
  const dbStructures = useCalculatorStore((s) => s.dbStructures);
  const dbWeightLookups = useCalculatorStore((s) => s.dbWeightLookups);
  const dbOrientationMultipliers = useCalculatorStore((s) => s.dbOrientationMultipliers);
  const { settings } = useSettings();

  const results = useMemo(() => {
    return systemIds.map((id) => {
      const builtIn = dbLoaded && dbSystems.length > 0 ? dbSystems : SYSTEMS;
      const systems = [...(settings.customSystems ?? []), ...builtIn];
      const system = systems.find((s) => s.id === id)!;
      try {
        const calc = calculateSystem({
          systemId: id,
          systems,
          state: 'Gujarat',
          projectType: 'residential',
          stateData: dbLoaded ? dbStateData : undefined,
          slabs: dbLoaded ? dbSlabs : undefined,
          dbStructureAccessoryRates: dbLoaded ? dbStructureAccessoryRates : undefined,
          dbPanels: dbLoaded ? dbPanels : undefined,
          dbInverters: dbLoaded ? dbInverters : undefined,
          dbBatteries: dbLoaded ? dbBatteries : undefined,
          dbMeters: dbLoaded ? dbMeters : undefined,
          dbLAs: dbLoaded ? dbLAs : undefined,
          dbStructures: dbLoaded ? dbStructures : undefined,
          dbWeightLookups: dbLoaded ? dbWeightLookups : undefined,
          dbOrientationMultipliers: dbLoaded ? dbOrientationMultipliers : undefined,
        });
        return { system, calc, error: null };
      } catch (err) {
        return { system, calc: null, error: (err as Error).message };
      }
    });
  }, [systemIds, dbLoaded, dbSystems, dbStateData, dbSlabs, settings.customSystems, dbStructureAccessoryRates, dbPanels, dbInverters, dbBatteries, dbMeters, dbLAs, dbStructures, dbWeightLookups, dbOrientationMultipliers]);

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
  const dbLoaded = useCalculatorStore((s) => s.dbLoaded);
  const dbSystems = useCalculatorStore((s) => s.dbSystems);
  const { settings, setSettings, commitToDb, isSyncing } = useSettings();
  const confirm = useConfirm();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [compareMode, setCompareMode] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerSystemId, setComposerSystemId] = useState<string | null>(null);
  
  // Custom Preset State
  const [formOpen, setFormOpen] = useState(false);
  const [customSystemError, setCustomSystemError] = useState<string | null>(null);
  const [customSystemDraft, setCustomSystemDraft] = useState({
    name: '', capacityKW: '', panelWattage: '', panelQty: '', targetMarginPct: '20',
  });
  const [commitStatus, setCommitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [commitMsg, setCommitMsg] = useState('');

  const customSystems = settings.customSystems ?? [];
  const localComposerSystem = useMemo(
    () => customSystems.find((system) => system.id === composerSystemId),
    [customSystems, composerSystemId],
  );
  const localComposerData = useMemo(
    () => (localComposerSystem ? localPresetToEditorData(localComposerSystem) : undefined),
    [localComposerSystem],
  );

  const allSystems = useMemo(() => {
    const builtIn = dbLoaded && dbSystems.length > 0 ? dbSystems : SYSTEMS;
    return [...customSystems, ...builtIn];
  }, [customSystems, dbLoaded, dbSystems]);

  const categories = useMemo(() => {
    const cats = new Set(allSystems.map((s) => s.category));
    return ['all', ...Array.from(cats)];
  }, [allSystems]);

  const filtered = useMemo(() => {
    let result = allSystems;
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
  }, [allSystems, search, categoryFilter]);

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

  // Preset Management Methods
  const handleAddCustomSystem = () => {
    const name = customSystemDraft.name.trim();
    const capacityKW = parseFloat(customSystemDraft.capacityKW);
    const panelQty = parseInt(customSystemDraft.panelQty, 10);
    const panelWattage = parseInt(customSystemDraft.panelWattage, 10);
    const targetMarginPct = parseFloat(customSystemDraft.targetMarginPct);
    
    const template = dbSystems[0] || SYSTEMS[0] || {
      id: 'default_template', name: 'Default Template', category: 'on-grid',
      capacityKW: 5, panelWattage: 550, panelQty: 10, targetMarginPct: 0.2,
      items: [
        { description: 'Panel', qty: 10, ratePerUnit: 0, gstPct: 0.12 as any },
        { description: 'Inverter', qty: 1, ratePerUnit: 0, gstPct: 0.18 as any },
        { description: 'Structure', qty: 1, ratePerUnit: 0, gstPct: 0.18 as any },
        { description: 'BOS / Cable / ACDB / DCDB', qty: 1, ratePerUnit: 0, gstPct: 0.18 as any },
      ]
    };

    if (!name) return setCustomSystemError('System name is required.');
    if (!Number.isFinite(capacityKW) || capacityKW <= 0) return setCustomSystemError('Capacity must be > 0.');
    if (!Number.isFinite(panelQty) || panelQty <= 0) return setCustomSystemError('Panel quantity must be > 0.');
    if (!Number.isFinite(panelWattage) || panelWattage <= 0) return setCustomSystemError('Panel wattage must be > 0.');
    if (!Number.isFinite(targetMarginPct) || targetMarginPct < 0) return setCustomSystemError('Target margin must be ≥ 0.');

    const items = template.items.map((item) =>
      item.description.toUpperCase() === 'PANEL' ? { ...item, qty: panelQty } : { ...item }
    );

    const customSystem: SolarSystem = {
      id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name, category: 'custom', capacityKW, panelWattage, panelQty, targetMarginPct: targetMarginPct / 100, items,
    };

    setSettings({ customSystems: [...customSystems, customSystem] });
    setCustomSystemError(null);
    setCustomSystemDraft({ name: '', capacityKW: '', panelWattage: '', panelQty: '', targetMarginPct: '20' });
    setFormOpen(false);
    toast(`Preset "${name}" added locally. Press Commit to sync.`, 'success');
  };

  const fetchMasterData = useCalculatorStore((s) => s.fetchMasterData);

  const removeCustomSystem = async (id: string) => {
    const isCustom = id.startsWith('custom_');
    const confirmed = await confirm({
      title: isCustom ? 'Delete Local Preset?' : 'Delete Master DB Preset?',
      message: isCustom ? 'This removes it from local storage. Press Commit to sync deletion to DB.' : 'WARNING: This will permanently delete this master preset from the database for all users.',
      confirmLabel: 'Delete', cancelLabel: 'Keep', type: 'danger',
    });
    if (!confirmed) return;

    if (isCustom) {
      setSettings({ customSystems: customSystems.filter((s) => s.id !== id) });
      toast('Preset deleted locally. Commit to sync.', 'success');
    } else {
      try {
        await SystemORM.delete(id);
        toast('Master preset deleted from database.', 'success');
        fetchMasterData(); // Refresh store
      } catch (err) {
        toast('Failed to delete master preset', 'error');
        console.error(err);
      }
    }
  };

  const renamePreset = async (id: string, newName: string) => {
    const isCustom = id.startsWith('custom_');
    if (isCustom) {
      setSettings({ customSystems: customSystems.map((s) => s.id === id ? { ...s, name: newName } : s) });
    } else {
      try {
        await SystemORM.update(id, { name: newName });
        toast('Master preset renamed in database.', 'success');
        fetchMasterData(); // Refresh store
      } catch (err) {
        toast('Failed to rename master preset', 'error');
        console.error(err);
      }
    }
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
      toast(`Committed — custom presets synced to DB ✓`, 'success');
      setTimeout(() => setCommitStatus('idle'), 4000);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 animate-fade-in max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-3">
            <Cpu size={24} className="text-accent" />
            System Presets
          </h1>
          <p className="text-sm text-text-muted mt-1">{customSystems.length} custom · {allSystems.length - customSystems.length} built-in</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setFormOpen(!formOpen)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border bg-surface text-sm font-semibold text-text-secondary hover:text-text-primary hover:border-border-light transition-all cursor-pointer"
          >
            <Plus size={14} /> New Preset
          </button>
          
          <button
            onClick={handleCommit}
            disabled={isSyncing || customSystems.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-accent text-background text-sm font-semibold hover:bg-accent-hover transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSyncing ? <><Loader2 size={14} className="animate-spin" /> Committing...</>
              : commitStatus === 'success' ? <><CheckCircle2 size={14} /> Committed!</>
              : commitStatus === 'error' ? <><AlertCircle size={14} /> Failed</>
              : <><Upload size={14} /> Commit to DB</>}
          </button>

          <button
            onClick={() => { setCompareMode(!compareMode); setCompareIds([]); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all
              ${compareMode ? 'bg-accent text-background' : 'bg-surface border border-border text-text-secondary hover:text-text-primary hover:border-border-light'}`}
          >
            <GitCompare size={16} />
            {compareMode ? `Comparing (${compareIds.length}/3)` : 'Compare Mode'}
          </button>
        </div>
      </div>

      {commitStatus === 'error' && commitMsg && (
        <div className="px-4 py-3 rounded-lg bg-error/10 border border-error/30 text-xs text-error flex items-center gap-2">
          <AlertCircle size={13} /> {commitMsg}
        </div>
      )}

      {/* New Preset Form */}
      {formOpen && (
        <div className="rounded-2xl border border-accent/30 bg-surface p-6 animate-fade-in shadow-lg">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
              <Plus size={16} className="text-accent" />
              Create Custom System Preset
            </h2>
            <button onClick={() => { setFormOpen(false); setCustomSystemError(null); }}
              className="p-1.5 rounded bg-surface hover:bg-surface-hover text-text-muted hover:text-text-primary cursor-pointer transition-colors">
              <X size={16} />
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="col-span-2 space-y-1.5">
              <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Preset Name *</label>
              <input type="text" value={customSystemDraft.name} onChange={(e) => setCustomSystemDraft({ ...customSystemDraft, name: e.target.value })}
                className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-sm outline-none focus:border-accent/50" placeholder="e.g. 7.5 KWp Rooftop" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Capacity (kW) *</label>
              <input type="number" min={0} step={0.01} value={customSystemDraft.capacityKW} onChange={(e) => setCustomSystemDraft({ ...customSystemDraft, capacityKW: e.target.value })}
                className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-sm outline-none focus:border-accent/50 font-mono" placeholder="7.50" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Panel Wattage *</label>
              <input type="number" min={0} step={1} value={customSystemDraft.panelWattage} onChange={(e) => setCustomSystemDraft({ ...customSystemDraft, panelWattage: e.target.value })}
                className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-sm outline-none focus:border-accent/50 font-mono" placeholder="620" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Panel Qty *</label>
              <input type="number" min={1} step={1} value={customSystemDraft.panelQty} onChange={(e) => setCustomSystemDraft({ ...customSystemDraft, panelQty: e.target.value })}
                className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-sm outline-none focus:border-accent/50 font-mono" placeholder="12" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Target Margin %</label>
              <input type="number" min={0} step={0.5} value={customSystemDraft.targetMarginPct} onChange={(e) => setCustomSystemDraft({ ...customSystemDraft, targetMarginPct: e.target.value })}
                className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-sm outline-none focus:border-accent/50 font-mono" placeholder="20" />
            </div>
          </div>
          {customSystemError && (
            <p className="text-xs font-semibold text-error mt-4 flex items-center gap-1.5">
              <AlertCircle size={14} /> {customSystemError}
            </p>
          )}
          <div className="mt-5 flex items-center gap-3 pt-5 border-t border-border/40">
            <button onClick={handleAddCustomSystem} className="px-5 py-2.5 rounded-xl bg-accent text-background text-sm font-bold hover:bg-accent-hover transition-colors cursor-pointer">
              Save Custom Preset
            </button>
            <p className="text-xs text-text-muted">
              Stays local until you press <strong className="text-accent">Commit to DB</strong>
            </p>
          </div>
        </div>
      )}

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
              className={`px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all
                ${categoryFilter === cat
                  ? 'bg-accent text-background'
                  : 'bg-surface border border-border text-text-secondary hover:text-text-primary hover:border-border-light'
                }`}
            >
              {cat === 'all' ? 'All' : CATEGORY_CONFIG[cat]?.label ?? cat}
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
            isCustom={system.category === 'custom'}
            onToggleCompare={() => handleToggleCompare(system.id)}
            onQuickCalc={() => handleQuickCalc(system.id)}
            onEdit={(id) => {
              setComposerSystemId(id);
              setComposerOpen(true);
            }}
            onDelete={removeCustomSystem}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Sun size={48} className="text-text-muted/30 mb-4" />
          <p className="text-text-muted text-lg">No systems match your filter</p>
        </div>
      )}

      {composerOpen && (
        <PresetEditorDialog
          open={composerOpen}
          presetId={composerSystemId || ''}
          onClose={() => {
            setComposerOpen(false);
            setComposerSystemId(null);
          }}
          onSaved={(id, name) => {
            if (id.startsWith('custom_')) {
              toast(`Preset "${name}" updated locally. Press Commit to sync.`, 'success');
            } else {
              fetchMasterData();
              toast(`Preset "${name}" saved to database`, 'success');
            }
          }}
          initialData={localComposerData}
          onSaveLocal={localComposerSystem ? (updates) => {
            const editedItems = updates.lineItems
              .filter((item) => item.isIncluded)
              .map(editorLineItemToBomItem);
            const panelItem = updates.lineItems.find((item) => item.category === 'panel' && item.isIncluded);
            setSettings({
              customSystems: customSystems.map((system) => (
                system.id === localComposerSystem.id
                  ? {
                      ...system,
                      name: updates.name,
                      capacityKW: updates.capacityKw,
                      stateId: updates.stateId ?? null,
                      panelQty: panelItem ? Number(panelItem.quantity || system.panelQty) : system.panelQty,
                      items: editedItems,
                    }
                  : system
              )),
            });
          } : undefined}
        />
      )}
    </div>
  );
}
