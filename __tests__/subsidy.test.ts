import { describe, it, expect } from 'vitest';
import { calculatePMSuryaGharSubsidy } from '../src/lib/subsidy';
import { getSubsidyAmount, roundToINR } from '../src/lib/engine/calculator';
import { TAX_CONSTANTS } from '../src/lib/tax-constants';
import { calculateFinancialProjections } from '../src/lib/engine/financials';

describe('PM Surya Ghar Subsidy Calculation', () => {
  it('calculates subsidy for 1kW residential system (₹30,000)', () => {
    const result = calculatePMSuryaGharSubsidy(1, 'residential');
    expect(result.amount).toBe(30000);
    expect(result.isEligible).toBe(true);
  });

  it('calculates subsidy for 2kW residential system (₹60,000)', () => {
    const result = calculatePMSuryaGharSubsidy(2, 'residential');
    expect(result.amount).toBe(60000);
    expect(result.isEligible).toBe(true);
  });

  it('calculates subsidy for 3kW residential system (₹78,000)', () => {
    const result = calculatePMSuryaGharSubsidy(3, 'residential');
    expect(result.amount).toBe(78000);
    expect(result.isEligible).toBe(true);
  });

  it('calculates subsidy for 4kW residential system (capped at ₹78,000)', () => {
    const result = calculatePMSuryaGharSubsidy(4, 'residential');
    expect(result.amount).toBe(78000);
    expect(result.isEligible).toBe(true);
  });

  it('calculates subsidy for 10kW residential system (capped at ₹78,000)', () => {
    const result = calculatePMSuryaGharSubsidy(10, 'residential');
    expect(result.amount).toBe(78000);
    expect(result.isEligible).toBe(true);
  });

  it('calculates subsidy for 11kW residential system (capped at ₹78,000)', () => {
    const result = calculatePMSuryaGharSubsidy(11, 'residential');
    expect(result.amount).toBe(78000);
    expect(result.isEligible).toBe(true);
  });

  it('rejects subsidy for commercial systems regardless of size', () => {
    const result = calculatePMSuryaGharSubsidy(4, 'commercial');
    expect(result.amount).toBe(0);
    expect(result.isEligible).toBe(false);
  });
});

describe('Verification Test Cases', () => {
  it('Composite GST Rate is 18%', () => {
    expect(TAX_CONSTANTS.COMPOSITE_GST_RATE).toBeCloseTo(0.18, 4);
  });

  it('Subsidy 3kW boundary', () => {
    const slabs = [
      { start_kw: 0, end_kw: 2, rate_per_kw: 30000, is_fixed_amount: false, fixed_amount: null },
      { start_kw: 2, end_kw: 3, rate_per_kw: 18000, is_fixed_amount: false, fixed_amount: null },
      { start_kw: 3, end_kw: null, rate_per_kw: 0, is_fixed_amount: false, fixed_amount: null }
    ];
    const amount = getSubsidyAmount(3, 3, 'state', 'residential', {}, slabs, 10, 78000, 0);
    expect(amount).toBe(78000);
  });

  it('LCOE uses beneficiary contribution', () => {
    const result = calculateFinancialProjections({
      beneficiaryContribution: 100000,
      totalSystemCost: 200000,
      annualGenerationKWh: 1000,
      annualSavingsINR: 10000,
      panelDegradationRate: 0,
      systemLifetimeYears: 25
    });
    // With 0% degradation, lifetime generation is 25000
    // LCOE must measure actual capital cost of energy production (beneficiaryContribution)
    expect(result.lcoe).toBe(100000 / 25000);
  });

  it('IRR clamped and bracketed', () => {
    const result = calculateFinancialProjections({
      beneficiaryContribution: 100000,
      totalSystemCost: 200000,
      annualGenerationKWh: 1000,
      annualSavingsINR: 10000,
      panelDegradationRate: 0,
      systemLifetimeYears: 25
    });
    expect(result.irr).toBeGreaterThanOrEqual(0);
    expect(result.irr).toBeLessThanOrEqual(0.5);
  });

  it('Rounding: sum of 2dp lines = 2dp aggregate', () => {
    const lines = [{lineTotal: 100.004}, {lineTotal: 100.004}, {lineTotal: 100.004}];
    const sum2dp = lines.reduce((s, l) => s + roundToINR(l.lineTotal), 0);
    expect(sum2dp).toBe(300.00);
  });
});
