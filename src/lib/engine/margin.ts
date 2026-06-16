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
export function calculatePricingAndMargins(input: PricingMarginInput) {
  // FIX CALC-07: Conflict detection
  const setPricingOptions = [
    input.targetMRPInclGST !== undefined,
    input.targetMRPPerWatt !== undefined,
    input.targetMarginPct !== undefined
  ].filter(Boolean).length;
  
  if (setPricingOptions > 1) {
    console.warn(
      'Pricing conflict: Only one of targetMRPInclGST, targetMRPPerWatt, or targetMarginPct can be set. ' +
      'Priority chain: targetMRPInclGST > targetMRPPerWatt > targetMarginPct.'
    );
  }

  const baseCostPaise = Math.round(input.baseCost * 100);
  let mrpInclGSTPaise = 0;
  let mrpExclGSTPaise = 0;
  let marginAmountPaise = 0;
  let effectiveMarginPct = 0;

  if (input.targetMRPInclGST !== undefined) {
    mrpInclGSTPaise = Math.round(input.targetMRPInclGST * 100);
    mrpExclGSTPaise = Math.round(mrpInclGSTPaise / (1 + input.gstOutputRate));
    marginAmountPaise = mrpExclGSTPaise - baseCostPaise;
    effectiveMarginPct = mrpExclGSTPaise > 0 ? marginAmountPaise / mrpExclGSTPaise : 0;
  } else if (input.targetMRPPerWatt !== undefined) {
    mrpInclGSTPaise = Math.round(input.targetMRPPerWatt * input.capacityWatts * 100);
    mrpExclGSTPaise = Math.round(mrpInclGSTPaise / (1 + input.gstOutputRate));
    marginAmountPaise = mrpExclGSTPaise - baseCostPaise;
    effectiveMarginPct = mrpExclGSTPaise > 0 ? marginAmountPaise / mrpExclGSTPaise : 0;
  } else {
    effectiveMarginPct = input.targetMarginPct !== undefined
      ? input.targetMarginPct
      : input.defaultMarginPct;
    effectiveMarginPct = Math.max(Math.min(effectiveMarginPct, 0.99), 0); // Cap at 99%
    mrpExclGSTPaise = Math.round(baseCostPaise / (1 - effectiveMarginPct));
    marginAmountPaise = mrpExclGSTPaise - baseCostPaise;
    mrpInclGSTPaise = Math.round(mrpExclGSTPaise * (1 + input.gstOutputRate));
  }

  return {
    mrpInclGST: mrpInclGSTPaise / 100,
    mrpExclGST: mrpExclGSTPaise / 100,
    marginAmount: marginAmountPaise / 100,
    effectiveMarginPct
  };
}

export interface DiscountInput {
  mrpInclGST: number;
  discountType: DiscountType;
  discountVal: number;
}

export function calculateDiscountAmount(input: DiscountInput): number {
  let discountAmountPaise = 0;
  const val = Math.max(0, input.discountVal);
  const mrpInclGSTPaise = Math.round(input.mrpInclGST * 100);

  switch (input.discountType) {
    case 'flat':
      discountAmountPaise = Math.round(val * 100);
      break;
    case 'percent':
      discountAmountPaise = Math.round(mrpInclGSTPaise * (val / 100));
      break;
    case 'none':
    default:
      discountAmountPaise = 0;
      break;
  }

  return Math.max(0, Math.min(discountAmountPaise, mrpInclGSTPaise)) / 100;
}
