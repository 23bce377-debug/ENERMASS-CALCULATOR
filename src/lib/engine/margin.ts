export type DiscountType = 'none' | 'flat' | 'percent';

export interface PricingMarginInput {
  costBeforeGST: number;
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
  if (input.targetMRPPerWatt !== undefined && input.targetMarginPct !== undefined) {
    throw new Error(
      'Pricing conflict: both targetMRPPerWatt and targetMarginPct are set. ' +
      'Provide only one. Priority chain: targetMRPInclGST > targetMRPPerWatt > targetMarginPct.'
    );
  }

  let mrpInclGST = 0;
  let mrpExclGST = 0;
  let marginAmount = 0;
  let effectiveMarginPct = 0;

  if (input.targetMRPInclGST !== undefined) {
    mrpInclGST = input.targetMRPInclGST;
    mrpExclGST = mrpInclGST / (1 + input.gstOutputRate);
    marginAmount = mrpExclGST - input.costBeforeGST;
    effectiveMarginPct = input.costBeforeGST > 0 ? marginAmount / input.costBeforeGST : 0;
  } else if (input.targetMRPPerWatt !== undefined) {
    mrpInclGST = input.targetMRPPerWatt * input.capacityWatts;
    mrpExclGST = mrpInclGST / (1 + input.gstOutputRate);
    marginAmount = mrpExclGST - input.costBeforeGST;
    effectiveMarginPct = input.costBeforeGST > 0 ? marginAmount / input.costBeforeGST : 0;
  } else {
    effectiveMarginPct = input.targetMarginPct !== undefined
      ? input.targetMarginPct
      : input.defaultMarginPct;
    effectiveMarginPct = Math.max(effectiveMarginPct, 0);
    marginAmount = input.costBeforeGST * effectiveMarginPct;
    mrpExclGST = input.costBeforeGST + marginAmount;
    mrpInclGST = mrpExclGST * (1 + input.gstOutputRate);
  }

  return {
    mrpInclGST,
    mrpExclGST,
    marginAmount,
    effectiveMarginPct
  };
}

export interface DiscountInput {
  mrpInclGST: number;
  discountType: DiscountType;
  discountVal: number;
}

export function calculateDiscountAmount(input: DiscountInput): number {
  let discountAmount = 0;
  const val = Math.max(0, input.discountVal);

  switch (input.discountType) {
    case 'flat':
      discountAmount = val;
      break;
    case 'percent':
      discountAmount = input.mrpInclGST * (val / 100);
      break;
    case 'none':
    default:
      discountAmount = 0;
      break;
  }

  return Math.max(0, Math.min(discountAmount, input.mrpInclGST));
}
