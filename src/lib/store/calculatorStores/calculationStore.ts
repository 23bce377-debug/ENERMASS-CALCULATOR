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
    | 'inventorySummary'
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
  dbWeightLookups: [],
  dbMeters: [],
  dbLAs: [],
  dbStructureParts: [],
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

    set({
      selectedSystemId: id,
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
          ratePerWatt: wac !== null ? wac / Number(p.wattage_w) : Number(p.rate_per_watt),
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
          rate: wac !== null ? wac : Number(i.rate),
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
          rate: wac !== null ? wac : Number(b.rate),
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
          rate: wac !== null ? wac : Number(m.rate),
          gst_pct: Number(m.gst_pct),
        };
      });

      const mappedLAs = bootstrap.lightningArresters.map((l: any) => {
        const description = l.description || l.model;
        const invMatch = bootstrap.inventorySummary.find((item: any) => item.item_description === description);
        const wac = invMatch && Number(invMatch.weighted_avg_cost) > 0 ? Number(invMatch.weighted_avg_cost) : null;
        return {
          ...l,
          rate: wac !== null ? wac : Number(l.rate),
          gst_pct: Number(l.gst_pct),
        };
      });

      const mappedBomItems = bootstrap.bomItems.map((b: any) => {
        const invMatch = bootstrap.inventorySummary.find((item: any) => item.item_description === b.description);
        const wac = invMatch && Number(invMatch.weighted_avg_cost) > 0 ? Number(invMatch.weighted_avg_cost) : null;
        return {
          ...b,
          rate: wac !== null ? wac : Number(b.rate),
          gst_pct: Number(b.gst_pct),
        };
      });

      const mappedCommDevices = bootstrap.commDevices.map((c: any) => {
        const description = `${c.brand || ''} ${c.model || ''}`;
        const invMatch = bootstrap.inventorySummary.find((item: any) => item.item_description === description);
        const wac = invMatch && Number(invMatch.weighted_avg_cost) > 0 ? Number(invMatch.weighted_avg_cost) : null;
        return {
          ...c,
          rate: wac !== null ? wac : Number(c.rate),
          gst_pct: Number(c.gst_pct),
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

      const sortedSlabs = [...bootstrap.slabs].sort((a, b) => a.slab_index - b.slab_index).map(s => ({
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
            gstPct = battery ? Number(battery.gst_pct) : 0.18;
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

      const mappedQuotes = bootstrap.quotes.map((q: any) => {
        const overrides: Record<number, RowOverride> = {};
        (q.quote_items || []).forEach((item: any) => {
          if (item.is_qty_overridden || item.is_rate_overridden) {
            overrides[item.sort_order] = {
              qty: item.is_qty_overridden ? Number(item.qty) : undefined,
              ratePerUnit: item.is_rate_overridden ? Number(item.rate_per_unit) : undefined,
              gstPct: Number(item.gst_pct) as any,
            };
          }
        });

        const disabledItemIndices: Record<number, boolean> = {};
        (q.quote_items || []).forEach((item: any) => {
          if (!item.is_included) {
            disabledItemIndices[item.sort_order] = true;
          }
        });

        const calculations = {
          lines: (q.quote_items || []).map((item: any) => ({
            index: item.sort_order,
            description: item.description,
            remarks: item.remarks || '',
            unit: item.unit || '',
            effectiveQty: Number(item.qty),
            effectiveRate: Number(item.rate_per_unit),
            effectiveGstPct: Number(item.gst_pct),
            lineTotal: Number(item.line_total),
            lineGST: Number(item.line_gst),
            lineSubTotal: Number(item.line_subtotal),
            isOverridden: item.is_qty_overridden || item.is_rate_overridden,
            isDisabled: !item.is_included,
          })),
          costBeforeGST: Number(q.cost_before_gst),
          totalInputGST: Number(q.total_input_gst),
          totalIncGST: Number(q.total_incl_gst),
          effectiveMarginPct: Number(q.effective_margin_pct),
          mrpExclGST: Number(q.mrp_excl_gst),
          marginAmount: Number(q.mrp_excl_gst) - Number(q.cost_before_gst),
          gstOutputRate: Number(q.gst_output_rate),
          mrpInclGST: Number(q.mrp_incl_gst),
          discountAmount: Number(q.discount_amount),
          finalCustomerPrice: Number(q.final_customer_price),
          subsidyAmount: Number(q.subsidy_amount),
          beneficiaryContribution: Number(q.beneficiary_contribution),
          additionalCostTotal: Number(q.additional_costs_total),
          perKWexclGST: Number(q.per_kw_excl_gst || 0),
          perKWinclGST: Number(q.per_kw_incl_gst || 0),
          dailyGenerationKWh: Number(q.annual_generation_kwh || 0) / 365,
          monthlyGenerationKWh: Number(q.annual_generation_kwh || 0) / 12,
          annualGenerationKWh: Number(q.annual_generation_kwh || 0),
          monthlySavingsINR: Number(q.annual_savings_inr || 0) / 12,
          annualSavingsINR: Number(q.annual_savings_inr || 0),
          paybackYears: Number(q.payback_years || 0),
          lcoe: 0,
          lifetimeSavingsINR: Number(q.lifetime_savings_inr || 0),
        };

        return {
          quoteId: q.quote_number,
          date: q.date || q.created_at.split('T')[0],
          projectType: q.project_type,
          customer: {
            name: q.customer_name,
            phone: q.customer_phone || '',
            whatsapp: q.customer_whatsapp || '',
            email: q.customer_email || '',
          },
          address: {
            line1: q.address_line1 || '',
            line2: q.address_line2 || '',
            city: q.city || '',
            state: q.state_name || 'Gujarat',
            pin: q.pincode || '',
          },
          site: {
            meterNo: q.meter_number || '',
            sanctionedLoad: String(q.sanctioned_load_kw || ''),
            monthlyBill: Number(q.monthly_bill_inr || 0),
            roofType: q.roof_type || 'RCC',
            roofArea: Number(q.roof_area_sqft || 0),
          },
          sales: {
            projectTitle: q.project_title || '',
            execName: q.exec_name || '',
            notes: q.notes || '',
            saleType: (q.sale_type === 'new' ? 'New' : q.sale_type === 'upgrade' ? 'Upgrade' : 'Referral') as any,
          },
          systemId: q.system_id || '',
          systemName: q.system_name || '',
          category: (q.system_category || '').replace('_', '-'),
          selectedState: q.state_name || 'Gujarat',
          equipment: {
            panelBrandId: q.panel_brand_model || undefined,
            inverterBrandId: q.inverter_brand_model || undefined,
            batteryBrandId: q.battery_brand_model || undefined,
          },
          additionalCosts: (q.quote_additional_costs || []).map((c: any) => ({
            id: c.id,
            description: c.description,
            amount: Number(c.amount),
          })),
          discountType: q.discount_type,
          discountVal: Number(q.discount_val),
          overrides,
          disabledItemIndices,
          targetMarginPct: Number(q.effective_margin_pct),
          calculations,
          status: (q.status === 'draft' ? 'Draft' : q.status === 'sent' ? 'Sent' : q.status === 'won' ? 'Won' : 'Lost') as any,
          createdAt: q.created_at,
          updatedAt: q.updated_at,
          version: q.version,

          structureId: q.structure_id,
          structurePricingMode: q.structure_pricing_mode || 'weight',
          solarMeterId: q.solar_meter_id,
          solarMeterQty: q.solar_meter_qty || 1,
          netMeterId: q.net_meter_id,
          netMeterQty: q.net_meter_qty || 1,
          lightningArresterId: q.la_id,
          lightningArresterQty: q.la_qty || 1,
          gstOnOutputOverride: q.gst_output_override,
          targetMRPInclGST: q.target_mrp_incl_gst,
          targetMRPPerWatt: q.target_mrp_per_watt,
        };
      });

      set({
        dbSystems: mappedSystems,
        dbStateData: mappedStateData,
        dbPanels: mappedPanels,
        dbInverters: mappedInverters,
        dbBatteries: mappedBatteries,
        dbSlabs: sortedSlabs,
        dbStructures: mappedStructures,
        dbWeightLookups: bootstrap.weightLookups || [],
        dbMeters: mappedMeters,
        dbLAs: mappedLAs,
        dbStructureParts: mappedBomItems,
        inventorySummary: bootstrap.inventorySummary,
        quotes: mappedQuotes,
        dbLoaded: true
      });

      get().recalculate();
    } catch (err) {
      console.error("Failed to fetch database master data:", err);
    }
  },
});
