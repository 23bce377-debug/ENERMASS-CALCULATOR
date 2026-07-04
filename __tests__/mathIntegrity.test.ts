import { describe, expect, it } from 'vitest';
import { calculateSystem, type CalcResult, type LineResult } from '../src/lib/engine/calculator';
import type { SolarSystem } from '../src/lib/data/bom';
import { INITIAL_STATE, runCalculation } from '../src/lib/store/calculatorTypes';
import {
  assertCalcResultIntegrity,
  computeLineMath,
  normalizeQuoteItemMath,
  validateCalcResultMath,
} from '../src/lib/math/integrity';

const stateData = {
  Kerala: {
    name: 'Kerala',
    sunHoursPerDay: 5,
    performanceRatio: 0.8,
    labourMultiplier: 1,
    gstOnOutput: 0.089,
    gridTariffInr: 8,
    subsidyRules: [],
  },
};

function makeSystem(items: SolarSystem['items']): SolarSystem {
  return {
    id: 'sys-math',
    name: 'Math Integrity System',
    category: 'on-grid',
    capacityKW: 5,
    panelWattage: 500,
    panelQty: 10,
    targetMarginPct: 0.2,
    items,
  };
}

function baseLine(overrides: Partial<LineResult> = {}): LineResult {
  return {
    index: 0,
    description: 'PANEL',
    effectiveQty: 2,
    effectiveRate: 1000,
    effectiveGstPct: 0.05,
    lineTotal: 2000,
    lineGST: 100,
    lineSubTotal: 2100,
    isOverridden: false,
    isDisabled: false,
    ...overrides,
  };
}

function baseResult(overrides: Partial<CalcResult> = {}): CalcResult {
  return {
    capacityKW: 1,
    lines: [baseLine()],
    quotedLines: [baseLine()],
    costBeforeGST: 2000,
    totalInputGST: 100,
    totalIncGST: 2100,
    effectiveMarginPct: 0.2,
    mrpExclGST: 2400,
    marginAmount: 400,
    gstOutputRate: 0.089,
    mrpInclGST: 2613.6,
    perKWexclGST: 2400,
    perKWinclGST: 2613.6,
    discountAmount: 32,
    unroundedFinalCustomerPrice: 2850,
    roundOffToThousand: false,
    roundOffAdjustment: 0,
    finalCustomerPrice: 2850,
    subsidyResult: { amount: 300, breakdown: 'test', isEligible: true, schemeNote: '' },
    subsidyAmount: 300,
    beneficiaryContribution: 2550,
    additionalCostTotal: 50,
    civilLogisticsCost: 0,
    dailyGenerationKWh: 4,
    monthlyGenerationKWh: 120,
    annualGenerationKWh: 1460,
    monthlySavingsINR: 960,
    annualSavingsINR: 11680,
    paybackYears: 5,
    lcoe: 2,
    lifetimeSavingsINR: 100000,
    npv: 50000,
    irr: 0.1,
    ...overrides,
  };
}

describe('math integrity checks', () => {
  it('respects editable master GST values and state output GST', () => {
    const system = makeSystem([
      { description: 'PANEL', qty: 10, ratePerUnit: 1000, gstPct: 7, unit: 'Nos' },
      { description: 'INVERTER', qty: 1, ratePerUnit: 20000, gstPct: 9, unit: 'Nos' },
      { description: 'BATTERY', qty: 1, ratePerUnit: 30000, gstPct: 18, unit: 'Nos' },
      { description: 'STRUCTURE', qty: 1, ratePerUnit: 10000, gstPct: 15, unit: 'Set' },
    ]);

    const result = calculateSystem({
      systemId: system.id,
      systems: [system],
      state: 'Kerala',
      stateData,
      projectType: 'commercial',
      dbOrientationMultipliers: { South: 1, 'East/West': 0.9, Flat: 0.85 },
      gstOnOutput: 12,
      applySubsidy: false,
    });

    expect(result.gstOutputRate).toBe(0.12);
    expect(result.lines.find((line) => line.description === 'PANEL')?.effectiveGstPct).toBe(0.07);
    expect(result.lines.find((line) => line.description === 'INVERTER')?.effectiveGstPct).toBe(0.09);
    expect(result.lines.find((line) => line.description === 'BATTERY')?.effectiveGstPct).toBe(0.18);
    expect(result.lines.find((line) => line.description === 'STRUCTURE')?.effectiveGstPct).toBe(0.15);
    expect(() => assertCalcResultIntegrity(result, { projectType: 'commercial' })).not.toThrow();
  });

  it('falls back to current GST policy when master GST is missing', () => {
    const system = makeSystem([
      { description: 'PANEL', qty: 10, ratePerUnit: 1000, unit: 'Nos' },
      { description: 'INVERTER', qty: 1, ratePerUnit: 20000, unit: 'Nos' },
      { description: 'BATTERY', qty: 1, ratePerUnit: 30000, unit: 'Nos' },
      { description: 'STRUCTURE', qty: 1, ratePerUnit: 10000, unit: 'Set' },
    ]);

    const result = calculateSystem({
      systemId: system.id,
      systems: [system],
      state: 'Kerala',
      stateData,
      projectType: 'commercial',
      dbOrientationMultipliers: { South: 1, 'East/West': 0.9, Flat: 0.85 },
      applySubsidy: false,
    });

    expect(result.gstOutputRate).toBe(0.089);
    expect(result.lines.find((line) => line.description === 'PANEL')?.effectiveGstPct).toBe(0.05);
    expect(result.lines.find((line) => line.description === 'INVERTER')?.effectiveGstPct).toBe(0.05);
    expect(result.lines.find((line) => line.description === 'BATTERY')?.effectiveGstPct).toBe(0.18);
    expect(result.lines.find((line) => line.description === 'STRUCTURE')?.effectiveGstPct).toBe(0.18);
    expect(() => assertCalcResultIntegrity(result, { projectType: 'commercial' })).not.toThrow();
  });

  it('calculates mixed panel quantity, weighted price, GST, and capacity from the selected panel mix', () => {
    const system = makeSystem([
      { description: 'PANEL', qty: 2, ratePerUnit: 1, gstPct: 0.05, unit: 'Nos' },
    ]);

    const dbPanels = [
      { id: 'p540', brand: 'Waaree', model: '540W', wattage: 540, ratePerWatt: 21, gst_pct: 0.05 },
      { id: 'p620', brand: 'Gautam', model: '620W', wattage: 620, ratePerWatt: 27, gst_pct: 0.05 },
      { id: 'p585', brand: 'Adani', model: '585W', wattage: 585, ratePerWatt: 15.5, gst_pct: 0.05 },
    ];
    const panelMix = { p540: 2, p620: 1, p585: 1 };
    const expectedPanelTotal = (2 * 540 * 21) + (1 * 620 * 27) + (1 * 585 * 15.5);
    const expectedPanelQty = 4;
    const expectedCapacityKW = ((2 * 540) + 620 + 585) / 1000;

    const result = calculateSystem({
      systemId: system.id,
      systems: [system],
      state: 'Kerala',
      stateData,
      projectType: 'commercial',
      dbPanels,
      panelMix,
      selectedPanelId: 'p540',
      panelRateOverride: expectedPanelTotal / expectedPanelQty,
      panelQtyOverride: expectedPanelQty,
      panelCapacityKW: expectedCapacityKW,
      dbOrientationMultipliers: { South: 1, 'East/West': 0.9, Flat: 0.85 },
      applySubsidy: false,
    });

    const panelLine = result.lines.find((line) => line.description === 'PANEL');
    expect(panelLine).toBeTruthy();
    expect(panelLine?.effectiveQty).toBe(expectedPanelQty);
    expect(panelLine?.effectiveRate).toBeCloseTo(expectedPanelTotal / expectedPanelQty, 5);
    expect(panelLine?.lineTotal).toBeCloseTo(expectedPanelTotal, 2);
    expect(panelLine?.lineGST).toBe(Math.round(expectedPanelTotal * 0.05 * 100) / 100);
    expect(result.capacityKW).toBeCloseTo(expectedCapacityKW, 5);
    expect(result.lines.filter((line) => line.description.toUpperCase().startsWith('PANEL'))).toHaveLength(1);
    expect(() => assertCalcResultIntegrity(result, { projectType: 'commercial' })).not.toThrow();
  });

  it('passes mixed panel selections from calculator state into the engine', () => {
    const system = makeSystem([
      { description: 'PANEL', qty: 2, ratePerUnit: 1, gstPct: 0.05, unit: 'Nos' },
    ]);
    const dbPanels = [
      { id: 'p540', brand: 'Waaree', model: '540W', wattage: 540, ratePerWatt: 21, gst_pct: 0.05 },
      { id: 'p620', brand: 'Gautam', model: '620W', wattage: 620, ratePerWatt: 27, gst_pct: 0.05 },
    ];

    const { result, error } = runCalculation({
      ...INITIAL_STATE,
      dbLoaded: true,
      selectedSystemId: system.id,
      dbSystems: [system],
      selectedState: 'Kerala',
      dbStateData: stateData,
      projectType: 'commercial',
      dbPanels,
      panelMix: { p540: 2, p620: 1 },
      selectedPanelId: 'p540',
      applySubsidy: false,
    } as any);

    expect(error).toBeNull();
    const panelLine = result?.lines.find((line) => line.description === 'PANEL');
    expect(panelLine?.effectiveQty).toBe(3);
    expect(panelLine?.lineTotal).toBeCloseTo((2 * 540 * 21) + (620 * 27), 2);
    expect(result?.capacityKW).toBeCloseTo(((2 * 540) + 620) / 1000, 5);
  });

  it('allows explicit output GST override for future tax changes', () => {
    const system = makeSystem([
      { description: 'PANEL', qty: 2, ratePerUnit: 1000, gstPct: 0.05, unit: 'Nos' },
    ]);

    const result = calculateSystem({
      systemId: system.id,
      systems: [system],
      state: 'Kerala',
      stateData,
      projectType: 'commercial',
      dbOrientationMultipliers: { South: 1, 'East/West': 0.9, Flat: 0.85 },
      gstOnOutput: 0.089,
      gstOnOutputOverride: 0.12,
      allowGstOverride: true,
      applySubsidy: false,
    });

    expect(result.gstOutputRate).toBe(0.12);
    expect(() => assertCalcResultIntegrity(result, { projectType: 'commercial' })).not.toThrow();
  });

  it('keeps discounts, additional costs, subsidy, and commercial ITC balanced', () => {
    const system = makeSystem([
      { description: 'PANEL', qty: 2, ratePerUnit: 1000, gstPct: 0.12, unit: 'Nos' },
    ]);

    const result = calculateSystem({
      systemId: system.id,
      systems: [system],
      state: 'Kerala',
      stateData,
      projectType: 'commercial',
      dbOrientationMultipliers: { South: 1, 'East/West': 0.9, Flat: 0.85 },
      gstOnOutput: 0.18,
      discountType: 'flat',
      discountVal: 999999,
      additionalCosts: [{ id: 'shipping', description: 'Shipping', amount: 500 }],
      applySubsidy: true,
      rpcSubsidyAmount: 100000,
    });

    expect(result.discountAmount).toBe(result.mrpInclGST);
    expect(result.unroundedFinalCustomerPrice).toBe(500);
    expect(result.finalCustomerPrice).toBe(500);
    expect(result.subsidyAmount).toBe(500);
    expect(result.beneficiaryContribution).toBe(0);
    expect(() => assertCalcResultIntegrity(result, { projectType: 'commercial', itcEligible: false })).not.toThrow();
  });

  it('detects corrupt line totals and aggregate drift', () => {
    const corrupt = baseResult({
      lines: [baseLine({ lineGST: 999 })],
      totalInputGST: 999,
      totalIncGST: 2999,
    });

    const report = validateCalcResultMath(corrupt, { projectType: 'residential' });
    expect(report.ok).toBe(false);
    expect(report.issues.some((issue) => issue.path.includes('lineGST'))).toBe(true);
  });

  it('normalizes quote item rows before revision-style persistence', () => {
    const normalized = normalizeQuoteItemMath({
      qty: '3',
      rate_per_unit: '1000',
      gst_pct: '18',
      is_included: true,
    });

    expect(normalized.gst_pct).toBe(0.18);
    expect(normalized.line_total).toBe(3000);
    expect(normalized.line_gst).toBe(540);
    expect(normalized.line_subtotal).toBe(3540);
  });

  it('zeros excluded quote item math consistently', () => {
    const line = computeLineMath({
      qty: 10,
      rate: 1000,
      gstPct: 18,
      isIncluded: false,
    });

    expect(line.gstPct).toBe(0.18);
    expect(line.lineTotal).toBe(0);
    expect(line.lineGST).toBe(0);
    expect(line.lineSubTotal).toBe(0);
  });

  it('rejects impossible GST fractions after normalization', () => {
    const report = validateCalcResultMath(baseResult({
      lines: [baseLine({
        effectiveGstPct: 1.8,
        lineGST: 3600,
        lineSubTotal: 5600,
      })],
      totalInputGST: 3600,
      totalIncGST: 5600,
    }));

    expect(report.ok).toBe(false);
    expect(report.issues.some((issue) => issue.path.includes('effectiveGstPct'))).toBe(true);
  });
});
