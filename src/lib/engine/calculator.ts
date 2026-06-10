/**
 * ENERMASS Solar Pricing Calculator — Calculation Engine
 * ======================================================
 * Pure-function engine. No rounding in intermediate steps.
 * All formulas aligned with the math.md spec.
 */

import { SYSTEMS, type SolarSystem, type BomItem } from '../data/bom';
import { type StateData } from '../data/masters';
import { calculateEnergyProjections } from './energy';
import { calculatePricingAndMargins, calculateDiscountAmount } from './margin';
import { calculateFinancialProjections } from './financials';

export function roundTo5(num: number | null | undefined): number {
  if (num === null || num === undefined || isNaN(num)) return 0;
  return Math.round((num + Number.EPSILON) * 100000) / 100000;
}

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface RowOverride {
  qty?: number;
  ratePerUnit?: number;
  gstPct?: number;
}

export interface RateMaster {
  [description: string]: { rate: number; active: boolean };
}

export interface AdditionalCost {
  id: string;
  description: string;
  amount: number;
}

export type DiscountType = 'none' | 'flat' | 'percent';
export type ProjectType = 'residential' | 'commercial';

export interface CalcInput {
  systemId: string;
  systems?: SolarSystem[];
  rpcSubsidyAmount?: number;
  state: string;
  projectType: ProjectType;
  targetMarginPct?: number;
  targetMRPInclGST?: number;
  targetMRPPerWatt?: number;
  gstOnOutput?: number;
  gstOnOutputOverride?: number;
  allowGstOverride?: boolean;
  overrides?: Record<number, RowOverride>;
  rateMaster?: RateMaster;
  disabledItemIndices?: Record<number, boolean>;
  discountType?: DiscountType;
  discountVal?: number;
  additionalCosts?: AdditionalCost[];
  customItems?: import('../data/bom').BomItem[];
  panelRateOverride?: number;
  panelQtyOverride?: number;
  inverterRateOverride?: number;
  inverterQtyOverride?: number;
  batteryRateOverride?: number;
  batteryQtyOverride?: number;
  gridTariffPerKWh?: number;
  
  // Engineering Accuracy additions
  orientation?: 'South' | 'East/West' | 'Flat';
  dcCableLengthM?: number;
  acCableLengthM?: number;
  electricityInflationRate?: number;
  panelCapacityKW?: number;
  inverterCapacityKW?: number;
  panelDegradationRate?: number;
  stateData?: Record<string, StateData>;
  slabs?: Array<{
    start_kw: number;
    end_kw: number | null;
    rate_per_kw: number;
    is_fixed_amount: boolean;
    fixed_amount: number | null;
  }>;

  // Structure selections
  structureId?: string;
  structurePricingMode?: 'weight' | 'per_watt' | 'flat';
  structureRateOverride?: number;
  structureWastageOverride?: number;
  structureFastenerOverride?: number;
  structureBaseWeightOverride?: number;
  structureWeightLookupKg?: number;
  
  structureCustomRawRate?: number;
  structureCustomFabricationRate?: number;
  structureCustomGalvanizingRate?: number;
  structureComponentMix?: Record<string, number>;
  structureAddonMix?: Record<string, number>;

  // Meters selections
  solarMeterId?: string;
  solarMeterQty?: number;
  netMeterId?: string;
  netMeterQty?: number;

  // Lightning Arrester selections
  lightningArresterId?: string;
  lightningArresterQty?: number;

  // Master lists for database data
  dbStructures?: any[];
  dbWeightLookups?: any[];
  dbMeters?: any[];
  dbLAs?: any[];
  dbStructureParts?: any[];
  dbStructureComponents?: any[];
  dbStructureBom?: any[];
  dbStructureAddons?: any[];
  dbOrientationMultipliers?: Record<string, number>;
  dbPanels?: any[];
  dbInverters?: any[];
  dbBatteries?: any[];
  panelMix?: Record<string, number>;
  selectedInverterMix?: Record<string, number>;
  selectedBatteryMix?: Record<string, number>;
  selectedPanelId?: string | null;
  maxSubsidyCapacityKW?: number;
}

export interface LineResult {
  index: number;
  description: string;
  remarks?: string;
  unit?: string;
  effectiveQty: number;
  effectiveRate: number;
  effectiveGstPct: number;
  lineTotal: number;
  lineGST: number;
  lineSubTotal: number;
  isOverridden: boolean;
  isCustomItem?: boolean;
  customItemIndex?: number;
  isDisabled?: boolean;
}

export interface CalcResult {
  // BOM breakdown
  lines: LineResult[];

  // Cost aggregates
  costBeforeGST: number;
  totalInputGST: number;
  totalIncGST: number;

  // Margin & MRP
  effectiveMarginPct: number;
  mrpExclGST: number;
  marginAmount: number;
  gstOutputRate: number;
  mrpInclGST: number;

  // Per-kW analysis
  perKWexclGST: number;
  perKWinclGST: number;

  // Discount
  discountAmount: number;
  finalCustomerPrice: number;

  // Subsidy
  subsidyAmount: number;
  beneficiaryContribution: number;

  // Additional costs
  additionalCostTotal: number;

  // Energy generation
  dailyGenerationKWh: number;
  monthlyGenerationKWh: number;
  annualGenerationKWh: number;
  monthlySavingsINR: number;
  annualSavingsINR: number;
  paybackYears: number;
  lcoe: number;
  lifetimeSavingsINR: number;
}

// Equipment descriptions that are resolved from the DB model selection,
// NOT via Rate Master or equipment overrides.
// Now loaded from database - no hardcoded values.

// ─── Rate Resolution ────────────────────────────────────────────────────────────

/**
 * Helper to perform case-insensitive lookup in RateMaster.
 */
export function getMasterEntry(description: string, rateMaster?: RateMaster) {
  if (!rateMaster) return undefined;
  const target = description.toUpperCase();
  // Exact match first
  if (rateMaster[description]) return rateMaster[description];
  // Case-insensitive key match
  const matchKey = Object.keys(rateMaster).find(k => k.toUpperCase() === target);
  return matchKey ? rateMaster[matchKey] : undefined;
}

const EQUIPMENT_DESCRIPTIONS = new Set(['PANEL', 'INVERTER', 'BATTERY']);

/**
 * Resolve the effective rate for a BOM item.
 *
 * Priority chain (first non-undefined wins):
 *   1. Row-level override  (overrides[index].ratePerUnit)
 *   2. Rate master          (rateMaster[description].rate, if active) — NOT applied to PANEL/INVERTER/BATTERY
 *   3. Item default         (item.ratePerUnit — already set from per-model DB rate)
 */
export function resolveRate(
  item: BomItem,
  index: number,
  overrides?: Record<number, RowOverride>,
  rateMaster?: RateMaster,
  _equipmentOverrides?: {
    panelRateOverride?: number;
    inverterRateOverride?: number;
    batteryRateOverride?: number;
  },
): number {
  // 1. Row-level override (manual cell edit)
  const rowOverride = overrides?.[index];
  if (rowOverride?.ratePerUnit !== undefined) {
    return rowOverride.ratePerUnit;
  }

  // 2. Rate master — only for non-equipment BOM items
  const descUpper = item.description.toUpperCase();
  const isEquipment = ['PANEL', 'INVERTER', 'BATTERY'].some(prefix =>
    descUpper === prefix || descUpper.startsWith(prefix + ' ') || descUpper.startsWith(prefix + ':')
  );
  if (!isEquipment) {
    const masterEntry = getMasterEntry(item.description, rateMaster);
    if (masterEntry && masterEntry.active && masterEntry.rate > 0) {
      return masterEntry.rate;
    }
  }

  // 3. Item default (already carries the per-model DB rate)
  const defaultRate = item.ratePerUnit;
  if (defaultRate < 0) {
    throw new Error(`Rate not configured for "${item.description}" (index ${index})`);
  }
  return defaultRate;
}

// ─── Subsidy Calculation ────────────────────────────────────────────────────────

/**
 * Get the subsidy amount for a given capacity, state, and project type.
 *
 * Rules:
 * - Commercial projects → always ₹0
 * - Uses STATE_DATA[state].subsidyRules — tiered lookup.
 *   Find first rule where capacityKW <= rule.maxKW → return rule.amount.
 * - If no rule matches or subsidyRules is empty → ₹0
 */
export function getSubsidyAmount(
  panelCapacityKW: number,
  inverterCapacityKW: number | undefined,
  state: string,
  projectType: ProjectType,
  stateDataInput?: Record<string, StateData>,
  slabs?: Array<{
    start_kw: number;
    end_kw: number | null;
    rate_per_kw: number;
    is_fixed_amount: boolean;
    fixed_amount: number | null;
  }>,
  maxCapacityKW?: number,
): number {
  // Commercial projects never receive residential subsidy
  if (projectType === 'commercial') {
    return 0;
  }

  const eligibleCapacityKW = inverterCapacityKW !== undefined ? Math.min(panelCapacityKW, inverterCapacityKW) : panelCapacityKW;

  if (!slabs || slabs.length === 0) {
    return 0;
  }

  const capacityForSubsidy = Math.min(eligibleCapacityKW, maxCapacityKW ?? 10.0);
  let total = 0;
  for (const slab of slabs) {
    const start = Number(slab.start_kw);
    if (capacityForSubsidy <= start) {
      break;
    }
    if (slab.is_fixed_amount) {
      total += Number(slab.fixed_amount ?? 0);
    } else {
      const end = slab.end_kw === null ? capacityForSubsidy : Math.min(capacityForSubsidy, Number(slab.end_kw));
      const applicable = end - start;
      total += applicable * Number(slab.rate_per_kw);
    }
  }
  return total;
}

export function resolveStructureItems(
  input: CalcInput,
  capacityKW: number,
  capacityWatts: number
): {
  items: BomItem[];
  removeGenericStructure: boolean;
} {
  const items: BomItem[] = [];
  let removeGenericStructure = false;

  if (!input.structureId) {
    return { items, removeGenericStructure };
  }

  if (input.structureId === 'custom') {
    const mode = input.structurePricingMode ?? 'weight';
    if (mode === 'weight') {
      const lookupWeight = input.structureWeightLookupKg ?? 0;
      const baseWeight = input.structureBaseWeightOverride ?? 0;
      const wastage = input.structureWastageOverride ?? 0.05;
      const fasteners = input.structureFastenerOverride ?? 0.02;
      const rawRate = input.structureCustomRawRate ?? 0;
      const fabRate = input.structureCustomFabricationRate ?? 0;
      const galvRate = input.structureCustomGalvanizingRate ?? 0;
      
      const ratePerKg = rawRate + fabRate + galvRate;
      const totalWeight = (lookupWeight + baseWeight) * (1 + wastage) * (1 + fasteners);
      const weightMultiplier = lookupWeight > 0 ? totalWeight / lookupWeight : 1;

      const structureParts = (input.dbStructureParts ?? []).filter((p: any) => 
        p.section === 'mounting_structure' && p.is_active
      );
      
      structureParts.forEach((part: any) => {
        const qtyMultiplier = Number(part.weight_multiplier ?? 1);
        items.push({
          description: part.description,
          qty: qtyMultiplier * weightMultiplier,
          ratePerUnit: Number(part.rate ?? 0),
          unit: part.unit ?? 'Nos',
          remarks: part.remarks ?? '',
          gstPct: Number(part.gst_pct ?? 0.18) as any,
        });
      });
    } else if (mode === 'per_watt') {
      items.push({
        description: 'STRUCTURE',
        qty: 1,
        ratePerUnit: capacityWatts * (input.structureRateOverride ?? 0),
        unit: 'Set',
        remarks: 'Custom Structure (Per watt)',
        gstPct: 0.18 as any,
      });
    } else {
      items.push({
        description: 'STRUCTURE',
        qty: 1,
        ratePerUnit: input.structureRateOverride ?? 0,
        unit: 'Set',
        remarks: 'Custom Structure (Flat rate)',
        gstPct: 0.18 as any,
      });
    }
  } else {
    const struct = (input.dbStructures ?? []).find(s => s.id === input.structureId);
    if (struct) {
      const structureGst = Number(struct.gst_pct);
      const mode = input.structurePricingMode ?? (struct.flat_rate !== null ? 'flat' : 'weight');
      const structComponents = (input.dbStructureComponents ?? []).filter(c => c.structure_id === struct.id);
      
      if (mode === 'weight' && structComponents.length > 0) {
        structComponents.forEach(c => {
          let bomEntry = (input.dbStructureBom ?? []).find(b => 
            b.component_id === c.id && 
            capacityKW >= Number(b.capacity_kw_min) && 
            capacityKW <= Number(b.capacity_kw_max)
          );
          if (!bomEntry && (input.dbStructureBom ?? []).length > 0) {
            const sameCompBom = (input.dbStructureBom ?? []).filter(b => b.component_id === c.id);
            if (sameCompBom.length > 0) {
              bomEntry = sameCompBom.reduce((prev, curr) => 
                Math.abs(Number(curr.capacity_kw_min) - capacityKW) < Math.abs(Number(prev.capacity_kw_min) - capacityKW) ? curr : prev
              );
            }
          }
          const overrideQty = input.structureComponentMix?.[c.id];
          const qty = overrideQty !== undefined ? overrideQty : (bomEntry ? Number(bomEntry.qty) : 0);

          if (qty > 0) {
            items.push({
              description: `STRUCTURE - ${c.name}`,
              qty: qty,
              ratePerUnit: Number(c.selling_price),
              unit: c.unit,
              remarks: `${struct.name} component`,
              gstPct: Number(c.gst_pct) as any,
            });
          }
        });
        removeGenericStructure = true;
      } else {
        let structureQty = 0;
        let structureRate = 0;
        let structureUnit = 'Set';
        let structureRemarks = '';

        if (mode === 'weight') {
          let lookup = (input.dbWeightLookups ?? []).find(l => 
            l.structure_id === struct.id && 
            capacityKW >= Number(l.capacity_kw_min) && 
            capacityKW <= Number(l.capacity_kw_max)
          );
          if (!lookup) {
            throw new Error(`No structure_weight_lookup for structure ${struct.id} at capacity ${capacityKW}kW`);
          }
          const lookupWeight = Number(lookup.total_weight_kg);
          const baseWeight = Number(struct.base_weight_kg ?? 0);
          const wastage = Number(struct.wastage_pct ?? 0.05);
          const fasteners = Number(struct.fastener_weight_pct ?? 0.02);
          const ratePerKg = Number(struct.rate_per_kg ?? (Number(struct.raw_material_rate ?? 0) + Number(struct.fabrication_rate ?? 0) + Number(struct.galvanizing_rate ?? 0)));
          
          structureQty = (lookupWeight + baseWeight) * (1 + wastage) * (1 + fasteners);
          structureRate = ratePerKg;
          structureUnit = 'kg';
          structureRemarks = `${struct.name} (${lookupWeight}kg lookup)`;
        } else if (mode === 'per_watt') {
          structureQty = 1;
          structureRate = capacityWatts * Number(struct.per_watt_rate ?? 0);
          structureUnit = 'Set';
          structureRemarks = `${struct.name} (Per watt)`;
        } else {
          structureQty = 1;
          structureRate = Number(struct.flat_rate ?? 0);
          structureUnit = 'Set';
          structureRemarks = `${struct.name} (Flat rate)`;
        }
        
        items.push({
          description: 'STRUCTURE',
          qty: structureQty,
          ratePerUnit: structureRate,
          unit: structureUnit,
          remarks: structureRemarks,
          gstPct: structureGst as any,
        });
      }
    }
  }

  // Resolve STRUCTURE ADD-ONS (Walkway, Ladder, etc.)
  if (input.dbStructureAddons && input.dbStructureAddons.length > 0) {
    input.dbStructureAddons.forEach((addon: any) => {
      const addonQty = input.structureAddonMix?.[addon.id];
      if (addonQty !== undefined && addonQty > 0) {
        items.push({
          description: `STRUCTURE - ${addon.name} (${addon.material})`,
          qty: addonQty,
          ratePerUnit: Number(addon.rate_per_unit),
          unit: addon.unit || 'Meter',
          remarks: addon.notes || 'Structure addon',
          gstPct: Number(addon.gst_pct ?? 0.18) as any,
        });
      }
    });
  }

  return { items, removeGenericStructure };
}

// ─── Main Calculation Engine ────────────────────────────────────────────────────

/**
 * Full system calculation. NO rounding in intermediate steps.
 * Round only in UI display layer.
 */
export function calculateSystem(input: CalcInput): CalcResult {
  const systems = input.systems ?? SYSTEMS;
  // ── Step 1: Lookup system ──
  const system = systems.find((s) => s.id === input.systemId);
  if (!system) {
    throw new Error(`System not found: "${input.systemId}"`);
  }

  // ── Step 2: Lookup state ──
  const stateDataResolved = input.stateData ?? {};
  const stateData = stateDataResolved[input.state];
  if (!stateData) {
    throw new Error(`State not found: "${input.state}"`);
  }

  // ── Equipment overrides bundle ──
  const equipmentOverrides = {
    panelRateOverride: input.panelRateOverride,
    panelQtyOverride: input.panelQtyOverride,
    inverterRateOverride: input.inverterRateOverride,
    inverterQtyOverride: input.inverterQtyOverride,
    batteryRateOverride: input.batteryRateOverride,
    batteryQtyOverride: input.batteryQtyOverride,
  };

  const capacityKW = system.capacityKW || 0.001;
  const capacityWatts = capacityKW * 1000;

  // Clone system items and expand generic placeholders to specific selected models
  let resolvedItems: import('../data/bom').BomItem[] = [];

  for (const item of system.items) {
    const descUpper = item.description.toUpperCase();

    if (descUpper === 'PANEL') {
      const panelMixEntries = Object.entries(input.panelMix ?? {}).filter(
        ([, qty]) => Number.isFinite(qty) && qty > 0
      );
      if (panelMixEntries.length > 0 && input.dbPanels && input.dbPanels.length > 0) {
        for (const [panelId, qty] of panelMixEntries) {
          const p = input.dbPanels.find(x => x.id === panelId);
          if (p) {
            resolvedItems.push({
              description: `PANEL ${p.brand} ${p.model} (${p.wattage}W)`,
              qty: qty,
              ratePerUnit: p.ratePerWatt * p.wattage,
              gstPct: p.gst_pct ?? 0.05,
              unit: 'Nos',
              remarks: item.remarks ?? '',
            });
          }
        }
      } else if (input.selectedPanelId && input.dbPanels && input.dbPanels.length > 0) {
        const p = input.dbPanels.find(x => x.id === input.selectedPanelId);
        if (p) {
          const qty = input.panelQtyOverride !== undefined ? input.panelQtyOverride : (system.panelQty ?? item.qty);
          resolvedItems.push({
            description: `PANEL ${p.brand} ${p.model} (${p.wattage}W)`,
            qty: qty,
            ratePerUnit: p.ratePerWatt * p.wattage,
            gstPct: p.gst_pct ?? 0.05,
            unit: 'Nos',
            remarks: item.remarks ?? '',
          });
        }
      } else {
        // Fallback to generic row if no db information is loaded
        const rate = input.panelRateOverride !== undefined ? input.panelRateOverride : item.ratePerUnit;
        const qty = input.panelQtyOverride !== undefined ? input.panelQtyOverride : item.qty;
        resolvedItems.push({
          ...item,
          ratePerUnit: rate,
          qty: qty
        });
      }
    }
    else if (descUpper === 'INVERTER') {
      const inverterMixEntries = Object.entries(input.selectedInverterMix ?? {}).filter(
        ([, qty]) => Number.isFinite(qty) && qty > 0
      );
      if (inverterMixEntries.length > 0 && input.dbInverters && input.dbInverters.length > 0) {
        for (const [invId, qty] of inverterMixEntries) {
          const inv = input.dbInverters.find(x => x.id === invId);
          if (inv) {
            resolvedItems.push({
              description: `INVERTER ${inv.brand} ${inv.model}`,
              qty: qty,
              ratePerUnit: inv.rate,
              gstPct: inv.gst_pct ?? 0.12,
              unit: 'Nos',
              remarks: item.remarks ?? '',
            });
          }
        }
      } else {
        // Fallback to generic row if no db information is loaded
        const rate = input.inverterRateOverride !== undefined ? input.inverterRateOverride : item.ratePerUnit;
        const qty = input.inverterQtyOverride !== undefined ? input.inverterQtyOverride : item.qty;
        resolvedItems.push({
          ...item,
          ratePerUnit: rate,
          qty: qty
        });
      }
    }
    else if (descUpper === 'BATTERY') {
      const batteryMixEntries = Object.entries(input.selectedBatteryMix ?? {}).filter(
        ([, qty]) => Number.isFinite(qty) && qty > 0
      );
      if (batteryMixEntries.length > 0 && input.dbBatteries && input.dbBatteries.length > 0) {
        for (const [batId, qty] of batteryMixEntries) {
          const bat = input.dbBatteries.find(x => x.id === batId);
          if (bat) {
            resolvedItems.push({
              description: `BATTERY ${bat.brand} ${bat.model}`,
              qty: qty,
              ratePerUnit: bat.rate,
              gstPct: bat.gst_pct ?? 0.18,
              unit: 'Nos',
              remarks: item.remarks ?? '',
            });
          }
        }
      } else {
        // Fallback to generic row if no db information is loaded
        const rate = input.batteryRateOverride !== undefined ? input.batteryRateOverride : item.ratePerUnit;
        const qty = input.batteryQtyOverride !== undefined ? input.batteryQtyOverride : item.qty;
        resolvedItems.push({
          ...item,
          ratePerUnit: rate,
          qty: qty
        });
      }
    }
    else {
      resolvedItems.push({ ...item });
    }
  }

  // Helper to find or update/create an item in BOM
  const upsertItem = (description: string, itemData: Partial<import('../data/bom').BomItem>, forceAdd = false) => {
    const idx = resolvedItems.findIndex(item => item.description.toUpperCase() === description.toUpperCase());
    if (idx >= 0) {
      resolvedItems[idx] = { ...resolvedItems[idx], ...itemData } as import('../data/bom').BomItem;
    } else if (forceAdd || (itemData.qty !== undefined && itemData.qty > 0)) {
      resolvedItems.push({
        description,
        qty: itemData.qty ?? 0,
        ratePerUnit: itemData.ratePerUnit ?? 0,
        gstPct: (itemData.gstPct ?? 0.18) as any,
        unit: itemData.unit ?? 'Nos',
        remarks: itemData.remarks ?? '',
      });
    }
  };

  // 1. Resolve STRUCTURE & ADD-ONS
  const resolvedStruct = resolveStructureItems(input, capacityKW, capacityWatts);
  resolvedStruct.items.forEach(item => {
    upsertItem(item.description, item, true);
  });
  if (resolvedStruct.removeGenericStructure) {
    const idx = resolvedItems.findIndex(item => item.description.toUpperCase() === 'STRUCTURE');
    if (idx >= 0) {
      resolvedItems.splice(idx, 1);
    }
  }

  // 2. Resolve SOLAR METER
  if (input.solarMeterId === 'custom') {
    upsertItem('SOLAR METER', {
      qty: input.solarMeterQty ?? 1,
      ratePerUnit: 0,
      gstPct: 0.18 as any,
      unit: 'Nos',
      remarks: 'Custom Solar Meter',
    }, true);
  } else {
    const solarMeterMeter = (input.dbMeters ?? []).find(m => m.id === input.solarMeterId);
    if (!solarMeterMeter) {
      throw new Error(`Solar meter not found: ${input.solarMeterId}`);
    }
    const gst = Number(solarMeterMeter.gst_pct);
    if (isNaN(gst) || gst <= 0) {
      throw new Error(`Solar meter GST not configured for ${solarMeterMeter.id}`);
    }
    upsertItem('SOLAR METER', {
      qty: input.solarMeterQty ?? 1,
      ratePerUnit: Number(solarMeterMeter.rate),
      gstPct: gst as any,
      unit: 'Nos',
      remarks: solarMeterMeter.description ?? `${solarMeterMeter.brand} ${solarMeterMeter.model}`,
    }, true);
  }

  // 3. Resolve NET METER
  if (input.netMeterId === 'custom') {
    upsertItem('NET METER', {
      qty: input.netMeterQty ?? 1,
      ratePerUnit: 0,
      gstPct: 0.18 as any,
      unit: 'Nos',
      remarks: 'Custom Net Meter',
    }, true);
  } else {
    const netMeterMeter = (input.dbMeters ?? []).find(m => m.id === input.netMeterId);
    if (!netMeterMeter) {
      throw new Error(`Net meter not found: ${input.netMeterId}`);
    }
    const gst = Number(netMeterMeter.gst_pct);
    if (isNaN(gst) || gst <= 0) {
      throw new Error(`Net meter GST not configured for ${netMeterMeter.id}`);
    }
    upsertItem('NET METER', {
      qty: input.netMeterQty ?? 1,
      ratePerUnit: Number(netMeterMeter.rate),
      gstPct: gst as any,
      unit: 'Nos',
      remarks: netMeterMeter.description ?? `${netMeterMeter.brand} ${netMeterMeter.model}`,
    }, true);
  }

  // 4. Resolve LIGHTNING ARRESTER
  if (input.lightningArresterId) {
    if (input.lightningArresterId === 'custom') {
      const laKey = resolvedItems.some(item => item.description.toUpperCase() === 'L/A') ? 'L/A' : 'LIGHTNING ARRESTER';
      upsertItem(laKey, {
        qty: input.lightningArresterQty ?? 1,
        ratePerUnit: 0,
        gstPct: 0.18 as any,
        unit: 'Nos',
        remarks: 'Custom Lightning Arrester',
      });
    } else {
      const la = (input.dbLAs ?? []).find(l => l.id === input.lightningArresterId);
      if (!la) {
        throw new Error(`Lightning arrester not found: ${input.lightningArresterId}`);
      }
      const gst = Number(la.gst_pct);
      if (isNaN(gst) || gst <= 0) {
        throw new Error(`Lightning arrester GST not configured for ${la.id}`);
      }
      const laKey = resolvedItems.some(item => item.description.toUpperCase() === 'L/A') ? 'L/A' : 'LIGHTNING ARRESTER';
      upsertItem(laKey, {
        qty: input.lightningArresterQty ?? 1,
        ratePerUnit: Number(la.rate),
        gstPct: gst as any,
        unit: 'Nos',
        remarks: la.description ?? la.model,
      });
    }
  }

  // ── Step 3-4: Process each BOM item ──
  const allItems = [...resolvedItems, ...(input.customItems || [])];
  const lines: LineResult[] = allItems.map((item, index) => {
    const rowOverride = input.overrides?.[index];
    const isDisabled = input.disabledItemIndices?.[index] === true;

    // Resolve effective values
    const effectiveQty = roundTo5(
      rowOverride?.qty !== undefined
        ? rowOverride.qty
        : item.description.toUpperCase() === 'PANEL' &&
          equipmentOverrides.panelQtyOverride !== undefined
        ? equipmentOverrides.panelQtyOverride
        : item.description.toUpperCase() === 'INVERTER' &&
          equipmentOverrides.inverterQtyOverride !== undefined
        ? equipmentOverrides.inverterQtyOverride
        : item.description.toUpperCase() === 'BATTERY' &&
          equipmentOverrides.batteryQtyOverride !== undefined
        ? equipmentOverrides.batteryQtyOverride
        : item.description.toUpperCase() === 'DC CABLE' && input.dcCableLengthM !== undefined
        ? input.dcCableLengthM
        : item.description.toUpperCase() === 'AC CABLE' && input.acCableLengthM !== undefined
        ? input.acCableLengthM
        : item.qty
    );

    const effectiveRate = roundTo5(resolveRate(
      item,
      index,
      input.overrides,
      input.rateMaster,
      equipmentOverrides,
    ));

    const effectiveGstPct = roundTo5(
      rowOverride?.gstPct !== undefined ? rowOverride.gstPct : item.gstPct
    );

    // Compute line totals — rounded to 5 decimal places (set to 0 if item is unchecked/disabled)
    const lineTotal = isDisabled ? 0 : roundTo5(effectiveQty * effectiveRate);
    const lineGST = isDisabled ? 0 : roundTo5(lineTotal * effectiveGstPct);
    const lineSubTotal = roundTo5(lineTotal + lineGST);

    const descUpper = item.description.toUpperCase();
    const isEquipment = ['PANEL', 'INVERTER', 'BATTERY'].some(prefix =>
      descUpper === prefix || descUpper.startsWith(prefix + ' ') || descUpper.startsWith(prefix + ':')
    );
    const masterEntry = isEquipment ? undefined : getMasterEntry(item.description, input.rateMaster);
    const isOverridden =
      rowOverride?.qty !== undefined ||
      rowOverride?.ratePerUnit !== undefined ||
      rowOverride?.gstPct !== undefined ||
      (item.description.toUpperCase() === 'PANEL' &&
        (input.panelRateOverride !== undefined ||
          input.panelQtyOverride !== undefined)) ||
      (item.description.toUpperCase() === 'INVERTER' &&
        (input.inverterRateOverride !== undefined || input.inverterQtyOverride !== undefined)) ||
      (item.description.toUpperCase() === 'BATTERY' &&
        (input.batteryRateOverride !== undefined || input.batteryQtyOverride !== undefined)) ||
      (item.description.toUpperCase() === 'DC CABLE' && input.dcCableLengthM !== undefined) ||
      (item.description.toUpperCase() === 'AC CABLE' && input.acCableLengthM !== undefined) ||
      (masterEntry?.active === true) ||
      false;

    const isCustomItem = index >= system.items.length;
    const customItemIndex = isCustomItem ? index - system.items.length : undefined;

    return {
      index,
      description: item.description,
      remarks: item.remarks,
      unit: item.unit,
      effectiveQty,
      effectiveRate,
      effectiveGstPct,
      lineTotal,
      lineGST,
      lineSubTotal,
      isOverridden,
      isCustomItem,
      customItemIndex,
      isDisabled,
    };
  });

  // ── Step 5: Cost aggregates ──
  const costBeforeGST = roundTo5(lines.reduce((sum, l) => sum + l.lineTotal, 0));
  const totalInputGST = roundTo5(lines.reduce((sum, l) => sum + l.lineGST, 0));
  const totalIncGST = roundTo5(costBeforeGST + totalInputGST);

  // ── Step 7: Resolve output GST ──
  const gstOutputRate = roundTo5(
    input.gstOnOutputOverride !== undefined && input.allowGstOverride === true
      ? input.gstOnOutputOverride
      : (input.gstOnOutput !== undefined ? input.gstOnOutput : stateData.gstOnOutput)
  );

  // ── Step 8 & 6: Resolve MRP & Margin ──
  const marginResults = calculatePricingAndMargins({
    costBeforeGST,
    targetMarginPct: input.targetMarginPct,
    targetMRPInclGST: input.targetMRPInclGST,
    targetMRPPerWatt: input.targetMRPPerWatt,
    gstOutputRate,
    capacityWatts,
    defaultMarginPct: system.targetMarginPct
  });
  const mrpInclGST = roundTo5(marginResults.mrpInclGST);
  const mrpExclGST = roundTo5(marginResults.mrpExclGST);
  const marginAmount = roundTo5(marginResults.marginAmount);
  const effectiveMarginPct = roundTo5(marginResults.effectiveMarginPct);

  // ── Per-kW analysis ──
  const capKW = system.capacityKW || 0.001; // Avoid div by zero
  const perKWexclGST = roundTo5(mrpExclGST / capKW);
  const perKWinclGST = roundTo5(mrpInclGST / capKW);

  // ── Step 10: Discount ──
  const discountAmount = roundTo5(calculateDiscountAmount({
    mrpInclGST,
    discountType: input.discountType ?? 'none',
    discountVal: input.discountVal ?? 0
  }));

  // ── Step 11: Additional costs ──
  const additionalCostTotal = roundTo5((input.additionalCosts ?? []).reduce(
    (sum, c) => sum + c.amount,
    0,
  ));

  // ── Step 12: Final customer price ──
  const finalCustomerPrice = roundTo5(Math.max(0, mrpInclGST - discountAmount + additionalCostTotal));

  // ── Step 13: Subsidy ──
  const subsidyAmount = roundTo5(getSubsidyAmount(
    input.panelCapacityKW ?? system.capacityKW,
    input.inverterCapacityKW,
    input.state,
    input.projectType,
    input.stateData,
    input.slabs,
    input.maxSubsidyCapacityKW
  ));

  // ── Step 14: Beneficiary contribution ──
  const beneficiaryContribution = roundTo5(Math.max(0, finalCustomerPrice - subsidyAmount));

  // ── Step 15: Energy generation ──
  const energyProjections = calculateEnergyProjections({
    panelCapacityKW: input.panelCapacityKW ?? system.capacityKW,
    inverterCapacityKW: input.inverterCapacityKW,
    sunHoursPerDay: stateData.sunHoursPerDay,
    performanceRatio: stateData.performanceRatio,
    orientation: input.orientation,
    orientationMultipliers: input.dbOrientationMultipliers
  });
  const dailyGenerationKWh = roundTo5(energyProjections.dailyGenerationKWh);
  const monthlyGenerationKWh = roundTo5(energyProjections.monthlyGenerationKWh);
  const annualGenerationKWh = roundTo5(energyProjections.annualGenerationKWh);

  // ── Step 16: Savings ──
  const stateGridTariff = (stateData as any).gridTariffInr;
  if (stateGridTariff === undefined) {
    throw new Error('grid_tariff_inr not configured for state');
  }
  const effectiveGridTariffPerKWh =
    input.gridTariffPerKWh !== undefined && input.gridTariffPerKWh >= 0
      ? input.gridTariffPerKWh
      : stateGridTariff;

  const monthlySavingsINR = roundTo5(monthlyGenerationKWh * effectiveGridTariffPerKWh);
  const annualSavingsINR = roundTo5(annualGenerationKWh * effectiveGridTariffPerKWh);

  // ── Step 17: Payback & LCOE ──
  const financialProjections = calculateFinancialProjections({
    beneficiaryContribution,
    annualGenerationKWh,
    annualSavingsINR,
    panelDegradationRate: input.panelDegradationRate,
    electricityInflationRate: input.electricityInflationRate,
    systemLifetimeYears: 25
  });
  const paybackYears = roundTo5(financialProjections.paybackYears);
  const lcoe = roundTo5(financialProjections.lcoe);
  const lifetimeSavingsINR = roundTo5(financialProjections.lifetimeSavingsINR);

  // ── Return complete result ──
  return {
    lines,

    costBeforeGST,
    totalInputGST,
    totalIncGST,

    effectiveMarginPct,
    mrpExclGST,
    marginAmount,
    gstOutputRate,
    mrpInclGST,

    perKWexclGST,
    perKWinclGST,

    discountAmount,
    finalCustomerPrice,

    subsidyAmount,
    beneficiaryContribution,

    additionalCostTotal,

    dailyGenerationKWh,
    monthlyGenerationKWh,
    annualGenerationKWh,
    monthlySavingsINR,
    annualSavingsINR,
    paybackYears,
    lcoe,
    lifetimeSavingsINR,
  };
}

// ─── Indian Currency Formatter ──────────────────────────────────────────────────

/**
 * Format a number as Indian Rupees: ₹1,23,456.78
 * Uses Intl.NumberFormat('en-IN') for proper lakh/crore grouping.
 */
export function formatINR(value: number, decimals?: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: decimals ?? 0,
    maximumFractionDigits: decimals ?? 0,
  }).format(value);
}
