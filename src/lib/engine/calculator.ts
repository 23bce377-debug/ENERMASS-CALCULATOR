/**
 * ENERMASS Solar Pricing Calculator — Calculation Engine
 * ======================================================
 * Pure-function engine. No rounding in intermediate steps.
 * All formulas aligned with the math.md spec.
 */

import { SYSTEMS, type SolarSystem, type BomItem } from '../data/bom';
import { type StateData } from '../data/masters';
import { calculateEnergyProjections } from './energy';
import { calculateSubsidyAmount } from './subsidy';
import { calculatePricingAndMargins, calculateDiscountAmount } from './margin';
import { calculateFinancialProjections } from './financials';

const GRID_TARIFF_PER_KWH = 8.0;

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
  state: string;
  projectType: ProjectType;
  targetMarginPct?: number;
  targetMRPInclGST?: number;
  targetMRPPerWatt?: number;
  gstOnOutput?: number;
  gstOnOutputOverride?: number;
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
  rpcSubsidyAmount?: number;

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
  dbOrientationMultipliers?: Record<string, number>;
  dbPanels?: any[];
  dbInverters?: any[];
  dbBatteries?: any[];
  panelMix?: Record<string, number>;
  selectedInverterMix?: Record<string, number>;
  selectedBatteryMix?: Record<string, number>;
  selectedPanelId?: string | null;
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
  return item.ratePerUnit;
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
): number {
  // Commercial projects never receive residential subsidy
  if (projectType === 'commercial') {
    return 0;
  }

  const eligibleCapacityKW = inverterCapacityKW !== undefined ? Math.min(panelCapacityKW, inverterCapacityKW) : panelCapacityKW;

  // Use dynamic database-driven slabs if available
  if (slabs && slabs.length > 0) {
    // Clamp to max 10.0 kW for PM Surya Ghar subsidy calculations
    const capacityForSubsidy = Math.min(eligibleCapacityKW, 10.0);
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

  // Fallback to exact PM Surya Ghar piecewise linear formula:
  // - First 2 kW: ₹30,000 per kW (₹300 per watt)
  // - Next 1 kW (2 kW to 3 kW): ₹18,000 per kW (₹180 per watt)
  // - Capped at ₹78,000 total (reached at 3 kW or above)
  const capacityForSubsidy = Math.min(eligibleCapacityKW, 10.0);
  const tier1Capacity = Math.min(capacityForSubsidy, 2.0);
  const tier1Amount = tier1Capacity * 30000;

  const tier2Capacity = Math.max(0.0, Math.min(capacityForSubsidy - 2.0, 1.0));
  const tier2Amount = tier2Capacity * 18000;

  return tier1Amount + tier2Amount;
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

  // 1. Resolve STRUCTURE
  let structureGst = 0.18;
  let structureQty = 0;
  let structureRate = 0;
  let structureUnit = 'Set';
  let structureRemarks = '';
  if (input.structureId) {
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
        
        // Decompose into individual parts from database
        const totalWeight = (lookupWeight + baseWeight) * (1 + wastage) * (1 + fasteners);
        const weightMultiplier = lookupWeight > 0 ? totalWeight / lookupWeight : 1;

        // Parts list from database (eq_bom_items with section = 'mounting_structure')
        const structureParts = (input.dbStructureParts ?? []).filter((p: any) => 
          p.section === 'mounting_structure' && p.is_active
        );
        
        structureParts.forEach((part: any) => {
          const qtyMultiplier = Number(part.weight_multiplier ?? 1);
          upsertItem(part.description, {
            qty: qtyMultiplier * weightMultiplier,
            ratePerUnit: Number(part.rate ?? 0),
            unit: part.unit ?? 'Nos',
            remarks: part.remarks ?? '',
            gstPct: Number(part.gst_pct ?? 0.18) as any,
          });
        });
      } else if (mode === 'per_watt') {
        upsertItem('STRUCTURE', {
          qty: 1,
          ratePerUnit: capacityWatts * (input.structureRateOverride ?? 0),
          unit: 'Set',
          remarks: 'Custom Structure (Per watt)',
          gstPct: 0.18 as any,
        });
      } else {
        upsertItem('STRUCTURE', {
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
        structureGst = Number(struct.gst_pct);
        const mode = input.structurePricingMode ?? (struct.flat_rate !== null ? 'flat' : 'weight');
        if (mode === 'weight') {
          // Weight lookup
          let lookup = (input.dbWeightLookups ?? []).find(l => 
            l.structure_id === struct.id && 
            capacityKW >= Number(l.capacity_kw_min) && 
            capacityKW <= Number(l.capacity_kw_max)
          );
          if (!lookup && (input.dbWeightLookups ?? []).length > 0) {
            // Find closest by capacity
            const sameStructLookups = (input.dbWeightLookups ?? []).filter(l => l.structure_id === struct.id);
            if (sameStructLookups.length > 0) {
              lookup = sameStructLookups.reduce((prev, curr) => 
                Math.abs(Number(curr.capacity_kw_min) - capacityKW) < Math.abs(Number(prev.capacity_kw_min) - capacityKW) ? curr : prev
              );
            }
          }
          
          const lookupWeight = lookup ? Number(lookup.total_weight_kg) : 0;
          const baseWeight = Number(struct.base_weight_kg ?? 0);
          const wastage = Number(struct.wastage_pct ?? 0.05);
          const fasteners = Number(struct.fastener_weight_pct ?? 0.02);
          const ratePerKg = Number(struct.rate_per_kg ?? (Number(struct.raw_material_rate ?? 0) + Number(struct.fabrication_rate ?? 0) + Number(struct.galvanizing_rate ?? 0)));
          
          const finalWeight = (lookupWeight + baseWeight) * (1 + wastage) * (1 + fasteners);
          
          structureQty = finalWeight;
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
        
        upsertItem('STRUCTURE', {
          qty: structureQty,
          ratePerUnit: structureRate,
          unit: structureUnit,
          remarks: structureRemarks,
          gstPct: structureGst as any,
        });
      }
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
    upsertItem('SOLAR METER', {
      qty: solarMeterMeter ? (input.solarMeterQty ?? 1) : 0,
      ratePerUnit: solarMeterMeter ? Number(solarMeterMeter.rate) : 0,
      gstPct: solarMeterMeter ? (Number(solarMeterMeter.gst_pct) as any) : 0.18,
      unit: 'Nos',
      remarks: solarMeterMeter ? (solarMeterMeter.description ?? `${solarMeterMeter.brand} ${solarMeterMeter.model}`) : 'Solar Meter (unselected)',
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
    upsertItem('NET METER', {
      qty: netMeterMeter ? (input.netMeterQty ?? 1) : 0,
      ratePerUnit: netMeterMeter ? Number(netMeterMeter.rate) : 0,
      gstPct: netMeterMeter ? (Number(netMeterMeter.gst_pct) as any) : 0.18,
      unit: 'Nos',
      remarks: netMeterMeter ? (netMeterMeter.description ?? `${netMeterMeter.brand} ${netMeterMeter.model}`) : 'Net Meter (unselected)',
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
      if (la) {
        const laKey = resolvedItems.some(item => item.description.toUpperCase() === 'L/A') ? 'L/A' : 'LIGHTNING ARRESTER';
        upsertItem(laKey, {
          qty: input.lightningArresterQty ?? 1,
          ratePerUnit: Number(la.rate),
          gstPct: Number(la.gst_pct) as any,
          unit: 'Nos',
          remarks: la.description ?? la.model,
        });
      }
    }
  }

  // ── Step 3-4: Process each BOM item ──
  const allItems = [...resolvedItems, ...(input.customItems || [])];
  const lines: LineResult[] = allItems.map((item, index) => {
    const rowOverride = input.overrides?.[index];
    const isDisabled = input.disabledItemIndices?.[index] === true;

    // Resolve effective values
    const effectiveQty =
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
        : item.qty;

    const effectiveRate = resolveRate(
      item,
      index,
      input.overrides,
      input.rateMaster,
      equipmentOverrides,
    );

    const effectiveGstPct =
      rowOverride?.gstPct !== undefined ? rowOverride.gstPct : item.gstPct;

    // Compute line totals — NO rounding (set to 0 if item is unchecked/disabled)
    const lineTotal = isDisabled ? 0 : effectiveQty * effectiveRate;
    const lineGST = isDisabled ? 0 : lineTotal * effectiveGstPct;
    const lineSubTotal = lineTotal + lineGST;

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
  const costBeforeGST = lines.reduce((sum, l) => sum + l.lineTotal, 0);
  const totalInputGST = lines.reduce((sum, l) => sum + l.lineGST, 0);
  const totalIncGST = costBeforeGST + totalInputGST;

  // ── Step 7: Resolve output GST ──
  const gstOutputRate =
    input.gstOnOutputOverride !== undefined
      ? input.gstOnOutputOverride
      : (input.gstOnOutput !== undefined ? input.gstOnOutput : stateData.gstOnOutput);

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
  const { mrpInclGST, mrpExclGST, marginAmount, effectiveMarginPct } = marginResults;

  // ── Per-kW analysis ──
  const capKW = system.capacityKW || 0.001; // Avoid div by zero
  const perKWexclGST = mrpExclGST / capKW;
  const perKWinclGST = mrpInclGST / capKW;

  // ── Step 10: Discount ──
  const discountAmount = calculateDiscountAmount({
    mrpInclGST,
    discountType: input.discountType ?? 'none',
    discountVal: input.discountVal ?? 0
  });

  // ── Step 11: Additional costs ──
  const additionalCostTotal = (input.additionalCosts ?? []).reduce(
    (sum, c) => sum + c.amount,
    0,
  );

  // ── Step 12: Final customer price ──
  const finalCustomerPrice = Math.max(0, mrpInclGST - discountAmount + additionalCostTotal);

  // ── Step 13: Subsidy ──
  const subsidyAmount = input.rpcSubsidyAmount !== undefined
    ? input.rpcSubsidyAmount
    : calculateSubsidyAmount({
        panelCapacityKW: input.panelCapacityKW ?? system.capacityKW,
        inverterCapacityKW: input.inverterCapacityKW,
        projectType: input.projectType,
        slabs: input.slabs,
        maxCapacityKW: 10.0
      });

  // ── Step 14: Beneficiary contribution ──
  const beneficiaryContribution = Math.max(0, finalCustomerPrice - subsidyAmount);

  // ── Step 15: Energy generation ──
  const energyProjections = calculateEnergyProjections({
    panelCapacityKW: input.panelCapacityKW ?? system.capacityKW,
    inverterCapacityKW: input.inverterCapacityKW,
    sunHoursPerDay: stateData.sunHoursPerDay,
    performanceRatio: stateData.performanceRatio,
    orientation: input.orientation,
    orientationMultipliers: input.dbOrientationMultipliers
  });
  const { dailyGenerationKWh, monthlyGenerationKWh, annualGenerationKWh } = energyProjections;

  // ── Step 16: Savings ──
  const stateGridTariff = (stateData as any).gridTariffInr ?? 8.0;
  const effectiveGridTariffPerKWh =
    input.gridTariffPerKWh !== undefined && input.gridTariffPerKWh >= 0
      ? input.gridTariffPerKWh
      : stateGridTariff;

  const monthlySavingsINR = monthlyGenerationKWh * effectiveGridTariffPerKWh;
  const annualSavingsINR = annualGenerationKWh * effectiveGridTariffPerKWh;

  // ── Step 17: Payback & LCOE ──
  const financialProjections = calculateFinancialProjections({
    beneficiaryContribution,
    annualGenerationKWh,
    annualSavingsINR,
    panelDegradationRate: input.panelDegradationRate,
    electricityInflationRate: input.electricityInflationRate,
    systemLifetimeYears: 25
  });
  const { paybackYears, lcoe, lifetimeSavingsINR } = financialProjections;

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
