/**
 * ENERMASS Solar Pricing Calculator — Calculation Engine
 * ======================================================
 * Pure-function engine. No rounding in intermediate steps.
 * All formulas aligned with the math.md spec.
 */

import { SYSTEMS, type SolarSystem, type BomItem } from '../data/bom';
import { STATE_DATA, GRID_TARIFF_PER_KWH, type StateData } from '../data/masters';

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
  gstOnOutput?: number;
  overrides?: Record<number, RowOverride>;
  rateMaster?: RateMaster;
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
}

// ─── Equipment override keys (matched against BomItem.description) ──────────

const PANEL_KEY = 'PANEL';
const INVERTER_KEY = 'INVERTER';
const BATTERY_KEY = 'BATTERY';

// ─── Rate Resolution ────────────────────────────────────────────────────────────

/**
 * Resolve the effective rate for a BOM item.
 *
 * Priority chain (first non-undefined wins):
 *   1. Row-level override  (overrides[index].ratePerUnit)
 *   2. Rate master          (rateMaster[description].rate, if active)
 *   3. Equipment override   (panelRateOverride / inverterRateOverride / batteryRateOverride)
 *   4. Item default         (item.ratePerUnit)
 */
export function resolveRate(
  item: BomItem,
  index: number,
  overrides?: Record<number, RowOverride>,
  rateMaster?: RateMaster,
  equipmentOverrides?: {
    panelRateOverride?: number;
    inverterRateOverride?: number;
    batteryRateOverride?: number;
  },
): number {
  // 1. Row-level override
  const rowOverride = overrides?.[index];
  if (rowOverride?.ratePerUnit !== undefined) {
    return rowOverride.ratePerUnit;
  }

  // 2. Rate master
  const masterEntry = rateMaster?.[item.description];
  if (masterEntry && masterEntry.active && masterEntry.rate > 0) {
    return masterEntry.rate;
  }

  // 3. Equipment override
  const descUpper = item.description.toUpperCase();
  if (descUpper === PANEL_KEY && equipmentOverrides?.panelRateOverride !== undefined) {
    return equipmentOverrides.panelRateOverride;
  }
  if (descUpper === INVERTER_KEY && equipmentOverrides?.inverterRateOverride !== undefined) {
    return equipmentOverrides.inverterRateOverride;
  }
  if (descUpper === BATTERY_KEY && equipmentOverrides?.batteryRateOverride !== undefined) {
    return equipmentOverrides.batteryRateOverride;
  }

  // 4. Item default
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
): number {
  // Commercial projects never receive residential subsidy
  if (projectType === 'commercial') {
    return 0;
  }

  const stateData = STATE_DATA[state];
  if (!stateData || !stateData.subsidyRules || stateData.subsidyRules.length === 0) {
    return 0;
  }

  // Subsidy eligible capacity is the MINIMUM of panel capacity or inverter capacity (if known)
  const eligibleCapacityKW = inverterCapacityKW !== undefined ? Math.min(panelCapacityKW, inverterCapacityKW) : panelCapacityKW;

  // Tiered lookup — first rule where capacity falls within maxKW
  for (const rule of stateData.subsidyRules) {
    if (eligibleCapacityKW <= rule.maxKW) {
      return rule.amount;
    }
  }

  // No matching tier → no subsidy
  return 0;
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
  const stateData = STATE_DATA[input.state];
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

  // ── Step 3-4: Process each BOM item ──
  const allItems = [...system.items, ...(input.customItems || [])];
  const lines: LineResult[] = allItems.map((item, index) => {
    const rowOverride = input.overrides?.[index];

    // Resolve effective values
    const effectiveQty =
      rowOverride?.qty !== undefined
        ? rowOverride.qty
        : item.description.toUpperCase() === PANEL_KEY &&
          equipmentOverrides.panelQtyOverride !== undefined
        ? equipmentOverrides.panelQtyOverride
        : item.description.toUpperCase() === INVERTER_KEY &&
          equipmentOverrides.inverterQtyOverride !== undefined
        ? equipmentOverrides.inverterQtyOverride
        : item.description.toUpperCase() === BATTERY_KEY &&
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

    // Compute line totals — NO rounding
    const lineTotal = effectiveQty * effectiveRate;
    const lineGST = lineTotal * effectiveGstPct;
    const lineSubTotal = lineTotal + lineGST;

    // Determine if anything was overridden
    const isOverridden =
      rowOverride?.qty !== undefined ||
      rowOverride?.ratePerUnit !== undefined ||
      rowOverride?.gstPct !== undefined ||
      (item.description.toUpperCase() === PANEL_KEY &&
        (input.panelRateOverride !== undefined ||
          input.panelQtyOverride !== undefined)) ||
      (item.description.toUpperCase() === INVERTER_KEY &&
        (input.inverterRateOverride !== undefined || input.inverterQtyOverride !== undefined)) ||
      (item.description.toUpperCase() === BATTERY_KEY &&
        (input.batteryRateOverride !== undefined || input.batteryQtyOverride !== undefined)) ||
      (input.rateMaster?.[item.description]?.active === true) ||
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
    };
  });

  // ── Step 5: Cost aggregates ──
  const costBeforeGST = lines.reduce((sum, l) => sum + l.lineTotal, 0);
  const totalInputGST = lines.reduce((sum, l) => sum + l.lineGST, 0);
  const totalIncGST = costBeforeGST + totalInputGST;

  // ── Step 6: Resolve margin ──
  let effectiveMarginPct =
    input.targetMarginPct !== undefined
      ? input.targetMarginPct
      : system.targetMarginPct;

  // Margin is treated as markup on cost (0% to 100%+ allowed by UI/config).
  // Clamp only to non-negative values to avoid pathological negative pricing.
  effectiveMarginPct = Math.max(effectiveMarginPct, 0);

  // ── Step 7: Resolve output GST ──
  const gstOutputRate =
    input.gstOnOutput !== undefined
      ? input.gstOnOutput
      : stateData.gstOnOutput;

  // ── Step 8: MRP excl GST — EXACT, no rounding ──
  // markup model: MRP = Cost × (1 + marginPct)
  const marginAmount = costBeforeGST * effectiveMarginPct;
  const mrpExclGST = costBeforeGST + marginAmount;

  // ── Step 9: MRP incl GST ──
  const mrpInclGST = mrpExclGST * (1 + gstOutputRate);

  // ── Per-kW analysis ──
  const capKW = system.capacityKW || 0.001; // Avoid div by zero
  const perKWexclGST = mrpExclGST / capKW;
  const perKWinclGST = mrpInclGST / capKW;

  // ── Step 10: Discount ──
  let discountAmount = 0;
  const discountType = input.discountType ?? 'none';
  const discountVal = Math.max(0, input.discountVal ?? 0);

  switch (discountType) {
    case 'flat':
      discountAmount = discountVal;
      break;
    case 'percent':
      discountAmount = mrpInclGST * (discountVal / 100);
      break;
    case 'none':
    default:
      discountAmount = 0;
      break;
  }
  
  // Ensure discount is never negative and does not exceed the total price
  discountAmount = Math.max(0, Math.min(discountAmount, mrpInclGST));

  // ── Step 11: Additional costs ──
  const additionalCostTotal = (input.additionalCosts ?? []).reduce(
    (sum, c) => sum + c.amount,
    0,
  );

  // ── Step 12: Final customer price ──
  const finalCustomerPrice = Math.max(0, mrpInclGST - discountAmount + additionalCostTotal);

  // ── Step 13: Subsidy ──
  const subsidyAmount = getSubsidyAmount(
    input.panelCapacityKW ?? system.capacityKW,
    input.inverterCapacityKW,
    input.state,
    input.projectType,
  );

  // ── Step 14: Beneficiary contribution ──
  const beneficiaryContribution = Math.max(0, finalCustomerPrice - subsidyAmount);

  // ── Step 15: Energy generation ──
  let orientationMultiplier = 1.0;
  if (input.orientation === 'East/West') orientationMultiplier = 0.85;
  if (input.orientation === 'Flat') orientationMultiplier = 0.90;

  const effectivePanelKW = input.panelCapacityKW ?? system.capacityKW;
  const effectiveInverterKW = input.inverterCapacityKW ?? effectivePanelKW;
  const maxHourlyGeneration = Math.min(effectivePanelKW, effectiveInverterKW); // Inverter clipping cap

  const dailyGenerationKWh = maxHourlyGeneration * stateData.sunHoursPerDay * stateData.performanceRatio * orientationMultiplier;
  const monthlyGenerationKWh = dailyGenerationKWh * 30;
  const annualGenerationKWh = dailyGenerationKWh * 365;

  // ── Step 16: Savings ──
  const effectiveGridTariffPerKWh =
    input.gridTariffPerKWh !== undefined && input.gridTariffPerKWh >= 0
      ? input.gridTariffPerKWh
      : GRID_TARIFF_PER_KWH;

  const monthlySavingsINR = monthlyGenerationKWh * effectiveGridTariffPerKWh;
  const annualSavingsINR = annualGenerationKWh * effectiveGridTariffPerKWh;

  // ── Step 17: Payback & LCOE ──
  const paybackYears =
    annualSavingsINR > 0 ? beneficiaryContribution / annualSavingsINR : Infinity;

  const degradationRate = input.panelDegradationRate ?? 0.005;
  let lifetimeGenerationKWh = 0;
  for (let year = 0; year < 25; year++) {
    lifetimeGenerationKWh += annualGenerationKWh * Math.pow(1 - degradationRate, year);
  }
  const lcoe = lifetimeGenerationKWh > 0 ? beneficiaryContribution / lifetimeGenerationKWh : 0;

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
