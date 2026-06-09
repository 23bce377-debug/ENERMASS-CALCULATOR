export interface ProjectionsInput {
  beneficiaryContribution: number;
  annualGenerationKWh: number;
  annualSavingsINR: number;
  panelDegradationRate?: number;
  electricityInflationRate?: number;
  systemLifetimeYears?: number;
}

export function calculateFinancialProjections(input: ProjectionsInput) {
  const paybackYears = input.annualSavingsINR > 0 
    ? input.beneficiaryContribution / input.annualSavingsINR 
    : Infinity;

  const degradationRate = input.panelDegradationRate ?? 0.005;
  const inflationRate = input.electricityInflationRate ?? 0.04;
  const lifetimeYears = input.systemLifetimeYears ?? 25;

  // 1. LCOE Calculation (configurable years generation)
  let lifetimeGenerationKWh = 0;
  for (let year = 0; year < lifetimeYears; year++) {
    lifetimeGenerationKWh += input.annualGenerationKWh * Math.pow(1 - degradationRate, year);
  }
  const lcoe = lifetimeGenerationKWh > 0 ? input.beneficiaryContribution / lifetimeGenerationKWh : 0;

  // 2. Lifetime savings compounded over configurable years with inflation
  let lifetimeSavingsINR = 0;
  let runningSavings = input.annualSavingsINR;
  for (let year = 1; year <= lifetimeYears; year++) {
    lifetimeSavingsINR += runningSavings;
    runningSavings = runningSavings * (1 - degradationRate) * (1 + inflationRate);
  }

  return {
    paybackYears,
    lcoe,
    lifetimeSavingsINR
  };
}
