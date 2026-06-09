export interface EnergyInput {
  panelCapacityKW: number;
  inverterCapacityKW?: number;
  sunHoursPerDay: number;
  performanceRatio: number;
  orientation?: 'South' | 'East/West' | 'Flat';
  orientationMultipliers?: Record<string, number>;
}

export function calculateEnergyProjections(input: EnergyInput) {
  const multipliers = input.orientationMultipliers ?? { South: 1.0, 'East/West': 0.85, Flat: 0.90 };
  const orientationMultiplier = input.orientation ? (multipliers[input.orientation] ?? 1.0) : 1.0;

  const effectivePanelKW = input.panelCapacityKW;
  const effectiveInverterKW = input.inverterCapacityKW ?? effectivePanelKW;
  
  // Inverter clipping caps generation
  const maxHourlyGeneration = Math.min(effectivePanelKW, effectiveInverterKW);

  const dailyGenerationKWh = maxHourlyGeneration * input.sunHoursPerDay * input.performanceRatio * orientationMultiplier;
  const monthlyGenerationKWh = dailyGenerationKWh * 30;
  const annualGenerationKWh = dailyGenerationKWh * 365;

  return {
    dailyGenerationKWh,
    monthlyGenerationKWh,
    annualGenerationKWh
  };
}
