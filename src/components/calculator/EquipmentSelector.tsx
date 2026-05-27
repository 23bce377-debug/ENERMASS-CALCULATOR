'use client';

import { useState, useMemo } from 'react';
import { Check, X, Sun, Cpu, Battery, Plus, Minus, Edit3, RotateCcw } from 'lucide-react';
import { getActivePanelBrands, getActiveInverterBrands, getActiveBatteryBrands, PANEL_BRANDS, INVERTER_BRANDS, BATTERY_BRANDS } from '@/lib/data/masters';
import type { PanelBrand, InverterBrand, BatteryBrand } from '@/lib/data/masters';
import { useSettings } from '@/lib/hooks/useSettings';

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

type TabKey = 'panel' | 'inverter' | 'battery';

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'panel', label: 'Panels', icon: <Sun size={15} /> },
  { key: 'inverter', label: 'Inverters', icon: <Cpu size={15} /> },
  { key: 'battery', label: 'Batteries', icon: <Battery size={15} /> },
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

  const selectionCounts = useMemo(() => ({
    panel: selectedPanelQty > 0 ? selectedPanelQty : (selectedPanelId ? 1 : 0),
    inverter: Object.values(selectedInverterMix).reduce((sum, qty) => sum + (Number.isFinite(qty) ? qty : 0), 0),
    battery: Object.values(selectedBatteryMix).reduce((sum, qty) => sum + (Number.isFinite(qty) ? qty : 0), 0),
  }), [selectedPanelQty, selectedPanelId, selectedInverterMix, selectedBatteryMix]);

  const { settings, setSettings } = useSettings();

  const allPanels = useMemo(() => getActivePanelBrands(settings), [settings]);
  const allInverters = useMemo(() => getActiveInverterBrands(settings), [settings]);
  const allBatteries = useMemo(() => getActiveBatteryBrands(settings), [settings]);

  const selectedSolarWattage = useMemo(() => {
    const panelById = new Map(allPanels.map((panel) => [panel.id, panel]));
    return Object.entries(panelMix).reduce((sum, [panelId, qty]) => {
      const panel = panelById.get(panelId);
      if (!panel || !Number.isFinite(qty) || qty <= 0) return sum;
      return sum + panel.wattage * qty;
    }, 0);
  }, [allPanels, panelMix]);

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden" id="equipment-selector">
      {/* Tab bar */}
      <div className="flex border-b border-border">
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
              
              const defaultBrand = PANEL_BRANDS.find((p) => p.id === brand.id);
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
                      <select
                        value={customPanel.type}
                        onChange={(e) => setCustomPanel({ ...customPanel, type: e.target.value as PanelBrand['type'] })}
                        className="w-full px-2.5 py-2 rounded-md bg-background border border-border text-xs text-text-primary outline-none focus:border-accent"
                      >
                        <option value="Mono PERC">Mono PERC</option>
                        <option value="TOPCon">TOPCon</option>
                      </select>
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
                      <select className="w-24 px-2 py-1 rounded bg-background border border-border text-xs focus:border-accent focus:outline-none"
                        value={customInv.type} onChange={(e) => setCustomInv({ ...customInv, type: e.target.value as InverterBrand['type'] })}>
                        <option value="on-grid">On-Grid</option>
                        <option value="hybrid">Hybrid</option>
                        <option value="micro">Micro</option>
                      </select>
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
                      <select className="w-24 px-2 py-1 rounded bg-background border border-border text-xs focus:border-accent focus:outline-none"
                        value={customBat.chemistry} onChange={(e) => setCustomBat({ ...customBat, chemistry: e.target.value as BatteryBrand['chemistry'] })}>
                        <option value="LFP">LFP</option>
                        <option value="NMC">NMC</option>
                        <option value="Lead-Acid">Lead-Acid</option>
                      </select>
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

  const defaultBrand = PANEL_BRANDS.find((p) => p.id === brand.id);
  const defaultRatePerWatt = defaultBrand?.ratePerWatt ?? brand.ratePerWatt;
  const currentRatePerWatt = brand.ratePerWatt;
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

  const defaultBrand = INVERTER_BRANDS.find((i) => i.id === brand.id);
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

  const defaultBrand = BATTERY_BRANDS.find((b) => b.id === brand.id);
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
