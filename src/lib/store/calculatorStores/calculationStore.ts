import { StateCreator } from 'zustand';
import {
  CalculatorState,
  getEquipmentCatalogsFromSettings,
  getEligibleSubsidySchemes,
  runCalculation,
  randomId,
  INITIAL_STATE
} from '../calculatorTypes';
import { SYSTEMS, type SolarSystem, type BomItem } from '../../data/bom';
import { type ProjectType, type RowOverride, type DiscountType, type MarginMode } from '../../engine/calculator';
import { getBatteryGstRate, TAX_CONSTANTS } from '@/lib/tax-constants';
import { normalizeGstRate } from '@/lib/utils/gst';

/** Key used in dbStateTerms for the global default T&C template (state_id IS NULL). */
export const DEFAULT_TERMS_KEY = '__default__';

/**
 * Build the state-scoped lookup maps from a master-data bootstrap payload.
 * - dbSystemStateMap: systemId → [stateName...] (empty/absent = global preset).
 * - dbStateTerms: stateName → ordered clauses, plus DEFAULT_TERMS_KEY for the global default.
 * Both are derived purely from data, so adding a state requires no code changes.
 */
function buildStateScopedMaps(bootstrap: any): {
  systemStateMap: Record<string, string[]>;
  stateTerms: Record<string, string[]>;
} {
  const stateIdToName: Record<string, string> = {};
  for (const rule of bootstrap?.stateRules ?? []) {
    if (rule?.id) stateIdToName[rule.id] = rule.state_name;
  }

  const systemStateMap: Record<string, string[]> = {};
  for (const row of bootstrap?.systemStateAvailability ?? []) {
    const name = stateIdToName[row?.state_id];
    if (!row?.system_id || !name) continue;
    (systemStateMap[row.system_id] ??= []).push(name);
  }
  for (const system of bootstrap?.systems ?? []) {
    const name = stateIdToName[system?.state_id];
    if (!system?.id || !name) continue;
    const states = (systemStateMap[system.id] ??= []);
    if (!states.includes(name)) states.push(name);
  }

  const stateTerms: Record<string, string[]> = {};
  for (const tpl of bootstrap?.stateTermsTemplates ?? []) {
    if (tpl?.is_active === false) continue;
    const clauses = Array.isArray(tpl?.clauses) ? tpl.clauses : [];
    if (tpl?.state_id == null) {
      stateTerms[DEFAULT_TERMS_KEY] = clauses;
    } else {
      const name = stateIdToName[tpl.state_id];
      if (name) stateTerms[name] = clauses;
    }
  }

  return { systemStateMap, stateTerms };
}

function normalizeSystemCategory(category: string | null | undefined): SolarSystem['category'] {
  const normalized = String(category ?? 'on-grid').replace(/_/g, '-').toLowerCase();
  if (normalized === 'on-grid' || normalized === '3-phase' || normalized === 'micro-inverter' || normalized === 'hybrid' || normalized === 'upgrade' || normalized === 'commercial' || normalized === 'custom') {
    return normalized;
  }
  if (normalized === 'off-grid' || normalized === 'offgrid') return 'hybrid';
  if (normalized === 'micro') return 'micro-inverter';
  return 'on-grid';
}

function normalizeMarginPct(value: unknown, fallback = 0.2): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return fallback;
  return num > 1 ? num / 100 : num;
}

function quoteSpec(item: any): string | undefined {
  const value = item?.specification_details ?? item?.description ?? item?.notes;
  return typeof value === 'string' && value.trim() ? value : undefined;
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = 15_000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

function buildGeneratedSystems(
  panels: Array<{ id: string; wattage: number; ratePerWatt: number; gst_pct?: number }>,
  inverters: Array<{ id: string; capacityKW: number; rate: number; gst_pct?: number; type?: string }>,
  batteries: Array<{ id: string; capacityKWh: number; rate: number; gst_pct?: number }>,
): SolarSystem[] {
  const usablePanels = panels
    .filter((panel) => Number.isFinite(panel.wattage) && panel.wattage > 0)
    .sort((a, b) => b.wattage - a.wattage);
  const usableInverters = inverters
    .filter((inverter) => Number.isFinite(inverter.capacityKW) && inverter.capacityKW > 0)
    .sort((a, b) => a.capacityKW - b.capacityKW);

  if (usablePanels.length === 0 || usableInverters.length === 0) return [];

  const panel = usablePanels[0];
  const capacities = [1, 2, 3, 4, 5, 6, 7, 8, 10];
  const makeSystem = (capacityKW: number, category: SolarSystem['category'], suffix: string): SolarSystem => {
    const panelQty = Math.max(1, Math.ceil((capacityKW * 1000) / panel.wattage));
    const targetInverterKW = category === 'hybrid' ? capacityKW : capacityKW / 1.2;
    const inverter = usableInverters
      .filter((item) => category !== 'hybrid' || item.type === 'hybrid')
      .sort((a, b) => Math.abs(a.capacityKW - targetInverterKW) - Math.abs(b.capacityKW - targetInverterKW))[0] ?? usableInverters[0];
    const battery = category === 'hybrid' ? batteries.find((item) => Number.isFinite(item.capacityKWh) && item.capacityKWh > 0) : undefined;

    return {
      id: `generated-${category}-${capacityKW}kw`,
      name: `${capacityKW} kW ${suffix}`,
      category,
      capacityKW,
      panelWattage: panel.wattage,
      panelQty,
      stateId: null,
      stateName: null,
      stateCode: null,
      targetMarginPct: 0.2,
      defaultEquipment: {
        panelMix: { [panel.id]: panelQty },
        inverterMix: { [inverter.id]: 1 },
        ...(battery ? { batteryMix: { [battery.id]: 1 } } : {}),
      },
      items: [
        {
          description: 'PANEL',
          remarks: 'Generated from active panel catalog',
          qty: panelQty,
          unit: 'Nos',
          ratePerUnit: panel.ratePerWatt * panel.wattage,
          gstPct: normalizeGstRate(panel.gst_pct, TAX_CONSTANTS.PANEL_GST_RATE),
        },
        {
          description: 'INVERTER',
          remarks: 'Generated from active inverter catalog',
          qty: 1,
          unit: 'Nos',
          ratePerUnit: inverter.rate,
          gstPct: normalizeGstRate(inverter.gst_pct, TAX_CONSTANTS.INVERTER_GST_RATE),
        },
        ...(battery ? [{
          description: 'BATTERY',
          remarks: 'Generated from active battery catalog',
          qty: 1,
          unit: 'Nos',
          ratePerUnit: battery.rate,
          gstPct: normalizeGstRate(battery.gst_pct, getBatteryGstRate(battery as any)),
        }] : []),
      ],
    };
  };

  const generated = capacities.map((capacityKW) => makeSystem(capacityKW, 'on-grid', 'On-Grid Standard'));
  if (batteries.length > 0 && usableInverters.some((inverter) => inverter.type === 'hybrid')) {
    generated.push(...[3, 5, 8, 10].map((capacityKW) => makeSystem(capacityKW, 'hybrid', 'Hybrid Standard')));
  }
  return generated;
}

export const createCalculationSlice: StateCreator<
  CalculatorState,
  [],
  [],
  Pick<
    CalculatorState,
    | 'selectedSystemId'
    | 'selectedState'
    | 'projectType'
    | 'itcEligible'
    | 'applySubsidy'
    | 'dbActiveScheme'
    | 'setApplySubsidy'
    | 'marginMode'
    | 'targetMarginPct'
    | 'targetMarginAmount'
    | 'overrides'
    | 'customItems'
    | 'rateMaster'
    | 'disabledItemIndices'
    | 'additionalCosts'
    | 'discountType'
    | 'discountVal'
    | 'roundOffToThousand'
    | 'gstOnOutputOverride'
    | 'targetMRPInclGST'
    | 'targetMRPPerWatt'
    | 'orientation'
    | 'dcCableLengthM'
    | 'acCableLengthM'
    | 'electricityInflationRate'
    | 'calcResult'
    | 'calcError'
    | 'dbSystems'
    | 'dbStateData'
    | 'dbSystemStateMap'
    | 'dbStateTerms'
    | 'dbPanels'
    | 'dbInverters'
    | 'dbBatteries'
    | 'dbSchemes'
    | 'dbSchemeOverrides'
    | 'dbSlabs'
    | 'dbStructures'
    | 'dbWeightLookups'
    | 'dbMeters'
    | 'dbLAs'
    | 'dbStructureParts'
    | 'dbStructureComponents'
    | 'dbStructureBom'
    | 'dbStructureAddons'
    | 'dbStructureVendors'
    | 'dbStructureAccessoryRates'
    | 'dbStructureMaterialRates'
    | 'dbStructureTemplates'
    | 'dbStructureTemplateItems'
    | 'dbWalkwayTemplates'
    | 'dbLadderTemplates'
    | 'dbTaxHsnCodes'
    | 'dbTaxGstRates'
    | 'selectedScheme'
    | 'selectedSubsidySchemeId'
    | 'inventorySummary'
    | 'dbOrientationMultipliers'
    | 'dbLoaded'
    | 'selectSystem'
    | 'setState'
    | 'setProjectType'
    | 'setItcEligible'
    | 'setMarginMode'
    | 'setMarginOverride'
    | 'setMarginAmountOverride'
    | 'setRowOverride'
    | 'clearRowOverride'
    | 'addCustomItem'
    | 'removeCustomItem'
    | 'setRateMaster'
    | 'toggleItemSelection'
    | 'addAdditionalCost'
    | 'removeAdditionalCost'
    | 'setDiscount'
    | 'setRoundOffToThousand'
    | 'setGSTOnOutputOverride'
    | 'setTargetMRP'
    | 'setOrientation'
    | 'setCableLengths'
    | 'setElectricityInflationRate'
    | 'recalculate'
    | 'reset'
    | 'fetchMasterData'
    | 'selectedGoalWattage'
    | 'setSelectedGoalWattage'
    | 'dbStructureComponentMasters'
    | 'setOfflineData'
  >
> = (set, get) => ({
  selectedSystemId: null,
  selectedGoalWattage: null,
  selectedState: '',
  projectType: 'residential',
  itcEligible: false,
  applySubsidy: true,
  selectedScheme: 'pm_suryaghar',
  selectedSubsidySchemeId: null,
  rpcSubsidyAmount: undefined,
  dbActiveScheme: null,
  marginMode: 'percent',
  targetMarginPct: null,
  targetMarginAmount: null,
  overrides: {},
  customItems: [],
  rateMaster: {},
  disabledItemIndices: {},
  additionalCosts: [],
  discountType: 'none',
  discountVal: 0,
  roundOffToThousand: false,
  gstOnOutputOverride: null,
  targetMRPInclGST: null,
  targetMRPPerWatt: null,
  orientation: 'South',
  dcCableLengthM: 0,
  acCableLengthM: 0,
  electricityInflationRate: 0,
  calcResult: null,
  calcError: null,

  dbSystems: [],
  dbStateData: {},
  dbSystemStateMap: {},
  dbStateTerms: {},
  dbPanels: [],
  dbInverters: [],
  dbBatteries: [],
  dbSchemes: [],
  dbSchemeOverrides: [],
  dbSlabs: [],
  dbStructures: [],
  dbStructureVendors: [],
  dbStructureAccessoryRates: [],
  dbStructureMaterialRates: [],
  dbStructureTemplates: [],
  dbStructureTemplateItems: [],
  dbWalkwayTemplates: [],
  dbLadderTemplates: [],
  dbWeightLookups: [],
  dbMeters: [],
  dbTaxHsnCodes: [],
  dbTaxGstRates: [],
  dbLAs: [],
  dbStructureParts: [],
  dbStructureComponents: [],
  dbStructureComponentMasters: [],
  dbStructureBom: [],
  dbStructureAddons: [],
  dbOrientationMultipliers: { South: 1.0, 'East/West': 0.85, Flat: 0.90 } as Record<string, number>,
  inventorySummary: [],
  dbLoaded: false,

  selectSystem: (id: string) => {
    const state = get();
    const { panels: allPanels, inverters: allInverters, batteries: allBatteries } = getEquipmentCatalogsFromSettings(
      state.dbLoaded,
      state.dbPanels,
      state.dbInverters,
      state.dbBatteries
    );
    let customSystems: SolarSystem[] = [];

    if (typeof window !== 'undefined') {
      try {
        const rawSettings = window.localStorage.getItem('enermass-settings');
        if (rawSettings) {
          const settings = JSON.parse(rawSettings);
          if (Array.isArray(settings.customSystems)) customSystems = settings.customSystems;
        }
      } catch (e) {}
    }

    const systems = get().dbLoaded ? get().dbSystems : [...SYSTEMS, ...customSystems];
    const system = systems.find((s: SolarSystem) => s.id === id);
    if (!system) {
      set({
        selectedSystemId: null,
        calcResult: null,
        calcError: `Selected preset no longer exists: "${id}". Please choose a valid preset.`,
      });
      return;
    }
    const selectedSystemState = system?.stateName || state.dbSystemStateMap[id]?.[0] || state.selectedState;

    if (system && system.defaultEquipment) {
      set({
        selectedSystemId: id,
        selectedState: selectedSystemState,
        selectedPanelId: null,
        selectedGoalWattage: system.capacityKW * 1000,
        panelMix: system.defaultEquipment.panelMix ?? {},
        selectedInverterMix: system.defaultEquipment.inverterMix ?? {},
        selectedBatteryMix: system.defaultEquipment.batteryMix ?? {},
        overrides: {},
      });
      const eligibleSchemes = getEligibleSubsidySchemes(get());
      if (!eligibleSchemes.some((scheme: any) => scheme.id === get().selectedSubsidySchemeId)) {
        const nextScheme = eligibleSchemes[0] ?? null;
        set({ selectedSubsidySchemeId: nextScheme?.id ?? null, dbActiveScheme: nextScheme ?? null, rpcSubsidyAmount: null });
      }
      get().fetchRpcSubsidy();
      return;
    }

    const newPanelMix: Record<string, number> = {};
    let newSelectedPanelId: string | null = null;

    if (system) {
      const matchingPanel = allPanels.find(
        (p: { wattage: number }) => p.wattage === system.panelWattage,
      ) || allPanels[0];
      
      if (matchingPanel) {
        newPanelMix[matchingPanel.id] = system.panelQty;
        newSelectedPanelId = matchingPanel.id;
      }
    }

    const newInverterMix: Record<string, number> = {};
    if (system) {
      const inverterBomLine = system.items.find(
        (item: BomItem) => item.description.toUpperCase() === 'INVERTER',
      );
      if (inverterBomLine && inverterBomLine.qty > 0) {
        const solarCapacityKW = system.capacityKW;
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

    const newBatteryMix: Record<string, number> = {};
    if (system) {
      const batteryBomLine = system.items.find(
        (item: BomItem) => item.description.toUpperCase() === 'BATTERY',
      );
      if (batteryBomLine && batteryBomLine.qty > 0 && allBatteries.length > 0) {
        const defaultBattery = allBatteries[0] as { id: string };
        newBatteryMix[defaultBattery.id] = batteryBomLine.qty;
      }
    }

    const isCommercial = system?.category === 'commercial';
    set({
      selectedSystemId: id,
      selectedState: selectedSystemState,
      selectedGoalWattage: system ? system.capacityKW * 1000 : null,
      projectType: isCommercial ? 'commercial' : 'residential',
      overrides: {},
      disabledItemIndices: {},
      panelMix: newPanelMix,
      selectedPanelId: newSelectedPanelId,
      selectedInverterMix: newInverterMix,
      selectedBatteryMix: newBatteryMix,
      activeVariantId: null,
    });
    const eligibleSchemes = getEligibleSubsidySchemes(get());
    if (!eligibleSchemes.some((scheme: any) => scheme.id === get().selectedSubsidySchemeId)) {
      const nextScheme = eligibleSchemes[0] ?? null;
      set({ selectedSubsidySchemeId: nextScheme?.id ?? null, dbActiveScheme: nextScheme ?? null, rpcSubsidyAmount: null });
    }
    get().fetchRpcSubsidy();
  },

  setState: (state: string) => {
    set({ selectedState: state });
    const eligibleSchemes = getEligibleSubsidySchemes(get());
    if (!eligibleSchemes.some((scheme: any) => scheme.id === get().selectedSubsidySchemeId)) {
      const nextScheme = eligibleSchemes[0] ?? null;
      set({ selectedSubsidySchemeId: nextScheme?.id ?? null, dbActiveScheme: nextScheme ?? null, rpcSubsidyAmount: null });
    } else {
      set({ rpcSubsidyAmount: null });
    }
    get().fetchRpcSubsidy();
  },

  setSelectedGoalWattage: (w: number | null) => {
    set({ selectedGoalWattage: w });
    get().recalculate();
  },

  setProjectType: (type: ProjectType) => {
    set({ projectType: type });
    const eligibleSchemes = getEligibleSubsidySchemes(get());
    if (!eligibleSchemes.some((scheme: any) => scheme.id === get().selectedSubsidySchemeId)) {
      const nextScheme = eligibleSchemes[0] ?? null;
      set({ selectedSubsidySchemeId: nextScheme?.id ?? null, dbActiveScheme: nextScheme ?? null, rpcSubsidyAmount: null });
    } else {
      set({ rpcSubsidyAmount: null });
    }
    get().fetchRpcSubsidy();
  },

  setItcEligible: (eligible: boolean) => {
    set({ itcEligible: eligible });
  },

  setApplySubsidy: (val: boolean) => {
    set({ applySubsidy: val });
    const { result, error } = runCalculation(get());
    set({ calcResult: result, calcError: error });
  },

  setMarginMode: (mode: MarginMode) => {
    const nextMode = mode === 'flat' ? 'flat' : 'percent';
    set({
      marginMode: nextMode,
      targetMRPInclGST: null,
      targetMRPPerWatt: null,
    });
    get().recalculate();
  },

  setMarginOverride: (pct: number | null) => {
    set({ targetMarginPct: pct === null ? null : normalizeMarginPct(pct), marginMode: 'percent', targetMRPInclGST: null, targetMRPPerWatt: null });
    get().recalculate();
  },

  setMarginAmountOverride: (amount: number | null) => {
    set({ targetMarginAmount: amount, marginMode: 'flat', targetMRPInclGST: null, targetMRPPerWatt: null });
    get().recalculate();
  },

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

  toggleItemSelection: (index: number) => {
    const current = get().disabledItemIndices;
    const next = { ...current };
    if (next[index]) {
      delete next[index];
    } else {
      next[index] = true;
    }
    set({ disabledItemIndices: next });
    get().recalculate();
  },

  addAdditionalCost: (cost: any) => {
    const newCost = { ...cost, id: randomId() };
    set({ additionalCosts: [...get().additionalCosts, newCost] });
    get().recalculate();
  },

  removeAdditionalCost: (id: string) => {
    set({
      additionalCosts: get().additionalCosts.filter((c) => c.id !== id),
    });
    get().recalculate();
  },

  setDiscount: (type: DiscountType, val: number) => {
    set({ discountType: type, discountVal: val });
    get().recalculate();
  },

  setRoundOffToThousand: (val: boolean) => {
    set({ roundOffToThousand: val });
    get().recalculate();
  },

  setGSTOnOutputOverride: (val: number | null) => {
    set({ gstOnOutputOverride: val });
    get().recalculate();
  },

  setTargetMRP: (val: number | null, type: 'total' | 'per_watt' = 'total') => {
    if (type === 'total') {
      set({ targetMRPInclGST: val, targetMRPPerWatt: null });
    } else {
      set({ targetMRPPerWatt: val, targetMRPInclGST: null });
    }
    get().recalculate();
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

  recalculate: () => {
    const { result, error } = runCalculation(get());
    set({ calcResult: result, calcError: error });
  },

  reset: () => {
    const { quotes, dbSystems } = get();
    const cleanState: any = { ...INITIAL_STATE, quotes };
    set(cleanState);
    if (dbSystems && dbSystems.length > 0) {
      get().selectSystem(dbSystems[0].id);
    } else {
      get().recalculate();
    }
  },

  fetchMasterData: async () => {
    try {
      const requestInit = {
        credentials: 'include' as RequestCredentials,
      };

      let rawBootstrap: any;
      try {
        const responses = await Promise.all([
          fetchWithTimeout('/api/erp/master/equipment', requestInit),
          fetchWithTimeout('/api/erp/master/structures', requestInit),
          fetchWithTimeout('/api/erp/master/rules?bomLimit=5000', requestInit),
          fetchWithTimeout('/api/erp/master/org?invLimit=2000', requestInit)
        ]);

        const failedRes = responses.find(r => !r.ok);
        if (failedRes) {
          throw new Error(`Component-level route failed: ${failedRes.status}`);
        }

        const [equipment, structures, rules, org] = await Promise.all(
          responses.map(r => r.json())
        );

        rawBootstrap = {
          ...equipment,
          ...structures,
          ...rules,
          ...org
        };
      } catch (componentFetchError) {
        console.warn('[fetchMasterData] Component-level fetch failed, falling back to consolidated bootstrap:', componentFetchError);

        let bootstrapRes = await fetchWithTimeout('/api/erp/bootstrap?bomLimit=5000&invLimit=2000', requestInit, 20_000);
        if (bootstrapRes.status === 404) {
          bootstrapRes = await fetchWithTimeout('/api/master', requestInit, 20_000);
        }

        if (!bootstrapRes.ok) {
          throw new Error(`/api/erp/bootstrap returned ${bootstrapRes.status}`);
        }

        rawBootstrap = await bootstrapRes.json();
      }
      const bootstrap: any = {
        ...rawBootstrap,
        // The legacy /api/master payload does not carry these ERP-specific
        // collections, so default them to empty arrays when absent.
        bomItems: rawBootstrap.bomItems ?? rawBootstrap.bomTemplateItems ?? [],
        commDevices: rawBootstrap.commDevices ?? [],
        systems: rawBootstrap.systems ?? [],
        inventorySummary: rawBootstrap.inventorySummary ?? [],
        vendors: rawBootstrap.vendors ?? [],
        structureVendors: rawBootstrap.structureVendors ?? [],
        structureComponents: rawBootstrap.structureComponents ?? [],
        structureBom: rawBootstrap.structureBom ?? [],
        structureAddons: rawBootstrap.structureAddons ?? [],
        stateRules: rawBootstrap.stateRules ?? [],
        slabs: rawBootstrap.slabs ?? [],
        schemes: rawBootstrap.schemes ?? [],
        systemStateAvailability: rawBootstrap.systemStateAvailability ?? [],
        stateTermsTemplates: rawBootstrap.stateTermsTemplates ?? [],
      };

      const mappedPanels = bootstrap.panels.map((p: any) => {
        return {
          id: p.id,
          brand: p.brand,
          model: p.model,
          wattage: Number(p.wattage_w),
          type: p.panel_type,
          ratePerWatt: Number(p.wattage_w) > 0 ? Number(p.selling_price) / Number(p.wattage_w) : 0,
          gst_pct: normalizeGstRate(p.gst_pct, TAX_CONSTANTS.PANEL_GST_RATE),
          description: p.description ?? '',
          specification_details: p.specification_details ?? '',
        };
      });

      const mappedInverters = bootstrap.inverters.map((i: any) => {
        return {
          id: i.id,
          brand: i.brand,
          model: i.model,
          capacityKW: Number(i.capacity_kw),
          type: i.inverter_type === 'on_grid' ? 'on-grid' : (i.inverter_type === 'micro' ? 'micro' : 'hybrid'),
          phases: Number(i.phases),
          rate: Number(i.selling_price),
          gst_pct: normalizeGstRate(i.gst_pct, TAX_CONSTANTS.INVERTER_GST_RATE),
          description: i.description ?? '',
          specification_details: i.specification_details ?? '',
        };
      });

      const mappedBatteries = bootstrap.batteries.map((b: any) => {
        return {
          id: b.id,
          brand: b.brand,
          model: b.model,
          capacityKWh: Number(b.capacity_kwh),
          chemistry: b.chemistry,
          dodPct: Number(b.dod_pct),
          rate: Number(b.selling_price),
          gst_pct: normalizeGstRate(b.gst_pct, getBatteryGstRate(b)),
          description: b.description ?? '',
          specification_details: b.specification_details ?? '',
        };
      });

      const mappedStructures = bootstrap.structures.map((st: any) => {
        return {
          ...st,
          raw_material_rate: Number(st.raw_material_rate),
          fabrication_rate: Number(st.fabrication_rate),
          galvanizing_rate: Number(st.galvanizing_rate),
          rate_per_kg: Number(st.rate_per_kg),
          wastage_pct: Number(st.wastage_pct),
          fastener_weight_pct: Number(st.fastener_weight_pct),
          base_weight_kg: Number(st.base_weight_kg),
          flat_rate: st.selling_price != null ? Number(st.selling_price) : (st.flat_rate != null ? Number(st.flat_rate) : null),
          per_watt_rate: st.per_watt_rate != null ? Number(st.per_watt_rate) : null,
          gst_pct: normalizeGstRate(st.gst_pct, TAX_CONSTANTS.BOS_GST_RATE),
          description: st.description ?? '',
          specification_details: st.specification_details ?? '',
        };
      });

      const mappedMeters = bootstrap.meters.map((m: any) => {
        return {
          ...m,
          phases: Number(m.phases),
          rate: Number(m.selling_price),
          gst_pct: normalizeGstRate(m.gst_pct, TAX_CONSTANTS.BOS_GST_RATE),
          description: m.description ?? '',
          specification_details: m.specification_details ?? '',
        };
      });

      const mappedLAs = bootstrap.lightningArresters.map((l: any) => {
        return {
          ...l,
          rate: Number(l.selling_price),
          gst_pct: normalizeGstRate(l.gst_pct, TAX_CONSTANTS.BOS_GST_RATE),
          description: l.description ?? '',
          specification_details: l.specification_details ?? '',
        };
      });

      const mappedBomItems = bootstrap.bomItems.map((b: any) => {
        return {
          ...b,
          rate: Number(b.default_rate ?? b.selling_price ?? 0),
          gst_pct: normalizeGstRate(b.gst_pct, TAX_CONSTANTS.BOS_GST_RATE),
          notes: b.notes ?? '',
          specification_details: b.specification_details ?? '',
        };
      });

      const mappedRateMaster = Object.fromEntries(
        (bootstrap.rateMaster || [])
          .filter((row: any) => row?.item_name)
          .map((row: any) => [
            row.item_name,
            {
              rate: Number(row.override_rate ?? 0),
              active: row.is_active !== false,
            },
          ]),
      );

      const mappedCommDevices = (bootstrap.commDevices || []).map((c: any) => {
        return {
          ...c,
          rate: Number(c.selling_price),
          gst_pct: normalizeGstRate(c.gst_pct, TAX_CONSTANTS.BOS_GST_RATE),
          description: c.description ?? '',
          specification_details: c.specification_details ?? '',
        };
      });

      const mappedStructureComponentMasters = (bootstrap.structureComponentMasters || []).map((scm: any) => {
        return {
          id: scm.id,
          name: scm.name,
          rate: Number(scm.selling_price),
          gst_pct: normalizeGstRate(scm.gst_pct, TAX_CONSTANTS.BOS_GST_RATE),
          specification_details: scm.specification_details ?? '',
        };
      });

      const mappedStateData: Record<string, any> = {};
      for (const rule of bootstrap.stateRules) {
        mappedStateData[rule.state_name] = {
          id: rule.id,
          name: rule.state_name,
          stateCode: rule.state_code,
          sunHoursPerDay: Number(rule.sun_hours_per_day),
          performanceRatio: Number(rule.performance_ratio),
          labourMultiplier: Number(rule.labour_multiplier),
          gstOnOutput: normalizeGstRate(rule.gst_on_output, TAX_CONSTANTS.PROJECT_COMPOSITE_GST_RATE),
          gridTariffInr: Number(rule.grid_tariff_inr),
          subsidyRules: [],
        };
      }
      const stateById = new Map<string, { stateName: string; stateCode: string }>(
        (bootstrap.stateRules || []).map((rule: any) => [
          rule.id,
          { stateName: rule.state_name, stateCode: rule.state_code },
        ]),
      );

      // Default orientation multipliers - loaded from app_settings
      const factor = bootstrap.appSettings?.orientation_factor !== undefined && bootstrap.appSettings?.orientation_factor !== null
        ? Number(bootstrap.appSettings.orientation_factor)
        : 1.0;
      const orientationMultipliers = {
        South: 1.0,
        'East/West': 0.85 * factor,
        Flat: 0.90 * factor
      };

      const activeSchemes = (bootstrap.schemes || []).filter((s: any) => s.is_active !== false);
      const activeScheme = activeSchemes.find((s: any) => s.code === 'PM_SURYA_GHAR_2024') ?? activeSchemes[0];
      const sortedSlabs = [...(bootstrap.slabs || [])].sort((a, b) => {
        const schemeSort = String(a.scheme_id ?? '').localeCompare(String(b.scheme_id ?? ''));
        return schemeSort || Number(a.slab_index ?? 0) - Number(b.slab_index ?? 0);
      }).map(s => ({
        id: s.id,
        scheme_id: s.scheme_id,
        slab_index: Number(s.slab_index ?? 0),
        start_kw: Number(s.start_kw),
        end_kw: s.end_kw !== null ? Number(s.end_kw) : null,
        rate_per_kw: Number(s.rate_per_kw),
        is_fixed_amount: Boolean(s.is_fixed_amount),
        fixed_amount: s.fixed_amount !== null ? Number(s.fixed_amount) : null,
        formula: s.formula ?? null,
      }));

      const loadedSystems: SolarSystem[] = (bootstrap.systems || []).map((sys: any) => {
        const items = (sys.system_items || []).map((item: any) => {
          let rate = 0;
          let gstPct: any = TAX_CONSTANTS.BOS_GST_RATE;
          let sourceTable: string | undefined;
          let sourceItemId: string | undefined;
          let sourceLabel: string | undefined;
          let sourceSpecification: string | undefined;
          if (item.panel_id) {
            const panel = mappedPanels.find((p: any) => p.id === item.panel_id);
            rate = panel ? Number(panel.ratePerWatt) * Number(panel.wattage) : 0;
            gstPct = panel ? normalizeGstRate(panel.gst_pct, TAX_CONSTANTS.PANEL_GST_RATE) : TAX_CONSTANTS.PANEL_GST_RATE;
            sourceTable = 'eq_panels';
            sourceItemId = item.panel_id;
            sourceLabel = panel ? `${panel.brand} ${panel.model} (${panel.wattage}W)` : item.description;
            sourceSpecification = quoteSpec(panel);
          } else if (item.inverter_id) {
            const inverter = mappedInverters.find((i: any) => i.id === item.inverter_id);
            rate = inverter ? Number(inverter.rate) : 0;
            gstPct = inverter ? normalizeGstRate(inverter.gst_pct, TAX_CONSTANTS.INVERTER_GST_RATE) : TAX_CONSTANTS.INVERTER_GST_RATE;
            sourceTable = 'eq_inverters';
            sourceItemId = item.inverter_id;
            sourceLabel = inverter ? `${inverter.brand} ${inverter.model}` : item.description;
            sourceSpecification = quoteSpec(inverter);
          } else if (item.battery_id) {
            const battery = mappedBatteries.find((b: any) => b.id === item.battery_id);
            rate = battery ? Number(battery.rate) : 0;
            gstPct = battery ? normalizeGstRate(battery.gst_pct, getBatteryGstRate(battery)) : TAX_CONSTANTS.BATTERY_GST_RATE;
            sourceTable = 'eq_batteries';
            sourceItemId = item.battery_id;
            sourceLabel = battery ? `${battery.brand} ${battery.model}` : item.description;
            sourceSpecification = quoteSpec(battery);
          } else if (item.solar_meter_id) {
            const meter = mappedMeters.find((m: any) => m.id === item.solar_meter_id);
            rate = meter ? Number(meter.rate) : 0;
            gstPct = meter ? normalizeGstRate(meter.gst_pct, TAX_CONSTANTS.BOS_GST_RATE) : TAX_CONSTANTS.BOS_GST_RATE;
            sourceTable = 'eq_meters';
            sourceItemId = item.solar_meter_id;
            sourceLabel = meter ? `${meter.brand ?? ''} ${meter.model ?? ''}`.trim() : item.description;
            sourceSpecification = quoteSpec(meter);
          } else if (item.net_meter_id) {
            const meter = mappedMeters.find((m: any) => m.id === item.net_meter_id);
            rate = meter ? Number(meter.rate) : 0;
            gstPct = meter ? normalizeGstRate(meter.gst_pct, TAX_CONSTANTS.BOS_GST_RATE) : TAX_CONSTANTS.BOS_GST_RATE;
            sourceTable = 'eq_meters';
            sourceItemId = item.net_meter_id;
            sourceLabel = meter ? `${meter.brand ?? ''} ${meter.model ?? ''}`.trim() : item.description;
            sourceSpecification = quoteSpec(meter);
          } else if (item.la_id) {
            const la = mappedLAs.find((l: any) => l.id === item.la_id);
            rate = la ? Number(la.rate) : 0;
            gstPct = la ? normalizeGstRate(la.gst_pct, TAX_CONSTANTS.BOS_GST_RATE) : TAX_CONSTANTS.BOS_GST_RATE;
            sourceTable = 'eq_lightning_arresters';
            sourceItemId = item.la_id;
            sourceLabel = la ? `${la.brand ?? ''} ${la.model ?? ''}`.trim() : item.description;
            sourceSpecification = quoteSpec(la);
          } else if (item.structure_id) {
            const structure = mappedStructures.find((s: any) => s.id === item.structure_id);
            rate = structure ? Number(structure.flat_rate ?? 0) : 0;
            gstPct = structure ? normalizeGstRate(structure.gst_pct, TAX_CONSTANTS.BOS_GST_RATE) : TAX_CONSTANTS.BOS_GST_RATE;
            sourceTable = 'eq_mounting_structures';
            sourceItemId = item.structure_id;
            sourceLabel = structure ? structure.name : item.description;
            sourceSpecification = quoteSpec(structure);
          } else if (item.bom_item_id) {
            const bom = mappedBomItems.find((b: any) => b.id === item.bom_item_id);
            rate = bom ? Number(bom.rate) : 0;
            gstPct = bom ? normalizeGstRate(bom.gst_pct, TAX_CONSTANTS.BOS_GST_RATE) : TAX_CONSTANTS.BOS_GST_RATE;
            sourceTable = 'bom_template_items';
            sourceItemId = item.bom_item_id;
            sourceLabel = bom ? bom.description : item.description;
            sourceSpecification = quoteSpec(bom);
          } else if (item.comm_device_id) {
            const comm = mappedCommDevices.find((c: any) => c.id === item.comm_device_id);
            rate = comm ? Number(comm.rate) : 0;
            gstPct = comm ? normalizeGstRate(comm.gst_pct, TAX_CONSTANTS.BOS_GST_RATE) : TAX_CONSTANTS.BOS_GST_RATE;
            sourceTable = 'eq_communication_devices';
            sourceItemId = item.comm_device_id;
            sourceLabel = comm ? `${comm.brand ?? ''} ${comm.model ?? ''}`.trim() : item.description;
            sourceSpecification = quoteSpec(comm);
          } else if (item.structure_component_id) {
            const comp = mappedStructureComponentMasters.find((c: any) => c.id === item.structure_component_id);
            rate = comp ? Number(comp.rate) : 0;
            gstPct = comp ? normalizeGstRate(comp.gst_pct, TAX_CONSTANTS.BOS_GST_RATE) : TAX_CONSTANTS.BOS_GST_RATE;
            sourceTable = 'structure_component_master';
            sourceItemId = item.structure_component_id;
            sourceLabel = comp ? comp.name : item.description;
            sourceSpecification = quoteSpec(comp);
          }

          return {
            description: item.description,
            remarks: item.remarks ?? sourceSpecification,
            unit: item.unit ?? undefined,
            qty: Number(item.default_qty),
            ratePerUnit: rate,
            gstPct: gstPct as any,
            sourceTable,
            sourceItemId,
            sourceLabel,
          };
        });

        return {
          id: sys.id,
          name: sys.name,
          category: normalizeSystemCategory(sys.category),
          capacityKW: Number(sys.capacity_kw),
          panelWattage: Number(sys.panel_wattage_w ?? 0),
          panelQty: Number(sys.panel_qty ?? 0),
          stateId: sys.state_id ?? null,
          stateName: sys.state_id ? stateById.get(sys.state_id)?.stateName ?? null : null,
          stateCode: sys.state_id ? stateById.get(sys.state_id)?.stateCode ?? null : null,
          targetMarginPct: normalizeMarginPct(sys.target_margin_pct),
          items
        };
      });
      const mappedSystems = loadedSystems.length > 0
        ? loadedSystems
        : buildGeneratedSystems(mappedPanels, mappedInverters, mappedBatteries);

      const { systemStateMap, stateTerms } = buildStateScopedMaps(bootstrap);

      set({
        dbSystems: mappedSystems,
        dbStateData: mappedStateData,
        dbSystemStateMap: systemStateMap,
        dbStateTerms: stateTerms,
        dbPanels: mappedPanels,
        dbInverters: mappedInverters,
        dbBatteries: mappedBatteries,
        dbSchemes: activeSchemes,
        dbSchemeOverrides: bootstrap.schemeOverrides || [],
        dbSlabs: sortedSlabs,
        dbActiveScheme: activeScheme || null,
        dbStructures: mappedStructures,
        dbStructureVendors: bootstrap.structureVendors || [],
        dbStructureAccessoryRates: bootstrap.structureAccessoryRates || [],
        dbStructureMaterialRates: bootstrap.structureMaterialRates || [],
        dbStructureTemplates: bootstrap.structureTemplates || [],
        dbStructureTemplateItems: bootstrap.structureTemplateItems || [],
        dbWalkwayTemplates: bootstrap.walkwayTemplates || [],
        dbLadderTemplates: bootstrap.ladderTemplates || [],
        dbWeightLookups: bootstrap.weightLookups || [],
        dbMeters: mappedMeters,
        dbLAs: mappedLAs,
        dbStructureParts: mappedBomItems,
        dbStructureComponents: bootstrap.structureComponents || [],
        dbStructureBom: bootstrap.structureBom || [],
        dbStructureAddons: bootstrap.structureAddons || [],
        dbOrientationMultipliers: orientationMultipliers,
        rateMaster: mappedRateMaster,
        inventorySummary: bootstrap.inventorySummary,
        dbStructureComponentMasters: mappedStructureComponentMasters,
        dbLoaded: true
      });

      const eligibleSchemes = getEligibleSubsidySchemes(get());
      if (!eligibleSchemes.some((scheme: any) => scheme.id === get().selectedSubsidySchemeId)) {
        const nextScheme = eligibleSchemes[0] ?? null;
        set({
          selectedSubsidySchemeId: nextScheme?.id ?? null,
          dbActiveScheme: nextScheme ?? null,
          rpcSubsidyAmount: null,
        });
      }

      const currentSystemId = get().selectedSystemId;
      const systemExists = mappedSystems.some(s => s.id === currentSystemId);
      if (!currentSystemId && mappedSystems.length > 0) {
        get().selectSystem(mappedSystems[0].id);
      } else if (currentSystemId && !systemExists) {
        set({
          selectedSystemId: null,
          calcResult: null,
          calcError: `Selected preset no longer exists: "${currentSystemId}". Please choose a valid preset.`,
        });
      } else {
        get().recalculate();
      }
    } catch (err) {
      console.error("Failed to fetch database master data:", err);
      // Fallback: select first static system if none selected or invalid
      const currentSystemId = get().selectedSystemId;
      const systems = SYSTEMS;
      const systemExists = systems.some((s) => s.id === currentSystemId);
      if ((!currentSystemId || !systemExists) && systems.length > 0) {
        get().selectSystem(systems[0].id);
      } else {
        get().recalculate();
      }
    }
  },  setOfflineData: (bootstrap: any) => {
    try {
      const stateUpdate: Partial<CalculatorState> = {};

      if (bootstrap.panels) {
        stateUpdate.dbPanels = bootstrap.panels.map((p: any) => ({
          id: p.id,
          brand: p.brand,
          model: p.model,
          wattage: Number(p.wattage_w),
          type: p.panel_type,
          ratePerWatt: Number(p.wattage_w) > 0 ? Number(p.selling_price) / Number(p.wattage_w) : 0,
          gst_pct: normalizeGstRate(p.gst_pct, TAX_CONSTANTS.PANEL_GST_RATE),
          description: p.description ?? '',
          specification_details: p.specification_details ?? '',
        }));
      }

      if (bootstrap.inverters) {
        stateUpdate.dbInverters = bootstrap.inverters.map((i: any) => ({
          id: i.id,
          brand: i.brand,
          model: i.model,
          capacityKW: Number(i.capacity_kw),
          type: i.inverter_type === 'on_grid' ? 'on-grid' : (i.inverter_type === 'micro' ? 'micro' : 'hybrid'),
          phases: Number(i.phases),
          rate: Number(i.selling_price),
          gst_pct: normalizeGstRate(i.gst_pct, TAX_CONSTANTS.INVERTER_GST_RATE),
          description: i.description ?? '',
          specification_details: i.specification_details ?? '',
        }));
      }

      if (bootstrap.batteries) {
        stateUpdate.dbBatteries = bootstrap.batteries.map((b: any) => ({
          id: b.id,
          brand: b.brand,
          model: b.model,
          capacityKWh: Number(b.capacity_kwh),
          chemistry: b.chemistry,
          dodPct: Number(b.dod_pct),
          rate: Number(b.selling_price),
          gst_pct: normalizeGstRate(b.gst_pct, getBatteryGstRate(b)),
          description: b.description ?? '',
          specification_details: b.specification_details ?? '',
        }));
      }

      if (bootstrap.meters) {
        stateUpdate.dbMeters = bootstrap.meters.map((m: any) => ({
          ...m,
          phases: Number(m.phases),
          rate: Number(m.selling_price),
          gst_pct: normalizeGstRate(m.gst_pct, TAX_CONSTANTS.BOS_GST_RATE),
          description: m.description ?? '',
          specification_details: m.specification_details ?? '',
        }));
      }

      if (bootstrap.lightningArresters) {
        stateUpdate.dbLAs = bootstrap.lightningArresters.map((l: any) => ({
          ...l,
          rate: Number(l.selling_price),
          gst_pct: normalizeGstRate(l.gst_pct, TAX_CONSTANTS.BOS_GST_RATE),
          description: l.description ?? '',
          specification_details: l.specification_details ?? '',
        }));
      }

      // commDevices is mapped locally inside the systems block

      if (bootstrap.stateRules) {
        const mappedStateData: Record<string, any> = {};
        for (const rule of bootstrap.stateRules) {
          mappedStateData[rule.state_name] = {
            id: rule.id,
            name: rule.state_name,
            stateCode: rule.state_code,
            sunHoursPerDay: Number(rule.sun_hours_per_day),
            performanceRatio: Number(rule.performance_ratio),
            labourMultiplier: Number(rule.labour_multiplier),
            gstOnOutput: normalizeGstRate(rule.gst_on_output, TAX_CONSTANTS.PROJECT_COMPOSITE_GST_RATE),
            gridTariffInr: Number(rule.grid_tariff_inr),
            subsidyRules: [],
          };
        }
        stateUpdate.dbStateData = mappedStateData;
      }
      const stateById = new Map<string, { stateName: string; stateCode: string }>(
        (bootstrap.stateRules || []).map((rule: any) => [
          rule.id,
          { stateName: rule.state_name, stateCode: rule.state_code },
        ]),
      );

      // State-scoped presets + T&C templates (derived from data; safe if absent).
      if (bootstrap.stateRules && (bootstrap.systemStateAvailability || bootstrap.stateTermsTemplates || bootstrap.systems)) {
        const { systemStateMap, stateTerms } = buildStateScopedMaps(bootstrap);
        if (bootstrap.systemStateAvailability || bootstrap.systems) stateUpdate.dbSystemStateMap = systemStateMap;
        if (bootstrap.stateTermsTemplates) stateUpdate.dbStateTerms = stateTerms;
      }

      if (bootstrap.schemes) {
        const activeSchemes = bootstrap.schemes.filter((s: any) => s.is_active !== false);
        const activeScheme = activeSchemes.find((s: any) => s.code === 'PM_SURYA_GHAR_2024') ?? activeSchemes[0];
        stateUpdate.dbSchemes = activeSchemes;
        stateUpdate.dbSchemeOverrides = bootstrap.schemeOverrides || [];
        stateUpdate.dbActiveScheme = activeScheme || null;
        if (bootstrap.slabs) {
          stateUpdate.dbSlabs = [...bootstrap.slabs].sort((a, b) => {
            const schemeSort = String(a.scheme_id ?? '').localeCompare(String(b.scheme_id ?? ''));
            return schemeSort || Number(a.slab_index ?? 0) - Number(b.slab_index ?? 0);
          }).map(s => ({
            id: s.id,
            scheme_id: s.scheme_id,
            slab_index: Number(s.slab_index ?? 0),
            start_kw: Number(s.start_kw),
            end_kw: s.end_kw !== null ? Number(s.end_kw) : null,
            rate_per_kw: Number(s.rate_per_kw),
            is_fixed_amount: Boolean(s.is_fixed_amount),
            fixed_amount: s.fixed_amount !== null ? Number(s.fixed_amount) : null,
            formula: s.formula ?? null,
          }));
        }
      }

      if (bootstrap.bomItems) {
        stateUpdate.dbStructureParts = bootstrap.bomItems.map((b: any) => ({
          ...b,
          rate: Number(b.default_rate ?? b.selling_price ?? 0),
          gst_pct: normalizeGstRate(b.gst_pct, TAX_CONSTANTS.BOS_GST_RATE),
          notes: b.notes ?? '',
          specification_details: b.specification_details ?? '',
        }));
      }

      if (bootstrap.rateMaster) {
        stateUpdate.rateMaster = Object.fromEntries(
          (bootstrap.rateMaster || [])
            .filter((row: any) => row?.item_name)
            .map((row: any) => [
              row.item_name,
              {
                rate: Number(row.override_rate ?? 0),
                active: row.is_active !== false,
              },
            ]),
        );
      }

      if (bootstrap.structures) {
        stateUpdate.dbStructures = bootstrap.structures.map((st: any) => ({
          ...st,
          raw_material_rate: Number(st.raw_material_rate),
          fabrication_rate: Number(st.fabrication_rate),
          galvanizing_rate: Number(st.galvanizing_rate),
          rate_per_kg: Number(st.rate_per_kg),
          wastage_pct: Number(st.wastage_pct),
          fastener_weight_pct: Number(st.fastener_weight_pct),
          base_weight_kg: Number(st.base_weight_kg),
          flat_rate: st.selling_price != null ? Number(st.selling_price) : (st.flat_rate != null ? Number(st.flat_rate) : null),
          per_watt_rate: st.per_watt_rate != null ? Number(st.per_watt_rate) : null,
          gst_pct: normalizeGstRate(st.gst_pct, TAX_CONSTANTS.BOS_GST_RATE),
          description: st.description ?? '',
          specification_details: st.specification_details ?? '',
        }));
      }

      if (bootstrap.structureComponentMasters) {
        stateUpdate.dbStructureComponentMasters = bootstrap.structureComponentMasters.map((scm: any) => ({
          id: scm.id,
          name: scm.name,
          rate: Number(scm.selling_price),
          gst_pct: normalizeGstRate(scm.gst_pct, TAX_CONSTANTS.BOS_GST_RATE),
          specification_details: scm.specification_details ?? '',
        }));
      }

      if (bootstrap.structureVendors !== undefined) stateUpdate.dbStructureVendors = bootstrap.structureVendors;
      if (bootstrap.structureAccessoryRates !== undefined) stateUpdate.dbStructureAccessoryRates = bootstrap.structureAccessoryRates;
      if (bootstrap.structureMaterialRates !== undefined) stateUpdate.dbStructureMaterialRates = bootstrap.structureMaterialRates;
      if (bootstrap.structureTemplates !== undefined) stateUpdate.dbStructureTemplates = bootstrap.structureTemplates;
      if (bootstrap.structureTemplateItems !== undefined) stateUpdate.dbStructureTemplateItems = bootstrap.structureTemplateItems;
      if (bootstrap.walkwayTemplates !== undefined) stateUpdate.dbWalkwayTemplates = bootstrap.walkwayTemplates;
      if (bootstrap.ladderTemplates !== undefined) stateUpdate.dbLadderTemplates = bootstrap.ladderTemplates;
      if (bootstrap.weightLookups !== undefined) stateUpdate.dbWeightLookups = bootstrap.weightLookups;
      if (bootstrap.structureComponents !== undefined) stateUpdate.dbStructureComponents = bootstrap.structureComponents;
      if (bootstrap.structureBom !== undefined) stateUpdate.dbStructureBom = bootstrap.structureBom;
      if (bootstrap.structureAddons !== undefined) stateUpdate.dbStructureAddons = bootstrap.structureAddons;
      if (bootstrap.inventorySummary !== undefined) stateUpdate.inventorySummary = bootstrap.inventorySummary;

      if (bootstrap.appSettings) {
        const factor = bootstrap.appSettings.orientation_factor !== undefined && bootstrap.appSettings.orientation_factor !== null
          ? Number(bootstrap.appSettings.orientation_factor)
          : 1.0;
        stateUpdate.dbOrientationMultipliers = {
          South: 1.0,
          'East/West': 0.85 * factor,
          Flat: 0.90 * factor
        };
      }

      // Map systems once panels and inverters exist (or are currently stored)
      if (bootstrap.systems) {
        const panels = stateUpdate.dbPanels || get().dbPanels;
        const inverters = stateUpdate.dbInverters || get().dbInverters;
        const batteries = stateUpdate.dbBatteries || get().dbBatteries;
        const meters = stateUpdate.dbMeters || get().dbMeters;
        const LAs = stateUpdate.dbLAs || get().dbLAs;
        const commDevices = (bootstrap.commDevices || []).map((c: any) => ({
          id: c.id,
          rate: Number(c.selling_price),
          gst_pct: normalizeGstRate(c.gst_pct, TAX_CONSTANTS.BOS_GST_RATE),
          brand: c.brand,
          model: c.model,
          description: c.description ?? '',
          specification_details: c.specification_details ?? '',
        }));
        const bomItems = stateUpdate.dbStructureParts || get().dbStructureParts;
        const structures = stateUpdate.dbStructures || get().dbStructures;
        const structureComponentMasters = stateUpdate.dbStructureComponentMasters || get().dbStructureComponentMasters;

        const loadedSystems: SolarSystem[] = bootstrap.systems.map((sys: any) => {
          const items = (sys.system_items || []).map((item: any) => {
            let rate = 0;
            let gstPct: any = TAX_CONSTANTS.BOS_GST_RATE;
            let sourceTable: string | undefined;
            let sourceItemId: string | undefined;
            let sourceLabel: string | undefined;
            let sourceSpecification: string | undefined;
            if (item.panel_id) {
              const panel = panels.find((p: any) => p.id === item.panel_id);
              rate = panel ? Number(panel.ratePerWatt) * Number(panel.wattage) : 0;
              gstPct = panel ? normalizeGstRate(panel.gst_pct, TAX_CONSTANTS.PANEL_GST_RATE) : TAX_CONSTANTS.PANEL_GST_RATE;
              sourceTable = 'eq_panels';
              sourceItemId = item.panel_id;
              sourceLabel = panel ? `${panel.brand} ${panel.model} (${panel.wattage}W)` : item.description;
              sourceSpecification = quoteSpec(panel);
            } else if (item.inverter_id) {
              const inverter = inverters.find((i: any) => i.id === item.inverter_id);
              rate = inverter ? Number(inverter.rate) : 0;
              gstPct = inverter ? normalizeGstRate(inverter.gst_pct, TAX_CONSTANTS.INVERTER_GST_RATE) : TAX_CONSTANTS.INVERTER_GST_RATE;
              sourceTable = 'eq_inverters';
              sourceItemId = item.inverter_id;
              sourceLabel = inverter ? `${inverter.brand} ${inverter.model}` : item.description;
              sourceSpecification = quoteSpec(inverter);
            } else if (item.battery_id) {
              const battery = batteries.find((b: any) => b.id === item.battery_id);
              rate = battery ? Number(battery.rate) : 0;
              gstPct = battery ? normalizeGstRate(battery.gst_pct, getBatteryGstRate(battery)) : TAX_CONSTANTS.BATTERY_GST_RATE;
              sourceTable = 'eq_batteries';
              sourceItemId = item.battery_id;
              sourceLabel = battery ? `${battery.brand} ${battery.model}` : item.description;
              sourceSpecification = quoteSpec(battery);
            } else if (item.solar_meter_id) {
              const meter = meters.find((m: any) => m.id === item.solar_meter_id);
              rate = meter ? Number(meter.rate) : 0;
              gstPct = meter ? normalizeGstRate(meter.gst_pct, TAX_CONSTANTS.BOS_GST_RATE) : TAX_CONSTANTS.BOS_GST_RATE;
              sourceTable = 'eq_meters';
              sourceItemId = item.solar_meter_id;
              sourceLabel = meter ? `${meter.brand ?? ''} ${meter.model ?? ''}`.trim() : item.description;
              sourceSpecification = quoteSpec(meter);
            } else if (item.net_meter_id) {
              const meter = meters.find((m: any) => m.id === item.net_meter_id);
              rate = meter ? Number(meter.rate) : 0;
              gstPct = meter ? normalizeGstRate(meter.gst_pct, TAX_CONSTANTS.BOS_GST_RATE) : TAX_CONSTANTS.BOS_GST_RATE;
              sourceTable = 'eq_meters';
              sourceItemId = item.net_meter_id;
              sourceLabel = meter ? `${meter.brand ?? ''} ${meter.model ?? ''}`.trim() : item.description;
              sourceSpecification = quoteSpec(meter);
            } else if (item.la_id) {
              const la = LAs.find((l: any) => l.id === item.la_id);
              rate = la ? Number(la.rate) : 0;
              gstPct = la ? normalizeGstRate(la.gst_pct, TAX_CONSTANTS.BOS_GST_RATE) : TAX_CONSTANTS.BOS_GST_RATE;
              sourceTable = 'eq_lightning_arresters';
              sourceItemId = item.la_id;
              sourceLabel = la ? `${la.brand ?? ''} ${la.model ?? ''}`.trim() : item.description;
              sourceSpecification = quoteSpec(la);
            } else if (item.structure_id) {
              const structure = structures.find((s: any) => s.id === item.structure_id);
              rate = structure ? Number(structure.flat_rate ?? 0) : 0;
              gstPct = structure ? normalizeGstRate(structure.gst_pct, TAX_CONSTANTS.BOS_GST_RATE) : TAX_CONSTANTS.BOS_GST_RATE;
              sourceTable = 'eq_mounting_structures';
              sourceItemId = item.structure_id;
              sourceLabel = structure ? structure.name : item.description;
              sourceSpecification = quoteSpec(structure);
            } else if (item.bom_item_id) {
              const bom = bomItems.find((b: any) => b.id === item.bom_item_id);
              rate = bom ? Number(bom.rate) : 0;
              gstPct = bom ? normalizeGstRate(bom.gst_pct, TAX_CONSTANTS.BOS_GST_RATE) : TAX_CONSTANTS.BOS_GST_RATE;
              sourceTable = 'bom_template_items';
              sourceItemId = item.bom_item_id;
              sourceLabel = bom ? bom.description : item.description;
              sourceSpecification = quoteSpec(bom);
            } else if (item.comm_device_id) {
              const comm = commDevices.find((c: any) => c.id === item.comm_device_id);
              rate = comm ? Number(comm.rate) : 0;
              gstPct = comm ? normalizeGstRate(comm.gst_pct, TAX_CONSTANTS.BOS_GST_RATE) : TAX_CONSTANTS.BOS_GST_RATE;
              sourceTable = 'eq_communication_devices';
              sourceItemId = item.comm_device_id;
              sourceLabel = comm ? `${comm.brand ?? ''} ${comm.model ?? ''}`.trim() : item.description;
              sourceSpecification = quoteSpec(comm);
            } else if (item.structure_component_id) {
              const comp = structureComponentMasters.find((c: any) => c.id === item.structure_component_id);
              rate = comp ? Number(comp.rate) : 0;
              gstPct = comp ? normalizeGstRate(comp.gst_pct, TAX_CONSTANTS.BOS_GST_RATE) : TAX_CONSTANTS.BOS_GST_RATE;
              sourceTable = 'structure_component_master';
              sourceItemId = item.structure_component_id;
              sourceLabel = comp ? comp.name : item.description;
              sourceSpecification = quoteSpec(comp);
            }

            return {
              description: item.description,
              remarks: item.remarks ?? sourceSpecification,
              unit: item.unit ?? undefined,
              qty: Number(item.default_qty),
              ratePerUnit: rate,
              gstPct: gstPct as any,
              sourceTable,
              sourceItemId,
              sourceLabel,
            };
          });

          return {
            id: sys.id,
            name: sys.name,
            category: normalizeSystemCategory(sys.category),
            capacityKW: Number(sys.capacity_kw),
            panelWattage: Number(sys.panel_wattage_w ?? 0),
            panelQty: Number(sys.panel_qty ?? 0),
            stateId: sys.state_id ?? null,
            stateName: sys.state_id ? stateById.get(sys.state_id)?.stateName ?? null : null,
            stateCode: sys.state_id ? stateById.get(sys.state_id)?.stateCode ?? null : null,
            targetMarginPct: normalizeMarginPct(sys.target_margin_pct),
            items
          };
        });
        stateUpdate.dbSystems = loadedSystems.length > 0
          ? loadedSystems
          : buildGeneratedSystems(panels, inverters, batteries);
      }

      // Mark store loaded if core data is hydrated
      const isLoaded = (stateUpdate.dbSystems || get().dbSystems).length > 0;
      if (isLoaded) {
        stateUpdate.dbLoaded = true;
      }

      set(stateUpdate);

      if (stateUpdate.dbSchemes || stateUpdate.dbSchemeOverrides || stateUpdate.dbStateData) {
        const eligibleSchemes = getEligibleSubsidySchemes(get());
        if (!eligibleSchemes.some((scheme: any) => scheme.id === get().selectedSubsidySchemeId)) {
          const nextScheme = eligibleSchemes[0] ?? null;
          set({ selectedSubsidySchemeId: nextScheme?.id ?? null, dbActiveScheme: nextScheme ?? null, rpcSubsidyAmount: null });
        }
      }

      // Select system or recalculate if systems or equipment fields changed
      if (stateUpdate.dbSystems && stateUpdate.dbSystems.length > 0) {
        const currentSystemId = get().selectedSystemId;
        const systemExists = stateUpdate.dbSystems.some(s => s.id === currentSystemId);
        if (!currentSystemId) {
          get().selectSystem(stateUpdate.dbSystems[0].id);
        } else if (!systemExists) {
          set({
            selectedSystemId: null,
            calcResult: null,
            calcError: `Selected preset no longer exists: "${currentSystemId}". Please choose a valid preset.`,
          });
        } else {
          get().recalculate();
        }
      } else if (stateUpdate.dbPanels || stateUpdate.dbInverters || stateUpdate.dbBatteries) {
        get().recalculate();
      }
    } catch (err) {
      console.error("Failed to parse offline master data:", err);
    }
  }
});
