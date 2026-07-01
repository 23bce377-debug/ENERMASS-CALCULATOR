import { describe, it, expect } from 'vitest';
import { calculatePricingAndMargins, calculateDiscountAmount } from '@/lib/engine/margin';

describe('margin engine', () => {
  it('should calculate margin based on target margin percent', () => {
    const input = {
      baseCost: 100000,
      targetMarginPct: 0.20,
      gstOutputRate: 0.12,
      capacityWatts: 5000,
      defaultMarginPct: 0.15
    };
    const result = calculatePricingAndMargins(input);
    expect(result.mrpExclGST).toBe(120000); // 100000 + 20% markup
    expect(result.marginAmount).toBe(20000);
    expect(result.effectiveMarginPct).toBe(0.20);
    expect(result.mrpInclGST).toBe(134400); // 120000 * 1.12
  });

  it('should correctly calculate flat discount', () => {
    const input = {
      mrpInclGST: 140000,
      discountType: 'flat' as const,
      discountVal: 5000
    };
    const result = calculateDiscountAmount(input);
    expect(result).toBe(5000);
  });
});
