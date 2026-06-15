export interface ProjectionsInput {
  beneficiaryContribution: number;
  totalSystemCost: number;
  annualGenerationKWh: number;
  annualSavingsINR: number;
  panelDegradationRate?: number;
  electricityInflationRate?: number;
  systemLifetimeYears?: number;
  discountRate?: number;
}

function calculateNPV(cashFlows: number[], rate: number): number {
  let npv = 0;
  for (let t = 0; t < cashFlows.length; t++) {
    npv += cashFlows[t] / Math.pow(1 + rate, t);
  }
  return npv;
}

export function calculateFinancialProjections(input: ProjectionsInput) {
  const degradationRate = input.panelDegradationRate ?? 0.005;
  const inflationRate = input.electricityInflationRate ?? 0.04;
  const lifetimeYears = input.systemLifetimeYears ?? 25;
  const discountRate = input.discountRate ?? 0.08; // 8% WACC

  let paybackYears = Infinity;
  let cumulativeSavings = 0;
  let runningSavings = input.annualSavingsINR;
  
  let npv = -input.beneficiaryContribution;
  let lifetimeSavingsINR = 0;
  let lifetimeGenerationKWh = 0;

  const cashFlows: number[] = [-input.beneficiaryContribution];

  for (let year = 1; year <= lifetimeYears; year++) {
    // For payback (undiscounted)
    if (paybackYears === Infinity) {
      if (cumulativeSavings + runningSavings >= input.beneficiaryContribution) {
        const remaining = input.beneficiaryContribution - cumulativeSavings;
        paybackYears = (year - 1) + (remaining / runningSavings);
      }
    }
    
    cumulativeSavings += runningSavings;
    lifetimeSavingsINR += runningSavings;
    cashFlows.push(runningSavings);

    // NPV calculation
    npv += runningSavings / Math.pow(1 + discountRate, year);

    // LCOE generation calculation
    lifetimeGenerationKWh += input.annualGenerationKWh * Math.pow(1 - degradationRate, year - 1);

    runningSavings = runningSavings * (1 - degradationRate) * (1 + inflationRate);
  }

  // IRR Calculation using secant method
  let irr = 0;
  let rate0 = 0.05, rate1 = 0.15;
  let f0 = calculateNPV(cashFlows, rate0);
  let f1 = calculateNPV(cashFlows, rate1);
  
  // Validate initial bracket
  if (f0 * f1 > 0) {
    console.warn('IRR initial guesses do not bracket root');
  } else {
    for(let i=0; i<20; i++) {
      if (Math.abs(rate1 - rate0) < 1e-6) break;
      const rate2 = rate1 - f1 * (rate1 - rate0) / (f1 - f0);
      rate0 = rate1;
      f0 = f1;
      rate1 = rate2;
      f1 = calculateNPV(cashFlows, rate1);
    }
  }
  // Clamp
  irr = Math.max(0, Math.min(rate1, 0.5));

  const lcoe = lifetimeGenerationKWh > 0 ? input.totalSystemCost / lifetimeGenerationKWh : 0;

  return {
    paybackYears,
    lcoe,
    lifetimeSavingsINR,
    npv,
    irr
  };
}
