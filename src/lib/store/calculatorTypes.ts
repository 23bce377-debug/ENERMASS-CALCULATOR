import { SYSTEMS, type BomItem, type SolarSystem } from '../data/bom';
import {
  MAX_VARIANTS,
  type PanelBrand,
  type InverterBrand,
  type BatteryBrand,
} from '../data/masters';
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

export interface Variant {
  id: string;
  name: string;
  systemId: string;
  overrides: Record<number, RowOverride>;
  customItems: BomItem[];
  disabledItemIndices?: Record<number, boolean>;
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
  disabledItemIndices: Record<number, boolean>;
  additionalCosts: AdditionalCost[];
  discountType: DiscountType;
  discountVal: number;

  // Equipment selections
  selectedPanelId: string | null;
  panelMix: Record<string, number>;
  selectedInverterMix: Record<string, number>;
  selectedBatteryMix: Record<string, number>;
  backupLoadW: number;

  // Structure & Meter & LA selections
  selectedStructureId: string | null;
  structurePricingMode: 'weight' | 'per_watt' | 'flat';
  structureRateOverride: number | null;
  structureWastageOverride: number | null;
  structureFastenerOverride: number | null;
  structureBaseWeightOverride: number | null;
  structureWeightLookupKg: number | null;
  structureCustomRawRate: number | null;
  structureCustomFabricationRate: number | null;
  structureCustomGalvanizingRate: number | null;

  solarMeterId: string | null;
  solarMeterQty: number;
  netMeterId: string | null;
  netMeterQty: number;

  lightningArresterId: string | null;
  lightningArresterQty: number;

  gstOnOutputOverride: number | null;
  targetMRPInclGST: number | null;
  targetMRPPerWatt: number | null;

  structureComponentMix: Record<string, number>;
  structureAddonMix: Record<string, number>;

  // Engineering configs
  orientation: 'South' | 'East/West' | 'Flat';
  dcCableLengthM: number;
  acCableLengthM: number;
  electricityInflationRate: number;

  // Live result (recomputed on every state mutation)
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
  toggleItemSelection: (index: number) => void;
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

  setStructureSelection: (id: string | null, mode?: 'weight' | 'per_watt' | 'flat') => void;
  setStructureCustomField: (field: string, val: number | null) => void;
  setStructureComponentQty: (id: string, qty: number | null) => void;
  setStructureAddonQty: (id: string, qty: number) => void;
  clearStructureMix: () => void;
  setMeterSelection: (type: 'solar' | 'net', id: string | null, qty?: number) => void;
  setLASelection: (id: string | null, qty?: number) => void;
  setGSTOnOutputOverride: (val: number | null) => void;
  setTargetMRP: (val: number | null, type?: 'total' | 'per_watt') => void;

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
  }, forceOverwrite?: boolean) => Promise<Quote>;
  loadQuote: (quoteId: string) => void;
  duplicateQuote: (quoteId: string) => void;
  reset: () => void;

  // Database integrations
  dbSystems: SolarSystem[];
  dbStateData: Record<string, any>;
  dbPanels: any[];
  dbInverters: any[];
  dbBatteries: any[];
  dbSlabs: any[];
  dbStructures: any[];
  dbWeightLookups: any[];
  dbMeters: any[];
  dbLAs: any[];
  dbStructureParts: any[];
  dbStructureComponents: any[];
  dbStructureBom: any[];
  dbStructureAddons: any[];
  dbOrientationMultipliers: Record<string, number>;
  inventorySummary: import('@/backend/orm/acquisition').InventorySummary[];
  dbLoaded: boolean;
  rpcSubsidyAmount: number | null;
  showInventoryInfo: boolean;
  setShowInventoryInfo: (val: boolean) => void;
  fetchRpcSubsidy: () => Promise<void>;
  fetchMasterData: () => Promise<void>;
}

export const INITIAL_STATE = {
  showInventoryInfo: true,
  inventorySummary: [] as import('@/backend/orm/acquisition').InventorySummary[],
  selectedSystemId: null as string | null,
  selectedState: '' as string,
  projectType: 'residential' as ProjectType,

  targetMarginPct: null as number | null,
  overrides: {} as Record<number, RowOverride>,
  customItems: [] as BomItem[],
  rateMaster: {} as RateMaster,
  disabledItemIndices: {} as Record<number, boolean>,
  additionalCosts: [] as AdditionalCost[],
  discountType: 'none' as DiscountType,
  discountVal: 0,

  selectedPanelId: null as string | null,
  panelMix: {} as Record<string, number>,
  selectedInverterMix: {} as Record<string, number>,
  selectedBatteryMix: {} as Record<string, number>,
  backupLoadW: 0,

  selectedStructureId: null as string | null,
  structurePricingMode: 'weight' as 'weight' | 'per_watt' | 'flat',
  structureRateOverride: null as number | null,
  structureWastageOverride: null as number | null,
  structureFastenerOverride: null as number | null,
  structureBaseWeightOverride: null as number | null,
  structureWeightLookupKg: null as number | null,
  structureCustomRawRate: null as number | null,
  structureCustomFabricationRate: null as number | null,
  structureCustomGalvanizingRate: null as number | null,

  solarMeterId: null as string | null,
  solarMeterQty: 1,
  netMeterId: null as string | null,
  netMeterQty: 1,

  lightningArresterId: null as string | null,
  lightningArresterQty: 1,

  gstOnOutputOverride: null as number | null,
  targetMRPInclGST: null as number | null,
  targetMRPPerWatt: null as number | null,

  structureComponentMix: {} as Record<string, number>,
  structureAddonMix: {} as Record<string, number>,

  orientation: 'South' as 'South' | 'East/West' | 'Flat',
  dcCableLengthM: 0,
  acCableLengthM: 0,
  electricityInflationRate: 0,

  calcResult: null as CalcResult | null,
  calcError: null as string | null,

  variants: [] as Variant[],
  activeVariantId: null as string | null,

  quotes: [] as Quote[],
  activeQuoteId: null as string | null,

  // Database integrations
  dbSystems: [] as SolarSystem[],
  dbStateData: {} as Record<string, any>,
  dbPanels: [] as any[],
  dbInverters: [] as any[],
  dbBatteries: [] as any[],
  dbSlabs: [] as any[],
  dbStructures: [] as any[],
  dbWeightLookups: [] as any[],
  dbMeters: [] as any[],
  dbLAs: [] as any[],
  dbStructureParts: [] as any[],
  dbStructureComponents: [] as any[],
  dbStructureBom: [] as any[],
  dbStructureAddons: [] as any[],
  dbOrientationMultipliers: { South: 1.0, 'East/West': 0.85, Flat: 0.90 } as Record<string, number>,
  dbLoaded: false,
  rpcSubsidyAmount: null as number | null,
};

export function randomId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 8; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

export function getCustomSystemsFromSettings(): SolarSystem[] {
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

export function getAllSystemsFromSettings(dbLoaded: boolean, dbSystems: SolarSystem[]): SolarSystem[] {
  if (dbLoaded && dbSystems.length > 0) {
    return [...dbSystems, ...getCustomSystemsFromSettings()];
  }
  return getCustomSystemsFromSettings();
}

export function getEquipmentCatalogsFromSettings(dbLoaded: boolean, dbPanels: any[], dbInverters: any[], dbBatteries: any[]): {
  panels: any[];
  inverters: any[];
  batteries: any[];
} {
  if (dbLoaded && dbPanels.length > 0) {
    return {
      panels: dbPanels,
      inverters: dbInverters,
      batteries: dbBatteries,
    };
  }
  return { panels: [], inverters: [], batteries: [] };
}

export function normalizeMixEntries(selectionMix: Record<string, number>): Array<[string, number]> {
  return Object.entries(selectionMix).filter(([, qty]) => Number.isFinite(qty) && qty > 0);
}

export function aggregateSelectionMix<T extends { id: string; rate: number }>(
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

export function runCalculation(state: CalculatorState): {
  result: CalcResult | null;
  error: string | null;
} {
  if (!state.selectedSystemId) {
    return { result: null, error: null };
  }

  try {
    const { panels: allPanels, inverters: allInverters, batteries: allBatteries } = getEquipmentCatalogsFromSettings(
      state.dbLoaded,
      state.dbPanels,
      state.dbInverters,
      state.dbBatteries
    );
    let customSystems: SolarSystem[] = [];
    let gridTariffPerKWh: number | undefined;

    if (typeof window !== 'undefined') {
      try {
        const rawSettings = window.localStorage.getItem('enermass-settings');
        if (rawSettings) {
          const settings = JSON.parse(rawSettings);
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

    const systems = state.dbLoaded ? state.dbSystems : [...SYSTEMS, ...customSystems];
    const system = systems.find(s => s.id === state.selectedSystemId);
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
      systems: state.dbLoaded ? state.dbSystems : [...SYSTEMS, ...customSystems],
      state: state.selectedState,
      projectType: state.projectType,
      targetMarginPct: state.targetMarginPct ?? undefined,
      overrides: state.overrides,
      rateMaster: state.rateMaster,
      disabledItemIndices: state.disabledItemIndices,
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
      stateData: state.dbLoaded ? state.dbStateData : undefined,
      slabs: state.dbLoaded ? state.dbSlabs : undefined,
      structureId: state.selectedStructureId ?? undefined,
      structurePricingMode: state.structurePricingMode,
      structureRateOverride: state.structureRateOverride ?? undefined,
      structureWastageOverride: state.structureWastageOverride ?? undefined,
      structureFastenerOverride: state.structureFastenerOverride ?? undefined,
      structureBaseWeightOverride: state.structureBaseWeightOverride ?? undefined,
      structureWeightLookupKg: state.structureWeightLookupKg ?? undefined,
      structureCustomRawRate: state.structureCustomRawRate ?? undefined,
      structureCustomFabricationRate: state.structureCustomFabricationRate ?? undefined,
      structureCustomGalvanizingRate: state.structureCustomGalvanizingRate ?? undefined,
      structureComponentMix: state.structureComponentMix,
      structureAddonMix: state.structureAddonMix,
      solarMeterId: state.solarMeterId ?? undefined,
      solarMeterQty: state.solarMeterQty,
      netMeterId: state.netMeterId ?? undefined,
      netMeterQty: state.netMeterQty,
      lightningArresterId: state.lightningArresterId ?? undefined,
      lightningArresterQty: state.lightningArresterQty,
      dbStructures: state.dbStructures,
      dbWeightLookups: state.dbWeightLookups,
      dbMeters: state.dbMeters,
      dbLAs: state.dbLAs,
      dbStructureParts: state.dbStructureParts,
      dbStructureComponents: state.dbStructureComponents,
      dbStructureBom: state.dbStructureBom,
      dbStructureAddons: state.dbStructureAddons,
      dbOrientationMultipliers: state.dbOrientationMultipliers,
      gstOnOutputOverride: state.gstOnOutputOverride ?? undefined,
      targetMRPInclGST: state.targetMRPInclGST ?? undefined,
      targetMRPPerWatt: state.targetMRPPerWatt ?? undefined,
      rpcSubsidyAmount: state.rpcSubsidyAmount ?? undefined,
    });

    return { result, error: null };
  } catch (err) {
    return {
      result: null,
      error: err instanceof Error ? err.message : 'Unknown calculation error',
    };
  }
}
