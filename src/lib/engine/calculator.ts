/**
 * ENERMASS Solar Pricing Calculator — Calculation Engine
 * ======================================================
 * Pure-function engine. No rounding in intermediate steps.
 * All formulas aligned with the math.md spec.
 */

import { SYSTEMS, type SolarSystem, type BomItem } from '../data/bom';
import { STATE_DATA } from '@/lib/data/masters';
import { TAX_CONSTANTS } from '@/lib/tax-constants';
import { STRUCTURE_CONFIGS, type StructureType } from '../structures/structureConfig';
import { SEED_BOM_TEMPLATE_ITEMS, SEED_BOM_CATEGORIES } from '../../../db/seeds/bom_templates';
import { type StateData } from '../data/masters';
import { calculateEnergyProjections } from './energy';
import { calculatePricingAndMargins, calculateDiscountAmount } from './margin';
import { calculateFinancialProjections } from './financials';
import { calculatePMSuryaGharSubsidy, type SubsidyResult } from '../subsidy';

export function roundTo5(num: number | null | undefined): number {
  if (num === null || num === undefined || isNaN(num)) return 0;
  return Math.round((num + Number.EPSILON) * 100000) / 100000;
}

/**
 * FIX CALC-09: Financial amounts in INR must be rounded to 2 decimal places.
 * Use this for all customer-facing monetary values (MRP, cost, subsidy, etc.).
 * roundTo5 is retained for intermediate computation only.
 */
export function roundToINR(num: number | null | undefined): number {
  if (num === null || num === undefined || isNaN(num)) return 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
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
  totalInverterCapacityKW?: number;
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
  structureType?: StructureType;
  structureVendorId?: string;
  structureMaterialType?: string;
  walkwayLengthM?: number;
  ladderLengthM?: number;
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
  dbStructureVendors?: any[];
  dbStructureMaterialRates?: any[];
  dbStructureTemplates?: any[];
  dbStructureTemplateItems?: any[];
  dbWalkwayTemplates?: any[];
  dbLadderTemplates?: any[];
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
  // FIX CALC-01: Structure accessory rates from structure_accessory_rates table
  dbStructureAccessoryRates?: any[];
  panelMix?: Record<string, number>;
  selectedInverterMix?: Record<string, number>;
  selectedBatteryMix?: Record<string, number>;
  selectedPanelId?: string | null;
  maxSubsidyCapacityKW?: number;
  maxAbsoluteSubsidy?: number;
  // FIX CALC-02: Additional state subsidy from state_scheme_overrides
  additionalStateSubsidy?: number;
  applySubsidy?: boolean;
  dbLoaded?: boolean;
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
  unitWattage?: number;
  categoryId?: string;
  categoryName?: string;
  unitRateMin?: number;
  unitRateMax?: number;
  isSurveyDependent?: boolean;
}

export interface CalcResult {
  capacityKW: number;
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
  subsidyResult: SubsidyResult;
  subsidyAmount: number;
  beneficiaryContribution: number;

  // Additional costs
  additionalCostTotal: number;
  civilLogisticsCost: number;

  // Energy generation
  dailyGenerationKWh: number;
  monthlyGenerationKWh: number;
  annualGenerationKWh: number;
  monthlySavingsINR: number;
  annualSavingsINR: number;
  paybackYears: number;
  lcoe: number;
  lifetimeSavingsINR: number;
  npv: number;
  irr: number;
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

  // 2. Equipment override
  const descUpper = item.description.toUpperCase();
  const isEquipment = ['PANEL', 'INVERTER', 'BATTERY'].some(prefix =>
    descUpper === prefix || descUpper.startsWith(prefix + ' ') || descUpper.startsWith(prefix + ':')
  );

  if (descUpper.startsWith('PANEL') && _equipmentOverrides?.panelRateOverride !== undefined) {
    return _equipmentOverrides.panelRateOverride;
  }
  if (descUpper.startsWith('INVERTER') && _equipmentOverrides?.inverterRateOverride !== undefined) {
    return _equipmentOverrides.inverterRateOverride;
  }
  if (descUpper.startsWith('BATTERY') && _equipmentOverrides?.batteryRateOverride !== undefined) {
    return _equipmentOverrides.batteryRateOverride;
  }

  // 3. Rate master — only for non-equipment BOM items
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
  maxAbsoluteSubsidy?: number,
  // FIX CALC-02: additional_state_subsidy from state_scheme_overrides
  additionalStateSubsidy?: number,
): number {
  // Commercial projects never receive residential subsidy
  if (projectType === 'commercial') {
    return 0;
  }

  const eligibleCapacityKW = inverterCapacityKW !== undefined
    ? Math.min(panelCapacityKW, inverterCapacityKW)
    : panelCapacityKW;

  const maxCap = maxCapacityKW ?? 10.0;
  if (eligibleCapacityKW > maxCap) {
    return 0;
  }

  if (!slabs || slabs.length === 0) {
    return 0;
  }

  let total = 0;
  for (const slab of slabs) {
    const start = Number(slab.start_kw);
    if (eligibleCapacityKW < start) {
      break;
    }
    if (slab.is_fixed_amount) {
      total += Number(slab.fixed_amount ?? 0);
    } else {
      const end = slab.end_kw === null
        ? eligibleCapacityKW
        : Math.min(eligibleCapacityKW, Number(slab.end_kw));
      const applicable = end - start;
      total += applicable * Number(slab.rate_per_kw);
    }
  }

  if (maxAbsoluteSubsidy !== undefined && maxAbsoluteSubsidy > 0) {
    total = Math.min(total, maxAbsoluteSubsidy);
  }

  // FIX CALC-02: Add state-specific additional subsidy (e.g. Gujarat top-up)
  if (additionalStateSubsidy !== undefined && additionalStateSubsidy > 0) {
    total += additionalStateSubsidy;
  }

  return total;
}

// FIX CALC-01: ACCESSORY_FALLBACK_RATES removed.
// All structure accessory rates must come from the structure_accessory_rates
// database table via dbStructureAccessoryRates in CalcInput.
// If the DB rate is missing for an accessory, the rate resolves to 0
// and a warning is logged — this surfaces misconfiguration rather than
// silently using wrong stale rates.
//
// To migrate: ensure all accessory items in structure_template_items
// have a corresponding row in structure_accessory_rates.
//
// Reference: scripts/07_link_template_items_to_accessory_rates.sql

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

  // 1. Check if new ERP Structure model is selected
  if (input.structureVendorId && input.structureMaterialType) {
    removeGenericStructure = true;
    
    // Find vendor name
    const vendor = (input.dbStructureVendors ?? []).find(v => v.id === input.structureVendorId);
    const vendorName = vendor ? vendor.name : 'Unknown';
    
    // Find material rate per kg
    const rateRow = (input.dbStructureMaterialRates ?? []).find(r => 
      r.vendor_id === input.structureVendorId && 
      r.material_type === input.structureMaterialType
    );
    const ratePerKg = rateRow ? Number(rateRow.rate_per_kg) : 0;
    
    // Find closest template
    const templates = (input.dbStructureTemplates ?? []).filter(t => 
      t.structure_type === input.structureMaterialType
    );
    
    if (templates.length > 0) {
      // Find template closest to capacityKW
      const template = templates.reduce((prev, curr) => 
        Math.abs(Number(curr.capacity_kw) - capacityKW) < Math.abs(Number(prev.capacity_kw) - capacityKW) ? curr : prev
      );
      
      // Get all template items for this template and selected vendor
      const templateItems = (input.dbStructureTemplateItems ?? []).filter(item => 
        item.template_id === template.id &&
        (item.vendor_id === null || item.vendor_id === input.structureVendorId)
      );
      
      templateItems.forEach(item => {
        const itemLower = item.item.toLowerCase().trim();
        const isPrimaryMember = itemLower.includes('rafter') || itemLower.includes('purlin');
        
        let ratePerUnit = 0;
        let unit = 'Nos';
        let remarks = `Template: ${template.capacity_kw}kW ${template.structure_type}`;
        
        if (isPrimaryMember) {
          // Weight-based pricing for primary members
          const itemWeight = Number(item.weight || 0);
          ratePerUnit = itemWeight * ratePerKg;
          unit = 'Nos';
          remarks = `${vendorName} ${template.structure_type} member (${itemWeight} kg)`;
        } else {
          // FIX CALC-01: Look up accessory rate from DB, not hardcoded map.
          // input.dbStructureAccessoryRates is loaded by dbCalculator.ts from
          // the structure_accessory_rates table.
          const accessoryRates = (input.dbStructureAccessoryRates ?? []);
          const accessoryRow = accessoryRates.find((r: any) => {
            const rName = (r.item_name ?? r.name ?? '').toLowerCase().trim();
            return rName === itemLower || itemLower.includes(rName) || rName.includes(itemLower);
          });
          if (accessoryRow) {
            ratePerUnit = Number(accessoryRow.rate ?? accessoryRow.override_rate ?? 0);
            unit = accessoryRow.unit ?? 'Nos';
          } else {
            console.error(`Missing accessory rate for "${item.item}" in structure_accessory_rates. Configure before quoting.`);
            ratePerUnit = 0;
            unit = 'Nos';
          }
          remarks = `Accessory (DB rate)`;
        }
        
        items.push({
          description: item.item,
          qty: Number(item.qty),
          ratePerUnit: ratePerUnit,
          unit: unit,
          remarks: remarks,
          gstPct: TAX_CONSTANTS.BOS_GST_RATE as any, // Default 18% for structure components
        });
      });
    }
    
    // Resolve Walkway
    if (input.walkwayLengthM && input.walkwayLengthM > 0) {
      const templateKey = `${input.structureMaterialType.toLowerCase()}_walkway`;
      let walkwayTemplate = (input.dbWalkwayTemplates ?? []).find(w => w.template === templateKey);
      if (!walkwayTemplate && (input.dbWalkwayTemplates ?? []).length > 0) {
        walkwayTemplate = input.dbWalkwayTemplates?.[0];
      }
      if (!walkwayTemplate) {
        console.warn(`Missing walkway template for ${input.structureMaterialType}. Configure before quoting.`);
      }
      
      const costPerMeter = walkwayTemplate ? Number(walkwayTemplate.cost_per_meter) : 0;
      items.push({
        description: `Walkway (${input.structureMaterialType})`,
        qty: input.walkwayLengthM,
        ratePerUnit: costPerMeter,
        unit: 'Meter',
        remarks: walkwayTemplate ? `Walkway template: ${walkwayTemplate.template}` : 'Walkway',
        gstPct: TAX_CONSTANTS.BOS_GST_RATE as any,
      });
    }
    
    // Resolve Ladder
    if (input.ladderLengthM && input.ladderLengthM > 0) {
      const templateKey = `${input.structureMaterialType.toLowerCase()}_ladder`;
      let ladderTemplate = (input.dbLadderTemplates ?? []).find(l => l.template === templateKey);
      if (!ladderTemplate && (input.dbLadderTemplates ?? []).length > 0) {
        ladderTemplate = input.dbLadderTemplates?.[0];
      }
      if (!ladderTemplate) {
        console.error(`Missing ladder template for ${input.structureMaterialType}. Configure before quoting.`);
      }
      
      const costPerMeter = ladderTemplate ? Number(ladderTemplate.cost_per_meter) : 0;
      items.push({
        description: `Ladder (${input.structureMaterialType})`,
        qty: input.ladderLengthM,
        ratePerUnit: costPerMeter,
        unit: 'Meter',
        remarks: ladderTemplate ? `Ladder template: ${ladderTemplate.template}` : 'Ladder',
        gstPct: TAX_CONSTANTS.BOS_GST_RATE as any,
      });
    }

    return { items, removeGenericStructure };
  }


  // 3. NEW FALLBACK: Use new config-driven structures
  if (!input.structureId) {
    if (input.structureType) {
      const spec = STRUCTURE_CONFIGS[input.structureType];
      if (spec) {
        const totalWeight = capacityKW * spec.weightPerKwKg;
        items.push({
          description: 'STRUCTURE',
          qty: capacityKW,
          ratePerUnit: spec.ratePerKwDefault,
          unit: 'kW',
          remarks: `Approx. ${totalWeight.toFixed(1)}kg HDG steel (${spec.displayName})`,
          gstPct: TAX_CONSTANTS.BOS_GST_RATE as any,
        });

        if (spec.elevationSurcharge) {
          const surchargeItem = {
            description: 'STRUCTURE ELEVATION SURCHARGE',
            qty: capacityKW,
            ratePerUnit: 500,
            unit: 'kW',
            remarks: `Confirm after site survey (${spec.notes})`,
            gstPct: TAX_CONSTANTS.BOS_GST_RATE as any,
          };
          (surchargeItem as any).isSurveyDependent = true;
          items.push(surchargeItem);
        }
        removeGenericStructure = true;
      }
    }
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
          gstPct: Number(part.gst_pct ?? TAX_CONSTANTS.BOS_GST_RATE) as any,
        });
      });
    } else if (mode === 'per_watt') {
      items.push({
        description: 'STRUCTURE',
        qty: 1,
        ratePerUnit: capacityWatts * (input.structureRateOverride ?? 0),
        unit: 'Set',
        remarks: 'Custom Structure (Per watt)',
        gstPct: TAX_CONSTANTS.BOS_GST_RATE as any,
      });
    } else {
      items.push({
        description: 'STRUCTURE',
        qty: 1,
        ratePerUnit: input.structureRateOverride ?? 0,
        unit: 'Set',
        remarks: 'Custom Structure (Flat rate)',
        gstPct: TAX_CONSTANTS.BOS_GST_RATE as any,
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
          let ratePerKg = Number(struct.rate_per_kg ?? (Number(struct.raw_material_rate ?? 0) + Number(struct.fabrication_rate ?? 0) + Number(struct.galvanizing_rate ?? 0)));
          
          structureQty = (lookupWeight + baseWeight) * (1 + wastage) * (1 + fasteners);
          if (ratePerKg === 0 && structureQty > 0) {
              // Enforce 5000/kW default if DB rates are missing
              ratePerKg = (5000 * capacityKW) / structureQty;
          }
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
          gstPct: Number(addon.gst_pct ?? TAX_CONSTANTS.BOS_GST_RATE) as any,
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
  let system = systems.find((s) => s.id === input.systemId);
  if (!system && systems.length > 0) {
    system = systems[0];
  }
  if (!system) {
    throw new Error(`System not found: "${input.systemId}"`);
  }

  // ── Step 2: Lookup state ──
  const stateDataResolved = input.stateData ?? {};
  let stateData = stateDataResolved[input.state];
  if (!stateData) {
    stateData = stateDataResolved['Kerala'] || Object.values(stateDataResolved)[0];
  }
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

  const capacityKW = input.panelCapacityKW || system.capacityKW || (system as any).capacity_kw || 1.0;
  const capacityWatts = capacityKW * 1000;

  // Clone system items and expand generic placeholders to specific selected models
  let resolvedItems: import('../data/bom').BomItem[] = [];

  let processedPanels = false;
  let processedInverters = false;
  let processedBatteries = false;

  for (const item of system.items) {
    const descUpper = item.description.toUpperCase();

    if (descUpper === 'PANEL') {
      processedPanels = true;
      const panelMixEntries = Object.entries(input.panelMix ?? {}).filter(
        ([, qty]) => Number.isFinite(qty) && qty > 0
      );
      const hasPanelSelection = panelMixEntries.length > 0 || !!input.selectedPanelId;
      if (hasPanelSelection && input.dbPanels && input.dbPanels.length > 0) {
        if (panelMixEntries.length > 0) {
          for (const [panelId, qty] of panelMixEntries) {
            const p = input.dbPanels.find(x => x.id === panelId);
            if (p) {
              resolvedItems.push({
                description: `PANEL ${p.brand} ${p.model} (${p.wattage}W)`,
                qty: qty,
                ratePerUnit: p.ratePerWatt * p.wattage,
                gstPct: p.gst_pct ?? TAX_CONSTANTS.RESIDENTIAL_GST_RATE,
                unit: 'Nos',
                remarks: item.remarks ?? '',
                unitWattage: p.wattage,
              });
            }
          }
        } else if (input.selectedPanelId) {
          const p = input.dbPanels.find(x => x.id === input.selectedPanelId);
          if (p) {
            const qty = input.panelQtyOverride !== undefined ? input.panelQtyOverride : (system.panelQty ?? item.qty);
            resolvedItems.push({
              description: `PANEL ${p.brand} ${p.model} (${p.wattage}W)`,
              qty: qty,
              ratePerUnit: p.ratePerWatt * p.wattage,
              gstPct: p.gst_pct ?? TAX_CONSTANTS.RESIDENTIAL_GST_RATE,
              unit: 'Nos',
              remarks: item.remarks ?? '',
              unitWattage: p.wattage,
            });
          }
        }
      } else {
        // Fallback or unselected
        const rate = input.panelRateOverride !== undefined ? input.panelRateOverride : item.ratePerUnit;
        const qty = (input.dbLoaded && !hasPanelSelection) ? 0 : (input.panelQtyOverride !== undefined ? input.panelQtyOverride : item.qty);
        resolvedItems.push({
          ...item,
          ratePerUnit: (qty === 0) ? 0 : rate,
          qty: qty
        });
      }
    }
    else if (descUpper === 'INVERTER') {
      processedInverters = true;
      const inverterMixEntries = Object.entries(input.selectedInverterMix ?? {}).filter(
        ([, qty]) => Number.isFinite(qty) && qty > 0
      );
      const hasInverterSelection = inverterMixEntries.length > 0;
      if (hasInverterSelection && input.dbInverters && input.dbInverters.length > 0) {
        for (const [invId, qty] of inverterMixEntries) {
          const inv = input.dbInverters.find(x => x.id === invId);
          if (inv) {
            resolvedItems.push({
              description: `INVERTER ${inv.brand} ${inv.model}`,
              qty: qty,
              ratePerUnit: inv.rate,
              gstPct: inv.gst_pct ?? TAX_CONSTANTS.INVERTER_GST_RATE,
              unit: 'Nos',
              remarks: item.remarks ?? '',
            });
          }
        }
      } else {
        // Fallback or unselected
        const rate = input.inverterRateOverride !== undefined ? input.inverterRateOverride : item.ratePerUnit;
        const qty = (input.dbLoaded && !hasInverterSelection) ? 0 : (input.inverterQtyOverride !== undefined ? input.inverterQtyOverride : item.qty);
        resolvedItems.push({
          ...item,
          ratePerUnit: (qty === 0) ? 0 : rate,
          qty: qty
        });
      }
    }
    else if (descUpper === 'BATTERY') {
      processedBatteries = true;
      const batteryMixEntries = Object.entries(input.selectedBatteryMix ?? {}).filter(
        ([, qty]) => Number.isFinite(qty) && qty > 0
      );
      const hasBatterySelection = batteryMixEntries.length > 0;
      if (hasBatterySelection && input.dbBatteries && input.dbBatteries.length > 0) {
        for (const [batId, qty] of batteryMixEntries) {
          const bat = input.dbBatteries.find(x => x.id === batId);
          if (bat) {
            resolvedItems.push({
              description: `BATTERY ${bat.brand} ${bat.model}`,
              qty: qty,
              ratePerUnit: bat.rate,
              // FIX CALC-08: Battery GST is 12% by default (not 18%).
              // Use the value from DB. Default 0.12 if DB column is NULL/zero.
              gstPct: (Number(bat.gst_pct) > 0 ? Number(bat.gst_pct) : TAX_CONSTANTS.INVERTER_GST_RATE) as any,
              unit: 'Nos',
              remarks: item.remarks ?? '',
            });
          }
        }
      } else {
        // Fallback or unselected
        const rate = input.batteryRateOverride !== undefined ? input.batteryRateOverride : item.ratePerUnit;
        const qty = (input.dbLoaded && !hasBatterySelection) ? 0 : (input.batteryQtyOverride !== undefined ? input.batteryQtyOverride : item.qty);
        resolvedItems.push({
          ...item,
          ratePerUnit: (qty === 0) ? 0 : rate,
          qty: qty
        });
      }
    }
    else if (descUpper === 'STRUCTURE') {
      const isStructureSelected = (input.structureVendorId && input.structureMaterialType) || !!input.structureId;
      const qty = (input.dbLoaded && !isStructureSelected) ? 0 : item.qty;
      resolvedItems.push({
        ...item,
        qty,
        ratePerUnit: (qty === 0) ? 0 : item.ratePerUnit,
      });
    }
    else {
      resolvedItems.push({ ...item });
    }
  }

  // Ensure PANEL, INVERTER, and BATTERY are included even if missing from system.items
  if (!processedPanels) {
    const panelMixEntries = Object.entries(input.panelMix ?? {}).filter(([, qty]) => Number.isFinite(qty) && qty > 0);
    const hasPanelSelection = panelMixEntries.length > 0 || !!input.selectedPanelId;
    if (hasPanelSelection && input.dbPanels && input.dbPanels.length > 0) {
      if (panelMixEntries.length > 0) {
        for (const [panelId, qty] of panelMixEntries) {
          const p = input.dbPanels.find(x => x.id === panelId);
          if (p) {
            resolvedItems.push({
              description: `PANEL ${p.brand} ${p.model} (${p.wattage}W)`,
              qty: qty,
              ratePerUnit: p.ratePerWatt * p.wattage,
              gstPct: p.gst_pct ?? TAX_CONSTANTS.RESIDENTIAL_GST_RATE,
              unit: 'Nos',
              remarks: '',
              unitWattage: p.wattage,
            });
          }
        }
      } else if (input.selectedPanelId) {
        const p = input.dbPanels.find(x => x.id === input.selectedPanelId);
        if (p) {
          const qty = input.panelQtyOverride !== undefined ? input.panelQtyOverride : 0;
          resolvedItems.push({
            description: `PANEL ${p.brand} ${p.model} (${p.wattage}W)`,
            qty: qty,
            ratePerUnit: p.ratePerWatt * p.wattage,
            gstPct: p.gst_pct ?? TAX_CONSTANTS.RESIDENTIAL_GST_RATE,
            unit: 'Nos',
            remarks: '',
            unitWattage: p.wattage,
          });
        }
      }
    } else {
      resolvedItems.push({
        description: 'PANEL',
        qty: input.panelQtyOverride !== undefined ? input.panelQtyOverride : 0,
        ratePerUnit: input.panelRateOverride !== undefined ? input.panelRateOverride : 0,
        gstPct: TAX_CONSTANTS.RESIDENTIAL_GST_RATE,
        unit: 'Nos',
        remarks: 'None (Unselected)',
      });
    }
  }

  if (!processedInverters) {
    const inverterMixEntries = Object.entries(input.selectedInverterMix ?? {}).filter(([, qty]) => Number.isFinite(qty) && qty > 0);
    if (inverterMixEntries.length > 0 && input.dbInverters && input.dbInverters.length > 0) {
      for (const [invId, qty] of inverterMixEntries) {
        const inv = input.dbInverters.find(x => x.id === invId);
        if (inv) {
          resolvedItems.push({
            description: `INVERTER ${inv.brand} ${inv.model}`,
            qty: qty,
            ratePerUnit: inv.rate,
            gstPct: inv.gst_pct ?? TAX_CONSTANTS.INVERTER_GST_RATE,
            unit: 'Nos',
            remarks: '',
          });
        }
      }
    } else {
      resolvedItems.push({
        description: 'INVERTER',
        qty: input.inverterQtyOverride !== undefined ? input.inverterQtyOverride : 0,
        ratePerUnit: input.inverterRateOverride !== undefined ? input.inverterRateOverride : 0,
        gstPct: TAX_CONSTANTS.INVERTER_GST_RATE,
        unit: 'Nos',
        remarks: 'None (Unselected)',
      });
    }
  }

  if (!processedBatteries) {
    const batteryMixEntries = Object.entries(input.selectedBatteryMix ?? {}).filter(([, qty]) => Number.isFinite(qty) && qty > 0);
    if (batteryMixEntries.length > 0 && input.dbBatteries && input.dbBatteries.length > 0) {
      for (const [batId, qty] of batteryMixEntries) {
        const bat = input.dbBatteries.find(x => x.id === batId);
        if (bat) {
          resolvedItems.push({
            description: `BATTERY ${bat.brand} ${bat.model}`,
            qty: qty,
            ratePerUnit: bat.rate,
            gstPct: (Number(bat.gst_pct) > 0 ? Number(bat.gst_pct) : TAX_CONSTANTS.INVERTER_GST_RATE) as any,
            unit: 'Nos',
            remarks: '',
          });
        }
      }
    } else {
      resolvedItems.push({
        description: 'BATTERY',
        qty: input.batteryQtyOverride !== undefined ? input.batteryQtyOverride : 0,
        ratePerUnit: input.batteryRateOverride !== undefined ? input.batteryRateOverride : 0,
        gstPct: TAX_CONSTANTS.INVERTER_GST_RATE,
        unit: 'Nos',
        remarks: 'None (Unselected)',
      });
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
        gstPct: (itemData.gstPct ?? (
          description.toUpperCase().startsWith('PANEL') ? TAX_CONSTANTS.RESIDENTIAL_GST_RATE :
          description.toUpperCase().startsWith('INVERTER') ? TAX_CONSTANTS.INVERTER_GST_RATE :
          description.toUpperCase().startsWith('BATTERY') ? TAX_CONSTANTS.INVERTER_GST_RATE :
          TAX_CONSTANTS.BOS_GST_RATE
        )) as any,
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
      gstPct: TAX_CONSTANTS.BOS_GST_RATE as any,
      unit: 'Nos',
      remarks: 'Custom Solar Meter',
    }, true);
  } else if (input.solarMeterId) {
    const solarMeterMeter = (input.dbMeters ?? []).find(m => m.id === input.solarMeterId);
    if (solarMeterMeter) {
      const gst = Number(solarMeterMeter.gst_pct) || TAX_CONSTANTS.BOS_GST_RATE;
      upsertItem('SOLAR METER', {
        qty: input.solarMeterQty ?? 1,
        ratePerUnit: Number(solarMeterMeter.rate),
        gstPct: gst as any,
        unit: 'Nos',
        remarks: solarMeterMeter.description ?? `${solarMeterMeter.brand} ${solarMeterMeter.model}`,
      }, true);
    } else {
      upsertItem('SOLAR METER', {
        qty: 0,
        ratePerUnit: 0,
        gstPct: TAX_CONSTANTS.BOS_GST_RATE as any,
        unit: 'Nos',
        remarks: 'None (Unselected)',
      }, true);
    }
  } else {
    upsertItem('SOLAR METER', {
      qty: 0,
      ratePerUnit: 0,
      gstPct: TAX_CONSTANTS.BOS_GST_RATE as any,
      unit: 'Nos',
      remarks: 'None (Unselected)',
    }, true);
  }

  // 3. Resolve NET METER
  if (input.netMeterId === 'custom') {
    upsertItem('NET METER', {
      qty: input.netMeterQty ?? 1,
      ratePerUnit: 0,
      gstPct: TAX_CONSTANTS.BOS_GST_RATE as any,
      unit: 'Nos',
      remarks: 'Custom Net Meter',
    }, true);
  } else if (input.netMeterId) {
    const netMeterMeter = (input.dbMeters ?? []).find(m => m.id === input.netMeterId);
    if (netMeterMeter) {
      const gst = Number(netMeterMeter.gst_pct) || TAX_CONSTANTS.BOS_GST_RATE;
      upsertItem('NET METER', {
        qty: input.netMeterQty ?? 1,
        ratePerUnit: Number(netMeterMeter.rate),
        gstPct: gst as any,
        unit: 'Nos',
        remarks: netMeterMeter.description ?? `${netMeterMeter.brand} ${netMeterMeter.model}`,
      }, true);
    } else {
      upsertItem('NET METER', {
        qty: 0,
        ratePerUnit: 0,
        gstPct: TAX_CONSTANTS.BOS_GST_RATE as any,
        unit: 'Nos',
        remarks: 'None (Unselected)',
      }, true);
    }
  } else {
    upsertItem('NET METER', {
      qty: 0,
      ratePerUnit: 0,
      gstPct: TAX_CONSTANTS.BOS_GST_RATE as any,
      unit: 'Nos',
      remarks: 'None (Unselected)',
    }, true);
  }

  // 4. Resolve LIGHTNING ARRESTER
  const laKey = resolvedItems.some(item => item.description.toUpperCase() === 'L/A') ? 'L/A' : 'LIGHTNING ARRESTER';
  if (input.lightningArresterId === 'custom') {
    upsertItem(laKey, {
      qty: input.lightningArresterQty ?? 1,
      ratePerUnit: 0,
      gstPct: TAX_CONSTANTS.BOS_GST_RATE as any,
      unit: 'Nos',
      remarks: 'Custom Lightning Arrester',
    }, true);
  } else if (input.lightningArresterId) {
    const la = (input.dbLAs ?? []).find(l => l.id === input.lightningArresterId);
    if (la) {
      const gst = Number(la.gst_pct) || TAX_CONSTANTS.BOS_GST_RATE;
      upsertItem(laKey, {
        qty: input.lightningArresterQty ?? 1,
        ratePerUnit: Number(la.rate),
        gstPct: gst as any,
        unit: 'Nos',
        remarks: la.description ?? la.model,
      }, true);
    } else {
      upsertItem(laKey, {
        qty: 0,
        ratePerUnit: 0,
        gstPct: TAX_CONSTANTS.BOS_GST_RATE as any,
        unit: 'Nos',
        remarks: 'None (Unselected)',
      }, true);
    }
  } else {
    upsertItem(laKey, {
      qty: 0,
      ratePerUnit: 0,
      gstPct: TAX_CONSTANTS.BOS_GST_RATE as any,
      unit: 'Nos',
      remarks: 'None (Unselected)',
    }, true);
  }

  // customItems
  if (input.customItems) {
    resolvedItems.push(...input.customItems);
  }

  // Inject standard product categories if they are missing so they aren't "left to rot"
  const STANDARD_CATEGORIES = [
    { desc: 'ISOLATOR', unit: 'Nos', gstPct: TAX_CONSTANTS.BOS_GST_RATE },
    { desc: 'METER BOX', unit: 'Nos', gstPct: TAX_CONSTANTS.BOS_GST_RATE },
    { desc: 'CHAMBER BOX', unit: 'Nos', gstPct: TAX_CONSTANTS.BOS_GST_RATE },
    { desc: 'EARTH BENCH', unit: 'Nos', gstPct: TAX_CONSTANTS.BOS_GST_RATE },
    { desc: 'ALUM CABLE 50 SQMM', unit: 'Meter', gstPct: TAX_CONSTANTS.BOS_GST_RATE },
    { desc: 'ALUM CABLE 10 SQMM', unit: 'Meter', gstPct: TAX_CONSTANTS.BOS_GST_RATE },
    { desc: 'COPPER', unit: 'Nos', gstPct: TAX_CONSTANTS.BOS_GST_RATE },
    { desc: 'MC4(ADDITIONAL)', unit: 'Nos', gstPct: TAX_CONSTANTS.BOS_GST_RATE },
    { desc: 'WIRING ACCESSORIES', unit: 'Lot', gstPct: TAX_CONSTANTS.BOS_GST_RATE },
    { desc: 'TRANSPORTATION', unit: 'Lot', gstPct: TAX_CONSTANTS.BOS_GST_RATE },
    { desc: 'COMMISSION', unit: 'Lot', gstPct: TAX_CONSTANTS.BOS_GST_RATE },
    { desc: 'SITE VISIT', unit: 'Lot', gstPct: TAX_CONSTANTS.BOS_GST_RATE },
    { desc: 'INSTALLATION', unit: 'Lot', gstPct: TAX_CONSTANTS.INSTALLATION_SERVICE_GST },
  ];

  for (const cat of STANDARD_CATEGORIES) {
    const exists = resolvedItems.some(i => i.description.toUpperCase().startsWith(cat.desc.toUpperCase()));
    if (!exists) {
      upsertItem(cat.desc, {
        qty: 0,
        ratePerUnit: 0,
        gstPct: cat.gstPct as any,
        unit: cat.unit,
        remarks: 'Standard item',
      }, true);
    }
  }

  
  // ── Step 3.5: Inject DB Seeded BOS Components ──
  const systemKw = input.panelCapacityKW ?? system.capacityKW ?? 0;
  const panelCount = equipmentOverrides.panelQtyOverride ?? system.panelQty ?? 0;
  const roofAreaSqft = systemKw * 100; // rough estimate if not provided

  for (const item of SEED_BOM_TEMPLATE_ITEMS) {
    if (item.categoryId === 'cat-civil') {
      const spec = input.structureType ? STRUCTURE_CONFIGS[input.structureType] : null;
      const isCivilRequired = spec ? spec.civilRequired : false;
      if (!isCivilRequired) continue;
    }

    let calculatedQty = 0;
    
    if (!item.isSystemSurveyDependent && item.qtyFormula && item.qtyFormula !== 'null') {
      let formula = item.qtyFormula
        .replace(/system_kw/g, systemKw.toString())
        .replace(/panel_count/g, panelCount.toString())
        .replace(/roof_area_sqft/g, roofAreaSqft.toString());
        
      // Safely evaluate basic math
      try {
        const cleanFormula = formula
          .replace(/CEIL/g, 'Math.ceil')
          .replace(/MAX/g, 'Math.max');
        calculatedQty = eval(cleanFormula);
      } catch (e) {
        console.warn('Failed to parse formula:', item.qtyFormula, e);
        calculatedQty = 1;
      }
    }

    const category = SEED_BOM_CATEGORIES.find(c => c.id === item.categoryId);

    upsertItem(item.description, {
      qty: calculatedQty,
      ratePerUnit: item.defaultRate,
      gstPct: TAX_CONSTANTS.BOS_GST_RATE,
      unit: item.unit,
      remarks: item.isSystemSurveyDependent ? 'Pending Site Survey' : 'Calculated BOM',
    }, false);
    
    // Attach metadata for the UI to use later
    const idx = resolvedItems.findIndex(i => i.description === item.description);
    if (idx !== -1) {
      (resolvedItems[idx] as any).categoryId = item.categoryId;
      (resolvedItems[idx] as any).categoryName = category?.name;
      (resolvedItems[idx] as any).unitRateMin = item.unitRateMin;
      (resolvedItems[idx] as any).unitRateMax = item.unitRateMax;
      (resolvedItems[idx] as any).isSurveyDependent = item.isSystemSurveyDependent;
    }
  }

  // ── Step 4: Apply Overrides, Rate Master, and Calculate Totals ──
  const allItems = [...resolvedItems];
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

    // Compute line totals — rounded to 2 decimal places (set to 0 if item is unchecked/disabled)
    const lineTotal = isDisabled ? 0 : roundToINR(effectiveQty * effectiveRate);
    const lineGST = isDisabled ? 0 : roundToINR(lineTotal * effectiveGstPct);
    const lineSubTotal = roundToINR(lineTotal + lineGST);

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
  const activeLines = lines.filter(l => !l.isDisabled);
  const costBeforeGST = roundToINR(activeLines.reduce((sum, l) => sum + l.lineTotal, 0));
  const totalInputGST = roundToINR(activeLines.reduce((sum, l) => sum + l.lineGST, 0));
  const totalIncGST = roundToINR(costBeforeGST + totalInputGST);

  // ── Step 7: Resolve output GST ──
  // FIX CALC-03: Validate GST override against legal Indian GST slabs.
  // Valid slabs: 0%, 5%, 12%, 18%, 28% (plus composite 13.8% for solar output)
  const VALID_OUTPUT_GST_SLABS = new Set([0, TAX_CONSTANTS.RESIDENTIAL_GST_RATE, TAX_CONSTANTS.INVERTER_GST_RATE, TAX_CONSTANTS.COMPOSITE_GST_RATE, TAX_CONSTANTS.BOS_GST_RATE, 0.28]);
  const rawGstOverride = input.gstOnOutputOverride;
  const resolvedGstOverride = (() => {
    if (rawGstOverride === undefined || input.allowGstOverride !== true) return undefined;
    // Validate: must match a known slab within floating-point tolerance
    const isValid = [...VALID_OUTPUT_GST_SLABS].some(
      slab => Math.abs(slab - rawGstOverride) < 0.0001
    );
    if (!isValid) {
      throw new Error(
        `Invalid GST output override: ${(rawGstOverride * 100).toFixed(3)}%. ` +
        `Must be one of: ${[...VALID_OUTPUT_GST_SLABS].map(s => (s * 100).toFixed(1) + '%').join(', ')}`
      );
    }
    return rawGstOverride;
  })();

  const gstOutputRate = roundTo5(
    resolvedGstOverride !== undefined
      ? resolvedGstOverride
      : (input.gstOnOutput !== undefined 
          ? input.gstOnOutput 
          : (input.projectType === 'commercial' ? TAX_CONSTANTS.COMMERCIAL_GST_RATE : stateData.gstOnOutput))
  );

  // ── Step 8 & 6: Resolve MRP & Margin ──
  // ITC Handling: Commercial projects use costBeforeGST (can claim ITC), Residential use totalIncGST (absorb input GST as cost)
  const baseCostForMargin = input.projectType === 'commercial' ? costBeforeGST : totalIncGST;

  const marginResults = calculatePricingAndMargins({
    baseCost: baseCostForMargin,
    targetMarginPct: input.targetMarginPct,
    targetMRPInclGST: input.targetMRPInclGST,
    targetMRPPerWatt: input.targetMRPPerWatt,
    gstOutputRate,
    capacityWatts,
    defaultMarginPct: system.targetMarginPct
  });
  const mrpInclGST = roundToINR(marginResults.mrpInclGST);
  const mrpExclGST = roundToINR(marginResults.mrpExclGST);
  const marginAmount = roundToINR(marginResults.marginAmount);
  const effectiveMarginPct = roundTo5(marginResults.effectiveMarginPct);

  // ── Per-kW analysis ──
  const capKW = capacityKW;
  const perKWexclGST = roundToINR(mrpExclGST / capKW);
  const perKWinclGST = roundToINR(mrpInclGST / capKW);

  // ── Step 10: Discount ──
  const discountAmount = roundToINR(calculateDiscountAmount({
    mrpInclGST,
    discountType: input.discountType ?? 'none',
    discountVal: input.discountVal ?? 0
  }));

  // ── Step 11: Additional costs ──
  const additionalCostTotal = roundToINR((input.additionalCosts ?? []).reduce(
    (sum, c) => sum + c.amount,
    0,
  ));

  // ── Step 12: Final customer price ──
  const finalCustomerPrice = roundToINR(Math.max(0, mrpInclGST - discountAmount + additionalCostTotal));

  // ── Step 13: Subsidy ──
  let subsidyResult: SubsidyResult = {
    amount: 0,
    breakdown: '',
    isEligible: false,
    schemeNote: ''
  };

  if (input.applySubsidy !== false) {
    if (input.rpcSubsidyAmount !== undefined) {
      subsidyResult = {
        amount: input.rpcSubsidyAmount,
        breakdown: 'Custom overridden subsidy',
        isEligible: true,
        schemeNote: 'Custom overridden subsidy'
      };
    } else {
      const computedSubsidy = getSubsidyAmount(
        input.panelCapacityKW ?? system.capacityKW ?? 0,
        input.inverterCapacityKW,
        input.state,
        input.projectType,
        stateDataResolved,
        input.slabs,
        input.maxSubsidyCapacityKW,
        input.maxAbsoluteSubsidy,
        input.additionalStateSubsidy
      );
      subsidyResult = {
        amount: computedSubsidy,
        breakdown: 'Calculated from DB scheme slabs',
        isEligible: computedSubsidy > 0,
        schemeNote: 'Subsidy calculated based on state rules'
      };
    }
  }

  const subsidyAmount = roundToINR(subsidyResult.amount);

  // ── Step 14: Beneficiary contribution ──
  // Commercial customers can claim GST Input Tax Credit on the system price
  let itcAmount = 0;
  if (input.projectType === 'commercial') {
    itcAmount = mrpInclGST - mrpExclGST;
  }
  const beneficiaryContribution = roundToINR(Math.max(0, finalCustomerPrice - subsidyAmount - itcAmount));

  // ── Step 15: Energy generation ──
  const energyProjections = calculateEnergyProjections({
    panelCapacityKW: capacityKW,
    inverterCapacityKW: input.inverterCapacityKW,
    totalInverterCapacityKW: input.totalInverterCapacityKW,
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

  const monthlySavingsINR = roundToINR(monthlyGenerationKWh * effectiveGridTariffPerKWh);
  const annualSavingsINR = roundToINR(annualGenerationKWh * effectiveGridTariffPerKWh);

  // ── Step 17: Payback & LCOE ──
  const financialProjections = calculateFinancialProjections({
    beneficiaryContribution,
    totalSystemCost: finalCustomerPrice,
    annualGenerationKWh,
    annualSavingsINR,
    panelDegradationRate: input.panelDegradationRate,
    electricityInflationRate: input.electricityInflationRate,
    systemLifetimeYears: 25
  });
  const paybackYears = roundTo5(financialProjections.paybackYears);
  const lcoe = roundToINR(financialProjections.lcoe);
  const lifetimeSavingsINR = roundToINR(financialProjections.lifetimeSavingsINR);
  const npv = roundToINR(financialProjections.npv);
  const irr = roundTo5(financialProjections.irr);

  const civilLogisticsCost = lines
    .filter(l => l.categoryId === 'cat-civil' || l.categoryId === 'cat-logistics')
    .filter(l => !l.isDisabled)
    .reduce((sum, l) => sum + l.lineSubTotal, 0);

  // ── Return complete result ──
  return {
    capacityKW,
    lines,
    costBeforeGST,
    civilLogisticsCost,
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

    subsidyResult,
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
    npv,
    irr,
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
