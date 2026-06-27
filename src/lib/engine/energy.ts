import { sanitizeNumber } from './calculator';

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

export function calculateEnergyProjections(rawInput: EnergyInput) {
  if (!rawInput.orientationMultipliers) {
    throw new Error('orientationMultipliers required — load from app_settings');
  }
  const multipliers = rawInput.orientationMultipliers;
  
  let orientationMultiplier = 1.0;
  if (rawInput.orientation) {
    const val = multipliers[rawInput.orientation];
    if (val === undefined || val === null || isNaN(val)) {
      throw new Error(`Invalid or missing orientation multiplier for: "${rawInput.orientation}"`);
    }
    orientationMultiplier = sanitizeNumber(val, 1.0);
  }

  const effectivePanelKW = Math.max(0, sanitizeNumber(rawInput.panelCapacityKW, 0));
  const sunHoursPerDay = Math.max(0, sanitizeNumber(rawInput.sunHoursPerDay, 0));
  const performanceRatio = Math.max(0, sanitizeNumber(rawInput.performanceRatio, 0));

  /**
   * FIX CALC-06: Multi-inverter clipping correction.
   */
  const aggregateInverterKW = Math.max(
    0,
    sanitizeNumber(
      rawInput.totalInverterCapacityKW ??
      rawInput.inverterCapacityKW ??
      effectivePanelKW,
      0
    )
  );

  // Accurate Inverter Clipping Model (NREL approximations)
  const dcAcRatio = aggregateInverterKW > 0 ? effectivePanelKW / aggregateInverterKW : 1.0;
  let clippingLoss = 0;
  if (dcAcRatio > 1.1) {
    clippingLoss = Math.pow(dcAcRatio - 1.1, 2);
  }
  clippingLoss = Math.min(clippingLoss, 0.9);
  if (isNaN(clippingLoss) || !isFinite(clippingLoss) || clippingLoss < 0) {
    clippingLoss = 0;
  }
  
  const utilizedPanelKW = effectivePanelKW * (1 - clippingLoss);

  // Year 1 (undegraded) generation values
  const undegradedDailyGenerationKWh = utilizedPanelKW * sunHoursPerDay * performanceRatio * orientationMultiplier;
  const undegradedMonthlyGenerationKWh = undegradedDailyGenerationKWh * DAYS_PER_MONTH;
  const undegradedAnnualGenerationKWh = undegradedDailyGenerationKWh * DAYS_PER_YEAR;

  // Lifetime average degraded generation (25-year timeline)
  const degradationRate = Math.max(0, Math.min(1.0, sanitizeNumber(rawInput.panelDegradationRate, 0.005)));
  const lifetimeYears = 25;
  let totalLifetimeGenerationKWh = 0;
  for (let year = 1; year <= lifetimeYears; year++) {
    totalLifetimeGenerationKWh += undegradedAnnualGenerationKWh * Math.pow(1 - degradationRate, year - 1);
  }
  
  const annualGenerationKWh = totalLifetimeGenerationKWh / lifetimeYears;
  const monthlyGenerationKWh = annualGenerationKWh / 12;
  const dailyGenerationKWh = annualGenerationKWh / DAYS_PER_YEAR;

  return {
    dailyGenerationKWh: sanitizeNumber(dailyGenerationKWh),
    monthlyGenerationKWh: sanitizeNumber(monthlyGenerationKWh),
    annualGenerationKWh: sanitizeNumber(annualGenerationKWh),
    undegradedDailyGenerationKWh: sanitizeNumber(undegradedDailyGenerationKWh),
    undegradedMonthlyGenerationKWh: sanitizeNumber(undegradedMonthlyGenerationKWh),
    undegradedAnnualGenerationKWh: sanitizeNumber(undegradedAnnualGenerationKWh),
  };
}
