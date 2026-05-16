/**
 * ENERMASS Solar Calculator — Zustand Store
 * ==========================================
 * Central state management with localStorage persistence.
 * Auto-recalculates on every state mutation that affects pricing.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { SYSTEMS, type BomItem, type SolarSystem } from '../data/bom';
import { MAX_VARIANTS, PANEL_BRANDS, INVERTER_BRANDS, BATTERY_BRANDS } from '../data/masters';

import {
  calculateSystem,
  type CalcResult,
  type RowOverride,
  type RateMaster,
  type AdditionalCost,
  type DiscountType,
  type ProjectType,
} from '../engine/calculator';

import {
  type Quote,
  type CustomerInfo,
  type AddressInfo,
  type SiteInfo,
  type SalesInfo,
  generateQuoteId,
} from '../types/quote';

// ─── Variant Type ───────────────────────────────────────────────────────────────

export interface Variant {
  id: string;
  name: string;
  systemId: string;
  overrides: Record<number, RowOverride>;
  customItems: BomItem[];
  targetMarginPct?: number;
  additionalCosts: AdditionalCost[];
  discountType: DiscountType;
  discountVal: number;
  selectedPanelId: string | null;
  panelMix: Record<string, number>;
  selectedInverterMix: Record<string, number>;
  selectedBatteryMix: Record<string, number>;
  backupLoadW: number;
  selectedState: string;
  projectType: ProjectType;
  rateMaster: RateMaster;
  createdAt: string;
  orientation: 'South' | 'East/West' | 'Flat';
  dcCableLengthM: number;
  acCableLengthM: number;
  electricityInflationRate: number;
}

// ─── State Interface ────────────────────────────────────────────────────────────

export interface CalculatorState {
  // Selection
  selectedSystemId: string | null;
  selectedState: string;
  projectType: ProjectType;

  // Config
  targetMarginPct: number | null;
  overrides: Record<number, RowOverride>;
  customItems: BomItem[];
  rateMaster: RateMaster;
  additionalCosts: AdditionalCost[];
  discountType: DiscountType;
  discountVal: number;

  // Equipment selections
  selectedPanelId: string | null;
  panelMix: Record<string, number>;
  selectedInverterMix: Record<string, number>;
  selectedBatteryMix: Record<string, number>;
  backupLoadW: number;

  // Engineering configs
  orientation: 'South' | 'East/West' | 'Flat';
  dcCableLengthM: number;
  acCableLengthM: number;
  electricityInflationRate: number;

  // Live result (recomputed on every change)
  calcResult: CalcResult | null;
  calcError: string | null;

  // Variants
  variants: Variant[];
  activeVariantId: string | null;

  // Quotes
  quotes: Quote[];
  activeQuoteId: string | null;

  // Actions
  selectSystem: (id: string) => void;
  setState: (state: string) => void;
  setProjectType: (type: ProjectType) => void;
  setMarginOverride: (pct: number | null) => void;
  setRowOverride: (index: number, override: Partial<RowOverride>) => void;
  clearRowOverride: (index: number) => void;
  addCustomItem: (item: BomItem) => void;
  removeCustomItem: (index: number) => void;
  setRateMaster: (desc: string, rate: number, active: boolean) => void;
  addAdditionalCost: (cost: Omit<AdditionalCost, 'id'>) => void;
  removeAdditionalCost: (id: string) => void;
  setDiscount: (type: DiscountType, val: number) => void;
  selectPanel: (id: string | null) => void;
  setPanelMixQty: (panelId: string, qty: number) => void;
  clearPanelMix: () => void;
  setInverterMixQty: (inverterId: string, qty: number) => void;
  clearInverterMix: () => void;
  setBatteryMixQty: (batteryId: string, qty: number) => void;
  clearBatteryMix: () => void;
  setBackupLoadW: (loadW: number) => void;
  setOrientation: (o: 'South' | 'East/West' | 'Flat') => void;
  setCableLengths: (dc: number, ac: number) => void;
  setElectricityInflationRate: (rate: number) => void;
  recalculate: () => void;
  saveVariant: (name: string) => void;
  loadVariant: (id: string) => void;
  saveQuote: (info: {
    customer: CustomerInfo;
    address: AddressInfo;
    site: SiteInfo;
    sales: SalesInfo;
  }) => Quote;
  loadQuote: (quoteId: string) => void;
  duplicateQuote: (quoteId: string) => void;
  reset: () => void;
}

// ─── Initial State ──────────────────────────────────────────────────────────────

const INITIAL_STATE = {
  selectedSystemId: null as string | null,
  selectedState: 'Gujarat',
  projectType: 'residential' as ProjectType,

  targetMarginPct: null as number | null,
  overrides: {} as Record<number, RowOverride>,
  customItems: [] as BomItem[],
  rateMaster: {} as RateMaster,
  additionalCosts: [] as AdditionalCost[],
  discountType: 'none' as DiscountType,
  discountVal: 0,

  selectedPanelId: null as string | null,
  panelMix: {} as Record<string, number>,
  selectedInverterMix: {} as Record<string, number>,
  selectedBatteryMix: {} as Record<string, number>,
  backupLoadW: 1000,

  orientation: 'South' as 'South' | 'East/West' | 'Flat',
  dcCableLengthM: 15,
  acCableLengthM: 10,
  electricityInflationRate: 0.04,

  calcResult: null as CalcResult | null,
  calcError: null as string | null,

  variants: [] as Variant[],
  activeVariantId: null as string | null,

  quotes: [] as Quote[],
  activeQuoteId: null as string | null,
};

// ─── Helpers ────────────────────────────────────────────────────────────────────

/** Generate a short random ID for internal entities */
function randomId(): string {
  return Math.random().toString(36).substring(2, 10);
}

function getCustomSystemsFromSettings(): SolarSystem[] {
  if (typeof window === 'undefined') return [];
  try {
    const rawSettings = window.localStorage.getItem('enermass-settings');
    if (!rawSettings) return [];
    const parsed = JSON.parse(rawSettings) as { customSystems?: SolarSystem[] };
    return Array.isArray(parsed.customSystems) ? parsed.customSystems : [];
  } catch {
    return [];
  }
}

function getAllSystemsFromSettings(): SolarSystem[] {
  return [...SYSTEMS, ...getCustomSystemsFromSettings()];
}

function normalizeMixEntries(selectionMix: Record<string, number>): Array<[string, number]> {
  return Object.entries(selectionMix).filter(([, qty]) => Number.isFinite(qty) && qty > 0);
}

function aggregateSelectionMix<T extends { id: string; rate: number }>(
  selectionMix: Record<string, number>,
  items: T[],
): { totalQty: number; weightedRate?: number } {
  const entries = normalizeMixEntries(selectionMix);
  if (entries.length === 0) {
    return { totalQty: 0 };
  }

  let totalQty = 0;
  let totalRate = 0;
  for (const [id, qty] of entries) {
    const item = items.find((entry) => entry.id === id);
    if (!item) continue;
    totalQty += qty;
    totalRate += item.rate * qty;
  }

  if (totalQty === 0) {
    return { totalQty: 0 };
  }

  return {
    totalQty,
    weightedRate: totalRate / totalQty,
  };
}



/**
 * Run the calculation engine with current state.
 * Returns { result, error } — exactly one will be non-null.
 */
function runCalculation(state: CalculatorState): {
  result: CalcResult | null;
  error: string | null;
} {
  if (!state.selectedSystemId) {
    return { result: null, error: null };
  }

  try {
    // Use statically imported brand lookups to resolve equipment rates
    
    let allPanels = [...PANEL_BRANDS];
    let allInverters = [...INVERTER_BRANDS];
    let allBatteries = [...BATTERY_BRANDS];
    let customSystems: SolarSystem[] = [];
    let gridTariffPerKWh: number | undefined;

    if (typeof window !== 'undefined') {
      try {
        const rawSettings = window.localStorage.getItem('enermass-settings');
        if (rawSettings) {
          const settings = JSON.parse(rawSettings);
          if (settings.customPanels) allPanels.push(...settings.customPanels);
          if (settings.customInverters) allInverters.push(...settings.customInverters);
          if (settings.customBatteries) allBatteries.push(...settings.customBatteries);
          if (Array.isArray(settings.customSystems)) customSystems = settings.customSystems;
          if (typeof settings.defaultGridTariff === 'number' && settings.defaultGridTariff >= 0) {
            gridTariffPerKWh = settings.defaultGridTariff;
          }
        }
      } catch (e) {}
    }

    let panelRateOverride: number | undefined;
    let panelQtyOverride: number | undefined;
    let inverterRateOverride: number | undefined;
    let inverterQtyOverride: number | undefined;
    let batteryRateOverride: number | undefined;
    let batteryQtyOverride: number | undefined;

    const panelMixEntries = Object.entries(state.panelMix).filter(
      ([, qty]) => Number.isFinite(qty) && qty > 0,
    );

    if (panelMixEntries.length > 0) {
      let totalQty = 0;
      let weightedPanelRateTotal = 0;

      for (const [panelId, qty] of panelMixEntries) {
        const panel = allPanels.find((p) => p.id === panelId);
        if (!panel) continue;
        totalQty += qty;
        weightedPanelRateTotal += panel.ratePerWatt * panel.wattage * qty;
      }

      if (totalQty > 0) {
        panelRateOverride = weightedPanelRateTotal / totalQty;
        panelQtyOverride = totalQty;
      }
    } else if (state.selectedPanelId) {
      const panel = allPanels.find((p) => p.id === state.selectedPanelId);
      if (panel) {
        // Panel rate in BOM is per-unit (per panel), so: ratePerWatt × wattage
        panelRateOverride = panel.ratePerWatt * panel.wattage;
      }
    }

    const inverterMix = aggregateSelectionMix(state.selectedInverterMix, allInverters as Array<{ id: string; rate: number }>);
    if (inverterMix.totalQty > 0 && inverterMix.weightedRate !== undefined) {
      inverterRateOverride = inverterMix.weightedRate;
      inverterQtyOverride = inverterMix.totalQty;
    }

    const batteryMix = aggregateSelectionMix(state.selectedBatteryMix, allBatteries as Array<{ id: string; rate: number }>);
    if (batteryMix.totalQty > 0 && batteryMix.weightedRate !== undefined) {
      batteryRateOverride = batteryMix.weightedRate;
      batteryQtyOverride = batteryMix.totalQty;
    }

    // Determine accurate panel and inverter capacity for clipping & subsidies
    const system = [...SYSTEMS, ...customSystems].find(s => s.id === state.selectedSystemId);
    let panelCapacityKW = system?.capacityKW ?? 0;
    let panelDegradationRate = 0.005;
    if (panelMixEntries.length > 0) {
      panelCapacityKW = 0;
      let isTopCon = false;
      for (const [panelId, qty] of panelMixEntries) {
        const p = allPanels.find(x => x.id === panelId);
        if (p) {
          panelCapacityKW += (p.wattage * qty) / 1000;
          if ('type' in p && p.type === 'TOPCon') isTopCon = true;
        }
      }
      panelDegradationRate = isTopCon ? 0.004 : 0.0055;
    } else if (state.selectedPanelId) {
      const p = allPanels.find(x => x.id === state.selectedPanelId);
      const qty = system?.panelQty ?? 0;
      if (p) {
        panelCapacityKW = (p.wattage * qty) / 1000;
        panelDegradationRate = ('type' in p && p.type === 'TOPCon') ? 0.004 : 0.0055;
      }
    }

    let inverterCapacityKW: number | undefined;
    const inverterMixEntries = Object.entries(state.selectedInverterMix).filter(([, q]) => Number.isFinite(q) && q > 0);
    if (inverterMixEntries.length > 0) {
      inverterCapacityKW = 0;
      for (const [invId, qty] of inverterMixEntries) {
        const inv = allInverters.find(x => x.id === invId);
        if (inv) inverterCapacityKW += inv.capacityKW * qty;
      }
    }

    const result = calculateSystem({
      systemId: state.selectedSystemId,
      systems: [...SYSTEMS, ...customSystems],
      state: state.selectedState,
      projectType: state.projectType,
      targetMarginPct: state.targetMarginPct ?? undefined,
      overrides: state.overrides,
      rateMaster: state.rateMaster,
      discountType: state.discountType,
      discountVal: state.discountVal,
      additionalCosts: state.additionalCosts,
      panelRateOverride,
      panelQtyOverride,
      inverterRateOverride,
      inverterQtyOverride,
      batteryRateOverride,
      batteryQtyOverride,
      gridTariffPerKWh,
      orientation: state.orientation,
      dcCableLengthM: state.dcCableLengthM,
      acCableLengthM: state.acCableLengthM,
      electricityInflationRate: state.electricityInflationRate,
      panelCapacityKW,
      inverterCapacityKW,
      panelDegradationRate,
    });

    return { result, error: null };
  } catch (err) {
    return {
      result: null,
      error: err instanceof Error ? err.message : 'Unknown calculation error',
    };
  }
}

// ─── Store ──────────────────────────────────────────────────────────────────────

export const useCalculatorStore = create<CalculatorState>()(
  persist(
    (set, get) => ({
      ...INITIAL_STATE,

      // ── System Selection ──────────────────────────────────────────────

      selectSystem: (id: string) => {
        let allPanels = [...PANEL_BRANDS];
        let allInverters = [...INVERTER_BRANDS];
        let allBatteries = [...BATTERY_BRANDS];
        let customSystems: SolarSystem[] = [];

        if (typeof window !== 'undefined') {
          try {
            const rawSettings = window.localStorage.getItem('enermass-settings');
            if (rawSettings) {
              const settings = JSON.parse(rawSettings);
              if (settings.customPanels) allPanels.push(...settings.customPanels);
              if (settings.customInverters) allInverters.push(...settings.customInverters);
              if (settings.customBatteries) allBatteries.push(...settings.customBatteries);
              if (Array.isArray(settings.customSystems)) customSystems = settings.customSystems;
            }
          } catch (e) {}
        }

        const systems = [...SYSTEMS, ...customSystems];
        const system = systems.find((s: SolarSystem) => s.id === id);

        if (system && system.defaultEquipment) {
          set({
            selectedSystemId: id,
            selectedPanelId: null,
            panelMix: system.defaultEquipment.panelMix ?? {},
            selectedInverterMix: system.defaultEquipment.inverterMix ?? {},
            selectedBatteryMix: system.defaultEquipment.batteryMix ?? {},
            overrides: {}, // Clear previous overrides when a preset is selected
          });
          get().recalculate();
          return;
        }

        // Build default panel mix
        const newPanelMix: Record<string, number> = {};
        let newSelectedPanelId: string | null = null;

        if (system) {
          // Find a panel matching the system's default wattage
          const matchingPanel = allPanels.find(
            (p: { wattage: number }) => p.wattage === system.panelWattage,
          );
          if (matchingPanel) {
            newPanelMix[matchingPanel.id] = system.panelQty;
            newSelectedPanelId = matchingPanel.id;
          }
        }

        // Build default inverter mix from BOM
        const newInverterMix: Record<string, number> = {};
        if (system) {
          const inverterBomLine = system.items.find(
            (item: BomItem) => item.description.toUpperCase() === 'INVERTER',
          );
          if (inverterBomLine && inverterBomLine.qty > 0) {
            // Find an inverter that roughly matches the system capacity
            const solarCapacityKW = system.capacityKW;
            // Sort inverters by proximity to ideal DC/AC ratio (1.2:1)
            const idealInverterKW = solarCapacityKW / 1.2;
            const sorted = [...allInverters]
              .filter((inv: { type: string }) => inv.type !== 'micro')
              .sort(
                (a: { capacityKW: number }, b: { capacityKW: number }) =>
                  Math.abs(a.capacityKW - idealInverterKW) -
                  Math.abs(b.capacityKW - idealInverterKW),
              );
            if (sorted.length > 0) {
              const bestMatch = sorted[0] as { id: string; capacityKW: number };
              const qtyNeeded = Math.max(
                1,
                Math.ceil(solarCapacityKW / (bestMatch.capacityKW * 1.3)),
              );
              newInverterMix[bestMatch.id] = qtyNeeded;
            }
          }
        }

        // Build default battery mix from BOM (only for hybrid systems)
        const newBatteryMix: Record<string, number> = {};
        if (system) {
          const batteryBomLine = system.items.find(
            (item: BomItem) => item.description.toUpperCase() === 'BATTERY',
          );
          if (batteryBomLine && batteryBomLine.qty > 0 && allBatteries.length > 0) {
            // Pick first available battery
            const defaultBattery = allBatteries[0] as { id: string };
            newBatteryMix[defaultBattery.id] = batteryBomLine.qty;
          }
        }

        set({
          selectedSystemId: id,
          overrides: {},
          panelMix: newPanelMix,
          selectedPanelId: newSelectedPanelId,
          selectedInverterMix: newInverterMix,
          selectedBatteryMix: newBatteryMix,
          activeVariantId: null,
        });
        get().recalculate();
      },

      // ── State & Project Type ──────────────────────────────────────────

      setState: (state: string) => {
        set({ selectedState: state });
        get().recalculate();
      },

      setProjectType: (type: ProjectType) => {
        set({ projectType: type });
        get().recalculate();
      },

      // ── Margin ────────────────────────────────────────────────────────

      setMarginOverride: (pct: number | null) => {
        set({ targetMarginPct: pct });
        get().recalculate();
      },

      // ── Row Overrides ─────────────────────────────────────────────────

      setRowOverride: (index: number, override: Partial<RowOverride>) => {
        const current = get().overrides;
        const existing = current[index] ?? {};
        set({
          overrides: {
            ...current,
            [index]: { ...existing, ...override },
          },
        });
        get().recalculate();
      },

      clearRowOverride: (index: number) => {
        const current = { ...get().overrides };
        delete current[index];
        set({ overrides: current });
        get().recalculate();
      },

      addCustomItem: (item: BomItem) => {
        set({ customItems: [...get().customItems, item] });
        get().recalculate();
      },

      removeCustomItem: (index: number) => {
        set({ customItems: get().customItems.filter((_, i) => i !== index) });
        get().recalculate();
      },

      // ── Rate Master ───────────────────────────────────────────────────

      setRateMaster: (desc: string, rate: number, active: boolean) => {
        const current = get().rateMaster;
        set({
          rateMaster: {
            ...current,
            [desc]: { rate, active },
          },
        });
        get().recalculate();
      },

      // ── Additional Costs ──────────────────────────────────────────────

      addAdditionalCost: (cost: Omit<AdditionalCost, 'id'>) => {
        const newCost: AdditionalCost = { ...cost, id: randomId() };
        set({ additionalCosts: [...get().additionalCosts, newCost] });
        get().recalculate();
      },

      removeAdditionalCost: (id: string) => {
        set({
          additionalCosts: get().additionalCosts.filter((c) => c.id !== id),
        });
        get().recalculate();
      },

      // ── Discount ──────────────────────────────────────────────────────

      setDiscount: (type: DiscountType, val: number) => {
        set({ discountType: type, discountVal: val });
        get().recalculate();
      },

      // ── Equipment Selections ──────────────────────────────────────────

      selectPanel: (id: string | null) => {
        set({ selectedPanelId: id, panelMix: {} });
        get().recalculate();
      },

      setPanelMixQty: (panelId: string, qty: number) => {
        const safeQty = Math.max(0, Math.floor(Number.isFinite(qty) ? qty : 0));
        const nextMix = { ...get().panelMix };

        if (safeQty === 0) {
          delete nextMix[panelId];
        } else {
          nextMix[panelId] = safeQty;
        }

        const firstSelectedPanelId = Object.keys(nextMix)[0] ?? null;
        set({ panelMix: nextMix, selectedPanelId: firstSelectedPanelId });
        get().recalculate();
      },

      clearPanelMix: () => {
        set({ panelMix: {}, selectedPanelId: null });
        get().recalculate();
      },

      setInverterMixQty: (inverterId: string, qty: number) => {
        const safeQty = Math.max(0, Math.floor(Number.isFinite(qty) ? qty : 0));
        const nextMix = { ...get().selectedInverterMix };

        if (safeQty === 0) {
          delete nextMix[inverterId];
        } else {
          nextMix[inverterId] = safeQty;
        }

        set({ selectedInverterMix: nextMix });
        get().recalculate();
      },

      clearInverterMix: () => {
        set({ selectedInverterMix: {} });
        get().recalculate();
      },

      setBatteryMixQty: (batteryId: string, qty: number) => {
        const safeQty = Math.max(0, Math.floor(Number.isFinite(qty) ? qty : 0));
        const nextMix = { ...get().selectedBatteryMix };

        if (safeQty === 0) {
          delete nextMix[batteryId];
        } else {
          nextMix[batteryId] = safeQty;
        }

        set({ selectedBatteryMix: nextMix });
        get().recalculate();
      },

      clearBatteryMix: () => {
        set({ selectedBatteryMix: {} });
        get().recalculate();
      },

      setBackupLoadW: (loadW: number) => {
        set({ backupLoadW: Math.max(0, Math.floor(Number.isFinite(loadW) ? loadW : 0)) });
      },

      setOrientation: (o: 'South' | 'East/West' | 'Flat') => {
        set({ orientation: o });
        get().recalculate();
      },

      setCableLengths: (dc: number, ac: number) => {
        set({ 
          dcCableLengthM: Math.max(0, dc), 
          acCableLengthM: Math.max(0, ac) 
        });
        get().recalculate();
      },

      setElectricityInflationRate: (rate: number) => {
        set({ electricityInflationRate: Math.max(0, rate) });
        get().recalculate();
      },

      // ── Recalculate ───────────────────────────────────────────────────

      recalculate: () => {
        const state = get();
        const { result, error } = runCalculation(state);
        set({ calcResult: result, calcError: error });
      },

      // ── Variants ──────────────────────────────────────────────────────

      saveVariant: (name: string) => {
        const state = get();
        if (!state.selectedSystemId) return;

        if (state.variants.length >= MAX_VARIANTS) {
          console.warn(`Maximum variants (${MAX_VARIANTS}) reached.`);
          return;
        }

        const variant: Variant = {
          id: randomId(),
          name,
          systemId: state.selectedSystemId,
          overrides: { ...state.overrides },
          customItems: [...state.customItems],
          targetMarginPct: state.targetMarginPct ?? undefined,
          additionalCosts: [...state.additionalCosts],
          discountType: state.discountType,
          discountVal: state.discountVal,
          selectedPanelId: state.selectedPanelId,
          panelMix: { ...state.panelMix },
          selectedInverterMix: { ...state.selectedInverterMix },
          selectedBatteryMix: { ...state.selectedBatteryMix },
          backupLoadW: state.backupLoadW,
          selectedState: state.selectedState,
          projectType: state.projectType,
          rateMaster: { ...state.rateMaster },
          createdAt: new Date().toISOString(),
          orientation: state.orientation,
          dcCableLengthM: state.dcCableLengthM,
          acCableLengthM: state.acCableLengthM,
          electricityInflationRate: state.electricityInflationRate,
        };

        set({
          variants: [...state.variants, variant],
          activeVariantId: variant.id,
        });
      },

      loadVariant: (id: string) => {
        const variant = get().variants.find((v) => v.id === id);
        if (!variant) return;

        set({
          selectedSystemId: variant.systemId,
          overrides: { ...variant.overrides },
          customItems: [...variant.customItems],
          targetMarginPct: variant.targetMarginPct ?? null,
          additionalCosts: [...variant.additionalCosts],
          discountType: variant.discountType,
          discountVal: variant.discountVal,
          selectedPanelId: variant.selectedPanelId,
          panelMix: { ...variant.panelMix },
          selectedInverterMix: { ...variant.selectedInverterMix },
          selectedBatteryMix: { ...variant.selectedBatteryMix },
          backupLoadW: variant.backupLoadW,
          selectedState: variant.selectedState,
          projectType: variant.projectType,
          rateMaster: { ...variant.rateMaster },
          activeVariantId: id,
          orientation: variant.orientation ?? 'South',
          dcCableLengthM: variant.dcCableLengthM ?? 15,
          acCableLengthM: variant.acCableLengthM ?? 10,
          electricityInflationRate: variant.electricityInflationRate ?? 0.04,
        });
        get().recalculate();
      },

      // ── Quotes ────────────────────────────────────────────────────────

      saveQuote: (info: {
        customer: CustomerInfo;
        address: AddressInfo;
        site: SiteInfo;
        sales: SalesInfo;
      }): Quote => {
        const state = get();

        if (!state.selectedSystemId || !state.calcResult) {
          throw new Error('Cannot save quote: no system selected or calculation missing.');
        }

        // Resolve system metadata
        const system = getAllSystemsFromSettings().find((s) => s.id === state.selectedSystemId);
        if (!system) {
          throw new Error(`System not found: "${state.selectedSystemId}"`);
        }

        const now = new Date().toISOString();
        const panelMixEntries = Object.entries(state.panelMix)
          .filter(([, qty]) => Number.isFinite(qty) && qty > 0)
          .map(([panelBrandId, qty]) => ({ panelBrandId, qty }));

        const inverterMixEntries = normalizeMixEntries(state.selectedInverterMix).map(([inverterBrandId, qty]) => ({ inverterBrandId, qty }));
        const batteryMixEntries = normalizeMixEntries(state.selectedBatteryMix).map(([batteryBrandId, qty]) => ({ batteryBrandId, qty }));

        const quote: Quote = {
          quoteId: generateQuoteId(),
          date: now.split('T')[0],
          projectType: state.projectType,

          customer: info.customer,
          address: info.address,
          site: info.site,
          sales: info.sales,

          systemId: state.selectedSystemId,
          systemName: system.name,
          category: system.category,
          selectedState: state.selectedState,

          equipment: {
            panelBrandId:
              panelMixEntries.length === 1
                ? panelMixEntries[0].panelBrandId
                : state.selectedPanelId ?? undefined,
            panelMix: panelMixEntries.length > 0 ? panelMixEntries : undefined,
            inverterBrandId: inverterMixEntries.length === 1 ? inverterMixEntries[0].inverterBrandId : undefined,
            inverterMix: inverterMixEntries.length > 0 ? inverterMixEntries : undefined,
            batteryBrandId: batteryMixEntries.length === 1 ? batteryMixEntries[0].batteryBrandId : undefined,
            batteryMix: batteryMixEntries.length > 0 ? batteryMixEntries : undefined,
            // Rates are resolved from the current calcResult snapshot
            panelRate: undefined,
            inverterRate: undefined,
            batteryRate: undefined,
          },

          additionalCosts: [...state.additionalCosts],
          discountType: state.discountType,
          discountVal: state.discountVal,
          overrides: { ...state.overrides },
          customItems: [...state.customItems],
          targetMarginPct: state.targetMarginPct ?? undefined,

          calculations: { ...state.calcResult },

          status: 'Draft',
          statusHistory: [{ status: 'Draft', changedAt: now }],
          createdAt: now,
          updatedAt: now,
        };

        if (state.activeQuoteId) {
          const oldQuote = state.quotes.find((q) => q.quoteId === state.activeQuoteId);
          if (oldQuote) {
            quote.quoteId = state.activeQuoteId;
            quote.createdAt = oldQuote.createdAt;
            quote.status = oldQuote.status;
            quote.statusHistory = oldQuote.statusHistory;
            set({
              quotes: state.quotes.map((q) => (q.quoteId === state.activeQuoteId ? quote : q)),
              activeQuoteId: quote.quoteId,
            });
          } else {
            set({ quotes: [...state.quotes, quote], activeQuoteId: quote.quoteId });
          }
        } else {
          set({ quotes: [...state.quotes, quote], activeQuoteId: quote.quoteId });
        }
        
        return quote;
      },

      loadQuote: (quoteId: string) => {
        const quote = get().quotes.find((q) => q.quoteId === quoteId);
        if (!quote) return;

        const quotePanelMix = Object.fromEntries(
          (quote.equipment.panelMix ?? []).map((entry) => [entry.panelBrandId, entry.qty]),
        );
        const fallbackSelectedPanelId = Object.keys(quotePanelMix)[0] ?? quote.equipment.panelBrandId ?? null;
        const quoteInverterMix = Object.fromEntries(
          (quote.equipment.inverterMix ?? (quote.equipment.inverterBrandId ? [{ inverterBrandId: quote.equipment.inverterBrandId, qty: 1 }] : []))
            .map((entry) => [entry.inverterBrandId, entry.qty]),
        );
        const quoteBatteryMix = Object.fromEntries(
          (quote.equipment.batteryMix ?? (quote.equipment.batteryBrandId ? [{ batteryBrandId: quote.equipment.batteryBrandId, qty: 1 }] : []))
            .map((entry) => [entry.batteryBrandId, entry.qty]),
        );

        set({
          selectedSystemId: quote.systemId,
          selectedState: quote.selectedState,
          projectType: quote.projectType,
          targetMarginPct: quote.targetMarginPct ?? null,
          overrides: { ...quote.overrides },
          customItems: [...(quote.customItems ?? [])],
          additionalCosts: [...quote.additionalCosts],
          discountType: quote.discountType,
          discountVal: quote.discountVal,
          selectedPanelId: fallbackSelectedPanelId,
          panelMix: quotePanelMix,
          selectedInverterMix: quoteInverterMix,
          selectedBatteryMix: quoteBatteryMix,
          activeVariantId: null,
          activeQuoteId: quoteId,
        });
        get().recalculate();
      },

      duplicateQuote: (quoteId: string) => {
        const quote = get().quotes.find((q) => q.quoteId === quoteId);
        if (!quote) return;
        // Load the quote's config into calculator state, then clear activeQuoteId
        // so saving creates a NEW quote instead of overwriting the original.
        get().loadQuote(quoteId);
        // Clear activeQuoteId synchronously — loadQuote already called recalculate()
        set({ activeQuoteId: null });
      },

      // ── Reset ─────────────────────────────────────────────────────────

      reset: () => {
        // Preserve quotes across resets — they are historical records
        const { quotes } = get();
        set({ ...INITIAL_STATE, quotes });
        // Clear stale calculation results
        set({ calcResult: null, calcError: null });
      },
    }),
    {
      name: 'enermass-calc-state',
      // Only persist data fields, not functions
      partialize: (state) => ({
        selectedSystemId: state.selectedSystemId,
        selectedState: state.selectedState,
        projectType: state.projectType,
        targetMarginPct: state.targetMarginPct,
        overrides: state.overrides,
        rateMaster: state.rateMaster,
        additionalCosts: state.additionalCosts,
        discountType: state.discountType,
        discountVal: state.discountVal,
        selectedPanelId: state.selectedPanelId,
        panelMix: state.panelMix,
        selectedInverterMix: state.selectedInverterMix,
        selectedBatteryMix: state.selectedBatteryMix,
        backupLoadW: state.backupLoadW,
        customItems: state.customItems,
        variants: state.variants,
        activeVariantId: state.activeVariantId,
        activeQuoteId: state.activeQuoteId,
        quotes: state.quotes,
      }),
      // After rehydration, recalculate to restore live result
      onRehydrateStorage: () => {
        return (state) => {
          if (state) {
            state.recalculate();
          }
        };
      },
    },
  ),
);
