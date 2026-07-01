import { describe, expect, it } from 'vitest';
import { buildQuotedLines, roundToNearestThousand, type LineResult } from '../calculator';
import { calculatePricingAndMargins } from '../margin';

function line(index: number, description: string, total: number, qty = 1): LineResult {
  return {
    index,
    description,
    effectiveQty: qty,
    effectiveRate: total / qty,
    effectiveGstPct: 0.18,
    lineTotal: total,
    lineGST: total * 0.18,
    lineSubTotal: total * 1.18,
    isOverridden: false,
  };
}

describe('pricing and margin math', () => {
  it('applies percent margin as a linear markup on procurement cost', () => {
    const result = calculatePricingAndMargins({
      baseCost: 100000,
      marginMode: 'percent',
      targetMarginPct: 0.2,
      gstOutputRate: 0.18,
      capacityWatts: 5000,
      defaultMarginPct: 0.1,
    });

    expect(result.mrpExclGST).toBe(120000);
    expect(result.marginAmount).toBe(20000);
    expect(result.effectiveMarginPct).toBe(0.2);
  });

  it('does not explode high percent margins through sell-price denominator math', () => {
    const result = calculatePricingAndMargins({
      baseCost: 135514,
      marginMode: 'percent',
      targetMarginPct: 0.9,
      gstOutputRate: 0.138,
      capacityWatts: 1080,
      defaultMarginPct: 0.1,
    });

    expect(result.mrpExclGST).toBeCloseTo(257476.6, 2);
    expect(result.marginAmount).toBeCloseTo(121962.6, 2);
    expect(result.mrpInclGST).toBeCloseTo(293008.37, 2);
    expect(result.effectiveMarginPct).toBe(0.9);
  });

  it('accepts legacy whole-number margin percentages as percent units', () => {
    const result = calculatePricingAndMargins({
      baseCost: 100000,
      marginMode: 'percent',
      targetMarginPct: 20,
      gstOutputRate: 0.18,
      capacityWatts: 5000,
      defaultMarginPct: 10,
    });

    expect(result.mrpExclGST).toBe(120000);
    expect(result.marginAmount).toBe(20000);
    expect(result.effectiveMarginPct).toBe(0.2);
  });

  it('adds flat margin as an exact pre-tax rupee amount', () => {
    const result = calculatePricingAndMargins({
      baseCost: 100000,
      marginMode: 'flat',
      targetMarginAmount: 20000,
      gstOutputRate: 0.18,
      capacityWatts: 5000,
      defaultMarginPct: 0.1,
    });

    expect(result.mrpExclGST).toBe(120000);
    expect(result.marginAmount).toBe(20000);
    expect(result.effectiveMarginPct).toBeCloseTo(20000 / 120000, 6);
  });

  it('handles zero base cost without invalid numbers', () => {
    const result = calculatePricingAndMargins({
      baseCost: 0,
      marginMode: 'flat',
      targetMarginAmount: 20000,
      gstOutputRate: 0.18,
      capacityWatts: 5000,
      defaultMarginPct: 0.1,
    });

    expect(result.mrpExclGST).toBe(20000);
    expect(result.marginAmount).toBe(20000);
    expect(Number.isFinite(result.effectiveMarginPct)).toBe(true);
  });

  it('rounds to nearest thousand with 500 as the upward threshold', () => {
    expect(roundToNearestThousand(10499)).toBe(10000);
    expect(roundToNearestThousand(10500)).toBe(11000);
  });

  it('allocates quoted line totals exactly and assigns round-off to panel total', () => {
    const quoted = buildQuotedLines([
      line(0, 'PANEL', 60000, 10),
      line(1, 'INVERTER', 40000, 1),
    ], 120000, 500);

    const total = quoted.reduce((sum, item) => sum + item.lineTotal, 0);
    const panel = quoted.find((item) => item.description === 'PANEL');

    expect(total).toBe(120500);
    expect(panel?.lineTotal).toBe(72500);
    expect(panel?.effectiveRate).toBe(7250);
  });
});
