'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { Check, X, Sun, Cpu, Battery, Plus, Minus, ChevronDown, Edit3, RotateCcw, SlidersHorizontal, Layers, Package2, Wrench, Bolt, Droplets, Construction, Milestone, ChevronUp } from 'lucide-react';
import { Select } from '@/components/ui/Select';
import type { PanelBrand, InverterBrand, BatteryBrand } from '@/lib/data/masters';
import { useSettings } from '@/lib/hooks/useSettings';
import { useCalculatorStore } from '@/lib/store/calculatorStore';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface EquipmentSelectorProps {
  selectedPanelId: string | null;
  panelMix: Record<string, number>;
  requiredPanelQty: number | null;
  requiredPanelWattage: number | null;
  selectedInverterMix: Record<string, number>;
  selectedBatteryMix: Record<string, number>;
  onSelectPanel: (id: string | null) => void;
  onSetPanelMixQty: (panelId: string, qty: number) => void;
  onClearPanelMix: () => void;
  onSetInverterMixQty: (id: string, qty: number) => void;
  onClearInverterMix: () => void;
  onSetBatteryMixQty: (id: string, qty: number) => void;
  onClearBatteryMix: () => void;
}

type TabKey = 'panel' | 'inverter' | 'battery' | 'structure';

interface StructureComponent {
  id: string;
  structure_id: string;
  category: 'steel_section' | 'hardware' | 'finishing' | 'civil' | 'fabrication' | 'addon';
  name: string;
  unit: string;
  rate_appolo: number;
  rate_tata: number;
  rate_deemac: number;
  selling_price: number;
  gst_pct: number;
}

interface StructureAddon {
  id: string;
  name: string;
  material: string;
  unit: string;
  rate_per_unit: number;
  gst_pct: number;
  notes: string | null;
}

const STRUCT_CATEGORY_META: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  steel_section: { label: 'Steel Sections',    color: '#6366f1', bg: 'rgba(99,102,241,0.08)',  icon: <Layers size={9} /> },
  hardware:      { label: 'Hardware',           color: '#0ea5e9', bg: 'rgba(14,165,233,0.08)',  icon: <Bolt size={9} /> },
  finishing:     { label: 'Finishing',           color: '#a855f7', bg: 'rgba(168,85,247,0.08)',  icon: <Droplets size={9} /> },
  civil:         { label: 'Civil / Foundation', color: '#f97316', bg: 'rgba(249,115,22,0.08)',  icon: <Construction size={9} /> },
  fabrication:   { label: 'Fabrication',         color: '#C6973F', bg: 'rgba(198,151,63,0.08)',  icon: <Wrench size={9} /> },
  addon:         { label: 'Add-ons',             color: '#22c55e', bg: 'rgba(34,197,94,0.08)',   icon: <Milestone size={9} /> },
};

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'panel', label: 'Panels', icon: <Sun size={15} /> },
  { key: 'inverter', label: 'Inverters', icon: <Cpu size={15} /> },
  { key: 'battery', label: 'Batteries', icon: <Battery size={15} /> },
  { key: 'structure', label: 'Structure', icon: <Layers size={15} /> },
];

// ─── Formatters ─────────────────────────────────────────────────────────────────

function formatRate(val: number): string {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 }).format(val);
}

function buildOptimalMix<T extends { id: string; capacity: number; rate: number }>(
  items: T[],
  targetCapacity: number,
): Record<string, number> {
  if (!Number.isFinite(targetCapacity) || targetCapacity <= 0 || items.length === 0) {
    return {};
  }

  const normalizedItems = items
    .map((item) => ({
      ...item,
      units: Math.max(1, Math.round(item.capacity / 100)),
    }))
    .filter((item) => item.units > 0);

  if (normalizedItems.length === 0) {
    return {};
  }

  const targetUnits = Math.ceil(targetCapacity / 100);
  const maxUnits = targetUnits + Math.max(...normalizedItems.map((item) => item.units)) - 1;
  const dp = Array<number>(maxUnits + 1).fill(Number.POSITIVE_INFINITY);
  const prev: Array<{ from: number; itemIndex: number } | null> = Array(maxUnits + 1).fill(null);
  dp[0] = 0;

  for (let index = 0; index < normalizedItems.length; index += 1) {
    const item = normalizedItems[index];
    for (let units = item.units; units <= maxUnits; units += 1) {
      const candidate = dp[units - item.units] + item.rate;
      if (candidate < dp[units]) {
        dp[units] = candidate;
        prev[units] = { from: units - item.units, itemIndex: index };
      }
    }
  }

  let bestUnits = -1;
  let bestCost = Number.POSITIVE_INFINITY;
  for (let units = targetUnits; units <= maxUnits; units += 1) {
    if (dp[units] < bestCost) {
      bestCost = dp[units];
      bestUnits = units;
    }
  }

  if (bestUnits < 0 || !Number.isFinite(bestCost)) {
    return {};
  }

  const mix: Record<string, number> = {};
  let cursor = bestUnits;
  while (cursor > 0) {
    const step = prev[cursor];
    if (!step) break;
    const item = normalizedItems[step.itemIndex];
    mix[item.id] = (mix[item.id] ?? 0) + 1;
    cursor = step.from;
  }

  return mix;
}

// ─── Component ──────────────────────────────────────────────────────────────────

export function EquipmentSelector({
  selectedPanelId,
  panelMix,
  requiredPanelQty,
  requiredPanelWattage,
  selectedInverterMix,
  selectedBatteryMix,
  onSelectPanel,
  onSetPanelMixQty,
  onClearPanelMix,
  onSetInverterMixQty,
  onClearInverterMix,
  onSetBatteryMixQty,
  onClearBatteryMix,
}: EquipmentSelectorProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('panel');
  const [panelRange, setPanelRange] = useState({ min: '', max: '' });
  const [inverterRange, setInverterRange] = useState({ min: '', max: '' });
  const [batteryRange, setBatteryRange] = useState({ min: '', max: '' });

  // Selection counts for tab badges
  const selectedPanelQty = useMemo(
    () => Object.values(panelMix).reduce((sum, qty) => sum + (Number.isFinite(qty) ? qty : 0), 0),
    [panelMix],
  );

  const selectedStructureId = useCalculatorStore((s) => s.selectedStructureId);
  const solarMeterId = useCalculatorStore((s) => s.solarMeterId);
  const netMeterId = useCalculatorStore((s) => s.netMeterId);
  const lightningArresterId = useCalculatorStore((s) => s.lightningArresterId);
  const structureAddonMix = useCalculatorStore((s) => s.structureAddonMix);

  const selectionCounts = useMemo(() => ({
    panel: selectedPanelQty > 0 ? selectedPanelQty : (selectedPanelId ? 1 : 0),
    inverter: Object.values(selectedInverterMix).reduce((sum, qty) => sum + (Number.isFinite(qty) ? qty : 0), 0),
    battery: Object.values(selectedBatteryMix).reduce((sum, qty) => sum + (Number.isFinite(qty) ? qty : 0), 0),
    structure: (selectedStructureId ? 1 : 0) + Object.values(structureAddonMix).filter(q => q > 0).length,
  }), [selectedPanelQty, selectedPanelId, selectedInverterMix, selectedBatteryMix, selectedStructureId, structureAddonMix]);

  const { settings, setSettings } = useSettings();
  const dbPanels = useCalculatorStore((s) => s.dbPanels);
  const dbInverters = useCalculatorStore((s) => s.dbInverters);
  const dbBatteries = useCalculatorStore((s) => s.dbBatteries);
  const dbLoaded = useCalculatorStore((s) => s.dbLoaded);

  const allPanels = useMemo(() => {
    const base = dbLoaded && dbPanels.length > 0 ? dbPanels : [];
    const rateOverrides = settings?.currentEquipmentRates?.panels ?? {};
    return [...base, ...(settings?.customPanels ?? [])].map((panel) => ({
      ...panel,
      ratePerWatt: rateOverrides[panel.id] ?? panel.ratePerWatt,
    }));
  }, [dbLoaded, dbPanels, settings]);

  const allInverters = useMemo(() => {
    const base = dbLoaded && dbInverters.length > 0 ? dbInverters : [];
    const rateOverrides = settings?.currentEquipmentRates?.inverters ?? {};
    return [...base, ...(settings?.customInverters ?? [])].map((inverter) => ({
      ...inverter,
      rate: rateOverrides[inverter.id] ?? inverter.rate,
    }));
  }, [dbLoaded, dbInverters, settings]);

  const allBatteries = useMemo(() => {
    const base = dbLoaded && dbBatteries.length > 0 ? dbBatteries : [];
    const rateOverrides = settings?.currentEquipmentRates?.batteries ?? {};
    return [...base, ...(settings?.customBatteries ?? [])].map((battery) => ({
      ...battery,
      rate: rateOverrides[battery.id] ?? battery.rate,
    }));
  }, [dbLoaded, dbBatteries, settings]);

  const selectedSolarWattage = useMemo(() => {
    const panelById = new Map(allPanels.map((panel) => [panel.id, panel]));
    return Object.entries(panelMix).reduce((sum, [panelId, qty]) => {
      const panel = panelById.get(panelId);
      if (!panel || !Number.isFinite(qty) || qty <= 0) return sum;
      return sum + panel.wattage * qty;
    }, 0);
  }, [allPanels, panelMix]);

  const showInventoryInfo = useCalculatorStore((s) => s.showInventoryInfo);
  const setShowInventoryInfo = useCalculatorStore((s) => s.setShowInventoryInfo);

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden" id="equipment-selector">
      {/* Tab bar with ERP stock toggle */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between border-b border-border px-1 gap-2 bg-surface">
        <div className="flex flex-1 overflow-x-auto min-w-0">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            const hasSelection = selectionCounts[tab.key] > 0;

            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3
                  text-xs font-semibold uppercase tracking-wider
                  transition-all duration-200 relative
                  ${isActive
                    ? 'text-accent bg-accent-glow'
                    : 'text-text-muted hover:text-text-secondary hover:bg-surface-hover'
                  }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {hasSelection && (
                  <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                )}
                {isActive && (
                  <div className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-accent rounded-t-full" />
                )}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 px-3 py-2 shrink-0 border-t md:border-t-0 border-border/50">
          <input
            type="checkbox"
            id="toggle-inventory-info"
            checked={showInventoryInfo}
            onChange={(e) => setShowInventoryInfo(e.target.checked)}
            className="rounded border-border text-accent focus:ring-accent bg-background cursor-pointer"
          />
          <label htmlFor="toggle-inventory-info" className="text-xs text-text-muted cursor-pointer hover:text-text-secondary select-none font-semibold uppercase tracking-wider text-[9px]">
            Show ERP Stock Details
          </label>
        </div>
      </div>

      {/* Tab content */}
      <div className="p-3">
        {activeTab === 'panel' && (
          <PanelTable
            brands={allPanels}
            selectedId={selectedPanelId}
            panelMix={panelMix}
            requiredPanelQty={requiredPanelQty}
            requiredPanelWattage={requiredPanelWattage}
            onSelect={onSelectPanel}
            onSetPanelMixQty={onSetPanelMixQty}
            onClearPanelMix={onClearPanelMix}
            range={panelRange}
            onRangeChange={setPanelRange}
            onAdd={(brand) => setSettings({
              customPanels: [...(settings?.customPanels || []), brand],
              currentEquipmentRates: {
                ...settings.currentEquipmentRates,
                panels: { ...settings.currentEquipmentRates.panels, [brand.id]: brand.ratePerWatt },
              },
            })}
            onRemove={(id) => setSettings({
              customPanels: (settings?.customPanels || []).filter((p) => p.id !== id),
              currentEquipmentRates: {
                ...settings.currentEquipmentRates,
                panels: Object.fromEntries(Object.entries(settings.currentEquipmentRates.panels).filter(([key]) => key !== id)),
              },
            })}
          />
        )}
        {activeTab === 'inverter' && (
          <InverterTable
            brands={allInverters}
            selectedMix={selectedInverterMix}
            onSetMixQty={onSetInverterMixQty}
            onClearMix={onClearInverterMix}
            solarCapacityWattage={selectedSolarWattage}
            range={inverterRange}
            onRangeChange={setInverterRange}
            onAdd={(brand) => setSettings({
              customInverters: [...(settings?.customInverters || []), brand],
              currentEquipmentRates: {
                ...settings.currentEquipmentRates,
                inverters: { ...settings.currentEquipmentRates.inverters, [brand.id]: brand.rate },
              },
            })}
            onRemove={(id) => setSettings({
              customInverters: (settings?.customInverters || []).filter((i) => i.id !== id),
              currentEquipmentRates: {
                ...settings.currentEquipmentRates,
                inverters: Object.fromEntries(Object.entries(settings.currentEquipmentRates.inverters).filter(([key]) => key !== id)),
              },
            })}
          />
        )}
        {activeTab === 'battery' && (
          <BatteryTable
            brands={allBatteries}
            selectedMix={selectedBatteryMix}
            onSetMixQty={onSetBatteryMixQty}
            onClearMix={onClearBatteryMix}
            range={batteryRange}
            onRangeChange={setBatteryRange}
            onAdd={(brand) => setSettings({
              customBatteries: [...(settings?.customBatteries || []), brand],
              currentEquipmentRates: {
                ...settings.currentEquipmentRates,
                batteries: { ...settings.currentEquipmentRates.batteries, [brand.id]: brand.rate },
              },
            })}
            onRemove={(id) => setSettings({
              customBatteries: (settings?.customBatteries || []).filter((b) => b.id !== id),
              currentEquipmentRates: {
                ...settings.currentEquipmentRates,
                batteries: Object.fromEntries(Object.entries(settings.currentEquipmentRates.batteries).filter(([key]) => key !== id)),
              },
            })}
          />
        )}
        {activeTab === 'structure' && (
          <StructureConfigTable />
        )}
      </div>
    </div>
  );
}

// ─── Panel Table ────────────────────────────────────────────────────────────────

function PanelTable({
  brands,
  selectedId,
  panelMix,
  requiredPanelQty,
  requiredPanelWattage,
  onSelect,
  onSetPanelMixQty,
  onClearPanelMix,
  range,
  onRangeChange,
  onAdd,
  onRemove,
}: {
  brands: PanelBrand[];
  selectedId: string | null;
  panelMix: Record<string, number>;
  requiredPanelQty: number | null;
  requiredPanelWattage: number | null;
  onSelect: (id: string | null) => void;
  onSetPanelMixQty: (panelId: string, qty: number) => void;
  onClearPanelMix: () => void;
  range: { min: string; max: string };
  onRangeChange: (range: { min: string; max: string }) => void;
  onAdd: (brand: PanelBrand) => void;
  onRemove: (id: string) => void;
}) {
  const { settings } = useSettings();
  const dbPanels = useCalculatorStore((s) => s.dbPanels);
  const activePanels = useMemo(() => {
    const mixEntries = Object.entries(panelMix).filter(([, qty]) => qty > 0);
    if (mixEntries.length > 0) {
      return mixEntries.map(([id]) => brands.find(p => p.id === id)).filter(Boolean);
    }
    if (selectedId) {
      const p = brands.find(x => x.id === selectedId);
      if (p) return [p];
    }
    return [];
  }, [panelMix, selectedId, brands]);

  const [selectionMode, setSelectionMode] = useState<'preset' | 'custom'>('custom');
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customError, setCustomError] = useState<string | null>(null);
  const [customPanel, setCustomPanel] = useState<{
    brand: string;
    model: string;
    wattage: string;
    type: PanelBrand['type'];
    ratePerWatt: string;
    qty: string;
  }>({
    brand: '',
    model: '',
    wattage: '',
    type: 'Mono PERC',
    ratePerWatt: '',
    qty: '',
  });


  const filteredBrands = useMemo(() => {
    const min = parseFloat(range.min);
    const max = parseFloat(range.max);
    return brands.filter((brand) => {
      if (!isNaN(min) && brand.wattage < min) return false;
      if (!isNaN(max) && brand.wattage > max) return false;
      return true;
    });
  }, [brands, range.min, range.max]);

  const selectedPanelQty = useMemo(
    () => Object.values(panelMix).reduce((sum, qty) => sum + (Number.isFinite(qty) ? qty : 0), 0),
    [panelMix],
  );

  const panelById = useMemo(
    () => new Map(brands.map((panel) => [panel.id, panel])),
    [brands],
  );

  const currentSelectedWattage = useMemo(
    () =>
      Object.entries(panelMix).reduce((sum, [panelId, qty]) => {
        const panel = panelById.get(panelId);
        if (!panel || !Number.isFinite(qty) || qty <= 0) return sum;
        return sum + panel.wattage * qty;
      }, 0),
    [panelById, panelMix],
  );

  const targetWattage =
    requiredPanelQty !== null && requiredPanelWattage !== null
      ? requiredPanelQty * requiredPanelWattage
      : null;

  const wattageProgressPct =
    targetWattage && targetWattage > 0
      ? Math.min((currentSelectedWattage / targetWattage) * 100, 100)
      : 0;

  const wattageLeft = targetWattage !== null ? targetWattage - currentSelectedWattage : null;

  const panelQtyGap = requiredPanelQty !== null ? requiredPanelQty - selectedPanelQty : null;

  const switchSelectionMode = (mode: 'preset' | 'custom') => {
    setSelectionMode(mode);
    if (mode !== 'preset') return;
    const entries = Object.entries(panelMix).filter(([, qty]) => Number.isFinite(qty) && qty > 0);
    if (entries.length === 0) return;
    const [panelId] = entries[0];
    const panel = panelById.get(panelId);
    let qtyToSet = entries[0][1];
    if (requiredPanelQty !== null && requiredPanelWattage !== null && panel) {
      const targetWattage = requiredPanelQty * requiredPanelWattage;
      qtyToSet = Math.max(1, Math.ceil(targetWattage / panel.wattage));
    } else if (requiredPanelQty !== null) {
      qtyToSet = requiredPanelQty;
    }
    onClearPanelMix();
    onSetPanelMixQty(panelId, qtyToSet);
  };

  // No wattage selection filtering: keep all panels visible and preserve panel mix when switching modes

  const updatePanelQty = (panelId: string, qty: number) => {
    onSetPanelMixQty(panelId, Math.max(0, Math.floor(qty)));
  };

  const handlePresetPanelSelect = (panelId: string) => {
    const panel = panelById.get(panelId);
    let qtyToSet = 1;
    if (requiredPanelQty !== null && requiredPanelWattage !== null && panel) {
      const targetWattage = requiredPanelQty * requiredPanelWattage;
      qtyToSet = Math.max(1, Math.ceil(targetWattage / panel.wattage));
    } else if (requiredPanelQty !== null) {
      qtyToSet = requiredPanelQty;
    }
    onSelect(panelId);
    onClearPanelMix();
    onSetPanelMixQty(panelId, qtyToSet);
  };

  const handleAddCustomPanel = () => {
    const brand = customPanel.brand.trim();
    const model = customPanel.model.trim();
    const wattage = parseInt(customPanel.wattage, 10);
    const ratePerWatt = parseFloat(customPanel.ratePerWatt);
    const qty = parseInt(customPanel.qty || '0', 10);

    if (brands.some(b => b.brand.toLowerCase() === brand.toLowerCase() && b.model.toLowerCase() === model.toLowerCase() && b.wattage === wattage)) {
      setCustomError('A panel with this brand, model, and wattage already exists.');
      return;
    }
    if (!brand || !model) {
      setCustomError('Brand and model are required.');
      return;
    }
    if (!Number.isFinite(wattage) || wattage <= 0) {
      setCustomError('Wattage must be greater than 0.');
      return;
    }
    if (!Number.isFinite(ratePerWatt) || ratePerWatt <= 0) {
      setCustomError('Rate per watt must be greater than 0.');
      return;
    }

    const customId = `custom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    onAdd({
      id: customId,
      brand,
      model,
      wattage,
      type: customPanel.type,
      ratePerWatt,
    });

    if (qty > 0) {
      onSetPanelMixQty(customId, qty);
    }

    setCustomError(null);
    setCustomPanel({ brand: '', model: '', wattage: '', type: 'Mono PERC', ratePerWatt: '', qty: '' });
    setShowCustomForm(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-text-muted">{brands.length} panels available</span>
        {(selectedPanelQty > 0 || selectedId) && (
          <button
            onClick={() => {
              onSelect(null);
              onClearPanelMix();
            }}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs
              text-error/80 hover:text-error hover:bg-error/10 transition-colors"
          >
            <X size={12} />
            Clear
          </button>
        )}
      </div>
      <div className="mb-3 p-3 rounded-lg border border-border bg-background/50 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-text-muted">Showing</p>
            <div className="text-xs text-text-primary">All panels (all wattages)</div>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-text-muted">Panel Selection Mode</p>
            <div className="flex rounded-md border border-border bg-background p-1">
              <button
                onClick={() => switchSelectionMode('preset')}
                className={`flex-1 px-2 py-1.5 rounded text-xs font-semibold transition-colors ${
                  selectionMode === 'preset'
                    ? 'bg-accent text-background'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                Preset Only
              </button>
              <button
                onClick={() => switchSelectionMode('custom')}
                className={`flex-1 px-2 py-1.5 rounded text-xs font-semibold transition-colors ${
                  selectionMode === 'custom'
                    ? 'bg-accent text-background'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                Custom Qty
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] text-text-muted uppercase tracking-wider">
            Selected Panel Qty
          </span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-text-primary font-mono">{selectedPanelQty}</span>
            {requiredPanelQty !== null && (
              <>
                <span className="text-text-muted">/</span>
                <span className="text-sm font-semibold text-text-secondary font-mono">{requiredPanelQty}</span>
              </>
            )}
            {panelQtyGap !== null && (
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                  panelQtyGap === 0
                    ? 'bg-success/15 text-success'
                    : panelQtyGap > 0
                    ? 'bg-warning/15 text-warning'
                    : 'bg-error/15 text-error'
                }`}
              >
                {panelQtyGap === 0 ? 'Matched' : panelQtyGap > 0 ? `${panelQtyGap} remaining` : `${Math.abs(panelQtyGap)} extra`}
              </span>
            )}
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-success">
              Current Wattage: <span className="font-mono font-semibold">{currentSelectedWattage.toLocaleString('en-IN')} W</span>
            </span>
            {wattageLeft !== null && (
              <span className={wattageLeft >= 0 ? 'text-error' : 'text-warning'}>
                Wattage Left: <span className="font-mono font-semibold">{Math.max(wattageLeft, 0).toLocaleString('en-IN')} W</span>
                {wattageLeft < 0 && ` (Over by ${Math.abs(wattageLeft).toLocaleString('en-IN')} W)`}
              </span>
            )}
          </div>
          <div className="h-2 rounded-full overflow-hidden border border-border bg-surface-hover">
            <div
              className="h-full"
              style={{
                background: `linear-gradient(to right, #16a34a 0% ${wattageProgressPct}%, #dc2626 ${wattageProgressPct}% 100%)`,
              }}
            />
          </div>
        </div>
      </div>
      <RangeFilter
        label="Wattage Filter (W)"
        minPlaceholder="Min"
        maxPlaceholder="Max"
        range={range}
        onChange={onRangeChange}
      />

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 px-2 text-text-muted font-medium">Brand</th>
              <th className="text-left py-2 px-2 text-text-muted font-medium">Model</th>
              <th className="text-right py-2 px-2 text-text-muted font-medium">Wattage</th>
              <th className="text-left py-2 px-2 text-text-muted font-medium">Type</th>
              <th className="text-right py-2 px-2 text-text-muted font-medium">₹/W</th>
              <th className="text-right py-2 px-2 text-text-muted font-medium">₹/Panel</th>
              <th className="text-center py-2 px-2 text-text-muted font-medium">Qty</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {filteredBrands.map((brand) => {
              const selectedQty = panelMix[brand.id] ?? 0;
              const isLegacySelected = selectedPanelQty === 0 && brand.id === selectedId;
              const isSelected = selectedQty > 0 || isLegacySelected;
              const defaultBrand = dbPanels.find((p) => p.id === brand.id);
              const defaultRatePerWatt = defaultBrand?.ratePerWatt ?? brand.ratePerWatt;
              const isOverridden = settings.currentEquipmentRates.panels[brand.id] !== undefined;
              const defaultPanelPrice = defaultRatePerWatt * brand.wattage;
              const currentPanelPrice = brand.ratePerWatt * brand.wattage;

              return (
                <tr
                  key={brand.id}
                  onClick={() => {
                    if (selectionMode === 'preset') {
                      handlePresetPanelSelect(brand.id);
                      return;
                    }
                    onSelect(isLegacySelected ? null : brand.id);
                  }}
                  className={`border-b border-border/50 cursor-pointer transition-all duration-150
                    ${isSelected
                      ? 'bg-accent-dim'
                      : 'hover:bg-surface-hover'
                    }`}
                >
                  <td className="py-2.5 px-2 font-medium text-text-primary">{brand.brand}</td>
                  <td className="py-2.5 px-2 text-text-secondary">{brand.model}</td>
                  <td className="py-2.5 px-2 text-right font-mono text-text-primary">{brand.wattage}W</td>
                  <td className="py-2.5 px-2">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-info/10 text-info border border-info/20">
                      {brand.type}
                    </span>
                  </td>
                  <td className="py-2.5 px-2" onClick={(e) => e.stopPropagation()}>
                    <PanelRateCell brand={brand} />
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono" onClick={(e) => e.stopPropagation()}>
                    <div className="flex flex-col items-end">
                      {isOverridden && (
                        <span className="text-[9px] text-text-muted line-through">₹{formatRate(defaultPanelPrice)}</span>
                      )}
                      <span className={`font-semibold ${isOverridden ? 'text-warning' : 'text-text-primary'}`}>
                        ₹{formatRate(currentPanelPrice)}
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 px-2">
                    <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        disabled={selectionMode === 'preset'}
                        onClick={() => updatePanelQty(brand.id, selectedQty - 1)}
                        className="p-1 rounded border border-border hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Decrease qty"
                      >
                        <Minus size={11} />
                      </button>
                      <input
                        type="number"
                        min={0}
                        value={selectedQty || ''}
                        disabled={selectionMode === 'preset'}
                        onChange={(e) => updatePanelQty(brand.id, parseInt(e.target.value || '0', 10))}
                        className="w-14 px-2 py-1 rounded bg-background border border-border text-center text-xs font-mono text-text-primary outline-none focus:border-accent disabled:opacity-40"
                        placeholder="0"
                      />
                      <button
                        disabled={selectionMode === 'preset'}
                        onClick={() => updatePanelQty(brand.id, selectedQty + 1)}
                        className="p-1 rounded border border-border hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Increase qty"
                      >
                        <Plus size={11} />
                      </button>
                    </div>
                  </td>
                  <td className="py-2.5 px-2 flex justify-end gap-2">
                    {(isSelected || selectedQty > 0) && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-success/15 text-success">
                        <Check size={10} />
                      </span>
                    )}
                    {brand.id.startsWith('custom') && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onRemove(brand.id); }}
                        className="p-1 rounded text-error/60 hover:text-error hover:bg-error/10 transition-colors"
                        title="Remove custom panel"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {/* Add Custom Row */}
            <tr onClick={() => { setShowCustomForm(!showCustomForm); setCustomError(null); }} className="border-b border-border/50 cursor-pointer hover:bg-surface-hover transition-colors">
              <td colSpan={7} className="py-3 px-2 text-center text-accent font-medium text-xs">
                + Add Custom Panel
              </td>
            </tr>
            {showCustomForm && (
              <tr className="border-b border-border/50">
                <td colSpan={7} className="p-3">
                  <div className="rounded-xl border border-accent/30 bg-accent-glow/20 p-3 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
                      <input
                        type="text"
                        value={customPanel.brand}
                        onChange={(e) => setCustomPanel({ ...customPanel, brand: e.target.value })}
                        placeholder="Brand"
                        className="w-full px-2.5 py-2 rounded-md bg-background border border-border text-xs text-text-primary outline-none focus:border-accent"
                      />
                      <input
                        type="text"
                        value={customPanel.model}
                        onChange={(e) => setCustomPanel({ ...customPanel, model: e.target.value })}
                        placeholder="Model"
                        className="w-full px-2.5 py-2 rounded-md bg-background border border-border text-xs text-text-primary outline-none focus:border-accent"
                      />
                      <input
                        type="number"
                        min={1}
                        value={customPanel.wattage}
                        onChange={(e) => setCustomPanel({ ...customPanel, wattage: e.target.value })}
                        placeholder="Wattage"
                        className="w-full px-2.5 py-2 rounded-md bg-background border border-border text-xs text-text-primary outline-none focus:border-accent"
                      />
                      <Select
                        size="sm"
                        value={customPanel.type}
                        onChange={(v) => setCustomPanel({ ...customPanel, type: v as PanelBrand['type'] })}
                        options={[
                          { value: 'Mono PERC', label: 'Mono PERC' },
                          { value: 'TOPCon', label: 'TOPCon' },
                        ]}
                      />
                      <input
                        type="number"
                        min={0.01}
                        step="0.01"
                        value={customPanel.ratePerWatt}
                        onChange={(e) => setCustomPanel({ ...customPanel, ratePerWatt: e.target.value })}
                        placeholder="₹/W"
                        className="w-full px-2.5 py-2 rounded-md bg-background border border-border text-xs text-text-primary outline-none focus:border-accent"
                      />
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={customPanel.qty}
                        onChange={(e) => setCustomPanel({ ...customPanel, qty: e.target.value })}
                        placeholder="Qty"
                        className="w-full px-2.5 py-2 rounded-md bg-background border border-border text-xs text-text-primary outline-none focus:border-accent"
                      />
                    </div>
                    {customError && <p className="text-[11px] text-error">{customError}</p>}
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => {
                          setShowCustomForm(false);
                          setCustomError(null);
                          setCustomPanel({ brand: '', model: '', wattage: '', type: 'Mono PERC', ratePerWatt: '', qty: '' });
                        }}
                        className="px-3 py-1.5 rounded-md border border-border text-xs text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleAddCustomPanel}
                        className="px-3 py-1.5 rounded-md bg-accent text-background text-xs font-semibold hover:bg-accent-hover transition-colors"
                      >
                        Add Panel
                      </button>
                    </div>
                  </div>
                </td>
              </tr>
            )}
            {filteredBrands.length === 0 && (
              <tr>
                <td colSpan={7} className="py-3 px-2 text-center text-text-muted text-xs">
                  No panels match this capacity range.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {activePanels.length > 0 && (
        <div className="mt-6 space-y-4 border-t border-border pt-4">
          <h4 className="text-xs uppercase font-bold text-text-secondary tracking-wider">Active Panel Detail Overview</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activePanels.map((panel: any) => {
              const qty = panelMix[panel.id] || requiredPanelQty || 0;
              return (
                <EquipmentDetailCard
                  key={panel.id}
                  title="Solar Panel"
                  brand={panel.brand}
                  model={panel.model}
                  category={`${panel.type} PV Module`}
                  specs={[
                    `Wattage: ${panel.wattage}W`,
                    `Type: ${panel.type}`,
                    `Quantity: ${qty} Nos`,
                    `Total Wattage: ${panel.wattage * qty}W`
                  ]}
                  gstPct={panel.gst_pct || 0.05}
                  sellingPrice={panel.ratePerWatt * panel.wattage}
                  itemDescForInventory={`${panel.brand} ${panel.model} ${Number(panel.wattage)}W Panel`}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Inverter Table ─────────────────────────────────────────────────────────────

function InverterTable({
  brands,
  selectedMix,
  solarCapacityWattage,
  range,
  onRangeChange,
  onSetMixQty,
  onClearMix,
  onAdd,
  onRemove,
}: {
  brands: InverterBrand[];
  selectedMix: Record<string, number>;
  solarCapacityWattage: number;
  range: { min: string; max: string };
  onRangeChange: (range: { min: string; max: string }) => void;
  onSetMixQty: (id: string, qty: number) => void;
  onClearMix: () => void;
  onAdd: (brand: InverterBrand) => void;
  onRemove: (id: string) => void;
}) {
  const filteredBrands = useMemo(() => {
    const min = parseFloat(range.min);
    const max = parseFloat(range.max);
    return brands.filter((brand) => {
      if (!isNaN(min) && brand.capacityKW < min) return false;
      if (!isNaN(max) && brand.capacityKW > max) return false;
      return true;
    });
  }, [brands, range.min, range.max]);

  const activeInverters = useMemo(() => {
    const mixEntries = Object.entries(selectedMix).filter(([, qty]) => qty > 0);
    return mixEntries.map(([id]) => brands.find(i => i.id === id)).filter(Boolean);
  }, [selectedMix, brands]);

  const selectedQty = useMemo(
    () => Object.values(selectedMix).reduce((sum, qty) => sum + (Number.isFinite(qty) ? qty : 0), 0),
    [selectedMix],
  );

  const selectedCapacityWattage = useMemo(
    () =>
      Object.entries(selectedMix).reduce((sum, [brandId, qty]) => {
        const brand = brands.find((entry) => entry.id === brandId);
        if (!brand || !Number.isFinite(qty) || qty <= 0) return sum;
        return sum + brand.capacityKW * 1000 * qty;
      }, 0),
    [brands, selectedMix],
  );

  const dcAcRatio = selectedCapacityWattage > 0 ? solarCapacityWattage / selectedCapacityWattage : null;

  const applyAutoFit = () => {
    const recommendedMix = buildOptimalMix(
      brands.map((brand) => ({ id: brand.id, capacity: brand.capacityKW * 1000, rate: brand.rate })),
      solarCapacityWattage,
    );
    onClearMix();
    Object.entries(recommendedMix).forEach(([brandId, qty]) => onSetMixQty(brandId, qty));
  };

  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customError, setCustomError] = useState<string | null>(null);
  const [customInv, setCustomInv] = useState({ brand: '', model: '', capacity: '', type: 'on-grid' as InverterBrand['type'], rate: '', qty: '' });

  const handleAddCustomInv = () => {
    const brand = customInv.brand.trim();
    const model = customInv.model.trim();
    const capacity = parseFloat(customInv.capacity);
    const rate = parseFloat(customInv.rate);
    const qty = parseInt(customInv.qty || '0', 10);

    if (!brand || !model) return setCustomError('Brand and model are required.');
    if (isNaN(capacity) || capacity <= 0) return setCustomError('Capacity must be > 0.');
    if (isNaN(rate) || rate <= 0) return setCustomError('Rate must be > 0.');
    
    if (brands.some(b => b.brand.toLowerCase() === brand.toLowerCase() && b.model.toLowerCase() === model.toLowerCase() && b.capacityKW === capacity)) {
      return setCustomError('Inverter already exists.');
    }

    const customId = `custom_inv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    onAdd({ id: customId, brand, model, capacityKW: capacity, type: customInv.type, rate });
    if (qty > 0) onSetMixQty(customId, qty);
    
    setCustomError(null);
    setCustomInv({ brand: '', model: '', capacity: '', type: 'on-grid', rate: '', qty: '' });
    setShowCustomForm(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-text-muted">{brands.length} inverters available</span>
        <div className="flex items-center gap-2">
          {solarCapacityWattage > 0 && (
            <button
              onClick={applyAutoFit}
              className="px-2 py-1 rounded-md text-xs font-semibold bg-accent/10 text-accent hover:bg-accent/15 transition-colors"
            >
              Suggest mix
            </button>
          )}
          {selectedQty > 0 && (
            <button
              onClick={onClearMix}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs
                text-error/80 hover:text-error hover:bg-error/10 transition-colors"
            >
              <X size={12} />
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="mb-3 p-3 rounded-lg border border-border bg-background/50 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-text-muted">Selected Inverter Qty</p>
            <div className="text-xs text-text-primary">{selectedQty} units</div>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-text-muted">DC / AC Ratio</p>
            <div className="text-xs font-semibold text-text-primary">
              {dcAcRatio !== null ? `${dcAcRatio.toFixed(2)}x` : '—'}
              Total inverter capacity: {selectedCapacityWattage.toLocaleString('en-IN')} W
              {solarCapacityWattage > 0 && (
                <span className="block text-text-secondary font-normal">
                  Solar capacity: {solarCapacityWattage.toLocaleString('en-IN')} W
                  {dcAcRatio !== null && dcAcRatio >= 1.1 && dcAcRatio <= 1.4 && ' · typical oversizing range'}
                  {dcAcRatio !== null && dcAcRatio > 1.4 && ' · clipping risk at peak sun'}
                  {dcAcRatio !== null && dcAcRatio < 1.1 && ' · inverter is larger than the array or lightly loaded'}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <RangeFilter
        label="Capacity Filter (kW)"
        minPlaceholder="Min"
        maxPlaceholder="Max"
        range={range}
        onChange={onRangeChange}
      />

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 px-2 text-text-muted font-medium">Brand</th>
              <th className="text-left py-2 px-2 text-text-muted font-medium">Model</th>
              <th className="text-right py-2 px-2 text-text-muted font-medium">Capacity</th>
              <th className="text-left py-2 px-2 text-text-muted font-medium">Type</th>
              <th className="text-right py-2 px-2 text-text-muted font-medium">Rate</th>
              <th className="text-center py-2 px-2 text-text-muted font-medium">Qty</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody>
            {filteredBrands.map((brand) => {
              const qty = selectedMix[brand.id] ?? 0;
              const isSelected = qty > 0;
              return (
                <tr
                  key={brand.id}
                  onClick={() => onSetMixQty(brand.id, qty + 1)}
                  className={`border-b border-border/50 cursor-pointer transition-all duration-150
                    ${isSelected
                      ? 'bg-accent-dim'
                      : 'hover:bg-surface-hover'
                    }`}
                >
                  <td className="py-2.5 px-2 font-medium text-text-primary">{brand.brand}</td>
                  <td className="py-2.5 px-2 text-text-secondary">{brand.model}</td>
                  <td className="py-2.5 px-2 text-right font-mono text-text-primary">{brand.capacityKW}kW</td>
                  <td className="py-2.5 px-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border
                      ${brand.type === 'hybrid'
                        ? 'bg-warning/10 text-warning border-warning/20'
                        : brand.type === 'micro'
                        ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                        : 'bg-success/10 text-success border-success/20'
                      }`}>
                      {brand.type}
                    </span>
                  </td>
                  <td className="py-2.5 px-2" onClick={(e) => e.stopPropagation()}>
                    <InverterRateCell brand={brand} />
                  </td>
                  <td className="py-2.5 px-2">
                    <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => onSetMixQty(brand.id, qty - 1)}
                        className="p-1 rounded border border-border hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors"
                        title="Decrease qty"
                      >
                        <Minus size={11} />
                      </button>
                      <input
                        type="number"
                        min={0}
                        value={qty || ''}
                        onChange={(e) => onSetMixQty(brand.id, parseInt(e.target.value || '0', 10))}
                        className="w-14 px-2 py-1 rounded bg-background border border-border text-center text-xs font-mono text-text-primary outline-none focus:border-accent"
                        placeholder="0"
                      />
                      <button
                        onClick={() => onSetMixQty(brand.id, qty + 1)}
                        className="p-1 rounded border border-border hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors"
                        title="Increase qty"
                      >
                        <Plus size={11} />
                      </button>
                    </div>
                  </td>
                  <td className="py-2.5 px-2 flex justify-end gap-2">
                    {isSelected && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-success/15 text-success">
                        <Check size={10} />
                      </span>
                    )}
                    {brand.id.startsWith('custom') && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onRemove(brand.id); }}
                        className="p-1 rounded text-error/60 hover:text-error hover:bg-error/10 transition-colors"
                        title="Remove custom inverter"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {/* Add Custom Row */}
            <tr onClick={() => { setShowCustomForm(!showCustomForm); setCustomError(null); }} className="border-b border-border/50 cursor-pointer hover:bg-surface-hover transition-colors">
              <td colSpan={7} className="py-3 px-2 text-center text-accent font-medium text-xs">
                + Add Custom Inverter
              </td>
            </tr>
            {showCustomForm && (
              <tr className="bg-surface-active">
                <td colSpan={7} className="py-2 px-2 border-b border-border">
                  <div className="flex flex-wrap gap-2 items-center justify-between">
                    <div className="flex flex-wrap gap-2 flex-1">
                      <input type="text" placeholder="Brand" className="w-24 px-2 py-1 rounded bg-background border border-border text-xs focus:border-accent focus:outline-none"
                        value={customInv.brand} onChange={(e) => setCustomInv({ ...customInv, brand: e.target.value })} autoFocus />
                      <input type="text" placeholder="Model" className="w-24 px-2 py-1 rounded bg-background border border-border text-xs focus:border-accent focus:outline-none"
                        value={customInv.model} onChange={(e) => setCustomInv({ ...customInv, model: e.target.value })} />
                      <input type="number" placeholder="kW" className="w-16 px-2 py-1 rounded bg-background border border-border text-xs text-right focus:border-accent focus:outline-none"
                        value={customInv.capacity} onChange={(e) => setCustomInv({ ...customInv, capacity: e.target.value })} />
                      <Select
                        size="sm"
                        value={customInv.type}
                        onChange={(v) => setCustomInv({ ...customInv, type: v as InverterBrand['type'] })}
                        className="w-24"
                        options={[
                          { value: 'on-grid', label: 'On-Grid' },
                          { value: 'hybrid', label: 'Hybrid' },
                          { value: 'micro', label: 'Micro' },
                        ]}
                      />
                      <input type="number" placeholder="Rate (₹)" className="w-20 px-2 py-1 rounded bg-background border border-border text-xs text-right focus:border-accent focus:outline-none"
                        value={customInv.rate} onChange={(e) => setCustomInv({ ...customInv, rate: e.target.value })} />
                      <input type="number" placeholder="Qty (opt)" className="w-20 px-2 py-1 rounded bg-background border border-border text-xs text-right focus:border-accent focus:outline-none"
                        value={customInv.qty} onChange={(e) => setCustomInv({ ...customInv, qty: e.target.value })} />
                    </div>
                    <div className="flex gap-2">
                      {customError && <p className="text-[11px] text-error flex items-center mr-2">{customError}</p>}
                      <button onClick={handleAddCustomInv} className="px-3 py-1 bg-accent text-background text-xs font-semibold rounded hover:bg-accent-hover transition-colors">Save</button>
                      <button onClick={() => { setShowCustomForm(false); setCustomError(null); }} className="px-3 py-1 bg-surface-hover text-text-primary text-xs font-semibold rounded transition-colors">Cancel</button>
                    </div>
                  </div>
                </td>
              </tr>
            )}
            {filteredBrands.length === 0 && (
              <tr>
                <td colSpan={7} className="py-3 px-2 text-center text-text-muted text-xs">
                  No inverters match this capacity range.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {activeInverters.length > 0 && (
        <div className="mt-6 space-y-4 border-t border-border pt-4">
          <h4 className="text-xs uppercase font-bold text-text-secondary tracking-wider">Active Inverter Detail Overview</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeInverters.map((inverter: any) => {
              const qty = selectedMix[inverter.id] || 0;
              return (
                <EquipmentDetailCard
                  key={inverter.id}
                  title="Inverter"
                  brand={inverter.brand}
                  model={inverter.model}
                  category={`${inverter.type} Inverter`}
                  specs={[
                    `Capacity: ${inverter.capacityKW} kW`,
                    `Phases: ${inverter.phases}-Phase`,
                    `Quantity: ${qty} Nos`
                  ]}
                  gstPct={inverter.gst_pct || 0.12}
                  sellingPrice={inverter.rate}
                  itemDescForInventory={`${inverter.brand} ${inverter.model} ${Number(inverter.capacity_kw)}kW Inverter`}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Battery Table ──────────────────────────────────────────────────────────────

function BatteryTable({
  brands,
  selectedMix,
  range,
  onRangeChange,
  onSetMixQty,
  onClearMix,
  onAdd,
  onRemove,
}: {
  brands: BatteryBrand[];
  selectedMix: Record<string, number>;
  range: { min: string; max: string };
  onRangeChange: (range: { min: string; max: string }) => void;
  onSetMixQty: (id: string, qty: number) => void;
  onClearMix: () => void;
  onAdd: (brand: BatteryBrand) => void;
  onRemove: (id: string) => void;
}) {
  const filteredBrands = useMemo(() => {
    const min = parseFloat(range.min);
    const max = parseFloat(range.max);
    return brands.filter((brand) => {
      if (!isNaN(min) && brand.capacityKWh < min) return false;
      if (!isNaN(max) && brand.capacityKWh > max) return false;
      return true;
    });
  }, [brands, range.min, range.max]);

  const activeBatteries = useMemo(() => {
    const mixEntries = Object.entries(selectedMix).filter(([, qty]) => qty > 0);
    return mixEntries.map(([id]) => brands.find(b => b.id === id)).filter(Boolean);
  }, [selectedMix, brands]);

  const selectedQty = useMemo(
    () => Object.values(selectedMix).reduce((sum, qty) => sum + (Number.isFinite(qty) ? qty : 0), 0),
    [selectedMix],
  );

  const selectedCapacityKWh = useMemo(
    () =>
      Object.entries(selectedMix).reduce((sum, [brandId, qty]) => {
        const brand = brands.find((entry) => entry.id === brandId);
        if (!brand || !Number.isFinite(qty) || qty <= 0) return sum;
        return sum + brand.capacityKWh * qty;
      }, 0),
    [brands, selectedMix],
  );

  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customError, setCustomError] = useState<string | null>(null);
  const [customBat, setCustomBat] = useState({ brand: '', model: '', capacity: '', chemistry: 'LFP' as BatteryBrand['chemistry'], rate: '', qty: '' });

  const handleAddCustomBat = () => {
    const brand = customBat.brand.trim();
    const model = customBat.model.trim();
    const capacity = parseFloat(customBat.capacity);
    const rate = parseFloat(customBat.rate);
    const qty = parseInt(customBat.qty || '0', 10);

    if (!brand || !model) return setCustomError('Brand and model are required.');
    if (isNaN(capacity) || capacity <= 0) return setCustomError('Capacity must be > 0.');
    if (isNaN(rate) || rate <= 0) return setCustomError('Rate must be > 0.');
    
    if (brands.some(b => b.brand.toLowerCase() === brand.toLowerCase() && b.model.toLowerCase() === model.toLowerCase() && b.capacityKWh === capacity)) {
      return setCustomError('Battery already exists.');
    }

    const customId = `custom_bat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    onAdd({ id: customId, brand, model, capacityKWh: capacity, chemistry: customBat.chemistry, rate, maxDischargeKW: capacity * 0.5 });
    if (qty > 0) onSetMixQty(customId, qty);
    
    setCustomError(null);
    setCustomBat({ brand: '', model: '', capacity: '', chemistry: 'LFP', rate: '', qty: '' });
    setShowCustomForm(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-text-muted">{brands.length} batteries available</span>
        {selectedQty > 0 && (
          <button
            onClick={onClearMix}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs
              text-error/80 hover:text-error hover:bg-error/10 transition-colors"
          >
            <X size={12} />
            Clear
          </button>
        )}
      </div>
      <div className="mb-3 p-3 rounded-lg border border-border bg-background/50 space-y-1.5">
        <p className="text-[10px] uppercase tracking-wider text-text-muted">Selected Battery Qty</p>
        <div className="text-xs font-semibold text-text-primary">
          {selectedQty} units · {selectedCapacityKWh.toLocaleString('en-IN')} kWh total
        </div>
      </div>
      <RangeFilter
        label="Capacity Filter (kWh)"
        minPlaceholder="Min"
        maxPlaceholder="Max"
        range={range}
        onChange={onRangeChange}
      />

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 px-2 text-text-muted font-medium">Brand</th>
              <th className="text-left py-2 px-2 text-text-muted font-medium">Model</th>
              <th className="text-right py-2 px-2 text-text-muted font-medium">Capacity</th>
              <th className="text-left py-2 px-2 text-text-muted font-medium">Chemistry</th>
              <th className="text-right py-2 px-2 text-text-muted font-medium">Rate</th>
              <th className="text-center py-2 px-2 text-text-muted font-medium">Qty</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody>
            {filteredBrands.map((brand) => {
              const qty = selectedMix[brand.id] ?? 0;
              const isSelected = qty > 0;
              return (
                <tr
                  key={brand.id}
                  onClick={() => onSetMixQty(brand.id, qty + 1)}
                  className={`border-b border-border/50 cursor-pointer transition-all duration-150
                    ${isSelected
                      ? 'bg-accent-dim'
                      : 'hover:bg-surface-hover'
                    }`}
                >
                  <td className="py-2.5 px-2 font-medium text-text-primary">{brand.brand}</td>
                  <td className="py-2.5 px-2 text-text-secondary">{brand.model}</td>
                  <td className="py-2.5 px-2 text-right font-mono text-text-primary">{brand.capacityKWh}kWh</td>
                  <td className="py-2.5 px-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border
                      ${brand.chemistry === 'LFP'
                        ? 'bg-success/10 text-success border-success/20'
                        : 'bg-info/10 text-info border-info/20'
                      }`}>
                      {brand.chemistry}
                    </span>
                  </td>
                  <td className="py-2.5 px-2" onClick={(e) => e.stopPropagation()}>
                    <BatteryRateCell brand={brand} />
                  </td>
                  <td className="py-2.5 px-2">
                    <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => onSetMixQty(brand.id, qty - 1)}
                        className="p-1 rounded border border-border hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors"
                        title="Decrease qty"
                      >
                        <Minus size={11} />
                      </button>
                      <input
                        type="number"
                        min={0}
                        value={qty || ''}
                        onChange={(e) => onSetMixQty(brand.id, parseInt(e.target.value || '0', 10))}
                        className="w-14 px-2 py-1 rounded bg-background border border-border text-center text-xs font-mono text-text-primary outline-none focus:border-accent"
                        placeholder="0"
                      />
                      <button
                        onClick={() => onSetMixQty(brand.id, qty + 1)}
                        className="p-1 rounded border border-border hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors"
                        title="Increase qty"
                      >
                        <Plus size={11} />
                      </button>
                    </div>
                  </td>
                  <td className="py-2.5 px-2 flex justify-end gap-2">
                    {isSelected && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-success/15 text-success">
                        <Check size={10} />
                      </span>
                    )}
                    {brand.id.startsWith('custom') && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onRemove(brand.id); }}
                        className="p-1 rounded text-error/60 hover:text-error hover:bg-error/10 transition-colors"
                        title="Remove custom battery"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {/* Add Custom Row */}
            <tr onClick={() => { setShowCustomForm(!showCustomForm); setCustomError(null); }} className="border-b border-border/50 cursor-pointer hover:bg-surface-hover transition-colors">
              <td colSpan={7} className="py-3 px-2 text-center text-accent font-medium text-xs">
                + Add Custom Battery
              </td>
            </tr>
            {showCustomForm && (
              <tr className="bg-surface-active">
                <td colSpan={7} className="py-2 px-2 border-b border-border">
                  <div className="flex flex-wrap gap-2 items-center justify-between">
                    <div className="flex flex-wrap gap-2 flex-1">
                      <input type="text" placeholder="Brand" className="w-24 px-2 py-1 rounded bg-background border border-border text-xs focus:border-accent focus:outline-none"
                        value={customBat.brand} onChange={(e) => setCustomBat({ ...customBat, brand: e.target.value })} autoFocus />
                      <input type="text" placeholder="Model" className="w-24 px-2 py-1 rounded bg-background border border-border text-xs focus:border-accent focus:outline-none"
                        value={customBat.model} onChange={(e) => setCustomBat({ ...customBat, model: e.target.value })} />
                      <input type="number" placeholder="kWh" className="w-16 px-2 py-1 rounded bg-background border border-border text-xs text-right focus:border-accent focus:outline-none"
                        value={customBat.capacity} onChange={(e) => setCustomBat({ ...customBat, capacity: e.target.value })} />
                      <Select
                        size="sm"
                        value={customBat.chemistry}
                        onChange={(v) => setCustomBat({ ...customBat, chemistry: v as BatteryBrand['chemistry'] })}
                        className="w-24"
                        options={[
                          { value: 'LFP', label: 'LFP' },
                          { value: 'NMC', label: 'NMC' },
                          { value: 'Lead-Acid', label: 'Lead-Acid' },
                        ]}
                      />
                      <input type="number" placeholder="Rate (₹)" className="w-20 px-2 py-1 rounded bg-background border border-border text-xs text-right focus:border-accent focus:outline-none"
                        value={customBat.rate} onChange={(e) => setCustomBat({ ...customBat, rate: e.target.value })} />
                      <input type="number" placeholder="Qty (opt)" className="w-20 px-2 py-1 rounded bg-background border border-border text-xs text-right focus:border-accent focus:outline-none"
                        value={customBat.qty} onChange={(e) => setCustomBat({ ...customBat, qty: e.target.value })} />
                    </div>
                    <div className="flex gap-2">
                      {customError && <p className="text-[11px] text-error flex items-center mr-2">{customError}</p>}
                      <button onClick={handleAddCustomBat} className="px-3 py-1 bg-accent text-background text-xs font-semibold rounded hover:bg-accent-hover transition-colors">Save</button>
                      <button onClick={() => { setShowCustomForm(false); setCustomError(null); }} className="px-3 py-1 bg-surface-hover text-text-primary text-xs font-semibold rounded transition-colors">Cancel</button>
                    </div>
                  </div>
                </td>
              </tr>
            )}
            {filteredBrands.length === 0 && (
              <tr>
                <td colSpan={7} className="py-3 px-2 text-center text-text-muted text-xs">
                  No batteries match this capacity range.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {activeBatteries.length > 0 && (
        <div className="mt-6 space-y-4 border-t border-border pt-4">
          <h4 className="text-xs uppercase font-bold text-text-secondary tracking-wider">Active Battery Detail Overview</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeBatteries.map((battery: any) => {
              const qty = selectedMix[battery.id] || 0;
              return (
                <EquipmentDetailCard
                  key={battery.id}
                  title="Battery"
                  brand={battery.brand}
                  model={battery.model}
                  category={`${battery.chemistry} Storage`}
                  specs={[
                    `Capacity: ${battery.capacityKWh} kWh`,
                    `Chemistry: ${battery.chemistry}`,
                    `Quantity: ${qty} Nos`
                  ]}
                  gstPct={battery.gst_pct || 0.12}
                  sellingPrice={battery.rate}
                  itemDescForInventory={`${battery.brand} ${battery.model} ${Number(battery.capacityKWh)}kWh Battery`}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function RangeFilter({
  label,
  minPlaceholder,
  maxPlaceholder,
  range,
  onChange,
}: {
  label: string;
  minPlaceholder: string;
  maxPlaceholder: string;
  range: { min: string; max: string };
  onChange: (range: { min: string; max: string }) => void;
}) {
  return (
    <div className="mb-3 space-y-1.5">
      <p className="text-[10px] uppercase tracking-wider text-text-muted">{label}</p>
      <div className="grid grid-cols-2 gap-2">
        <input
          type="number"
          value={range.min}
          onChange={(e) => onChange({ ...range, min: e.target.value })}
          placeholder={minPlaceholder}
          min="0"
          className="w-full px-2 py-1.5 rounded-md bg-background border border-border text-xs text-text-primary outline-none focus:border-accent"
        />
        <input
          type="number"
          value={range.max}
          onChange={(e) => onChange({ ...range, max: e.target.value })}
          placeholder={maxPlaceholder}
          min="0"
          className="w-full px-2 py-1.5 rounded-md bg-background border border-border text-xs text-text-primary outline-none focus:border-accent"
        />
      </div>
    </div>
  );
}

// ─── Inline Rate Editor Cells ─────────────────────────────────────────────────

function PanelRateCell({ brand }: { brand: PanelBrand }) {
  const { settings, setSettings } = useSettings();
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  const dbPanels = useCalculatorStore((s) => s.dbPanels);
  const defaultBrand = dbPanels.find((p) => p.id === brand.id);
  const defaultRatePerWatt = (defaultBrand?.ratePerWatt ?? brand.ratePerWatt) || 0;
  const currentRatePerWatt = brand.ratePerWatt || 0;
  const isOverridden = settings.currentEquipmentRates.panels[brand.id] !== undefined;

  const handleSave = () => {
    const newRate = parseFloat(editValue);
    if (!Number.isFinite(newRate) || newRate <= 0) {
      setEditing(false);
      return;
    }
    setSettings({
      currentEquipmentRates: {
        ...settings.currentEquipmentRates,
        panels: { ...settings.currentEquipmentRates.panels, [brand.id]: newRate },
      },
    });
    setEditing(false);
  };

  const handleReset = () => {
    const next = { ...settings.currentEquipmentRates.panels };
    delete next[brand.id];
    setSettings({
      currentEquipmentRates: { ...settings.currentEquipmentRates, panels: next },
    });
  };

  if (editing) {
    return (
      <div className="flex flex-col items-end gap-0.5">
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-text-muted">₹</span>
          <input
            autoFocus
            type="number"
            step="0.1"
            min="0"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false); }}
            onBlur={handleSave}
            className="w-16 px-1.5 py-0.5 rounded bg-background border border-accent/50 text-right text-xs font-mono text-text-primary outline-none"
          />
          <span className="text-[9px] text-text-muted font-mono">/W</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-end gap-1.5 group/rate">
      <div className="flex flex-col items-end">
        {isOverridden && (
          <span className="text-[9px] font-mono text-text-muted line-through">₹{defaultRatePerWatt.toFixed(2)}/W</span>
        )}
        <span className={`text-xs font-mono font-semibold ${isOverridden ? 'text-warning' : 'text-accent'}`}>
          ₹{currentRatePerWatt.toFixed(2)}/W
        </span>
      </div>
      <button
        onClick={() => { setEditValue(currentRatePerWatt.toFixed(2)); setEditing(true); }}
        className="p-0.5 rounded opacity-0 group-hover/rate:opacity-100 hover:bg-accent/10 text-text-muted hover:text-accent transition-all"
        title="Edit rate per watt"
      >
        <Edit3 size={10} />
      </button>
      {isOverridden && (
        <button
          onClick={handleReset}
          className="p-0.5 rounded opacity-0 group-hover/rate:opacity-100 hover:bg-error/10 text-text-muted hover:text-error transition-all"
          title="Reset to default"
        >
          <RotateCcw size={10} />
        </button>
      )}
    </div>
  );
}

function InverterRateCell({ brand }: { brand: InverterBrand }) {
  const { settings, setSettings } = useSettings();
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  const dbInverters = useCalculatorStore((s) => s.dbInverters);
  const defaultBrand = dbInverters.find((i) => i.id === brand.id);
  const defaultRate = defaultBrand?.rate ?? brand.rate;
  const currentRate = brand.rate;
  const isOverridden = settings.currentEquipmentRates.inverters[brand.id] !== undefined;

  const handleSave = () => {
    const val = parseFloat(editValue);
    if (!Number.isFinite(val) || val <= 0) {
      setEditing(false);
      return;
    }
    setSettings({
      currentEquipmentRates: {
        ...settings.currentEquipmentRates,
        inverters: { ...settings.currentEquipmentRates.inverters, [brand.id]: val },
      },
    });
    setEditing(false);
  };

  const handleReset = () => {
    const next = { ...settings.currentEquipmentRates.inverters };
    delete next[brand.id];
    setSettings({
      currentEquipmentRates: { ...settings.currentEquipmentRates, inverters: next },
    });
  };

  if (editing) {
    return (
      <div className="flex items-center justify-end gap-1">
        <span className="text-[10px] text-text-muted">₹</span>
        <input
          autoFocus
          type="number"
          step="100"
          min="0"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false); }}
          onBlur={handleSave}
          className="w-20 px-1.5 py-0.5 rounded bg-background border border-accent/50 text-right text-xs font-mono text-text-primary outline-none"
        />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-end gap-1.5 group/rate">
      <div className="flex flex-col items-end">
        {isOverridden && (
          <span className="text-[9px] font-mono text-text-muted line-through">₹{formatRate(defaultRate)}</span>
        )}
        <span className={`text-xs font-mono font-semibold ${isOverridden ? 'text-warning' : 'text-accent'}`}>
          ₹{formatRate(currentRate)}
        </span>
      </div>
      <button
        onClick={() => { setEditValue(String(currentRate)); setEditing(true); }}
        className="p-0.5 rounded opacity-0 group-hover/rate:opacity-100 hover:bg-accent/10 text-text-muted hover:text-accent transition-all"
        title="Edit rate"
      >
        <Edit3 size={10} />
      </button>
      {isOverridden && (
        <button
          onClick={handleReset}
          className="p-0.5 rounded opacity-0 group-hover/rate:opacity-100 hover:bg-error/10 text-text-muted hover:text-error transition-all"
          title="Reset to default"
        >
          <RotateCcw size={10} />
        </button>
      )}
    </div>
  );
}

function BatteryRateCell({ brand }: { brand: BatteryBrand }) {
  const { settings, setSettings } = useSettings();
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  const dbBatteries = useCalculatorStore((s) => s.dbBatteries);
  const defaultBrand = dbBatteries.find((b) => b.id === brand.id);
  const defaultRate = defaultBrand?.rate ?? brand.rate;
  const currentRate = brand.rate;
  const isOverridden = settings.currentEquipmentRates.batteries[brand.id] !== undefined;

  const handleSave = () => {
    const val = parseFloat(editValue);
    if (!Number.isFinite(val) || val <= 0) {
      setEditing(false);
      return;
    }
    setSettings({
      currentEquipmentRates: {
        ...settings.currentEquipmentRates,
        batteries: { ...settings.currentEquipmentRates.batteries, [brand.id]: val },
      },
    });
    setEditing(false);
  };

  const handleReset = () => {
    const next = { ...settings.currentEquipmentRates.batteries };
    delete next[brand.id];
    setSettings({
      currentEquipmentRates: { ...settings.currentEquipmentRates, batteries: next },
    });
  };

  if (editing) {
    return (
      <div className="flex items-center justify-end gap-1">
        <span className="text-[10px] text-text-muted">₹</span>
        <input
          autoFocus
          type="number"
          step="100"
          min="0"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false); }}
          onBlur={handleSave}
          className="w-20 px-1.5 py-0.5 rounded bg-background border border-accent/50 text-right text-xs font-mono text-text-primary outline-none"
        />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-end gap-1.5 group/rate">
      <div className="flex flex-col items-end">
        {isOverridden && (
          <span className="text-[9px] font-mono text-text-muted line-through">₹{formatRate(defaultRate)}</span>
        )}
        <span className={`text-xs font-mono font-semibold ${isOverridden ? 'text-warning' : 'text-accent'}`}>
          ₹{formatRate(currentRate)}
        </span>
      </div>
      <button
        onClick={() => { setEditValue(String(currentRate)); setEditing(true); }}
        className="p-0.5 rounded opacity-0 group-hover/rate:opacity-100 hover:bg-accent/10 text-text-muted hover:text-accent transition-all"
        title="Edit rate"
      >
        <Edit3 size={10} />
      </button>
      {isOverridden && (
        <button
          onClick={handleReset}
          className="p-0.5 rounded opacity-0 group-hover/rate:opacity-100 hover:bg-error/10 text-text-muted hover:text-error transition-all"
          title="Reset to default"
        >
          <RotateCcw size={10} />
        </button>
      )}
    </div>
  );
}

function StructureConfigTable() {
  const dbStructures = useCalculatorStore((s) => s.dbStructures);
  const dbWeightLookups = useCalculatorStore((s) => s.dbWeightLookups);

  const selectedStructureId = useCalculatorStore((s) => s.selectedStructureId);
  const structurePricingMode = useCalculatorStore((s) => s.structurePricingMode);
  const structureRateOverride = useCalculatorStore((s) => s.structureRateOverride);
  const structureWastageOverride = useCalculatorStore((s) => s.structureWastageOverride);
  const structureFastenerOverride = useCalculatorStore((s) => s.structureFastenerOverride);
  const structureBaseWeightOverride = useCalculatorStore((s) => s.structureBaseWeightOverride);
  const structureWeightLookupKg = useCalculatorStore((s) => s.structureWeightLookupKg);
  const structureCustomRawRate = useCalculatorStore((s) => s.structureCustomRawRate);
  const structureCustomFabricationRate = useCalculatorStore((s) => s.structureCustomFabricationRate);
  const structureCustomGalvanizingRate = useCalculatorStore((s) => s.structureCustomGalvanizingRate);

  const setStructureSelection = useCalculatorStore((s) => s.setStructureSelection);
  const setStructureCustomField = useCalculatorStore((s) => s.setStructureCustomField);

  const currentSystemId = useCalculatorStore((s) => s.selectedSystemId);
  const dbSystems = useCalculatorStore((s) => s.dbSystems);
  
  // Resolve current system details (like capacity)
  const currentSystem = dbSystems.find(sys => sys.id === currentSystemId);
  const capacityKW = currentSystem?.capacityKW ?? 0;

  // Find selected standard structure
  const selectedStructure = useMemo(() => {
    return dbStructures.find((s: any) => s.id === selectedStructureId);
  }, [dbStructures, selectedStructureId]);

  // Find active weight lookup for standard structure
  const activeLookup = useMemo(() => {
    if (!selectedStructureId || selectedStructureId === 'custom' || !capacityKW) return null;
    return dbWeightLookups.find((l: any) => 
      l.structure_id === selectedStructureId &&
      capacityKW >= Number(l.capacity_kw_min) &&
      capacityKW <= Number(l.capacity_kw_max)
    );
  }, [dbWeightLookups, selectedStructureId, capacityKW]);

  const lookupWeight = useMemo(() => {
    if (selectedStructureId === 'custom') return structureWeightLookupKg ?? 0;
    return structureWeightLookupKg !== null
      ? structureWeightLookupKg
      : (activeLookup ? Number(activeLookup.total_weight_kg) : 0);
  }, [selectedStructureId, structureWeightLookupKg, activeLookup]);

  const baseWeight = useMemo(() => {
    if (selectedStructureId === 'custom') return structureBaseWeightOverride ?? 0;
    return structureBaseWeightOverride !== null
      ? structureBaseWeightOverride
      : (selectedStructure ? Number(selectedStructure.base_weight_kg ?? 0) : 0);
  }, [selectedStructureId, structureBaseWeightOverride, selectedStructure]);

  const wastage = useMemo(() => {
    if (selectedStructureId === 'custom') return structureWastageOverride ?? 0.05;
    return structureWastageOverride !== null
      ? structureWastageOverride
      : (selectedStructure ? Number(selectedStructure.wastage_pct ?? 0.05) : 0.05);
  }, [selectedStructureId, structureWastageOverride, selectedStructure]);

  const fasteners = useMemo(() => {
    if (selectedStructureId === 'custom') return structureFastenerOverride ?? 0.02;
    return structureFastenerOverride !== null
      ? structureFastenerOverride
      : (selectedStructure ? Number(selectedStructure.fastener_weight_pct ?? 0.02) : 0.02);
  }, [selectedStructureId, structureFastenerOverride, selectedStructure]);

  const ratePerKg = useMemo(() => {
    if (selectedStructureId === 'custom') {
      return (structureCustomRawRate ?? 0) + (structureCustomFabricationRate ?? 0) + (structureCustomGalvanizingRate ?? 0);
    }
    return selectedStructure
      ? Number(selectedStructure.rate_per_kg ?? (Number(selectedStructure.raw_material_rate ?? 0) + Number(selectedStructure.fabrication_rate ?? 0) + Number(selectedStructure.galvanizing_rate ?? 0)))
      : 0;
  }, [selectedStructureId, selectedStructure, structureCustomRawRate, structureCustomFabricationRate, structureCustomGalvanizingRate]);

  const finalWeight = (lookupWeight + baseWeight) * (1 + wastage) * (1 + fasteners);
  const totalCost = finalWeight * ratePerKg;

  return (
    <div className="space-y-6 p-1 text-xs">
      {/* ── Structure Selection ── */}
      <div className="space-y-3">
        <h4 className="text-xs uppercase font-bold text-text-secondary tracking-wider">Mounting Structure</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] text-text-muted uppercase mb-1 font-semibold">Select Model</label>
            <Select
              value={selectedStructureId || ''}
              onChange={(v) => setStructureSelection(v === '' ? null : v)}
              placeholder="None (Unselected)"
              options={[
                { value: '', label: 'None (Unselected)' },
                ...dbStructures.map((struct: any) => ({
                  value: struct.id,
                  label: `${struct.name} (${struct.material.replace('_', ' ')})`,
                })),
                { value: 'custom', label: 'Custom Structure' },
              ]}
            />
          </div>

          {selectedStructureId && (
            <div>
              <label className="block text-[10px] text-text-muted uppercase mb-1 font-semibold">Pricing Mode</label>
              <Select
                value={structurePricingMode}
                onChange={(v) => setStructureSelection(selectedStructureId, v as any)}
                options={[
                  { value: 'weight', label: 'Weight-based' },
                  { value: 'per_watt', label: 'Per-watt price' },
                  { value: 'flat', label: 'Flat price' },
                ]}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Custom Structure & Weight Details ── */}
      {selectedStructureId === 'custom' && structurePricingMode === 'weight' && (
        <div className="rounded-xl border border-accent/20 bg-accent-glow/5 p-4 space-y-4">
          <h5 className="text-[10px] uppercase font-bold text-accent tracking-widest">Custom Structure (Weight-based Parameters)</h5>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-[9px] text-text-muted mb-1 uppercase font-semibold">Raw Material Rate (₹/kg)</label>
              <input
                type="number"
                min="0"
                value={structureCustomRawRate ?? ''}
                placeholder="0"
                onChange={(e) => setStructureCustomField('structureCustomRawRate', parseFloat(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 rounded-md bg-background border border-border text-xs text-text-primary outline-none focus:border-accent font-mono"
              />
            </div>
            <div>
              <label className="block text-[9px] text-text-muted mb-1 uppercase font-semibold">Fabrication Rate (₹/kg)</label>
              <input
                type="number"
                min="0"
                value={structureCustomFabricationRate ?? ''}
                placeholder="0"
                onChange={(e) => setStructureCustomField('structureCustomFabricationRate', parseFloat(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 rounded-md bg-background border border-border text-xs text-text-primary outline-none focus:border-accent font-mono"
              />
            </div>
            <div>
              <label className="block text-[9px] text-text-muted mb-1 uppercase font-semibold">Galvanizing Rate (₹/kg)</label>
              <input
                type="number"
                min="0"
                value={structureCustomGalvanizingRate ?? ''}
                placeholder="0"
                onChange={(e) => setStructureCustomField('structureCustomGalvanizingRate', parseFloat(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 rounded-md bg-background border border-border text-xs text-text-primary outline-none focus:border-accent font-mono"
              />
            </div>
          </div>

          <div className="p-2.5 rounded bg-background/50 border border-border flex justify-between items-center text-[10px] font-mono">
            <span className="text-text-muted">Total Calculated Rate per kg:</span>
            <span className="text-accent font-bold">₹{((structureCustomRawRate ?? 0) + (structureCustomFabricationRate ?? 0) + (structureCustomGalvanizingRate ?? 0)).toFixed(2)} / kg</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-[9px] text-text-muted mb-1 uppercase font-semibold">Lookup Weight (kg)</label>
              <input
                type="number"
                min="0"
                value={structureWeightLookupKg ?? ''}
                placeholder="0"
                onChange={(e) => setStructureCustomField('structureWeightLookupKg', parseFloat(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 rounded-md bg-background border border-border text-xs text-text-primary outline-none focus:border-accent font-mono"
              />
            </div>
            <div>
              <label className="block text-[9px] text-text-muted mb-1 uppercase font-semibold">Base Weight (kg)</label>
              <input
                type="number"
                min="0"
                value={structureBaseWeightOverride ?? ''}
                placeholder="0"
                onChange={(e) => setStructureCustomField('structureBaseWeightOverride', parseFloat(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 rounded-md bg-background border border-border text-xs text-text-primary outline-none focus:border-accent font-mono"
              />
            </div>
            <div>
              <label className="block text-[9px] text-text-muted mb-1 uppercase font-semibold">Wastage %</label>
              <input
                type="number"
                min="0"
                max="100"
                value={structureWastageOverride !== null ? Math.round(structureWastageOverride * 100) : ''}
                placeholder="5"
                onChange={(e) => setStructureCustomField('structureWastageOverride', (parseFloat(e.target.value) || 0) / 100)}
                className="w-full px-2.5 py-1.5 rounded-md bg-background border border-border text-xs text-text-primary outline-none focus:border-accent font-mono"
              />
            </div>
            <div>
              <label className="block text-[9px] text-text-muted mb-1 uppercase font-semibold">Fasteners %</label>
              <input
                type="number"
                min="0"
                max="100"
                value={structureFastenerOverride !== null ? Math.round(structureFastenerOverride * 100) : ''}
                placeholder="2"
                onChange={(e) => setStructureCustomField('structureFastenerOverride', (parseFloat(e.target.value) || 0) / 100)}
                className="w-full px-2.5 py-1.5 rounded-md bg-background border border-border text-xs text-text-primary outline-none focus:border-accent font-mono"
              />
            </div>
          </div>
        </div>
      )}

      {selectedStructureId && selectedStructureId !== 'custom' && structurePricingMode === 'weight' && (
        <div className="rounded-xl border border-border bg-surface-hover/30 p-4 space-y-4">
          <h5 className="text-[10px] uppercase font-bold text-text-secondary tracking-widest">{selectedStructure?.name} Specs</h5>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-[10px] text-text-muted">
            <div>
              <span className="block font-semibold uppercase text-[8px] text-text-muted">Rates</span>
              <p className="font-mono text-text-primary mt-1">₹{Number(selectedStructure?.rate_per_kg).toFixed(2)}/kg</p>
            </div>
            <div>
              <span className="block font-semibold uppercase text-[8px] text-text-muted">Wastage Factor</span>
              <p className="font-mono text-text-primary mt-1">{(Number(selectedStructure?.wastage_pct) * 100).toFixed(0)}%</p>
            </div>
            <div>
              <span className="block font-semibold uppercase text-[8px] text-text-muted">Fasteners Factor</span>
              <p className="font-mono text-text-primary mt-1">{(Number(selectedStructure?.fastener_weight_pct) * 100).toFixed(0)}%</p>
            </div>
            <div>
              <span className="block font-semibold uppercase text-[8px] text-text-muted">Base Weight</span>
              <p className="font-mono text-text-primary mt-1">{selectedStructure?.base_weight_kg} kg</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[9px] text-text-muted mb-1 uppercase font-semibold">Resolved Capacity Weight Lookup (kg)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  disabled
                  value={activeLookup ? Number(activeLookup.total_weight_kg) : 0}
                  className="w-1/2 px-2.5 py-1.5 rounded-md bg-background/50 border border-border text-xs text-text-muted outline-none font-mono cursor-not-allowed"
                />
                <span className="text-[9.5px] text-text-muted">
                  {activeLookup ? `Found lookup for ${activeLookup.panel_qty} panels` : 'No lookup match for this capacity'}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-[9px] text-text-muted mb-1 uppercase font-semibold">Override Weight Lookup (kg)</label>
              <input
                type="number"
                min="0"
                value={structureWeightLookupKg ?? ''}
                placeholder="Use default lookup"
                onChange={(e) => setStructureCustomField('structureWeightLookupKg', e.target.value === '' ? null : parseFloat(e.target.value))}
                className="w-full px-2.5 py-1.5 rounded-md bg-background border border-border text-xs text-text-primary outline-none focus:border-accent font-mono"
              />
            </div>
          </div>
        </div>
      )}

      {selectedStructureId && structurePricingMode === 'weight' && (
        <div className="rounded-xl border border-accent/25 bg-accent-glow/5 p-4 space-y-3">
          <h5 className="text-[10px] uppercase font-bold text-accent tracking-widest">Weight Calculation Preview</h5>
          <div className="grid grid-cols-2 gap-4 text-xs font-mono">
            <div className="space-y-1.5 text-text-muted">
              <div>Lookup Weight:</div>
              <div>Base Weight:</div>
              <div>Wastage Factor:</div>
              <div>Fasteners Factor:</div>
              <div className="border-t border-border/60 pt-1.5 font-bold text-text-primary">Final Calculated Weight:</div>
              <div>Rate per kg:</div>
              <div className="border-t border-border/60 pt-1.5 font-bold text-text-primary">Total Structure Cost:</div>
            </div>
            <div className="space-y-1.5 text-right text-text-primary">
              <div>{lookupWeight.toFixed(1)} kg</div>
              <div>+ {baseWeight.toFixed(1)} kg</div>
              <div>+ {(wastage * 100).toFixed(0)}%</div>
              <div>+ {(fasteners * 100).toFixed(0)}%</div>
              <div className="border-t border-border/60 pt-1.5 font-bold text-accent">{finalWeight.toFixed(1)} kg</div>
              <div>₹{ratePerKg.toFixed(2)} / kg</div>
              <div className="border-t border-border/60 pt-1.5 font-bold text-accent">₹{Math.round(totalCost).toLocaleString('en-IN')}</div>
            </div>
          </div>
        </div>
      )}

      {selectedStructureId && structurePricingMode === 'per_watt' && (
        <div className="rounded-xl border border-border bg-surface-hover/30 p-4 space-y-3">
          <label className="block text-[10px] text-text-muted uppercase font-semibold">Rate per Watt Override (₹ / W)</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              step="0.1"
              min="0"
              value={structureRateOverride ?? ''}
              placeholder={selectedStructureId === 'custom' ? 'Enter rate per watt' : String(selectedStructure?.per_watt_rate ?? 0)}
              onChange={(e) => setStructureCustomField('structureRateOverride', e.target.value === '' ? null : parseFloat(e.target.value))}
              className="w-1/2 px-2.5 py-1.5 rounded-md bg-background border border-border text-xs text-text-primary outline-none focus:border-accent font-mono"
            />
            <span className="text-[10px] text-text-muted font-mono">
              Calculated Total Structure Cost: ₹{(capacityKW * 1000 * (structureRateOverride ?? (selectedStructure ? Number(selectedStructure.per_watt_rate) : 0))).toLocaleString('en-IN')}
            </span>
          </div>
        </div>
      )}

      {selectedStructureId && structurePricingMode === 'flat' && (
        <div className="rounded-xl border border-border bg-surface-hover/30 p-4 space-y-3">
          <label className="block text-[10px] text-text-muted uppercase font-semibold">Flat Price Override (₹)</label>
          <input
            type="number"
            step="100"
            min="0"
            value={structureRateOverride ?? ''}
            placeholder={selectedStructureId === 'custom' ? 'Enter flat price' : String(selectedStructure?.flat_rate ?? 0)}
            onChange={(e) => setStructureCustomField('structureRateOverride', e.target.value === '' ? null : parseFloat(e.target.value))}
            className="w-1/2 px-2.5 py-1.5 rounded-md bg-background border border-border text-xs text-text-primary outline-none focus:border-accent font-mono"
          />
        </div>
      )}

      {selectedStructure && (
        <div className="mt-6 border-t border-border pt-4">
          <EquipmentDetailCard
            title="Mounting Structure"
            brand="Standard Structure"
            model={selectedStructure.name}
            category="Mounting Gear"
            specs={[
              `Material: ${selectedStructure.material.replace('_', ' ')}`,
              `Roof mount: ${selectedStructure.roof_mount_type.replace('_', ' ')}`,
              `Elevation: ${selectedStructure.elevation_height_mm} mm`,
              `Weight rate: ₹${Number(selectedStructure.rate_per_kg).toFixed(2)}/kg`
            ]}
            gstPct={selectedStructure.gst_pct || 0.18}
            sellingPrice={totalCost}
            itemDescForInventory={`${selectedStructure.name} Structure (${selectedStructure.material || ''})`}
          />
        </div>
      )}

      {/* ── Structure BOM Components ── */}
      <StructureBOMPanel 
        structureId={selectedStructureId !== 'custom' ? selectedStructureId : null} 
        capacityKW={capacityKW}
      />

      {selectedStructureId === 'custom' && (
        <div className="mt-6 border-t border-border pt-4">
          <EquipmentDetailCard
            title="Custom Structure"
            brand="Custom"
            model="GI/GP Custom Build"
            category="Mounting Gear"
            specs={[
              `Pricing Mode: ${structurePricingMode}`,
              `Total Calculated Weight: ${finalWeight.toFixed(1)} kg`,
              `Custom Rate per kg: ₹${ratePerKg.toFixed(2)}/kg`
            ]}
            gstPct={0.18}
            sellingPrice={totalCost}
            itemDescForInventory="Custom Structure"
          />
        </div>
      )}

    </div>
  );
}

interface DetailCardProps {
  title: string;
  brand: string;
  model: string;
  category: string;
  specs: string[];
  gstPct: number;
  sellingPrice: number;
  description?: string;
  itemDescForInventory: string;
}

function EquipmentDetailCard({
  title,
  brand,
  model,
  category,
  specs,
  gstPct,
  sellingPrice,
  description,
  itemDescForInventory
}: DetailCardProps) {
  const showInventoryInfo = useCalculatorStore((s) => s.showInventoryInfo);
  const inventorySummary = useCalculatorStore((s) => s.inventorySummary) || [];
  
  const inv = inventorySummary.find((x: any) => x.item_description === itemDescForInventory);
  const currentStock = inv ? Number(inv.current_qty) : 0;
  const wac = inv ? Number(inv.weighted_avg_cost) : 0;
  
  const isAvailable = currentStock > 0;
  
  return (
    <div className="p-4 rounded-xl border border-border bg-surface-hover/30 shadow-md relative overflow-hidden transition-all duration-200 hover:border-accent/30 hover:shadow-lg hover:shadow-accent/2 flex flex-col gap-3">
      {/* Decorative accent glow */}
      <div className="absolute top-0 right-0 w-24 h-24 bg-accent/5 rounded-full blur-xl pointer-events-none" />
      
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="text-[10px] uppercase font-bold text-accent tracking-widest">{category}</span>
          <h4 className="text-sm font-bold text-text-primary mt-0.5">{brand} {model}</h4>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
          isAvailable ? 'bg-success/15 text-success border border-success/30' : 'bg-error/15 text-error border border-error/30'
        }`}>
          {isAvailable ? 'In Stock' : 'Out of Stock'}
        </span>
      </div>

      {description && (
        <p className="text-xs text-text-muted leading-relaxed italic">
          {description}
        </p>
      )}

      {/* Specs Grid */}
      <div className="grid grid-cols-2 gap-2 text-xs py-1 border-t border-b border-border/40">
        <div>
          <span className="block text-[9px] text-text-muted uppercase font-semibold">Specifications</span>
          <ul className="list-disc list-inside text-text-secondary mt-1 space-y-0.5">
            {specs.map((s, idx) => <li key={idx}>{s}</li>)}
          </ul>
        </div>
        <div>
          <span className="block text-[9px] text-text-muted uppercase font-semibold">Financials</span>
          <div className="mt-1 space-y-0.5 text-text-secondary">
            <div>Selling Price: <span className="font-semibold text-text-primary">₹{formatRate(sellingPrice)}</span></div>
            <div>GST Rate: <span className="font-semibold text-text-primary">{(gstPct * 100).toFixed(0)}%</span></div>
          </div>
        </div>
      </div>

      {/* Optional Inventory & Costing Block */}
      {showInventoryInfo && (
        <div className="rounded-lg bg-background/50 border border-border p-3 space-y-2 text-xs font-mono">
          <div className="flex justify-between items-center text-[9px] uppercase font-bold text-text-muted tracking-wider border-b border-border/30 pb-1.5">
            <span>ERP Inventory Details</span>
            <span className="text-accent">Live Status</span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-text-secondary">
            <div>Current Stock:</div>
            <div className="text-right text-text-primary font-bold">{currentStock.toLocaleString()} Nos</div>
            
            <div>Available Stock:</div>
            <div className="text-right text-text-primary font-bold">{currentStock.toLocaleString()} Nos</div>
            
            <div>Weighted Avg Cost (WAC):</div>
            <div className="text-right text-accent font-bold">₹{formatRate(wac)}</div>
            
            <div>Last Purchase Cost:</div>
            <div className="text-right text-accent font-bold">₹{formatRate(wac)}</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Structure BOM Panel ─────────────────────────────────────────────────────
// Shows itemized components for the selected mounting structure,
// grouped by category, with per-supplier rates.

function StructureBOMPanel({ structureId, capacityKW }: { structureId: string | null; capacityKW: number }) {
  const [expanded, setExpanded] = useState(false);
  const [addonsExpanded, setAddonsExpanded] = useState(false);

  const structureComponentMix = useCalculatorStore((s) => s.structureComponentMix);
  const structureAddonMix = useCalculatorStore((s) => s.structureAddonMix);
  const setStructureComponentQty = useCalculatorStore((s) => s.setStructureComponentQty);
  const setStructureAddonQty = useCalculatorStore((s) => s.setStructureAddonQty);

  const { data: components, isLoading } = useQuery<StructureComponent[]>({
    queryKey: ['structure-components', structureId],
    queryFn: async () => {
      if (!structureId) return [];
      const { data, error } = await (supabase as any)
        .from('eq_structure_components')
        .select('*')
        .eq('structure_id', structureId)
        .eq('is_active', true)
        .order('category')
        .order('name');
      if (error) return [];
      return (data || []) as StructureComponent[];
    },
    enabled: !!structureId,
  });

  const { data: bomQtyEntries } = useQuery<any[]>({
    queryKey: ['structure-bom-qtys', structureId],
    queryFn: async () => {
      if (!structureId) return [];
      const { data, error } = await (supabase as any)
        .from('eq_structure_bom')
        .select('*')
        .eq('structure_id', structureId);
      if (error) return [];
      return data || [];
    },
    enabled: !!structureId,
  });

  const { data: addons } = useQuery<StructureAddon[]>({
    queryKey: ['structure-addons'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('eq_structure_addons')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) return [];
      return (data || []) as StructureAddon[];
    },
  });

  if (!structureId) return null;
  if (isLoading) return (
    <div className="mt-4 p-3 rounded-lg border border-border bg-surface-hover/20 text-[10px] text-text-muted animate-pulse">
      Loading structure components…
    </div>
  );
  if (!components || components.length === 0) return null;

  return (
    <div className="mt-4 space-y-2">

      {/* ── BOM Components Collapsible ── */}
      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-hover/40 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Package2 size={13} className="text-accent" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">
              Structure BOM — Itemized Components
            </span>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-accent/10 text-accent font-bold border border-accent/20">
              {components.length} items
            </span>
          </div>
          {expanded ? <ChevronUp size={14} className="text-text-muted" /> : <ChevronDown size={14} className="text-text-muted" />}
        </button>

        {expanded && (
          <div className="px-4 pb-4 space-y-4 border-t border-border">
            {Object.entries(STRUCT_CATEGORY_META).map(([cat, meta]) => {
              const items = components.filter((c) => c.category === cat);
              if (items.length === 0) return null;
              return (
                <div key={cat} className="space-y-1.5">
                  {/* Category pill */}
                  <div
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider mt-3"
                    style={{ color: meta.color, background: meta.bg }}
                  >
                    {meta.icon}
                    {meta.label}
                  </div>

                  {/* Component rows */}
                  <div className="rounded-lg border border-border overflow-hidden">
                    <table className="w-full text-[10px] border-collapse">
                      <thead>
                        <tr className="bg-surface-hover text-text-muted border-b border-border text-[8px] uppercase font-bold tracking-wider">
                          <th className="p-2 text-left">Component</th>
                          <th className="p-2 text-center">Unit</th>
                          <th className="p-2 text-center w-36">Qty</th>
                          <th className="p-2 text-right">₹ Appolo</th>
                          <th className="p-2 text-right">₹ Tata</th>
                          <th className="p-2 text-right">₹ Deemac</th>
                          <th className="p-2 text-right font-bold" style={{ color: meta.color }}>Selling ₹</th>
                          <th className="p-2 text-right font-bold" style={{ color: meta.color }}>Total ₹</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((comp) => {
                          let bomEntry = bomQtyEntries?.find(b => 
                            b.component_id === comp.id && 
                            capacityKW >= Number(b.capacity_kw_min) && 
                            capacityKW <= Number(b.capacity_kw_max)
                          );
                          if (!bomEntry && bomQtyEntries && bomQtyEntries.length > 0) {
                            const sameCompBom = bomQtyEntries.filter(b => b.component_id === comp.id);
                            if (sameCompBom.length > 0) {
                              bomEntry = sameCompBom.reduce((prev, curr) => 
                                Math.abs(Number(curr.capacity_kw_min) - capacityKW) < Math.abs(Number(prev.capacity_kw_min) - capacityKW) ? curr : prev
                              );
                            }
                          }
                          const defaultQty = bomEntry ? Number(bomEntry.qty) : 0;
                          const overrideQty = structureComponentMix[comp.id];
                          const qty = overrideQty !== undefined ? overrideQty : defaultQty;
                          const isOverridden = overrideQty !== undefined;

                          return (
                            <tr key={comp.id} className="border-b border-border/30 hover:bg-surface-hover/20 transition-colors">
                              <td className="p-2 font-medium text-text-primary">{comp.name}</td>
                              <td className="p-2 text-center text-text-muted">{comp.unit}</td>
                              <td className="p-2" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    onClick={() => setStructureComponentQty(comp.id, Math.max(0, qty - 1))}
                                    className="p-1 rounded border border-border hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                                    title="Decrease qty"
                                  >
                                    <Minus size={11} />
                                  </button>
                                  <input
                                    type="number"
                                    min={0}
                                    value={qty === 0 ? '' : qty}
                                    onChange={(e) => {
                                      const val = parseFloat(e.target.value);
                                      setStructureComponentQty(comp.id, isNaN(val) ? 0 : val);
                                    }}
                                    className="w-14 px-2 py-1 rounded bg-background border border-border text-center text-xs font-mono text-text-primary outline-none focus:border-accent"
                                    placeholder="0"
                                  />
                                  <button
                                    onClick={() => setStructureComponentQty(comp.id, qty + 1)}
                                    className="p-1 rounded border border-border hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                                    title="Increase qty"
                                  >
                                    <Plus size={11} />
                                  </button>
                                  {isOverridden && (
                                    <button
                                      onClick={() => setStructureComponentQty(comp.id, null)}
                                      className="p-1 rounded hover:bg-warning/15 text-warning/70 hover:text-warning transition-colors cursor-pointer"
                                      title="Reset to default"
                                    >
                                      <RotateCcw size={11} />
                                    </button>
                                  )}
                                </div>
                              </td>
                              <td className="p-2 text-right font-mono">{comp.rate_appolo > 0 ? `₹${comp.rate_appolo}` : '—'}</td>
                              <td className="p-2 text-right font-mono">{comp.rate_tata > 0 ? `₹${comp.rate_tata}` : '—'}</td>
                              <td className="p-2 text-right font-mono">{comp.rate_deemac > 0 ? `₹${comp.rate_deemac}` : '—'}</td>
                              <td className="p-2 text-right font-mono font-bold" style={{ color: meta.color }}>₹{comp.selling_price}</td>
                              <td className="p-2 text-right font-mono font-bold text-text-primary">₹{formatRate(qty * comp.selling_price)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Add-ons: Walkway & Ladder ── */}
      {addons && addons.length > 0 && (
        <div className="rounded-xl border border-border bg-surface overflow-hidden">
          <button
            onClick={() => setAddonsExpanded((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-hover/40 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Milestone size={13} className="text-emerald-400" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">
                Structure Add-ons — Walkway & Ladder
              </span>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
                ₹/meter
              </span>
            </div>
            {addonsExpanded ? <ChevronUp size={14} className="text-text-muted" /> : <ChevronDown size={14} className="text-text-muted" />}
          </button>

          {addonsExpanded && (
            <div className="border-t border-border">
              <table className="w-full text-[10px] border-collapse">
                <thead>
                  <tr className="bg-surface-hover text-text-muted border-b border-border text-[8px] uppercase font-bold tracking-wider">
                    <th className="p-2.5 text-left">Add-on</th>
                    <th className="p-2.5 text-left">Material</th>
                    <th className="p-2.5 text-center">Unit</th>
                    <th className="p-2.5 text-right">Rate / Unit</th>
                    <th className="p-2.5 text-center">GST</th>
                    <th className="p-2.5 text-center w-36">Qty</th>
                    <th className="p-2.5 text-right">Total ₹</th>
                    <th className="p-2.5 text-left">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {addons.map((addon) => {
                    const qty = structureAddonMix[addon.id] ?? 0;
                    const isSelected = qty > 0;
                    return (
                      <tr key={addon.id} className={`border-b border-border/30 hover:bg-surface-hover/20 transition-colors ${isSelected ? 'bg-accent-glow/10' : ''}`}>
                        <td className="p-2.5 font-semibold text-text-primary">{addon.name}</td>
                        <td className="p-2.5 text-text-muted">{addon.material}</td>
                        <td className="p-2.5 text-center text-text-muted">{addon.unit}</td>
                        <td className="p-2.5 text-right font-mono font-bold text-emerald-400">₹{addon.rate_per_unit.toFixed(2)}</td>
                        <td className="p-2.5 text-center text-text-muted">{(addon.gst_pct * 100).toFixed(0)}%</td>
                        <td className="p-2.5" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => setStructureAddonQty(addon.id, Math.max(0, qty - 1))}
                              className="p-1 rounded border border-border hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                              title="Decrease qty"
                            >
                              <Minus size={11} />
                            </button>
                            <input
                              type="number"
                              min={0}
                              value={qty || ''}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                setStructureAddonQty(addon.id, isNaN(val) ? 0 : val);
                              }}
                              className="w-14 px-2 py-1 rounded bg-background border border-border text-center text-xs font-mono text-text-primary outline-none focus:border-accent"
                              placeholder="0"
                            />
                            <button
                              onClick={() => setStructureAddonQty(addon.id, qty + 1)}
                              className="p-1 rounded border border-border hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                              title="Increase qty"
                            >
                              <Plus size={11} />
                            </button>
                          </div>
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold text-text-primary">
                          {qty > 0 ? `₹${formatRate(qty * addon.rate_per_unit)}` : '—'}
                        </td>
                        <td className="p-2.5 text-text-muted text-[9px] max-w-[180px] truncate" title={addon.notes ?? ''}>{addon.notes ?? '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
