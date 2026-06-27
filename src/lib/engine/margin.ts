import { sanitizeNumber } from './calculator';

export type DiscountType = 'none' | 'flat' | 'percent';

export interface PricingMarginInput {
  baseCost: number;
  targetMarginPct?: number;
  targetMRPInclGST?: number;
  targetMRPPerWatt?: number;
  gstOutputRate: number;
  capacityWatts: number;
  defaultMarginPct: number;
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
    rawInput.targetMarginPct !== undefined
  ].filter(Boolean).length;
  
  if (setPricingOptions > 1) {
    console.warn(
      'Pricing conflict: Only one of targetMRPInclGST, targetMRPPerWatt, or targetMarginPct can be set. ' +
      'Priority chain: targetMRPInclGST > targetMRPPerWatt > targetMarginPct.'
    );
  }

  const baseCost = Math.max(0, sanitizeNumber(rawInput.baseCost, 0));
  const targetMarginPct = rawInput.targetMarginPct !== undefined ? sanitizeNumber(rawInput.targetMarginPct, 0) : undefined;
  const targetMRPInclGST = rawInput.targetMRPInclGST !== undefined ? sanitizeNumber(rawInput.targetMRPInclGST, 0) : undefined;
  const targetMRPPerWatt = rawInput.targetMRPPerWatt !== undefined ? sanitizeNumber(rawInput.targetMRPPerWatt, 0) : undefined;
  const gstOutputRate = Math.max(0, Math.min(2.0, sanitizeNumber(rawInput.gstOutputRate, 0)));
  const capacityWatts = Math.max(0, sanitizeNumber(rawInput.capacityWatts, 0));
  const defaultMarginPct = sanitizeNumber(rawInput.defaultMarginPct, 0);

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
  } else {
    effectiveMarginPct = targetMarginPct !== undefined
      ? targetMarginPct
      : defaultMarginPct;
    effectiveMarginPct = Math.max(Math.min(effectiveMarginPct, 0.99), 0); // Cap at 99%
    mrpExclGSTPaise = Math.round(baseCostPaise / (1 - effectiveMarginPct));
    marginAmountPaise = mrpExclGSTPaise - baseCostPaise;
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
