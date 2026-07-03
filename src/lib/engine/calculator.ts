/**
 * ENERMASS Solar Pricing Calculator — Calculation Engine
 * ======================================================
 * Pure-function engine. No rounding in intermediate steps.
 * All formulas aligned with the math.md spec.
 */

import { SYSTEMS, type SolarSystem, type BomItem } from '../data/bom';
import { STATE_DATA } from '@/lib/data/masters';
import { getBatteryGstRate, TAX_CONSTANTS } from '@/lib/tax-constants';
import { STRUCTURE_CONFIGS, type StructureType } from '../structures/structureConfig';
import { SEED_BOM_TEMPLATE_ITEMS, SEED_BOM_CATEGORIES } from '../../../db/seeds/bom_templates';
import { type StateData } from '../data/masters';
import { calculateEnergyProjections } from './energy';
import { calculatePricingAndMargins, calculateDiscountAmount, type MarginMode } from './margin';
import { calculateFinancialProjections } from './financials';
import { calculatePMSuryaGharSubsidy, type SubsidyResult } from '../subsidy';
import { assertCalcResultIntegrity } from '@/lib/math/integrity';
import { normalizeGstRate } from '@/lib/utils/gst';

import { safeEvalFormula, FormulaParseError } from './formulaParser';

import { generateElectricalBOM } from './bomElectrical';
import { generateStructureBOM } from './bomStructure';
import { generateCivilEarthingBOM } from './bomCivilEarthing';

export type { MarginMode } from './margin';

export const MAX_SAFE_NUMBER = 999999999999;
export const MIN_SAFE_NUMBER = -999999999999;

export function sanitizeNumber(num: any, def = 0): number {
  if (num === null || num === undefined || typeof num !== 'number' || isNaN(num) || !isFinite(num)) {
    return def;
  }
  return Math.max(MIN_SAFE_NUMBER, Math.min(MAX_SAFE_NUMBER, num));
}

export function roundTo5(num: number | null | undefined): number {
  const val = sanitizeNumber(num);
  return Math.round(val * 1e5) / 1e5;
}

/**
 * Rounds a number to exactly two decimal places (currency).
 */
export function roundToINR(num: number | null | undefined): number {
  const val = sanitizeNumber(num);
  return Math.round(val * 1e2) / 1e2;
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
  marginMode?: MarginMode;
  targetMarginPct?: number;
  targetMarginAmount?: number;
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
  roundOffToThousand?: boolean;
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
  structureBaseWeightOverride?: number;
  structureElevationOverride?: number;
  structureWeightLookupKg?: number;
  structureRateOverride?: number;
  structureWastageOverride?: number;
  structureFastenerOverride?: number;
  
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
  subsidySchemeName?: string;
  // FIX CALC-02: Additional state subsidy from state_scheme_overrides
  additionalStateSubsidy?: number;
  /**
   * Source of truth for the state-driven pipeline: when true the subsidy is
   * auto-applied from the selected state (via the server-computed rpcSubsidyAmount,
   * with a local slab fallback for offline). When false, no subsidy is applied.
   * Falls back to deriving from selectedScheme when undefined (legacy callers).
   */
  applySubsidy?: boolean;
  /** @deprecated Retained for backward compatibility; superseded by applySubsidy + state. */
  selectedScheme?: 'none' | 'pm_suryaghar' | 'state';
  dbLoaded?: boolean;
}

export function resolveStructureMaterialRate(input: Pick<CalcInput,
  'structureMaterialType' |
  'structureVendorId' |
  'dbStructureMaterialRates' |
  'dbStructureVendors'
>): {
  vendorId: string | null;
  vendorName: string | null;
  ratePerKg: number;
  rateRow: any | null;
} {
  const materialType = input.structureMaterialType;
  if (!materialType) {
    return { vendorId: null, vendorName: null, ratePerKg: 0, rateRow: null };
  }

  const vendors = input.dbStructureVendors ?? [];
  const matchingRates = (input.dbStructureMaterialRates ?? [])
    .filter((rate: any) => rate.material_type === materialType);

  if (matchingRates.length === 0) {
    return { vendorId: null, vendorName: null, ratePerKg: 0, rateRow: null };
  }

  const preferredRate = input.structureVendorId
    ? matchingRates.find((rate: any) => rate.vendor_id === input.structureVendorId)
    : null;

  const appoloRate = matchingRates.find((rate: any) => {
    const vendor = vendors.find((v: any) => v.id === rate.vendor_id);
    const name = String(vendor?.name ?? '').toLowerCase();
    return name.includes('appolo') || name.includes('apollo');
  });

  const rateRow = preferredRate ?? appoloRate ?? matchingRates[0];
  const vendor = vendors.find((v: any) => v.id === rateRow.vendor_id);

  return {
    vendorId: rateRow.vendor_id ?? null,
    vendorName: vendor?.name ?? null,
    ratePerKg: Number(rateRow.rate_per_kg ?? 0),
    rateRow,
  };
}

export function filterStructureTemplateItemsForRate(
  items: any[],
  templateId: string,
  vendorId?: string | null
): any[] {
  return items.filter((item: any) =>
    item.template_id === templateId &&
    (item.vendor_id === null || item.vendor_id === undefined || item.vendor_id === vendorId)
  );
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
  quotedLines: LineResult[];

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
  unroundedFinalCustomerPrice: number;
  roundOffToThousand: boolean;
  roundOffAdjustment: number;
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

export function roundToNearestThousand(value: number): number {
  const safeValue = sanitizeNumber(value, 0);
  const sign = safeValue < 0 ? -1 : 1;
  const absValue = Math.abs(safeValue);
  const lower = Math.floor(absValue / 1000) * 1000;
  const remainder = absValue - lower;
  const roundedAbs = remainder < 500 ? lower : lower + 1000;
  return roundToINR(sign * roundedAbs);
}

function lineTotalPaise(line: LineResult): number {
  return Math.round(sanitizeNumber(line.lineTotal, 0) * 100);
}

function withLineTotal(line: LineResult, lineTotalPaiseValue: number): LineResult {
  const lineTotal = roundToINR(lineTotalPaiseValue / 100);
  const qty = sanitizeNumber(line.effectiveQty, 0);
  const effectiveRate = qty > 0 ? roundTo5(lineTotal / qty) : 0;
  const lineGST = roundToINR(lineTotal * sanitizeNumber(line.effectiveGstPct, 0));

  return {
    ...line,
    effectiveRate,
    lineTotal,
    lineGST,
    lineSubTotal: roundToINR(lineTotal + lineGST),
  };
}

export function buildQuotedLines(
  lines: LineResult[],
  targetMrpExclGST: number,
  roundOffAdjustment = 0,
): LineResult[] {
  const included = lines.filter((line) => !line.isDisabled && lineTotalPaise(line) > 0);
  const baseTotalPaise = included.reduce((sum, line) => sum + lineTotalPaise(line), 0);
  const targetPaise = Math.max(0, Math.round(sanitizeNumber(targetMrpExclGST, 0) * 100));

  if (included.length === 0 || baseTotalPaise <= 0) {
    return lines.map((line) => withLineTotal(line, 0));
  }

  const largestLine = included.reduce((largest, line) =>
    lineTotalPaise(line) > lineTotalPaise(largest) ? line : largest
  );
  const panelLine = included.find((line) => line.description.toUpperCase() === 'PANEL');
  const residueTargetIndex = largestLine.index;
  const roundOffTargetIndex = panelLine?.index ?? largestLine.index;

  const allocatedByIndex = new Map<number, number>();
  let allocatedPaise = 0;

  for (const line of included) {
    const allocated = Math.round((lineTotalPaise(line) * targetPaise) / baseTotalPaise);
    allocatedByIndex.set(line.index, allocated);
    allocatedPaise += allocated;
  }

  const residuePaise = targetPaise - allocatedPaise;
  allocatedByIndex.set(
    residueTargetIndex,
    (allocatedByIndex.get(residueTargetIndex) ?? 0) + residuePaise,
  );

  const roundOffPaise = Math.round(sanitizeNumber(roundOffAdjustment, 0) * 100);
  if (roundOffPaise !== 0) {
    allocatedByIndex.set(
      roundOffTargetIndex,
      Math.max(0, (allocatedByIndex.get(roundOffTargetIndex) ?? 0) + roundOffPaise),
    );
  }

  return lines.map((line) => {
    if (line.isDisabled || !allocatedByIndex.has(line.index)) {
      return withLineTotal(line, 0);
    }
    return withLineTotal(line, allocatedByIndex.get(line.index) ?? 0);
  });
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
    formula?: string | null;
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

  if (inverterCapacityKW === undefined) {
    console.warn('inverterCapacityKW is undefined. Defaulting eligible capacity to panelCapacityKW.');
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
    if (eligibleCapacityKW <= start) {
      break;
    }
    const end = slab.end_kw === null
      ? eligibleCapacityKW
      : Math.min(eligibleCapacityKW, Number(slab.end_kw));
    const applicable = Math.max(0, end - start);

    if (slab.formula) {
      try {
        const val = safeEvalFormula(slab.formula, {
          system_kw: eligibleCapacityKW,
          applicable_kw: applicable,
          panel_capacity_kw: panelCapacityKW,
          inverter_capacity_kw: inverterCapacityKW ?? panelCapacityKW,
          start_kw: start,
          end_kw: slab.end_kw === null ? eligibleCapacityKW : Number(slab.end_kw),
        });
        total += sanitizeNumber(val, 0);
      } catch (err) {
        console.warn(`Failed to evaluate subsidy slab formula: "${slab.formula}". Error:`, err);
      }
    } else if (slab.is_fixed_amount) {
      total += Number(slab.fixed_amount ?? 0);
    } else {
      total += applicable * Number(slab.rate_per_kw);
    }
  }

  // FIX CALC-02: Add state-specific additional subsidy (e.g. Gujarat top-up) before enforcing the cap
  if (additionalStateSubsidy !== undefined && additionalStateSubsidy > 0) {
    total += additionalStateSubsidy;
  }

  if (maxAbsoluteSubsidy !== undefined && maxAbsoluteSubsidy > 0) {
    total = Math.min(total, maxAbsoluteSubsidy);
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
  if (input.structureMaterialType) {
    removeGenericStructure = true;
    const materialRate = resolveStructureMaterialRate(input);
    const ratePerKg = materialRate.ratePerKg;
    
    // Find closest template
    const templates = (input.dbStructureTemplates ?? []).filter(t => 
      t.structure_type === input.structureMaterialType
    );
    
    if (templates.length > 0) {
      // Find template closest to capacityKW
      const template = templates.reduce((prev, curr) => 
        Math.abs(Number(curr.capacity_kw) - capacityKW) < Math.abs(Number(prev.capacity_kw) - capacityKW) ? curr : prev
      );
      
      // Get all template items for this template. Vendor-specific rows are
      // resolved internally so the calculator user only chooses GI/GP.
      const templateItems = filterStructureTemplateItemsForRate(
        input.dbStructureTemplateItems ?? [],
        template.id,
        materialRate.vendorId
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
          remarks = `${template.structure_type} member (${itemWeight} kg)`;
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
            const resolvedRate = Number(accessoryRow.rate ?? accessoryRow.override_rate);
            if (isNaN(resolvedRate) || resolvedRate <= 0) {
              throw new Error(`Invalid or zero rate for structure accessory "${item.item}" in structure_accessory_rates.`);
            }
            ratePerUnit = resolvedRate;
            unit = accessoryRow.unit ?? 'Nos';
          } else {
            throw new Error(`Missing accessory rate for "${item.item}" in structure_accessory_rates. Configure before quoting.`);
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

      items.push({
        description: 'STRUCTURE',
        qty: totalWeight,
        ratePerUnit: ratePerKg,
        unit: 'kg',
        remarks: `Custom structure: ${totalWeight.toFixed(1)}kg @ ₹${ratePerKg.toFixed(2)}/kg`,
        gstPct: TAX_CONSTANTS.BOS_GST_RATE as any,
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
            console.warn(`No structure_weight_lookup for structure ${struct.id} at capacity ${capacityKW}kW. Falling back to default weight.`);
          }
          const lookupWeight = lookup ? Number(lookup.total_weight_kg) : (capacityKW * 20.0);
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
export function calculateSystem(rawInput: CalcInput): CalcResult {
  const input: CalcInput = {
    ...rawInput,
    panelCapacityKW: rawInput.panelCapacityKW !== undefined ? sanitizeNumber(rawInput.panelCapacityKW, 0) : undefined,
    discountVal: rawInput.discountVal !== undefined ? sanitizeNumber(rawInput.discountVal, 0) : undefined,
    targetMarginPct: rawInput.targetMarginPct !== undefined ? sanitizeNumber(rawInput.targetMarginPct, 0) : undefined,
    targetMRPInclGST: rawInput.targetMRPInclGST !== undefined ? sanitizeNumber(rawInput.targetMRPInclGST, 0) : undefined,
    targetMRPPerWatt: rawInput.targetMRPPerWatt !== undefined ? sanitizeNumber(rawInput.targetMRPPerWatt, 0) : undefined,
    panelRateOverride: rawInput.panelRateOverride !== undefined ? sanitizeNumber(rawInput.panelRateOverride, 0) : undefined,
    panelQtyOverride: rawInput.panelQtyOverride !== undefined ? sanitizeNumber(rawInput.panelQtyOverride, 0) : undefined,
    inverterRateOverride: rawInput.inverterRateOverride !== undefined ? sanitizeNumber(rawInput.inverterRateOverride, 0) : undefined,
    inverterQtyOverride: rawInput.inverterQtyOverride !== undefined ? sanitizeNumber(rawInput.inverterQtyOverride, 0) : undefined,
    batteryRateOverride: rawInput.batteryRateOverride !== undefined ? sanitizeNumber(rawInput.batteryRateOverride, 0) : undefined,
    batteryQtyOverride: rawInput.batteryQtyOverride !== undefined ? sanitizeNumber(rawInput.batteryQtyOverride, 0) : undefined,
    dcCableLengthM: rawInput.dcCableLengthM !== undefined ? sanitizeNumber(rawInput.dcCableLengthM, 0) : undefined,
    acCableLengthM: rawInput.acCableLengthM !== undefined ? sanitizeNumber(rawInput.acCableLengthM, 0) : undefined,
    walkwayLengthM: rawInput.walkwayLengthM !== undefined ? sanitizeNumber(rawInput.walkwayLengthM, 0) : undefined,
    ladderLengthM: rawInput.ladderLengthM !== undefined ? sanitizeNumber(rawInput.ladderLengthM, 0) : undefined,
    additionalCosts: rawInput.additionalCosts?.map(c => ({
      ...c,
      amount: sanitizeNumber(c.amount, 0)
    }))
  };
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

  let capacityKW = input.panelCapacityKW || system.capacityKW || (system as any).capacity_kw || 1.0;
  let capacityWatts = capacityKW * 1000;

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
              gstPct: (Number(bat.gst_pct) > 0 ? Number(bat.gst_pct) : getBatteryGstRate(bat)) as any,
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
      const isStructureSelected = !!input.structureMaterialType || !!input.structureId;
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
            gstPct: (Number(bat.gst_pct) > 0 ? Number(bat.gst_pct) : getBatteryGstRate(bat)) as any,
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
        gstPct: TAX_CONSTANTS.BATTERY_GST_RATE,
        unit: 'Nos',
        remarks: 'None (Unselected)',
      });
    }
  }

  // Recalculate capacity dynamically based on resolved panel wattage and overrides
  let totalPanelWatts = 0;
  resolvedItems.forEach((item, index) => {
    if (item.description.toUpperCase().startsWith('PANEL')) {
      const rowOverride = input.overrides?.[index];
      const effectiveQty = rowOverride?.qty !== undefined
        ? rowOverride.qty
        : equipmentOverrides.panelQtyOverride !== undefined
        ? equipmentOverrides.panelQtyOverride
        : item.qty;

      let wattage = item.unitWattage ?? 0;
      if (wattage === 0) {
        const match = item.description.match(/\((\d+)\s*W\)/i);
        if (match) {
          wattage = parseInt(match[1], 10);
        }
      }
      if (wattage > 0) {
        totalPanelWatts += effectiveQty * wattage;
      }
    }
  });

  if (totalPanelWatts > 0) {
    capacityKW = totalPanelWatts / 1000;
    capacityWatts = totalPanelWatts;
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
          description.toUpperCase().startsWith('BATTERY') ? TAX_CONSTANTS.BATTERY_GST_RATE :
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
        description: `LIGHTNING ARRESTER ${la.brand} ${la.model}`,
        qty: input.lightningArresterQty ?? 1,
        ratePerUnit: Number(la.rate),
        gstPct: gst as any,
        unit: 'Nos',
        remarks: la.description ?? la.model,
      });
    } else {
      resolvedItems.push({
        description: 'LIGHTNING ARRESTER',
        qty: 0,
        ratePerUnit: 0,
        gstPct: TAX_CONSTANTS.BOS_GST_RATE as any,
        unit: 'Nos',
        remarks: 'None (Unselected)',
      });
    }
  } else {
    resolvedItems.push({
      description: 'LIGHTNING ARRESTER',
      qty: 0,
      ratePerUnit: 0,
      gstPct: TAX_CONSTANTS.BOS_GST_RATE as any,
      unit: 'Nos',
      remarks: 'None (Unselected)',
    });
  }

  // customItems
  if (input.customItems) {
    resolvedItems.push(...input.customItems);
  }

  // 🚀 Step 3.5: Inject Engineering BOS Components (Electrical, Structure, Civil)
  const systemKw = capacityKW;
  const panelCount = equipmentOverrides.panelQtyOverride ?? system.panelQty ?? 0;
  
  // Phase and Inverter approximations based on current state parameters
  const inverterCount = resolvedItems.filter(i => i.description.toUpperCase().includes('INVERTER')).reduce((acc, curr) => acc + curr.qty, 0) || 1;
  const phase = systemKw > 5 ? 3 : 1; 

  const electricalBOM = generateElectricalBOM({
    systemKw,
    panelCount,
    inverterCount,
    phase,
    dcCableLengthM: input.dcCableLengthM,
    acCableLengthM: input.acCableLengthM
  });

  const structureBOM = generateStructureBOM({
    systemKw,
    structureType: input.structureType as any
  });

  const civilEarthingBOM = generateCivilEarthingBOM({
    systemKw,
    structureType: input.structureType as any,
    laCount: input.lightningArresterQty
  });

  // Additional base overheads that must exist
  const logisticsBOM: BomItem[] = [
    { description: 'TRANSPORTATION', unit: 'Lot', qty: 1, ratePerUnit: 0, gstPct: TAX_CONSTANTS.BOS_GST_RATE as any },
    { description: 'COMMISSION', unit: 'Lot', qty: 1, ratePerUnit: 0, gstPct: TAX_CONSTANTS.BOS_GST_RATE as any },
    { description: 'SITE VISIT', unit: 'Lot', qty: 1, ratePerUnit: 0, gstPct: TAX_CONSTANTS.BOS_GST_RATE as any },
    { 
      description: 'INSTALLATION', 
      unit: 'Lot', 
      qty: systemKw, 
      ratePerUnit: 3000, 
      gstPct: (input.projectType === 'residential' ? TAX_CONSTANTS.RESIDENTIAL_COMPOSITE_GST_RATE : TAX_CONSTANTS.INSTALLATION_SERVICE_GST) as any 
    }
  ];

  const engineeredItems = [...electricalBOM, ...structureBOM, ...civilEarthingBOM, ...logisticsBOM];

  for (const item of engineeredItems) {
    const exists = resolvedItems.some(i => i.description.toUpperCase().includes(item.description.toUpperCase()));
    if (!exists) {
      upsertItem(item.description, {
        qty: item.qty,
        ratePerUnit: item.ratePerUnit,
        gstPct: item.gstPct as any,
        unit: item.unit,
        remarks: 'Engineered BOM',
      }, false);
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

    const effectiveGstPct = roundTo5(normalizeGstRate(
      rowOverride?.gstPct !== undefined ? rowOverride.gstPct : item.gstPct,
      TAX_CONSTANTS.BOS_GST_RATE,
    ));

    const lineTotalPaise = isDisabled ? 0 : Math.round(effectiveQty * effectiveRate * 100);
    const lineGSTPaise = isDisabled ? 0 : Math.round(lineTotalPaise * effectiveGstPct);
    const lineSubTotalPaise = lineTotalPaise + lineGSTPaise;

    const lineTotal = lineTotalPaise / 100;
    const lineGST = lineGSTPaise / 100;
    const lineSubTotal = lineSubTotalPaise / 100;

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
      categoryName: resolveCategoryName(item.description, (item as any).section),
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
  const VALID_OUTPUT_GST_SLABS = new Set([
    0, 
    TAX_CONSTANTS.RESIDENTIAL_GST_RATE, 
    TAX_CONSTANTS.INVERTER_GST_RATE, 
    TAX_CONSTANTS.COMPOSITE_GST_RATE, 
    TAX_CONSTANTS.RESIDENTIAL_COMPOSITE_GST_RATE, 
    TAX_CONSTANTS.BOS_GST_RATE, 
    0.28
  ]);
  const rawGstOverride = input.gstOnOutputOverride;
  const resolvedGstOverride = (() => {
    if (rawGstOverride === undefined || input.allowGstOverride !== true) return undefined;
    // Validate: must match a known slab within floating-point tolerance
    const normalizedOverride = normalizeGstRate(rawGstOverride, rawGstOverride);
    const isValid = [...VALID_OUTPUT_GST_SLABS].some(
      slab => Math.abs(slab - normalizedOverride) < 0.0001
    );
    if (!isValid) {
      throw new Error(
        `Invalid GST output override: ${(normalizedOverride * 100).toFixed(3)}%. ` +
        `Must be one of: ${[...VALID_OUTPUT_GST_SLABS].map(s => (s * 100).toFixed(1) + '%').join(', ')}`
      );
    }
    return normalizedOverride;
  })();

  const gstOutputRate = roundTo5(normalizeGstRate(
    resolvedGstOverride !== undefined
      ? resolvedGstOverride
      : (input.gstOnOutput !== undefined 
          ? input.gstOnOutput 
          : (input.projectType === 'commercial' ? TAX_CONSTANTS.COMMERCIAL_GST_RATE : TAX_CONSTANTS.RESIDENTIAL_COMPOSITE_GST_RATE)),
    input.projectType === 'commercial' ? TAX_CONSTANTS.COMMERCIAL_GST_RATE : TAX_CONSTANTS.RESIDENTIAL_COMPOSITE_GST_RATE,
  ));

  // ── Step 8 & 6: Resolve MRP & Margin ──
  // ITC Handling: The EPC contractor can always claim ITC (if registered), so base cost is always costBeforeGST.
  // Using totalIncGST would result in charging Output GST on top of Input GST (Tax-on-Tax).
  const baseCostForMargin = costBeforeGST;

  const marginResults = calculatePricingAndMargins({
    baseCost: baseCostForMargin,
    marginMode: input.marginMode,
    targetMarginPct: input.targetMarginPct,
    targetMarginAmount: input.targetMarginAmount,
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
  const capKW = Math.max(0.0001, capacityKW);
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
  const unroundedFinalCustomerPrice = roundToINR(Math.max(0, mrpInclGST - discountAmount + additionalCostTotal));
  const roundOffToThousand = input.roundOffToThousand === true;
  const roundedFinalCustomerPrice = roundOffToThousand
    ? roundToNearestThousand(unroundedFinalCustomerPrice)
    : unroundedFinalCustomerPrice;
  const roundOffAdjustment = roundToINR(roundedFinalCustomerPrice - unroundedFinalCustomerPrice);
  const finalCustomerPrice = roundToINR(roundedFinalCustomerPrice);
  const quotedLines = buildQuotedLines(lines, mrpExclGST, roundOffAdjustment);

  // ── Step 13: Subsidy (state-driven) ──
  // The selected state is the single source of truth. `applySubsidy` (a simple
  // on/off toggle for ineligible/commercial customers) decides whether to apply it;
  // the actual amount is computed server-side by the calculate_state_subsidy RPC
  // (PM Surya Ghar central assistance + any per-state top-up), surfaced as
  // rpcSubsidyAmount. A local slab computation is used as an offline fallback.
  let subsidyResult: SubsidyResult = {
    amount: 0,
    breakdown: 'No subsidy applied',
    isEligible: false,
    schemeNote: ''
  };

  // Source of truth: applySubsidy. Legacy callers that only set selectedScheme
  // continue to work (selectedScheme !== 'none' ⇒ apply).
  const isSubsidyEnabled = input.applySubsidy !== undefined
    ? input.applySubsidy
    : (input.selectedScheme !== undefined && input.selectedScheme !== 'none');

  if (isSubsidyEnabled) {
    const panelCapKW = capacityKW;
    const aggregateInverterKW = input.totalInverterCapacityKW ?? input.inverterCapacityKW ?? panelCapKW;
    const eligibleKw = Math.min(panelCapKW, aggregateInverterKW);

    if (input.rpcSubsidyAmount !== undefined && input.rpcSubsidyAmount !== null) {
      // Server-computed, state-driven amount (authoritative).
      const amt = input.rpcSubsidyAmount;
      subsidyResult = {
        amount: amt,
        breakdown: amt > 0
          ? `${input.subsidySchemeName ?? input.state + ' subsidy'} — ₹${amt.toLocaleString('en-IN')} for ${panelCapKW.toFixed(2)} kW system`
          : `${input.state} — No subsidy applicable for this configuration`,
        isEligible: amt > 0,
        schemeNote: amt > 0
          ? `${input.subsidySchemeName ?? input.state + ' policy'} · DISCOM approval required`
          : '',
      };
    } else {
      // Offline / fallback — compute locally from the state's slab config.
      const computedSubsidy = getSubsidyAmount(
        panelCapKW,
        aggregateInverterKW,
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
        breakdown: computedSubsidy > 0
          ? `${input.state} subsidy — ₹${computedSubsidy.toLocaleString('en-IN')} for ${panelCapKW.toFixed(2)} kW`
          : `${input.state} — No subsidy applicable for this configuration`,
        isEligible: computedSubsidy > 0,
        schemeNote: computedSubsidy > 0 ? `${input.subsidySchemeName ?? input.state + ' state policy'} · DISCOM approval required` : '',
      };
    }
  }

  const subsidyAmount = roundToINR(subsidyResult.amount);

  // ── Step 14: Beneficiary contribution ──
  // Commercial customers can claim GST Input Tax Credit on the system price.
  // The ITC is exactly the output GST portion of the final invoice price.
  let itcAmount = 0;
  if (input.projectType === 'commercial') {
    const finalCustomerPriceExclGST = finalCustomerPrice / (1 + gstOutputRate);
    itcAmount = finalCustomerPrice - finalCustomerPriceExclGST;
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
    orientationMultipliers: input.dbOrientationMultipliers,
    panelDegradationRate: input.panelDegradationRate
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
    annualGenerationKWh: energyProjections.undegradedAnnualGenerationKWh,
    annualSavingsINR: energyProjections.undegradedAnnualGenerationKWh * effectiveGridTariffPerKWh,
    panelDegradationRate: input.panelDegradationRate,
    electricityInflationRate: input.electricityInflationRate,
    systemLifetimeYears: 25
  });
  // Preserve a non-finite payback (system never recovers its cost) as Infinity.
  // roundTo5/sanitizeNumber would otherwise coerce it to 0, which the UI reads as
  // an instant payback. Downstream consumers explicitly check `=== Infinity`.
  const paybackYears = isFinite(financialProjections.paybackYears)
    ? roundTo5(financialProjections.paybackYears)
    : Infinity;
  const lcoe = roundToINR(financialProjections.lcoe);
  const lifetimeSavingsINR = roundToINR(financialProjections.lifetimeSavingsINR);
  const npv = roundToINR(financialProjections.npv);
  const irr = roundTo5(financialProjections.irr);

  const civilLogisticsCost = lines
    .filter(l => l.categoryId === 'cat-civil' || l.categoryId === 'cat-logistics')
    .filter(l => !l.isDisabled)
    .reduce((sum, l) => sum + l.lineSubTotal, 0);

  // ── Return complete result ──
  const result: CalcResult = {
    capacityKW,
    lines,
    quotedLines,
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
    unroundedFinalCustomerPrice,
    roundOffToThousand,
    roundOffAdjustment,
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

  assertCalcResultIntegrity(result, {
    projectType: input.projectType,
    context: 'calculateSystem',
  });

  return result;
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

export function resolveCategoryName(description: string, section?: string): string {
  if (section) {
    const mapping: Record<string, string> = {
      solar_panels: 'Solar Panels',
      power_electronics: 'Power Electronics',
      metering: 'Metering',
      mounting_structure: 'Mounting & Structure',
      electrical_protection: 'Electrical Protection',
      earthing: 'Earthing',
      cabling: 'Cabling',
      wiring: 'Wiring',
      services: 'Services',
    };
    if (mapping[section]) return mapping[section];
  }

  const desc = description.toUpperCase();
  if (desc.includes('PANEL')) return 'Solar Panels';
  if (desc.includes('INVERTER') || desc.includes('BATTERY') || desc.includes('COMMUNICATION')) return 'Power Electronics';
  if (desc.includes('SOLAR METER') || desc.includes('NET METER')) return 'Metering';
  if (desc.includes('STRUCTURE') || desc.includes('ACCESSORIES') || desc.includes('WALKWAY') || desc.includes('LADDER')) return 'Mounting & Structure';
  if (desc.includes('ACDB') || desc.includes('DCDB') || desc.includes('ISOLATOR') || desc.includes('METER BOX')) return 'Electrical Protection';
  if (desc.includes('EARTH') || desc.includes('GI STRIP') || desc.includes('CHAMBER')) return 'Earthing';
  if (desc.includes('CABLE') || desc.includes('MC4') || desc.includes('COPPER')) return 'Cabling';
  if (desc.includes('PIPE') || desc.includes('LIGHTNING') || desc.includes(' L/A')) return 'Wiring';
  if (desc.includes('TRANSPORT') || desc.includes('COMMISSION') || desc.includes('VISIT') || desc.includes('INSTALLATION')) return 'Services';

  return 'Other';
}
