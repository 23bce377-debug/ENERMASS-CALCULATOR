export interface EnergyInput {
  panelCapacityKW: number;
  inverterCapacityKW?: number;
  /** FIX CALC-06: For multi-inverter systems, pass total summed inverter capacity */
  totalInverterCapacityKW?: number;
  sunHoursPerDay: number;
  performanceRatio: number;
  orientation?: 'South' | 'East/West' | 'Flat';
  orientationMultipliers?: Record<string, number>;
  panelDegradationRate?: number;
}

const DAYS_PER_MONTH = 30.4375;
const DAYS_PER_YEAR = 365.2425;

export function calculateEnergyProjections(input: EnergyInput) {
  if (!input.orientationMultipliers) {
    throw new Error('orientationMultipliers required — load from app_settings');
  }
  const multipliers = input.orientationMultipliers;
  
  let orientationMultiplier = 1.0;
  if (input.orientation) {
    const val = multipliers[input.orientation];
    if (val === undefined || val === null || isNaN(val)) {
      throw new Error(`Invalid or missing orientation multiplier for: "${input.orientation}"`);
    }
    orientationMultiplier = val;
  }

  const effectivePanelKW = input.panelCapacityKW;

  /**
   * FIX CALC-06: Multi-inverter clipping correction.
   */
  const aggregateInverterKW =
    input.totalInverterCapacityKW ??
    input.inverterCapacityKW ??
    effectivePanelKW;

  // Accurate Inverter Clipping Model (NREL approximations)
  const dcAcRatio = effectivePanelKW / aggregateInverterKW;
  let clippingLoss = 0;
  if (dcAcRatio > 1.1) {
    clippingLoss = Math.pow(dcAcRatio - 1.1, 2);
  }
  clippingLoss = Math.min(clippingLoss, 0.9);
  
  const utilizedPanelKW = effectivePanelKW * (1 - clippingLoss);

  // Year 1 (undegraded) generation values
  const undegradedDailyGenerationKWh = utilizedPanelKW * input.sunHoursPerDay * input.performanceRatio * orientationMultiplier;
  const undegradedMonthlyGenerationKWh = undegradedDailyGenerationKWh * DAYS_PER_MONTH;
  const undegradedAnnualGenerationKWh = undegradedDailyGenerationKWh * DAYS_PER_YEAR;

  // Lifetime average degraded generation (25-year timeline)
  const degradationRate = input.panelDegradationRate ?? 0.005;
  const lifetimeYears = 25;
  let totalLifetimeGenerationKWh = 0;
  for (let year = 1; year <= lifetimeYears; year++) {
    totalLifetimeGenerationKWh += undegradedAnnualGenerationKWh * Math.pow(1 - degradationRate, year - 1);
  }
  
  const annualGenerationKWh = totalLifetimeGenerationKWh / lifetimeYears;
  const monthlyGenerationKWh = annualGenerationKWh / 12;
  const dailyGenerationKWh = annualGenerationKWh / DAYS_PER_YEAR;

  return {
    dailyGenerationKWh,
    monthlyGenerationKWh,
    annualGenerationKWh,
    undegradedDailyGenerationKWh,
    undegradedMonthlyGenerationKWh,
    undegradedAnnualGenerationKWh,
  };
}
