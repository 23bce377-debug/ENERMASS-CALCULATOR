import { sanitizeNumber } from './calculator';

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
    const denom = Math.pow(1 + rate, t);
    if (denom !== 0 && isFinite(denom)) {
      npv += cashFlows[t] / denom;
    }
  }
  return npv;
}

export function calculateFinancialProjections(rawInput: ProjectionsInput) {
  const beneficiaryContribution = Math.max(0, sanitizeNumber(rawInput.beneficiaryContribution, 0));
  const totalSystemCost = Math.max(0, sanitizeNumber(rawInput.totalSystemCost, 0));
  const annualGenerationKWh = Math.max(0, sanitizeNumber(rawInput.annualGenerationKWh, 0));
  const annualSavingsINR = Math.max(0, sanitizeNumber(rawInput.annualSavingsINR, 0));

  const degradationRate = Math.max(0, Math.min(1.0, sanitizeNumber(rawInput.panelDegradationRate, 0.005)));
  const inflationRate = Math.max(-0.99, Math.min(10.0, sanitizeNumber(rawInput.electricityInflationRate, 0.04)));
  const lifetimeYears = Math.max(1, Math.min(100, rawInput.systemLifetimeYears ?? 25));
  const discountRate = Math.max(-0.99, Math.min(10.0, sanitizeNumber(rawInput.discountRate, 0.08)));

  let paybackYears = Infinity;
  let cumulativeSavings = 0;
  let runningSavings = annualSavingsINR;
  
  let npv = -beneficiaryContribution;
  let lifetimeSavingsINR = 0;
  let lifetimeGenerationKWh = 0;

  const cashFlows: number[] = [-beneficiaryContribution];

  for (let year = 1; year <= lifetimeYears; year++) {
    // For payback (undiscounted)
    if (paybackYears === Infinity) {
      if (cumulativeSavings + runningSavings >= beneficiaryContribution) {
        const remaining = beneficiaryContribution - cumulativeSavings;
        if (runningSavings > 0) {
          paybackYears = (year - 1) + (remaining / runningSavings);
        }
      }
    }
    
    cumulativeSavings += runningSavings;
    lifetimeSavingsINR += runningSavings;
    cashFlows.push(runningSavings);

    // NPV calculation
    const denom = Math.pow(1 + discountRate, year);
    if (denom !== 0 && isFinite(denom)) {
      npv += runningSavings / denom;
    }

    // LCOE generation calculation
    lifetimeGenerationKWh += annualGenerationKWh * Math.pow(1 - degradationRate, year - 1);

    runningSavings = runningSavings * (1 - degradationRate) * (1 + inflationRate);
  }

  // IRR Calculation using Newton-Raphson method
  let irr = 0.1;
  for (let i = 0; i < 100; i++) {
    const npv_rate = calculateNPV(cashFlows, irr);
    
    const dnpv = cashFlows.reduce((d, cf, t) => {
      const denom = Math.pow(1 + irr, t + 1);
      if (denom !== 0 && isFinite(denom)) {
        return d - (t * cf) / denom;
      }
      return d;
    }, 0);

    if (Math.abs(dnpv) < 0.000001 || !isFinite(dnpv)) {
      break;
    }
    
    let step = npv_rate / dnpv;
    if (isNaN(step) || !isFinite(step)) {
      break;
    }
    step = Math.max(-0.1, Math.min(step, 0.1)); // Prevent huge jumps
    const newRate = irr - step;
    if (Math.abs(newRate - irr) < 0.0001) {
      irr = newRate;
      break;
    }
    irr = newRate;
  }
  
  // Clamp between 0% and 100%
  irr = Math.max(0, Math.min(irr, 1.0));

  const lcoe = lifetimeGenerationKWh > 0 ? beneficiaryContribution / lifetimeGenerationKWh : 0;

  return {
    paybackYears: isNaN(paybackYears) ? 0 : paybackYears,
    lcoe: sanitizeNumber(lcoe),
    lifetimeSavingsINR: sanitizeNumber(lifetimeSavingsINR),
    npv: sanitizeNumber(npv),
    irr: sanitizeNumber(irr)
  };
}
