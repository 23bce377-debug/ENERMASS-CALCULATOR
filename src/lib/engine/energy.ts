export interface EnergyInput {
  panelCapacityKW: number;
  inverterCapacityKW?: number;
  /** FIX CALC-06: For multi-inverter systems, pass total summed inverter capacity */
  totalInverterCapacityKW?: number;
  sunHoursPerDay: number;
  performanceRatio: number;
  orientation?: 'South' | 'East/West' | 'Flat';
  orientationMultipliers?: Record<string, number>;
}

const DAYS_PER_MONTH = 30.4375;
const DAYS_PER_YEAR = 365.2425;

export function calculateEnergyProjections(input: EnergyInput) {
  if (!input.orientationMultipliers) {
    throw new Error('orientationMultipliers required — load from app_settings');
  }
  const multipliers = input.orientationMultipliers;
  const orientationMultiplier = input.orientation
    ? (multipliers[input.orientation] ?? 1.0)
    : 1.0;

  const effectivePanelKW = input.panelCapacityKW;

  /**
   * FIX CALC-06: Multi-inverter clipping correction.
   *
   * The old code used `inverterCapacityKW ?? effectivePanelKW`, which assumed a
   * single inverter. For multi-inverter systems (e.g., two 5kW inverters for a
   * 10kW array), the caller MUST sum inverter capacities before passing to this
   * function.
   *
   * Priority:
   *   1. totalInverterCapacityKW (pre-summed by dbCalculator for multi-inverter mix)
   *   2. inverterCapacityKW      (single inverter or already-aggregated value)
   *   3. effectivePanelKW        (fallback: assume inverter matches panel)
   */
  const aggregateInverterKW =
    input.totalInverterCapacityKW ??
    input.inverterCapacityKW ??
    effectivePanelKW;

  // Inverter clipping caps hourly generation at inverter capacity
  const maxHourlyGeneration = Math.min(effectivePanelKW, aggregateInverterKW);

  const dailyGenerationKWh = maxHourlyGeneration * input.sunHoursPerDay * input.performanceRatio * orientationMultiplier;
  const monthlyGenerationKWh = dailyGenerationKWh * DAYS_PER_MONTH;
  const annualGenerationKWh = dailyGenerationKWh * DAYS_PER_YEAR;

  return {
    dailyGenerationKWh,
    monthlyGenerationKWh,
    annualGenerationKWh
  };
}
