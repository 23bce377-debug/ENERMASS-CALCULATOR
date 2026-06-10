export interface EnergyInput {
  panelCapacityKW: number;
  inverterCapacityKW?: number;
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
  const orientationMultiplier = input.orientation ? (multipliers[input.orientation] ?? 1.0) : 1.0;

  const effectivePanelKW = input.panelCapacityKW;
  const effectiveInverterKW = input.inverterCapacityKW ?? effectivePanelKW;
  
  // Inverter clipping caps generation
  // Note: For multi-inverter systems, per-inverter clipping would be more accurate.
  // Current implementation assumes single inverter or aggregated capacity.
  const maxHourlyGeneration = Math.min(effectivePanelKW, effectiveInverterKW);

  const dailyGenerationKWh = maxHourlyGeneration * input.sunHoursPerDay * input.performanceRatio * orientationMultiplier;
  const monthlyGenerationKWh = dailyGenerationKWh * DAYS_PER_MONTH;
  const annualGenerationKWh = dailyGenerationKWh * DAYS_PER_YEAR;

  return {
    dailyGenerationKWh,
    monthlyGenerationKWh,
    annualGenerationKWh
  };
}
