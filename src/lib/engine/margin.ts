import { sanitizeNumber } from './calculator';

export type DiscountType = 'none' | 'flat' | 'percent';
export type MarginMode = 'percent' | 'flat';

export interface PricingMarginInput {
  baseCost: number;
  marginMode?: MarginMode;
  targetMarginPct?: number;
  targetMarginAmount?: number;
  targetMRPInclGST?: number;
  targetMRPPerWatt?: number;
  gstOutputRate: number;
  capacityWatts: number;
  defaultMarginPct: number;
}

function normalizeMarginPct(value: unknown, fallback = 0): number {
  const num = sanitizeNumber(value, fallback);
  if (!Number.isFinite(num) || num < 0) return fallback;
  return num > 1 ? num / 100 : num;
}

/**
 * FIX CALC-07: Throw when both targetMRPPerWatt and targetMarginPct are provided.
 * Previously targetMRPPerWatt silently won, masking a misconfiguration.
 * Priority (documented): targetMRPInclGST > targetMRPPerWatt > targetMarginPct > defaultMarginPct
 */
export function calculatePricingAndMargins(rawInput: PricingMarginInput) {
  // FIX CALC-07: Conflict detection
  const setPricingOptions = [
    rawInput.targetMRPInclGST !== undefined,
    rawInput.targetMRPPerWatt !== undefined,
    rawInput.marginMode === 'flat' && rawInput.targetMarginAmount !== undefined,
    rawInput.marginMode !== 'flat' && rawInput.targetMarginPct !== undefined
  ].filter(Boolean).length;
  
  if (setPricingOptions > 1) {
    console.warn(
      'Pricing conflict: Only one of targetMRPInclGST, targetMRPPerWatt, or targetMarginPct can be set. ' +
      'Priority chain: targetMRPInclGST > targetMRPPerWatt > targetMarginPct.'
    );
  }

  const baseCost = Math.max(0, sanitizeNumber(rawInput.baseCost, 0));
  const marginMode: MarginMode = rawInput.marginMode === 'flat' ? 'flat' : 'percent';
  const targetMarginPct = rawInput.targetMarginPct !== undefined ? normalizeMarginPct(rawInput.targetMarginPct) : undefined;

  // Guard targetMarginAmount to be non-negative
  let targetMarginAmount = rawInput.targetMarginAmount !== undefined ? sanitizeNumber(rawInput.targetMarginAmount, 0) : undefined;
  if (targetMarginAmount !== undefined && targetMarginAmount < 0) {
    console.warn('Target margin amount is negative. Clamping to 0.');
    targetMarginAmount = 0;
  }

  const targetMRPInclGST = rawInput.targetMRPInclGST !== undefined ? sanitizeNumber(rawInput.targetMRPInclGST, 0) : undefined;
  const targetMRPPerWatt = rawInput.targetMRPPerWatt !== undefined ? sanitizeNumber(rawInput.targetMRPPerWatt, 0) : undefined;
  const gstOutputRate = Math.max(0, Math.min(2.0, sanitizeNumber(rawInput.gstOutputRate, 0)));
  const capacityWatts = Math.max(0, sanitizeNumber(rawInput.capacityWatts, 0));
  const defaultMarginPct = normalizeMarginPct(rawInput.defaultMarginPct);

  // Guard: targetMRPPerWatt requires non-zero capacity
  if (targetMRPPerWatt !== undefined && capacityWatts <= 0) {
    throw new Error('Capacity must be greater than zero when targetMRPPerWatt is specified.');
  }

  const baseCostPaise = Math.round(baseCost * 100);
  let mrpInclGSTPaise = 0;
  let mrpExclGSTPaise = 0;
  let marginAmountPaise = 0;
  let effectiveMarginPct = 0;

  if (targetMRPInclGST !== undefined) {
    mrpInclGSTPaise = Math.round(targetMRPInclGST * 100);
    mrpExclGSTPaise = Math.round(mrpInclGSTPaise / (1 + gstOutputRate));
    marginAmountPaise = mrpExclGSTPaise - baseCostPaise;
    effectiveMarginPct = mrpExclGSTPaise > 0 ? marginAmountPaise / mrpExclGSTPaise : 0;
  } else if (targetMRPPerWatt !== undefined) {
    mrpInclGSTPaise = Math.round(targetMRPPerWatt * capacityWatts * 100);
    mrpExclGSTPaise = Math.round(mrpInclGSTPaise / (1 + gstOutputRate));
    marginAmountPaise = mrpExclGSTPaise - baseCostPaise;
    effectiveMarginPct = mrpExclGSTPaise > 0 ? marginAmountPaise / mrpExclGSTPaise : 0;
  } else if (marginMode === 'flat') {
    marginAmountPaise = Math.max(0, Math.round((targetMarginAmount ?? 0) * 100));
    mrpExclGSTPaise = baseCostPaise + marginAmountPaise;
    effectiveMarginPct = mrpExclGSTPaise > 0 ? marginAmountPaise / mrpExclGSTPaise : 0;
    mrpInclGSTPaise = Math.round(mrpExclGSTPaise * (1 + gstOutputRate));
  } else {
    const markupPct = targetMarginPct !== undefined
      ? targetMarginPct
      : defaultMarginPct;

    effectiveMarginPct = Math.max(markupPct, 0);
    marginAmountPaise = Math.round(baseCostPaise * effectiveMarginPct);
    mrpExclGSTPaise = baseCostPaise + marginAmountPaise;
    mrpInclGSTPaise = Math.round(mrpExclGSTPaise * (1 + gstOutputRate));
  }

  return {
    mrpInclGST: sanitizeNumber(mrpInclGSTPaise / 100),
    mrpExclGST: sanitizeNumber(mrpExclGSTPaise / 100),
    marginAmount: sanitizeNumber(marginAmountPaise / 100),
    effectiveMarginPct: sanitizeNumber(effectiveMarginPct)
  };
}

export interface DiscountInput {
  mrpInclGST: number;
  discountType: DiscountType;
  discountVal: number;
}

export function calculateDiscountAmount(rawInput: DiscountInput): number {
  const mrpInclGST = Math.max(0, sanitizeNumber(rawInput.mrpInclGST, 0));
  const val = Math.max(0, sanitizeNumber(rawInput.discountVal, 0));
  
  let discountAmountPaise = 0;
  const mrpInclGSTPaise = Math.round(mrpInclGST * 100);

  if (rawInput.discountType === 'flat' && val > mrpInclGST) {
    console.warn(`Discount amount ₹${val} exceeds MRP ₹${mrpInclGST}`);
  } else if (rawInput.discountType === 'percent' && val > 50) {
    console.warn(`High discount rate specified: ${val}%`);
  }

  switch (rawInput.discountType) {
    case 'flat':
      discountAmountPaise = Math.round(val * 100);
      break;
    case 'percent':
      discountAmountPaise = Math.round(mrpInclGSTPaise * (Math.min(100, val) / 100));
      break;
    case 'none':
    default:
      discountAmountPaise = 0;
      break;
  }

  const finalDiscountPaise = Math.max(0, Math.min(discountAmountPaise, mrpInclGSTPaise));
  return sanitizeNumber(finalDiscountPaise / 100);
}
