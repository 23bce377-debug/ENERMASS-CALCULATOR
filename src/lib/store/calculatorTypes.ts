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
  type MarginMode,
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

import { type StructureType } from '../structures/structureConfig';

export interface Variant {
  id: string;
  name: string;
  systemId: string;
  overrides: Record<number, RowOverride>;
  customItems: BomItem[];
  disabledItemIndices?: Record<number, boolean>;
  marginMode?: MarginMode;
  targetMarginPct?: number;
  targetMarginAmount?: number;
  additionalCosts: AdditionalCost[];
  discountType: DiscountType;
  discountVal: number;
  roundOffToThousand: boolean;
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
  applySubsidy?: boolean;
}

// ─── Domain Sub-Interfaces ─────────────────────────────────────────────────────
// Each slice file (calculationStore, equipmentStore, etc.) should only read/write
// fields from its own domain interface. CalculatorState is the composed union
// that Zustand sees — consumers remain fully backward-compatible.

/** Owned by calculationStore.ts */
export interface CalcSliceState {
  // Selection
  selectedSystemId: string | null;
  selectedState: string;
  projectType: ProjectType;

  // Pricing overrides
  itcEligible: boolean;
  marginMode: MarginMode;
  targetMarginPct: number | null;
  targetMarginAmount: number | null;
  gstOnOutputOverride: number | null;
  targetMRPInclGST: number | null;
  targetMRPPerWatt: number | null;

  // BOM overrides
  overrides: Record<number, RowOverride>;
  customItems: BomItem[];
  rateMaster: RateMaster;
  disabledItemIndices: Record<number, boolean>;
  additionalCosts: AdditionalCost[];
  discountType: DiscountType;
  discountVal: number;
  roundOffToThousand: boolean;

  // Engineering
  orientation: 'South' | 'East/West' | 'Flat';
  dcCableLengthM: number;
  acCableLengthM: number;
  electricityInflationRate: number;

  // Live result
  calcResult: CalcResult | null;
  calcError: string | null;

  // Actions
  selectSystem: (id: string) => void;
  setState: (state: string) => void;
  setProjectType: (type: ProjectType) => void;
  setItcEligible: (eligible: boolean) => void;
  setMarginMode: (mode: MarginMode) => void;
  setMarginOverride: (pct: number | null) => void;
  setMarginAmountOverride: (amount: number | null) => void;
  setRowOverride: (index: number, override: Partial<RowOverride>) => void;
  clearRowOverride: (index: number) => void;
  addCustomItem: (item: BomItem) => void;
  removeCustomItem: (index: number) => void;
  setRateMaster: (desc: string, rate: number, active: boolean) => void;
  toggleItemSelection: (index: number) => void;
  addAdditionalCost: (cost: Omit<AdditionalCost, 'id'>) => void;
  removeAdditionalCost: (id: string) => void;
  setDiscount: (type: DiscountType, val: number) => void;
  setRoundOffToThousand: (val: boolean) => void;
  setGSTOnOutputOverride: (val: number | null) => void;
  setTargetMRP: (val: number | null, type?: 'total' | 'per_watt') => void;
  setOrientation: (o: 'South' | 'East/West' | 'Flat') => void;
  setCableLengths: (dc: number, ac: number) => void;
  setElectricityInflationRate: (rate: number) => void;
  recalculate: () => void;
  reset: () => void;
}

/** Owned by equipmentStore.ts */
export interface EquipmentSliceState {
  // Equipment selections
  selectedPanelId: string | null;
  panelMix: Record<string, number>;
  selectedInverterMix: Record<string, number>;
  selectedBatteryMix: Record<string, number>;
  backupLoadW: number;

  // Structure
  selectedStructureId: string | null;
  structureType: StructureType;
  structureVendorId: string | null;
  structureMaterialType: 'GI' | 'GP' | null;
  walkwayLengthM: number;
  ladderLengthM: number;
  structurePricingMode: 'weight' | 'per_watt' | 'flat';
  structureRateOverride: number | null;
  structureWastageOverride: number | null;
  structureFastenerOverride: number | null;
  structureBaseWeightOverride: number | null;
  structureElevationOverride: number | null;
  structureWeightLookupKg: number | null;
  structureCustomRawRate: number | null;
  structureCustomFabricationRate: number | null;
  structureCustomGalvanizingRate: number | null;
  structureComponentMix: Record<string, number>;
  structureAddonMix: Record<string, number>;

  // Accessories
  solarMeterId: string | null;
  solarMeterQty: number;
  netMeterId: string | null;
  netMeterQty: number;
  lightningArresterId: string | null;
  lightningArresterQty: number;

  // Actions
  selectPanel: (id: string | null) => void;
  setPanelMixQty: (panelId: string, qty: number) => void;
  clearPanelMix: () => void;
  setInverterMixQty: (inverterId: string, qty: number) => void;
  clearInverterMix: () => void;
  setBatteryMixQty: (batteryId: string, qty: number) => void;
  clearBatteryMix: () => void;
  setBackupLoadW: (loadW: number) => void;
  setStructureType: (type: StructureType) => void;
  setStructureSelection: (id: string | null, mode?: 'weight' | 'per_watt' | 'flat') => void;
  setStructureTypeAndVendor: (materialType: 'GI' | 'GP' | null, vendorId: string | null) => void;
  setWalkwayLength: (length: number) => void;
  setLadderLength: (length: number) => void;
  setStructureCustomField: (field: string, val: number | null) => void;
  setStructureComponentQty: (id: string, qty: number | null) => void;
  setStructureAddonQty: (id: string, qty: number) => void;
  clearStructureMix: () => void;
  setMeterSelection: (type: 'solar' | 'net', id: string | null, qty?: number) => void;
  setLASelection: (id: string | null, qty?: number) => void;
}

/** Owned by projectStore.ts / calculationStore.ts — DB cache */
export interface DbCacheSliceState {
  dbSystems: SolarSystem[];
  dbStateData: Record<string, any>;
  /** systemId → [stateName...]. Empty/absent = global preset (shown for all states). */
  dbSystemStateMap: Record<string, string[]>;
  /** stateName → ordered T&C clauses. Key '__default__' holds the global default. */
  dbStateTerms: Record<string, string[]>;
  dbPanels: any[];
  dbInverters: any[];
  dbBatteries: any[];
  dbSchemes: any[];
  dbSchemeOverrides: any[];
  dbSlabs: any[];
  dbStructures: any[];
  dbStructureVendors: any[];
  dbStructureAccessoryRates: any[];
  dbStructureMaterialRates: any[];
  dbStructureTemplates: any[];
  dbStructureTemplateItems: any[];
  dbWalkwayTemplates: any[];
  dbLadderTemplates: any[];
  dbWeightLookups: any[];
  dbMeters: any[];
  dbLAs: any[];
  dbStructureParts: any[];
  dbStructureComponents: any[];
  dbStructureComponentMasters: any[];
  dbStructureBom: any[];
  dbStructureAddons: any[];
  dbOrientationMultipliers: Record<string, number>;
  dbTaxHsnCodes: any[];
  dbTaxGstRates: any[];
  inventorySummary: import('@/backend/orm/acquisition').InventorySummary[];
  dbLoaded: boolean;
  setOfflineData: (data: Partial<CalculatorState>) => void;
  fetchMasterData: () => Promise<void>;
}

/** Owned by subsidyStore.ts */
export interface SubsidySliceState {
  applySubsidy: boolean;
  rpcSubsidyAmount: number | null;
  selectedScheme: 'none' | 'pm_suryaghar' | 'state';
  selectedSubsidySchemeId: string | null;
  dbActiveScheme: any | null;
  setApplySubsidy: (val: boolean) => void;
  setSelectedScheme: (val: 'none' | 'pm_suryaghar' | 'state') => void;
  setSelectedSubsidySchemeId: (id: string | null) => void;
  fetchRpcSubsidy: () => Promise<void>;
}

/** Owned by quoteStore.ts */
export interface QuoteSliceState {
  quotes: Quote[];
  activeQuoteId: string | null;
  saveQuote: (info: {
    customer: CustomerInfo;
    address: AddressInfo;
    site: SiteInfo;
    sales: SalesInfo;
    validationAcknowledged?: string[];
    leadId?: string | null;
    company_cin?: string;
    company_gstin?: string;
    company_pan?: string;
    company_phone?: string;
    company_email?: string;
    company_website?: string;
    company_address?: string;
    ceo_name?: string;
    ceo_designation?: string;
    ceo_signature_url?: string;
    sales_exec_role?: string;
    sales_exec_phone?: string;
    sales_exec_email?: string;
    sales_exec_id?: string | null;
    bank_account_holder?: string;
    bank_name?: string;
    bank_account_no?: string;
    bank_ifsc?: string;
    bank_upi_id?: string;
    terms_json?: string[];
    why_solar_json?: any;
  }, forceOverwrite?: boolean) => Promise<Quote>;
  loadQuote: (quoteId: string) => void;
  duplicateQuote: (quoteId: string) => void;
}

/** UI & variant state */
export interface UISliceState {
  showInventoryInfo: boolean;
  setShowInventoryInfo: (val: boolean) => void;
  selectedGoalWattage: number | null;
  setSelectedGoalWattage: (w: number | null) => void;

  // Variants
  variants: Variant[];
  activeVariantId: string | null;
  saveVariant: (name: string) => void;
  loadVariant: (id: string) => void;
  deleteVariant: (id: string) => void;
  duplicateVariant: (id: string) => void;
}

// ─── Composed State ────────────────────────────────────────────────────────────
// CalculatorState is the union of all domain slices. Zustand's `create<CalculatorState>()`
// sees a single flat object while each slice file enforces its own boundary.
export interface CalculatorState
  extends CalcSliceState,
    EquipmentSliceState,
    DbCacheSliceState,
    SubsidySliceState,
    QuoteSliceState,
    UISliceState {}


export const INITIAL_STATE = {
  selectedGoalWattage: null as number | null,
  inventorySummary: [] as import('@/backend/orm/acquisition').InventorySummary[],
  selectedSystemId: '3kw-ongrid' as string | null,

  selectedState: 'Kerala' as string,
  projectType: 'residential' as ProjectType,
  itcEligible: false as boolean,

  targetMarginPct: null as number | null,
  marginMode: 'percent' as MarginMode,
  targetMarginAmount: null as number | null,
  overrides: {} as Record<number, RowOverride>,
  customItems: [] as BomItem[],
  rateMaster: {} as RateMaster,
  disabledItemIndices: {} as Record<number, boolean>,
  additionalCosts: [] as AdditionalCost[],
  discountType: 'none' as DiscountType,
  discountVal: 0,
  roundOffToThousand: false,

  selectedPanelId: null as string | null,
  panelMix: {} as Record<string, number>,
  selectedInverterMix: {} as Record<string, number>,
  selectedBatteryMix: {} as Record<string, number>,
  backupLoadW: 0,

  selectedStructureId: null as string | null,
  structureType: 'rcc_roof_elevated' as StructureType,
  structureVendorId: null as string | null,
  structureMaterialType: null as 'GI' | 'GP' | null,
  walkwayLengthM: 0,
  ladderLengthM: 0,
  structurePricingMode: 'weight' as 'weight' | 'per_watt' | 'flat',
  structureRateOverride: null as number | null,
  structureWastageOverride: null as number | null,
  structureFastenerOverride: null as number | null,
  structureBaseWeightOverride: null as number | null,
  structureElevationOverride: null as number | null,
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

  showInventoryInfo: false,

  variants: [] as Variant[],
  activeVariantId: null as string | null,

  quotes: [] as Quote[],
  activeQuoteId: null as string | null,

  // Database integrations
  dbSystems: [] as SolarSystem[],
  dbStateData: {} as Record<string, any>,
  dbSystemStateMap: {} as Record<string, string[]>,
  dbStateTerms: {} as Record<string, string[]>,
  dbPanels: [] as any[],
  dbInverters: [] as any[],
  dbBatteries: [] as any[],
  dbSchemes: [] as any[],
  dbSchemeOverrides: [] as any[],
  dbSlabs: [] as any[],
  dbStructures: [] as any[],
  dbStructureVendors: [] as any[],
  dbStructureAccessoryRates: [] as any[],
  dbStructureMaterialRates: [] as any[],
  dbStructureTemplates: [] as any[],
  dbStructureTemplateItems: [] as any[],
  dbWalkwayTemplates: [] as any[],
  dbLadderTemplates: [] as any[],
  dbWeightLookups: [] as any[],
  dbMeters: [] as any[],
  dbLAs: [] as any[],
  dbStructureParts: [] as any[],
  dbStructureComponents: [] as any[],
  dbStructureComponentMasters: [] as any[],
  dbStructureBom: [] as any[],
  dbStructureAddons: [] as any[],
  dbOrientationMultipliers: { South: 1.0, 'East/West': 0.85, Flat: 0.90 } as Record<string, number>,
  dbTaxHsnCodes: [] as any[],
  dbTaxGstRates: [] as any[],
  dbLoaded: false,
  rpcSubsidyAmount: null as number | null,
  applySubsidy: true,
  selectedScheme: 'pm_suryaghar',
  selectedSubsidySchemeId: null as string | null,
  dbActiveScheme: null as any | null,
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
  let customPanels: any[] = [];
  let customInverters: any[] = [];
  let customBatteries: any[] = [];

  if (typeof window !== 'undefined') {
    try {
      const rawSettings = window.localStorage.getItem('enermass-settings');
      if (rawSettings) {
        const settings = JSON.parse(rawSettings);
        if (Array.isArray(settings.customPanels)) customPanels = settings.customPanels;
        if (Array.isArray(settings.customInverters)) customInverters = settings.customInverters;
        if (Array.isArray(settings.customBatteries)) customBatteries = settings.customBatteries;
      }
    } catch (e) {}
  }

  const basePanels = dbLoaded && dbPanels.length > 0 ? dbPanels : [];
  const baseInverters = dbLoaded && dbInverters.length > 0 ? dbInverters : [];
  const baseBatteries = dbLoaded && dbBatteries.length > 0 ? dbBatteries : [];

  return {
    panels: [...basePanels, ...customPanels],
    inverters: [...baseInverters, ...customInverters],
    batteries: [...baseBatteries, ...customBatteries],
  };
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

function selectedStateId(state: Pick<CalculatorState, 'dbStateData' | 'selectedState'>) {
  return Object.values(state.dbStateData).find((entry: any) => entry?.name === state.selectedState)?.id ?? null;
}

function isCentralSubsidyScheme(scheme: any) {
  const text = `${scheme?.code ?? ''} ${scheme?.name ?? ''}`.toLowerCase();
  return text.includes('pm_surya') || text.includes('pm surya') || text.includes('mnre') || text.includes('central');
}

export function getEligibleSubsidySchemes(state: Pick<CalculatorState,
  'dbSchemes' | 'dbSchemeOverrides' | 'dbStateData' | 'selectedState' | 'projectType'
>) {
  const stateId = selectedStateId(state as CalculatorState);
  const activeOverrides = (state.dbSchemeOverrides ?? []).filter((override: any) => override?.is_active !== false);

  return (state.dbSchemes ?? [])
    .filter((scheme: any) => scheme?.is_active !== false && scheme?.applies_to === state.projectType)
    .filter((scheme: any) => {
      if (isCentralSubsidyScheme(scheme)) return true;
      const schemeOverrides = activeOverrides.filter((override: any) => override.scheme_id === scheme.id);
      if (schemeOverrides.length === 0) return true;
      return stateId ? schemeOverrides.some((override: any) => override.state_id === stateId) : false;
    });
}

export function resolveSelectedSubsidyScheme(state: CalculatorState) {
  if (!state.applySubsidy || state.projectType === 'commercial') {
    return { scheme: null as any, slabs: [] as any[], override: null as any };
  }

  const eligibleSchemes = getEligibleSubsidySchemes(state);
  const scheme = eligibleSchemes.find((item: any) => item.id === state.selectedSubsidySchemeId)
    ?? eligibleSchemes[0]
    ?? null;
  if (!scheme) return { scheme: null as any, slabs: [] as any[], override: null as any };

  const stateId = selectedStateId(state);
  const override = stateId
    ? (state.dbSchemeOverrides ?? []).find((item: any) =>
        item.scheme_id === scheme.id && item.state_id === stateId && item.is_active !== false
      ) ?? null
    : null;
  const slabs = (state.dbSlabs ?? [])
    .filter((item: any) => item.scheme_id === scheme.id)
    .sort((a: any, b: any) => Number(a.slab_index ?? 0) - Number(b.slab_index ?? 0))
    .map((item: any) => ({
      ...item,
      start_kw: Number(item.start_kw),
      end_kw: item.end_kw !== null && item.end_kw !== undefined ? Number(item.end_kw) : null,
      rate_per_kw: Number(item.rate_per_kw),
      is_fixed_amount: Boolean(item.is_fixed_amount),
      fixed_amount: item.fixed_amount !== null && item.fixed_amount !== undefined ? Number(item.fixed_amount) : null,
    }));

  return { scheme, slabs, override };
}

export function runCalculation(state: CalculatorState): {
  result: CalcResult | null;
  error: string | null;
} {
  try {
    const resolvedSubsidy = resolveSelectedSubsidyScheme(state);
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

    // Resolve systemId: use selected, or fall back to first available system
    const systems = state.dbLoaded ? state.dbSystems : [...SYSTEMS, ...customSystems];
    let resolvedSystemId = state.selectedSystemId
      ?? (systems.length > 0 ? systems[0].id : null);

    // If the system ID is stale/invalid, fall back to the first available system
    let system = systems.find(s => s.id === resolvedSystemId);
    if (!system && systems.length > 0) {
      system = systems[0];
      resolvedSystemId = system.id;
    }

    // If there are truly no systems available at all, we can't calculate
    if (!resolvedSystemId || !system) {
      return { result: null, error: null };
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

    let panelCapacityKW = system.capacityKW ?? 0;
    let panelDegradationRate = 0.005;
    
    // Default to system capacity, we will only override if we find valid panels
    let customPanelCapacityKW = 0;
    let foundCustomPanels = false;

    if (panelMixEntries.length > 0) {
      let weightedDegradationSum = 0;
      for (const [panelId, qty] of panelMixEntries) {
        const p = allPanels.find(x => x.id === panelId);
        if (p) {
          foundCustomPanels = true;
          const capKW = (p.wattage * qty) / 1000;
          customPanelCapacityKW += capKW;
          const deg = ('type' in p && p.type === 'TOPCon') ? 0.004 : 0.0055;
          weightedDegradationSum += deg * capKW;
        }
      }
      if (foundCustomPanels && customPanelCapacityKW > 0) {
        panelCapacityKW = customPanelCapacityKW;
        panelDegradationRate = weightedDegradationSum / customPanelCapacityKW;
      }
    } else if (state.selectedPanelId) {
      const p = allPanels.find(x => x.id === state.selectedPanelId);
      // Dynamically compute qty if system.panelQty is missing but capacityKW is known
      let qty = system?.panelQty ?? 0;
      if (qty === 0 && system?.items) {
        const panelItem = system.items.find((item: any) => item.description.toUpperCase() === 'PANEL');
        qty = panelItem?.qty ?? 0;
      }
      if (qty === 0 && system?.capacityKW && p) {
        qty = Math.ceil((system.capacityKW * 1000) / p.wattage);
      }
      
      if (p && qty > 0) {
        panelCapacityKW = (p.wattage * qty) / 1000;
        panelDegradationRate = ('type' in p && p.type === 'TOPCon') ? 0.004 : 0.0055;
      }
    }

    let inverterCapacityKW: number | undefined;
    const inverterMixEntries = Object.entries(state.selectedInverterMix).filter(([, q]) => Number.isFinite(q) && q > 0);
    
    let customInverterCapacityKW = 0;
    let foundCustomInverters = false;
    
    if (inverterMixEntries.length > 0) {
      for (const [invId, qty] of inverterMixEntries) {
        const inv = allInverters.find(x => x.id === invId);
        if (inv) {
          foundCustomInverters = true;
          customInverterCapacityKW += inv.capacityKW * qty;
        }
      }
      if (foundCustomInverters) {
        inverterCapacityKW = customInverterCapacityKW;
      }
    }

const result = calculateSystem({
      systemId: resolvedSystemId,
      systems,
      state: state.selectedState,
      projectType: state.projectType,
      marginMode: state.marginMode,
      targetMarginPct: state.targetMarginPct ?? undefined,
      targetMarginAmount: state.targetMarginAmount ?? undefined,
      overrides: state.overrides,
      rateMaster: state.rateMaster,
      disabledItemIndices: state.disabledItemIndices,
      discountType: state.discountType,
      discountVal: state.discountVal,
      roundOffToThousand: state.roundOffToThousand,
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
      slabs: state.dbLoaded ? resolvedSubsidy.slabs : undefined,
      structureId: state.selectedStructureId ?? undefined,
      structurePricingMode: state.structurePricingMode,
      structureRateOverride: state.structureRateOverride ?? undefined,
      structureWastageOverride: state.structureWastageOverride ?? undefined,
      structureFastenerOverride: state.structureFastenerOverride ?? undefined,
      structureBaseWeightOverride: state.structureBaseWeightOverride ?? undefined,
      structureElevationOverride: state.structureElevationOverride ?? undefined,
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
      dbStructureVendors: state.dbStructureVendors,
      dbStructureAccessoryRates: state.dbStructureAccessoryRates,
      dbStructureMaterialRates: state.dbStructureMaterialRates,
      dbStructureTemplates: state.dbStructureTemplates,
      dbStructureTemplateItems: state.dbStructureTemplateItems,
      dbWalkwayTemplates: state.dbWalkwayTemplates,
      dbLadderTemplates: state.dbLadderTemplates,
      dbWeightLookups: state.dbWeightLookups,
      dbMeters: state.dbMeters,
      dbLAs: state.dbLAs,
      dbStructureParts: state.dbStructureParts,
      dbStructureComponents: state.dbStructureComponents,
      dbStructureBom: state.dbStructureBom,
      dbStructureAddons: state.dbStructureAddons,
      dbOrientationMultipliers: state.dbOrientationMultipliers,
      gstOnOutputOverride: state.gstOnOutputOverride ?? undefined,
      allowGstOverride: state.gstOnOutputOverride !== null && state.gstOnOutputOverride !== undefined,
      targetMRPInclGST: state.targetMRPInclGST ?? undefined,
      targetMRPPerWatt: state.targetMRPPerWatt ?? undefined,
      rpcSubsidyAmount: state.rpcSubsidyAmount ?? undefined,
      maxSubsidyCapacityKW: resolvedSubsidy.scheme?.max_capacity_kw ? Number(resolvedSubsidy.scheme.max_capacity_kw) : undefined,
      maxAbsoluteSubsidy: resolvedSubsidy.override?.max_absolute_override != null
        ? Number(resolvedSubsidy.override.max_absolute_override)
        : (resolvedSubsidy.scheme?.max_absolute_subsidy ? Number(resolvedSubsidy.scheme.max_absolute_subsidy) : undefined),
      additionalStateSubsidy: resolvedSubsidy.override?.additional_state_subsidy ? Number(resolvedSubsidy.override.additional_state_subsidy) : undefined,
      subsidySchemeName: resolvedSubsidy.scheme?.name,
      // State-driven subsidy: applySubsidy is the source of truth (auto-applied from
      // the selected state). selectedScheme is retained for backward compatibility.
      applySubsidy: state.applySubsidy,
      selectedScheme: state.selectedScheme,
      structureType: state.structureType,
      structureVendorId: state.structureVendorId ?? undefined,
      structureMaterialType: state.structureMaterialType ?? undefined,
      walkwayLengthM: state.walkwayLengthM,
      ladderLengthM: state.ladderLengthM,
    });

    return { result, error: null };
  } catch (err) {
    return {
      result: null,
      error: err instanceof Error ? err.message : 'Unknown calculation error',
    };
  }
}
