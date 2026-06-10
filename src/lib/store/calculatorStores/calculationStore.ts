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

export const createCalculationSlice: StateCreator<
  CalculatorState,
  [],
  [],
  Pick<
    CalculatorState,
    | 'selectedSystemId'
    | 'selectedState'
    | 'projectType'
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
    | 'inventorySummary'
    | 'dbOrientationMultipliers'
    | 'dbLoaded'
    | 'showInventoryInfo'
    | 'setShowInventoryInfo'
    | 'selectSystem'
    | 'setState'
    | 'setProjectType'
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
  >
> = (set, get) => ({
  showInventoryInfo: true,
  selectedSystemId: null,
  selectedState: '',
  projectType: 'residential',
  applySubsidy: true,
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
  dbLAs: [],
  dbStructureParts: [],
  dbStructureComponents: [],
  dbStructureBom: [],
  dbStructureAddons: [],
  dbOrientationMultipliers: { South: 1.0, 'East/West': 0.85, Flat: 0.90 } as Record<string, number>,
  inventorySummary: [],
  dbLoaded: false,

  setShowInventoryInfo: (val: boolean) => {
    set({ showInventoryInfo: val });
  },

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
        selectedPanelId: null,
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

  setProjectType: (type: ProjectType) => {
    set({ projectType: type });
    get().fetchRpcSubsidy();
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
    const { result, error } = runCalculation(state);
    set({ calcResult: result, calcError: error });
  },

  reset: () => {
    const { quotes } = get();
    const cleanState: any = { ...INITIAL_STATE, quotes };
    set(cleanState);
    set({ calcResult: null, calcError: null });
  },

  fetchMasterData: async () => {
    try {
      const bootstrapRes = await fetch('/api/erp/bootstrap', { cache: 'no-store' });
      if (!bootstrapRes.ok) throw new Error(`/api/erp/bootstrap returned ${bootstrapRes.status}`);
      const bootstrap = await bootstrapRes.json() as any;

      const mappedPanels = bootstrap.panels.map((p: any) => {
        const description = `${p.brand} ${p.model} ${Number(p.wattage_w)}W Panel`;
        const invMatch = bootstrap.inventorySummary.find((item: any) => item.item_description === description);
        const wac = invMatch && Number(invMatch.weighted_avg_cost) > 0 ? Number(invMatch.weighted_avg_cost) : null;
        return {
          id: p.id,
          brand: p.brand,
          model: p.model,
          wattage: Number(p.wattage_w),
          type: p.panel_type,
          ratePerWatt: wac !== null ? wac / Number(p.wattage_w) : (Number(p.wattage_w) > 0 ? Number(p.selling_price) / Number(p.wattage_w) : 0),
          gst_pct: Number(p.gst_pct),
        };
      });

      const mappedInverters = bootstrap.inverters.map((i: any) => {
        const description = `${i.brand} ${i.model} ${Number(i.capacity_kw)}kW Inverter`;
        const invMatch = bootstrap.inventorySummary.find((item: any) => item.item_description === description);
        const wac = invMatch && Number(invMatch.weighted_avg_cost) > 0 ? Number(invMatch.weighted_avg_cost) : null;
        return {
          id: i.id,
          brand: i.brand,
          model: i.model,
          capacityKW: Number(i.capacity_kw),
          type: i.inverter_type === 'on_grid' ? 'on-grid' : (i.inverter_type === 'micro' ? 'micro' : 'hybrid'),
          phases: Number(i.phases),
          rate: wac !== null ? wac : Number(i.selling_price),
          gst_pct: Number(i.gst_pct),
        };
      });

      const mappedBatteries = bootstrap.batteries.map((b: any) => {
        const description = `${b.brand} ${b.model} ${Number(b.capacity_kwh)}kWh Battery`;
        const invMatch = bootstrap.inventorySummary.find((item: any) => item.item_description === description);
        const wac = invMatch && Number(invMatch.weighted_avg_cost) > 0 ? Number(invMatch.weighted_avg_cost) : null;
        return {
          id: b.id,
          brand: b.brand,
          model: b.model,
          capacityKWh: Number(b.capacity_kwh),
          chemistry: b.chemistry,
          dodPct: Number(b.dod_pct),
          rate: wac !== null ? wac : Number(b.selling_price),
          gst_pct: Number(b.gst_pct),
        };
      });

      const mappedStructures = bootstrap.structures.map((st: any) => {
        const description = `${st.name} Structure (${st.material || ''})`;
        const invMatch = bootstrap.inventorySummary.find((item: any) => item.item_description === description);
        const wac = invMatch && Number(invMatch.weighted_avg_cost) > 0 ? Number(invMatch.weighted_avg_cost) : null;
        return {
          ...st,
          raw_material_rate: Number(st.raw_material_rate),
          fabrication_rate: Number(st.fabrication_rate),
          galvanizing_rate: Number(st.galvanizing_rate),
          rate_per_kg: Number(st.rate_per_kg),
          wastage_pct: Number(st.wastage_pct),
          fastener_weight_pct: Number(st.fastener_weight_pct),
          base_weight_kg: Number(st.base_weight_kg),
          flat_rate: wac !== null ? wac : (st.flat_rate !== null ? Number(st.flat_rate) : null),
          per_watt_rate: st.per_watt_rate !== null ? Number(st.per_watt_rate) : null,
          gst_pct: Number(st.gst_pct),
        };
      });

      const mappedMeters = bootstrap.meters.map((m: any) => {
        const description = `${m.meter_type === 'solar_meter' ? 'Solar' : 'Net'} Meter ${m.brand || ''} ${m.model || ''}`;
        const invMatch = bootstrap.inventorySummary.find((item: any) => item.item_description === description);
        const wac = invMatch && Number(invMatch.weighted_avg_cost) > 0 ? Number(invMatch.weighted_avg_cost) : null;
        return {
          ...m,
          phases: Number(m.phases),
          rate: wac !== null ? wac : Number(m.selling_price),
          gst_pct: Number(m.gst_pct),
        };
      });

      const mappedLAs = bootstrap.lightningArresters.map((l: any) => {
        const description = l.description || l.model;
        const invMatch = bootstrap.inventorySummary.find((item: any) => item.item_description === description);
        const wac = invMatch && Number(invMatch.weighted_avg_cost) > 0 ? Number(invMatch.weighted_avg_cost) : null;
        return {
          ...l,
          rate: wac !== null ? wac : Number(l.selling_price),
          gst_pct: Number(l.gst_pct),
        };
      });

      const mappedBomItems = bootstrap.bomItems.map((b: any) => {
        const invMatch = bootstrap.inventorySummary.find((item: any) => item.item_description === b.description);
        const wac = invMatch && Number(invMatch.weighted_avg_cost) > 0 ? Number(invMatch.weighted_avg_cost) : null;
        return {
          ...b,
          rate: wac !== null ? wac : Number(b.selling_price),
          gst_pct: Number(b.gst_pct),
        };
      });

      const mappedCommDevices = bootstrap.commDevices.map((c: any) => {
        const description = `${c.brand || ''} ${c.model || ''}`;
        const invMatch = bootstrap.inventorySummary.find((item: any) => item.item_description === description);
        const wac = invMatch && Number(invMatch.weighted_avg_cost) > 0 ? Number(invMatch.weighted_avg_cost) : null;
        return {
          ...c,
          rate: wac !== null ? wac : Number(c.selling_price),
          gst_pct: Number(c.gst_pct),
        };
      });

      const mappedStructureComponentMasters = (bootstrap.structureComponentMasters || []).map((scm: any) => {
        const description = scm.name;
        const invMatch = bootstrap.inventorySummary.find((item: any) => item.item_description === description);
        const wac = invMatch && Number(invMatch.weighted_avg_cost) > 0 ? Number(invMatch.weighted_avg_cost) : null;
        return {
          id: scm.id,
          name: scm.name,
          rate: wac !== null ? wac : Number(scm.selling_price),
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
          let gstPct = 0.18;
          if (item.panel_id) {
            const panel = mappedPanels.find((p: any) => p.id === item.panel_id);
            rate = panel ? Number(panel.ratePerWatt) * Number(panel.wattage) : 0;
            gstPct = panel ? Number(panel.gst_pct) : 0.05;
          } else if (item.inverter_id) {
            const inverter = mappedInverters.find((i: any) => i.id === item.inverter_id);
            rate = inverter ? Number(inverter.rate) : 0;
            gstPct = inverter ? Number(inverter.gst_pct) : 0.18;
          } else if (item.battery_id) {
            const battery = mappedBatteries.find((b: any) => b.id === item.battery_id);
            rate = battery ? Number(battery.rate) : 0;
            gstPct = battery ? Number(battery.gst_pct) : 0.12;
          } else if (item.solar_meter_id) {
            const meter = mappedMeters.find((m: any) => m.id === item.solar_meter_id);
            rate = meter ? Number(meter.rate) : 0;
            gstPct = meter ? Number(meter.gst_pct) : 0.18;
          } else if (item.net_meter_id) {
            const meter = mappedMeters.find((m: any) => m.id === item.net_meter_id);
            rate = meter ? Number(meter.rate) : 0;
            gstPct = meter ? Number(meter.gst_pct) : 0.18;
          } else if (item.la_id) {
            const la = mappedLAs.find((l: any) => l.id === item.la_id);
            rate = la ? Number(la.rate) : 0;
            gstPct = la ? Number(la.gst_pct) : 0.18;
          } else if (item.structure_id) {
            const structure = mappedStructures.find((s: any) => s.id === item.structure_id);
            rate = structure ? Number(structure.flat_rate ?? 0) : 0;
            gstPct = structure ? Number(structure.gst_pct) : 0.18;
          } else if (item.bom_item_id) {
            const bom = mappedBomItems.find((b: any) => b.id === item.bom_item_id);
            rate = bom ? Number(bom.rate) : 0;
            gstPct = bom ? Number(bom.gst_pct) : 0.18;
          } else if (item.comm_device_id) {
            const comm = mappedCommDevices.find((c: any) => c.id === item.comm_device_id);
            rate = comm ? Number(comm.rate) : 0;
            gstPct = comm ? Number(comm.gst_pct) : 0.12;
          } else if (item.structure_component_id) {
            const comp = mappedStructureComponentMasters.find((c: any) => c.id === item.structure_component_id);
            rate = comp ? Number(comp.rate) : 0;
            gstPct = comp ? Number(comp.gst_pct) : 0.18;
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
          targetMarginPct: Number(sys.target_margin_pct),
          items
        };
      });

      set({
        dbSystems: mappedSystems,
        dbStateData: mappedStateData,
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
        dbLoaded: true
      });

      get().recalculate();
    } catch (err) {
      console.error("Failed to fetch database master data:", err);
    }
  },
});
