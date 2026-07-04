'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useSettings } from '@/lib/hooks/useSettings';
import { SYSTEMS, type SolarSystem } from '@/lib/data/bom';
import { calculateSystem, formatINR } from '@/lib/engine/calculator';
import { useCalculatorStore } from '@/lib/store/calculatorStore';
import {
  Cpu, Zap, ArrowRight, GitCompare, X, Search,
  Plus, Upload, CheckCircle2, AlertCircle, Loader2,
  Trash2, Edit3, Sun, MapPin, LayoutGrid, List, Copy
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/Confirm';
import { PresetEditorDialog } from '@/components/presets/PresetEditorDialog';
import { DuplicatePresetChoiceDialog, type DuplicatePresetChoice } from '@/components/presets/DuplicatePresetChoiceDialog';
import { deleteSystemPreset, duplicateSystemPreset, type LineItem } from '@/lib/actions/presets';

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
        specificationDetails: (item as any).specificationDetails ?? (item as any).specification_details ?? (item as any).notes ?? '',
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
    specificationDetails: item.specificationDetails,
  };
}

function buildUniquePresetName(baseName: string, existingNames: string[]) {
  const cleanBase = baseName.trim() || 'Preset';
  const names = new Set(existingNames.map((name) => name.toLowerCase()));
  let index = 1;
  let candidate = `${cleanBase} (${index})`;
  while (names.has(candidate.toLowerCase())) {
    index += 1;
    candidate = `${cleanBase} (${index})`;
  }
  return candidate;
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

// ─── System Card ────────────────────────────────────────────────────────────────

interface SystemCardProps {
  system: SolarSystem;
  selected: boolean;
  compareMode: boolean;
  isCustom: boolean;
  stateLabel: string;
  onToggleCompare: () => void;
  onQuickCalc: () => void;
  onEdit?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onDelete?: (id: string) => void;
}

function SystemCard({ system, selected, compareMode, isCustom, stateLabel, onToggleCompare, onQuickCalc, onEdit, onDuplicate, onDelete }: SystemCardProps) {
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
            <p className="mt-1 flex items-center gap-1 truncate text-[11px] font-semibold text-text-muted" title={stateLabel}>
              <MapPin size={11} />
              {stateLabel}
            </p>
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
          {onDuplicate && (
            <button
              onClick={() => onDuplicate(system.id)}
              className="p-2 rounded-lg bg-surface hover:bg-surface-hover border border-border text-text-secondary hover:text-accent transition-all cursor-pointer"
              title="Create duplicate"
            >
              <Copy size={14} />
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

interface SystemListProps {
  systems: SolarSystem[];
  compareMode: boolean;
  compareIds: string[];
  getStateLabel: (system: SolarSystem) => string;
  onToggleCompare: (id: string) => void;
  onQuickCalc: (id: string) => void;
  onEdit: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}

function SystemList({
  systems,
  compareMode,
  compareIds,
  getStateLabel,
  onToggleCompare,
  onQuickCalc,
  onEdit,
  onDuplicate,
  onDelete,
}: SystemListProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="overflow-hidden">
        <table className="w-full table-fixed text-sm">
          <colgroup>
            {compareMode && <col className="w-[3%]" />}
            <col className={compareMode ? 'w-[38%]' : 'w-[40%]'} />
            <col className="w-[13%]" />
            <col className="w-[8%]" />
            <col className="w-[7%]" />
            <col className="w-[8%]" />
            <col className="w-[5%]" />
            <col className={compareMode ? 'w-[18%]' : 'w-[19%]'} />
          </colgroup>
          <thead className="bg-background/70">
            <tr className="border-b border-border">
              {compareMode && (
                <th className="px-3 py-3 text-left">
                  <span className="sr-only">Compare</span>
                </th>
              )}
              <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-text-muted">Preset Name</th>
              <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-text-muted">State</th>
              <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-text-muted">Type</th>
              <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-text-muted">Capacity</th>
              <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-text-muted">Panels</th>
              <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-text-muted">Margin</th>
              <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-text-muted">Actions</th>
            </tr>
          </thead>
          <tbody>
            {systems.map((system) => {
              const selected = compareIds.includes(system.id);
              const isCustom = system.category === 'custom';
              const stateLabel = getStateLabel(system);

              return (
                <tr
                  key={system.id}
                  className={`border-b border-border/60 transition-colors last:border-b-0 hover:bg-surface-hover/40 ${
                    selected ? 'bg-accent/5' : isCustom ? 'bg-accent/[0.025]' : ''
                  }`}
                >
                  {compareMode && (
                    <td className="px-4 py-3 align-middle">
                      <button
                        onClick={() => onToggleCompare(system.id)}
                        className={`flex h-5 w-5 items-center justify-center rounded-md border-2 transition-all ${
                          selected
                            ? 'border-accent bg-accent text-background'
                            : 'border-border-light bg-surface hover:border-accent/50'
                        }`}
                        title={selected ? 'Remove from comparison' : 'Add to comparison'}
                      >
                        {selected && <span className="text-[10px] font-bold">✓</span>}
                      </button>
                    </td>
                  )}
                  <td className="px-4 py-3 align-middle">
                    <div className="flex items-start gap-3">
                      {isCustom && <div className="mt-1 h-10 w-0.5 shrink-0 rounded-full bg-accent" />}
                      <div className="min-w-0">
                        <p className="whitespace-normal break-words text-sm font-bold leading-5 text-text-primary">
                          {system.name}
                        </p>
                        <p className="mt-1 text-[11px] text-text-muted">{system.items.length} configured line items</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 align-middle">
                    <div className="flex items-start gap-1.5 text-xs font-semibold text-text-secondary">
                      <MapPin size={13} className="mt-0.5 shrink-0 text-accent" />
                      <span className="whitespace-normal break-words">{stateLabel}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 align-middle">
                    <CategoryBadge category={system.category} />
                  </td>
                  <td className="px-3 py-3 text-right align-middle font-mono text-text-primary">{system.capacityKW} kW</td>
                  <td className="px-3 py-3 text-right align-middle font-mono text-text-primary">
                    {system.panelQty} x {system.panelWattage}W
                  </td>
                  <td className="px-3 py-3 text-right align-middle font-mono text-text-primary">
                    {(system.targetMarginPct * 100).toFixed(0)}%
                  </td>
                  <td className="px-3 py-3 align-middle">
                    <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                      <button
                        onClick={() => onQuickCalc(system.id)}
                        className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-accent/10 px-3 py-2 text-xs font-semibold text-accent transition-all hover:bg-accent/20"
                      >
                        <Zap size={14} />
                        Quick Calculate
                      </button>
                      <button
                        onClick={() => onEdit(system.id)}
                        className="shrink-0 rounded-lg border border-border bg-surface p-2 text-text-secondary transition-all hover:bg-surface-hover hover:text-text-primary"
                        title="Edit preset"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        onClick={() => onDuplicate(system.id)}
                        className="shrink-0 rounded-lg border border-border bg-surface p-2 text-text-secondary transition-all hover:bg-surface-hover hover:text-accent"
                        title="Create duplicate"
                      >
                        <Copy size={14} />
                      </button>
                      <button
                        onClick={() => onDelete(system.id)}
                        className="shrink-0 rounded-lg border border-border bg-surface p-2 text-text-secondary transition-all hover:border-error/30 hover:bg-error/10 hover:text-error"
                        title="Delete preset"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
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
  const dbStateData = useCalculatorStore((s) => s.dbStateData);
  const dbSystemStateMap = useCalculatorStore((s) => s.dbSystemStateMap);
  const { settings, setSettings, commitToDb, isSyncing } = useSettings();
  const confirm = useConfirm();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [stateFilter, setStateFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [compareMode, setCompareMode] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerSystemId, setComposerSystemId] = useState<string | null>(null);
  const [duplicateTarget, setDuplicateTarget] = useState<SolarSystem | null>(null);
  const [duplicating, setDuplicating] = useState(false);
  
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

  const stateOptions = useMemo(() => {
    return Object.values(dbStateData)
      .map((state: any) => ({
        id: String(state?.id ?? ''),
        name: String(state?.name ?? ''),
      }))
      .filter((state) => state.id && state.name)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [dbStateData]);

  const stateNameById = useMemo(() => {
    return new Map(stateOptions.map((state) => [state.id, state.name]));
  }, [stateOptions]);

  const getSystemStateNames = (system: SolarSystem) => {
    const mappedStates = dbSystemStateMap[system.id] ?? [];
    if (mappedStates.length > 0) return mappedStates;
    if (system.stateName) return [system.stateName];
    if (system.stateId && stateNameById.has(system.stateId)) return [stateNameById.get(system.stateId) as string];
    return [];
  };

  const getSystemStateLabel = (system: SolarSystem) => {
    const states = getSystemStateNames(system);
    if (states.length === 0) return 'State not assigned';
    if (states.length === 1) return states[0];
    return `${states[0]} +${states.length - 1}`;
  };

  const filtered = useMemo(() => {
    let result = allSystems;
    if (stateFilter === 'global') {
      result = result.filter((system) => getSystemStateNames(system).length === 0);
    } else if (stateFilter !== 'all') {
      const selectedState = stateNameById.get(stateFilter);
      result = result.filter((system) => {
        const states = getSystemStateNames(system);
        return states.length === 0 || (selectedState ? states.includes(selectedState) : false);
      });
    }
    if (categoryFilter !== 'all') {
      result = result.filter((s) => s.category === categoryFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((s) =>
        s.name.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        getSystemStateLabel(s).toLowerCase().includes(q)
      );
    }
    return result;
  }, [allSystems, search, categoryFilter, stateFilter, dbSystemStateMap, stateNameById]);

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

  const fetchMasterData = useCalculatorStore((s) => s.fetchMasterData);

  const duplicateLocalSystem = (system: SolarSystem) => {
    const uniqueName = buildUniquePresetName(system.name, allSystems.map((item) => item.name));
    const duplicate: SolarSystem = {
      ...system,
      id: `custom_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      name: uniqueName,
      items: system.items.map((item, index) => ({
        ...item,
        id: `${Date.now()}_${index}_${Math.random().toString(36).slice(2)}`,
      })),
    };
    setSettings({ customSystems: [duplicate, ...customSystems] });
    return duplicate;
  };

  const handleDuplicateChoice = async (choice: DuplicatePresetChoice) => {
    if (!duplicateTarget) return;
    setDuplicating(true);
    try {
      if (duplicateTarget.id.startsWith('custom_')) {
        const duplicate = duplicateLocalSystem(duplicateTarget);
        toast(`Created duplicate "${duplicate.name}" locally. Press Commit to sync.`, 'success');
        setDuplicateTarget(null);
        if (choice === 'edit-now') {
          setComposerSystemId(duplicate.id);
          setComposerOpen(true);
        }
        return;
      }

      const duplicate = await duplicateSystemPreset(duplicateTarget.id);
      toast(`Created duplicate "${duplicate.name}"`, 'success');
      setDuplicateTarget(null);
      await fetchMasterData();
      if (choice === 'edit-now') {
        setComposerSystemId(duplicate.id);
        setComposerOpen(true);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown duplicate error.';
      toast(`Failed to duplicate preset: ${message}`, 'error');
      console.warn('[systems] failed to duplicate preset', { id: duplicateTarget.id, message });
    } finally {
      setDuplicating(false);
    }
  };

  const removeCustomSystem = async (id: string) => {
    const isCustom = id.startsWith('custom_');
    const confirmed = await confirm({
      title: isCustom ? 'Delete Local Preset?' : 'Delete Master DB Preset?',
      message: isCustom
        ? 'This removes it from local storage. Press Commit to sync deletion to DB.'
        : 'This will hide built-in presets for your organisation, or deactivate/delete organisation presets safely.',
      confirmLabel: 'Delete', cancelLabel: 'Keep', type: 'danger',
    });
    if (!confirmed) return;

    if (isCustom) {
      setSettings({ customSystems: customSystems.filter((s) => s.id !== id) });
      toast('Preset deleted locally. Commit to sync.', 'success');
    } else {
      try {
        await deleteSystemPreset(id);
        toast('Preset removed from your available presets.', 'success');
        await fetchMasterData();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown preset delete error.';
        toast(`Failed to remove preset: ${message}`, 'error');
        console.error('[systems] failed to remove preset', { id, message, error: err });
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
            onClick={() => {
              setComposerSystemId(null);
              setComposerOpen(true);
            }}
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

      {/* Filters */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
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
          <div className="inline-flex w-fit rounded-lg border border-border bg-surface p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs font-bold uppercase tracking-wider transition-all ${
                viewMode === 'grid'
                  ? 'bg-accent text-background'
                  : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
              }`}
              aria-pressed={viewMode === 'grid'}
            >
              <LayoutGrid size={14} />
              Grid
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs font-bold uppercase tracking-wider transition-all ${
                viewMode === 'list'
                  ? 'bg-accent text-background'
                  : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
              }`}
              aria-pressed={viewMode === 'list'}
            >
              <List size={14} />
              List
            </button>
          </div>
        </div>
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-text-secondary">
            <MapPin size={16} className="text-accent" />
            State-wise presets
            <span className="rounded-full bg-background px-2 py-0.5 text-[11px] text-text-muted">
              {filtered.length} shown
            </span>
          </div>
          <label className="relative w-full sm:w-[280px]">
            <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <select
              value={stateFilter}
              onChange={(event) => setStateFilter(event.target.value)}
              className="w-full appearance-none rounded-lg border border-border bg-background py-2.5 pl-9 pr-8 text-sm font-semibold text-text-primary outline-none transition-all focus:border-accent/50 focus:ring-1 focus:ring-accent/20"
            >
              <option value="all">All states</option>
              {stateOptions.map((state) => (
                <option key={state.id} value={state.id}>
                  {state.name}
                </option>
              ))}
            </select>
          </label>
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

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((system) => (
            <SystemCard
              key={system.id}
              system={system}
              selected={compareIds.includes(system.id)}
              compareMode={compareMode}
              isCustom={system.category === 'custom'}
              stateLabel={getSystemStateLabel(system)}
              onToggleCompare={() => handleToggleCompare(system.id)}
              onQuickCalc={() => handleQuickCalc(system.id)}
              onEdit={(id) => {
                setComposerSystemId(id);
                setComposerOpen(true);
              }}
              onDuplicate={(id) => {
                const system = allSystems.find((item) => item.id === id);
                if (system) setDuplicateTarget(system);
              }}
              onDelete={removeCustomSystem}
            />
          ))}
        </div>
      ) : (
        <SystemList
          systems={filtered}
          compareMode={compareMode}
          compareIds={compareIds}
          getStateLabel={getSystemStateLabel}
          onToggleCompare={handleToggleCompare}
          onQuickCalc={handleQuickCalc}
          onEdit={(id) => {
            setComposerSystemId(id);
            setComposerOpen(true);
          }}
          onDuplicate={(id) => {
            const system = allSystems.find((item) => item.id === id);
            if (system) setDuplicateTarget(system);
          }}
          onDelete={removeCustomSystem}
        />
      )}

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

      <DuplicatePresetChoiceDialog
        open={Boolean(duplicateTarget)}
        presetName={duplicateTarget?.name ?? ''}
        saving={duplicating}
        onChoose={handleDuplicateChoice}
        onClose={() => {
          if (!duplicating) setDuplicateTarget(null);
        }}
      />
    </div>
  );
}
