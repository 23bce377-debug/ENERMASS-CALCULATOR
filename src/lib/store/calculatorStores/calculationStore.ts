import { StateCreator } from 'zustand';
import {
  CalculatorState,
  getEquipmentCatalogsFromSettings,
  runCalculation,
  randomId,
  INITIAL_STATE
} from '../calculatorTypes';
import { SYSTEMS, type SolarSystem, type BomItem } from '../../data/bom';
import { type ProjectType, type RowOverride, type DiscountType } from '../../engine/calculator';
import { TAX_CONSTANTS } from '@/lib/tax-constants';

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
    | 'targetMarginPct'
    | 'overrides'
    | 'customItems'
    | 'rateMaster'
    | 'disabledItemIndices'
    | 'additionalCosts'
    | 'discountType'
    | 'discountVal'
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
    | 'inventorySummary'
    | 'dbOrientationMultipliers'
    | 'dbLoaded'
    | 'selectSystem'
    | 'setState'
    | 'setProjectType'
    | 'setItcEligible'
    | 'setMarginOverride'
    | 'setRowOverride'
    | 'clearRowOverride'
    | 'addCustomItem'
    | 'removeCustomItem'
    | 'setRateMaster'
    | 'toggleItemSelection'
    | 'addAdditionalCost'
    | 'removeAdditionalCost'
    | 'setDiscount'
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
  rpcSubsidyAmount: undefined,
  dbActiveScheme: null,
  targetMarginPct: null,
  overrides: {},
  customItems: [],
  rateMaster: {},
  disabledItemIndices: {},
  additionalCosts: [],
  discountType: 'none',
  discountVal: 0,
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

    if (system && system.defaultEquipment) {
      set({
        selectedSystemId: id,
        selectedState: system.stateName || state.selectedState,
        selectedPanelId: null,
        selectedGoalWattage: system.capacityKW * 1000,
        panelMix: system.defaultEquipment.panelMix ?? {},
        selectedInverterMix: system.defaultEquipment.inverterMix ?? {},
        selectedBatteryMix: system.defaultEquipment.batteryMix ?? {},
        overrides: {},
      });
      get().recalculate();
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
      selectedState: system?.stateName || state.selectedState,
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
    get().fetchRpcSubsidy();
  },

  setState: (state: string) => {
    set({ selectedState: state });
    get().fetchRpcSubsidy();
  },

  setSelectedGoalWattage: (w: number | null) => {
    set({ selectedGoalWattage: w });
    get().recalculate();
  },

  setProjectType: (type: ProjectType) => {
    set({ projectType: type });
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

  setMarginOverride: (pct: number | null) => {
    set({ targetMarginPct: pct });
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
    const state = get();
    // Auto-assign first system if none selected but master data is loaded
    // Use soft-set to preserve current equipment selections
    if (!state.selectedSystemId && state.dbLoaded && state.dbSystems.length > 0) {
      set({ selectedSystemId: state.dbSystems[0].id });
    }
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
      // Parallel lazy-chunk fetches — equipment, structures, rules, and org data load
      // concurrently instead of sequentially inside a single blocking request.
      const [equipRes, structRes, rulesRes, orgRes] = await Promise.all([
        fetch('/api/erp/master/equipment', { cache: 'no-store', credentials: 'include' }),
        fetch('/api/erp/master/structures', { cache: 'no-store', credentials: 'include' }),
        fetch('/api/erp/master/rules', { cache: 'no-store', credentials: 'include' }),
        fetch('/api/erp/master/org', { cache: 'no-store', credentials: 'include' }),
      ]);

      // Surface auth / server errors clearly
      if (!equipRes.ok) throw new Error(`/api/erp/master/equipment returned ${equipRes.status}`);
      if (!structRes.ok) throw new Error(`/api/erp/master/structures returned ${structRes.status}`);
      if (!rulesRes.ok) throw new Error(`/api/erp/master/rules returned ${rulesRes.status}`);
      if (!orgRes.ok) throw new Error(`/api/erp/master/org returned ${orgRes.status}`);

      const [equip, struct, rules, org] = await Promise.all([
        equipRes.json() as Promise<any>,
        structRes.json() as Promise<any>,
        rulesRes.json() as Promise<any>,
        orgRes.json() as Promise<any>,
      ]);

      // Merge into the same flat shape the mapping logic below expects.
      const bootstrap: any = {
        ...equip,   // panels, inverters, batteries, meters, lightningArresters, commDevices
        ...struct,  // structures, weightLookups, structureComponents, structureBom, structureAddons,
                    // structureAccessoryRates, structureMaterialRates, structureTemplates,
                    // structureTemplateItems, walkwayTemplates, ladderTemplates, structureComponentMasters
        ...rules,   // stateRules, slabs, schemes, systems, taxHsnCodes, taxGstRates, bomItems
        ...org,     // inventorySummary, vendors, structureVendors, appSettings
      };

      const mappedPanels = bootstrap.panels.map((p: any) => {
        return {
          id: p.id,
          brand: p.brand,
          model: p.model,
          wattage: Number(p.wattage_w),
          type: p.panel_type,
          ratePerWatt: Number(p.wattage_w) > 0 ? Number(p.selling_price) / Number(p.wattage_w) : 0,
          gst_pct: Number(p.gst_pct),
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
          gst_pct: Number(i.gst_pct),
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
          gst_pct: Number(b.gst_pct),
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
          gst_pct: Number(st.gst_pct),
        };
      });

      const mappedMeters = bootstrap.meters.map((m: any) => {
        return {
          ...m,
          phases: Number(m.phases),
          rate: Number(m.selling_price),
          gst_pct: Number(m.gst_pct),
        };
      });

      const mappedLAs = bootstrap.lightningArresters.map((l: any) => {
        return {
          ...l,
          rate: Number(l.selling_price),
          gst_pct: Number(l.gst_pct),
        };
      });

      const mappedBomItems = bootstrap.bomItems.map((b: any) => {
        return {
          ...b,
          rate: Number(b.selling_price),
          gst_pct: Number(b.gst_pct),
        };
      });

      const mappedCommDevices = bootstrap.commDevices.map((c: any) => {
        return {
          ...c,
          rate: Number(c.selling_price),
          gst_pct: Number(c.gst_pct),
        };
      });

      const mappedStructureComponentMasters = (bootstrap.structureComponentMasters || []).map((scm: any) => {
        return {
          id: scm.id,
          name: scm.name,
          rate: Number(scm.selling_price),
          gst_pct: Number(scm.gst_pct)
        };
      });

      const mappedStateData: Record<string, any> = {};
      for (const rule of bootstrap.stateRules) {
        mappedStateData[rule.state_name] = {
          name: rule.state_name,
          stateCode: rule.state_code,
          sunHoursPerDay: Number(rule.sun_hours_per_day),
          performanceRatio: Number(rule.performance_ratio),
          labourMultiplier: Number(rule.labour_multiplier),
          gstOnOutput: Number(rule.gst_on_output),
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

      const activeScheme = bootstrap.schemes?.find((s: any) => s.code === 'PM_SURYA_GHAR_2024' && s.is_active);
      const schemeSlabs = activeScheme 
        ? bootstrap.slabs.filter((s: any) => s.scheme_id === activeScheme.id)
        : [];
      const sortedSlabs = [...schemeSlabs].sort((a, b) => a.slab_index - b.slab_index).map(s => ({
        start_kw: Number(s.start_kw),
        end_kw: s.end_kw !== null ? Number(s.end_kw) : null,
        rate_per_kw: Number(s.rate_per_kw),
        is_fixed_amount: Boolean(s.is_fixed_amount),
        fixed_amount: s.fixed_amount !== null ? Number(s.fixed_amount) : null,
      }));

      const mappedSystems: SolarSystem[] = bootstrap.systems.map((sys: any) => {
        const items = (sys.system_items || []).map((item: any) => {
          let rate = 0;
          let gstPct: any = TAX_CONSTANTS.COMMERCIAL_GST_RATE;
          if (item.panel_id) {
            const panel = mappedPanels.find((p: any) => p.id === item.panel_id);
            rate = panel ? Number(panel.ratePerWatt) * Number(panel.wattage) : 0;
            gstPct = panel ? Number(panel.gst_pct) : TAX_CONSTANTS.RESIDENTIAL_GST_RATE;
          } else if (item.inverter_id) {
            const inverter = mappedInverters.find((i: any) => i.id === item.inverter_id);
            rate = inverter ? Number(inverter.rate) : 0;
            gstPct = inverter ? Number(inverter.gst_pct) : TAX_CONSTANTS.COMMERCIAL_GST_RATE;
          } else if (item.battery_id) {
            const battery = mappedBatteries.find((b: any) => b.id === item.battery_id);
            rate = battery ? Number(battery.rate) : 0;
            gstPct = battery ? Number(battery.gst_pct) : 0.12;
          } else if (item.solar_meter_id) {
            const meter = mappedMeters.find((m: any) => m.id === item.solar_meter_id);
            rate = meter ? Number(meter.rate) : 0;
            gstPct = meter ? Number(meter.gst_pct) : TAX_CONSTANTS.COMMERCIAL_GST_RATE;
          } else if (item.net_meter_id) {
            const meter = mappedMeters.find((m: any) => m.id === item.net_meter_id);
            rate = meter ? Number(meter.rate) : 0;
            gstPct = meter ? Number(meter.gst_pct) : TAX_CONSTANTS.COMMERCIAL_GST_RATE;
          } else if (item.la_id) {
            const la = mappedLAs.find((l: any) => l.id === item.la_id);
            rate = la ? Number(la.rate) : 0;
            gstPct = la ? Number(la.gst_pct) : TAX_CONSTANTS.COMMERCIAL_GST_RATE;
          } else if (item.structure_id) {
            const structure = mappedStructures.find((s: any) => s.id === item.structure_id);
            rate = structure ? Number(structure.flat_rate ?? 0) : 0;
            gstPct = structure ? Number(structure.gst_pct) : TAX_CONSTANTS.COMMERCIAL_GST_RATE;
          } else if (item.bom_item_id) {
            const bom = mappedBomItems.find((b: any) => b.id === item.bom_item_id);
            rate = bom ? Number(bom.rate) : 0;
            gstPct = bom ? Number(bom.gst_pct) : TAX_CONSTANTS.COMMERCIAL_GST_RATE;
          } else if (item.comm_device_id) {
            const comm = mappedCommDevices.find((c: any) => c.id === item.comm_device_id);
            rate = comm ? Number(comm.rate) : 0;
            gstPct = comm ? Number(comm.gst_pct) : 0.12;
          } else if (item.structure_component_id) {
            const comp = mappedStructureComponentMasters.find((c: any) => c.id === item.structure_component_id);
            rate = comp ? Number(comp.rate) : 0;
            gstPct = comp ? Number(comp.gst_pct) : TAX_CONSTANTS.COMMERCIAL_GST_RATE;
          }

          return {
            description: item.description,
            remarks: item.remarks ?? undefined,
            unit: item.unit ?? undefined,
            qty: Number(item.default_qty),
            ratePerUnit: rate,
            gstPct: gstPct as any
          };
        });

        return {
          id: sys.id,
          name: sys.name,
          category: sys.category.replace('_', '-') as any,
          capacityKW: Number(sys.capacity_kw),
          panelWattage: Number(sys.panel_wattage_w ?? 0),
          panelQty: Number(sys.panel_qty ?? 0),
          stateId: sys.state_id ?? null,
          stateName: sys.state_id ? stateById.get(sys.state_id)?.stateName ?? null : null,
          stateCode: sys.state_id ? stateById.get(sys.state_id)?.stateCode ?? null : null,
          targetMarginPct: Number(sys.target_margin_pct),
          items
        };
      });

      const { systemStateMap, stateTerms } = buildStateScopedMaps(bootstrap);

      set({
        dbSystems: mappedSystems,
        dbStateData: mappedStateData,
        dbSystemStateMap: systemStateMap,
        dbStateTerms: stateTerms,
        dbPanels: mappedPanels,
        dbInverters: mappedInverters,
        dbBatteries: mappedBatteries,
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
        inventorySummary: bootstrap.inventorySummary,
        dbStructureComponentMasters: mappedStructureComponentMasters,
        dbLoaded: true
      });

      const currentSystemId = get().selectedSystemId;
      const systemExists = mappedSystems.some(s => s.id === currentSystemId);
      if ((!currentSystemId || !systemExists) && mappedSystems.length > 0) {
        get().selectSystem(mappedSystems[0].id);
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
          gst_pct: Number(p.gst_pct),
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
          gst_pct: Number(i.gst_pct),
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
          gst_pct: Number(b.gst_pct),
        }));
      }

      if (bootstrap.meters) {
        stateUpdate.dbMeters = bootstrap.meters.map((m: any) => ({
          ...m,
          phases: Number(m.phases),
          rate: Number(m.selling_price),
          gst_pct: Number(m.gst_pct),
        }));
      }

      if (bootstrap.lightningArresters) {
        stateUpdate.dbLAs = bootstrap.lightningArresters.map((l: any) => ({
          ...l,
          rate: Number(l.selling_price),
          gst_pct: Number(l.gst_pct),
        }));
      }

      // commDevices is mapped locally inside the systems block

      if (bootstrap.stateRules) {
        const mappedStateData: Record<string, any> = {};
        for (const rule of bootstrap.stateRules) {
          mappedStateData[rule.state_name] = {
            name: rule.state_name,
            stateCode: rule.state_code,
            sunHoursPerDay: Number(rule.sun_hours_per_day),
            performanceRatio: Number(rule.performance_ratio),
            labourMultiplier: Number(rule.labour_multiplier),
            gstOnOutput: Number(rule.gst_on_output),
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
        const activeScheme = bootstrap.schemes.find((s: any) => s.code === 'PM_SURYA_GHAR_2024' && s.is_active);
        stateUpdate.dbActiveScheme = activeScheme || null;
        if (activeScheme && bootstrap.slabs) {
          const schemeSlabs = bootstrap.slabs.filter((s: any) => s.scheme_id === activeScheme.id);
          stateUpdate.dbSlabs = [...schemeSlabs].sort((a, b) => a.slab_index - b.slab_index).map(s => ({
            start_kw: Number(s.start_kw),
            end_kw: s.end_kw !== null ? Number(s.end_kw) : null,
            rate_per_kw: Number(s.rate_per_kw),
            is_fixed_amount: Boolean(s.is_fixed_amount),
            fixed_amount: s.fixed_amount !== null ? Number(s.fixed_amount) : null,
          }));
        }
      }

      if (bootstrap.bomItems) {
        stateUpdate.dbStructureParts = bootstrap.bomItems.map((b: any) => ({
          ...b,
          rate: Number(b.selling_price),
          gst_pct: Number(b.gst_pct),
        }));
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
          gst_pct: Number(st.gst_pct),
        }));
      }

      if (bootstrap.structureComponentMasters) {
        stateUpdate.dbStructureComponentMasters = bootstrap.structureComponentMasters.map((scm: any) => ({
          id: scm.id,
          name: scm.name,
          rate: Number(scm.selling_price),
          gst_pct: Number(scm.gst_pct)
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
          gst_pct: Number(c.gst_pct)
        }));
        const bomItems = stateUpdate.dbStructureParts || get().dbStructureParts;
        const structures = stateUpdate.dbStructures || get().dbStructures;
        const structureComponentMasters = stateUpdate.dbStructureComponentMasters || get().dbStructureComponentMasters;

        stateUpdate.dbSystems = bootstrap.systems.map((sys: any) => {
          const items = (sys.system_items || []).map((item: any) => {
            let rate = 0;
            let gstPct: any = TAX_CONSTANTS.COMMERCIAL_GST_RATE;
            if (item.panel_id) {
              const panel = panels.find((p: any) => p.id === item.panel_id);
              rate = panel ? Number(panel.ratePerWatt) * Number(panel.wattage) : 0;
              gstPct = panel ? Number(panel.gst_pct) : TAX_CONSTANTS.RESIDENTIAL_GST_RATE;
            } else if (item.inverter_id) {
              const inverter = inverters.find((i: any) => i.id === item.inverter_id);
              rate = inverter ? Number(inverter.rate) : 0;
              gstPct = inverter ? Number(inverter.gst_pct) : TAX_CONSTANTS.COMMERCIAL_GST_RATE;
            } else if (item.battery_id) {
              const battery = batteries.find((b: any) => b.id === item.battery_id);
              rate = battery ? Number(battery.rate) : 0;
              gstPct = battery ? Number(battery.gst_pct) : 0.12;
            } else if (item.solar_meter_id) {
              const meter = meters.find((m: any) => m.id === item.solar_meter_id);
              rate = meter ? Number(meter.rate) : 0;
              gstPct = meter ? Number(meter.gst_pct) : TAX_CONSTANTS.COMMERCIAL_GST_RATE;
            } else if (item.net_meter_id) {
              const meter = meters.find((m: any) => m.id === item.net_meter_id);
              rate = meter ? Number(meter.rate) : 0;
              gstPct = meter ? Number(meter.gst_pct) : TAX_CONSTANTS.COMMERCIAL_GST_RATE;
            } else if (item.la_id) {
              const la = LAs.find((l: any) => l.id === item.la_id);
              rate = la ? Number(la.rate) : 0;
              gstPct = la ? Number(la.gst_pct) : TAX_CONSTANTS.COMMERCIAL_GST_RATE;
            } else if (item.structure_id) {
              const structure = structures.find((s: any) => s.id === item.structure_id);
              rate = structure ? Number(structure.flat_rate ?? 0) : 0;
              gstPct = structure ? Number(structure.gst_pct) : TAX_CONSTANTS.COMMERCIAL_GST_RATE;
            } else if (item.bom_item_id) {
              const bom = bomItems.find((b: any) => b.id === item.bom_item_id);
              rate = bom ? Number(bom.rate) : 0;
              gstPct = bom ? Number(bom.gst_pct) : TAX_CONSTANTS.COMMERCIAL_GST_RATE;
            } else if (item.comm_device_id) {
              const comm = commDevices.find((c: any) => c.id === item.comm_device_id);
              rate = comm ? Number(comm.rate) : 0;
              gstPct = comm ? Number(comm.gst_pct) : 0.12;
            } else if (item.structure_component_id) {
              const comp = structureComponentMasters.find((c: any) => c.id === item.structure_component_id);
              rate = comp ? Number(comp.rate) : 0;
              gstPct = comp ? Number(comp.gst_pct) : TAX_CONSTANTS.COMMERCIAL_GST_RATE;
            }

            return {
              description: item.description,
              remarks: item.remarks ?? undefined,
              unit: item.unit ?? undefined,
              qty: Number(item.default_qty),
              ratePerUnit: rate,
              gstPct: gstPct as any
            };
          });

          return {
            id: sys.id,
            name: sys.name,
            category: sys.category.replace('_', '-') as any,
            capacityKW: Number(sys.capacity_kw),
            panelWattage: Number(sys.panel_wattage_w ?? 0),
            panelQty: Number(sys.panel_qty ?? 0),
            stateId: sys.state_id ?? null,
            stateName: sys.state_id ? stateById.get(sys.state_id)?.stateName ?? null : null,
            stateCode: sys.state_id ? stateById.get(sys.state_id)?.stateCode ?? null : null,
            targetMarginPct: Number(sys.target_margin_pct),
            items
          };
        });
      }

      // Mark store loaded if core data is hydrated
      const isLoaded = (stateUpdate.dbPanels || get().dbPanels).length > 0 &&
                        (stateUpdate.dbSystems || get().dbSystems).length > 0;
      if (isLoaded) {
        stateUpdate.dbLoaded = true;
      }

      set(stateUpdate);

      // Select system or recalculate if systems or equipment fields changed
      if (stateUpdate.dbSystems && stateUpdate.dbSystems.length > 0) {
        const currentSystemId = get().selectedSystemId;
        const systemExists = stateUpdate.dbSystems.some(s => s.id === currentSystemId);
        if ((!currentSystemId || !systemExists)) {
          get().selectSystem(stateUpdate.dbSystems[0].id);
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
