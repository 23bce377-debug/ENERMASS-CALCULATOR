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

    // LCOE generation calculation (linear degradation from original nameplate)
    lifetimeGenerationKWh += annualGenerationKWh * Math.max(0, 1 - (year - 1) * degradationRate);

    // Linear degradation + compounding electricity inflation
    const degradationFactor = Math.max(0, 1 - (year * degradationRate));
    const inflationFactor = Math.pow(1 + inflationRate, year);
    runningSavings = annualSavingsINR * degradationFactor * inflationFactor;
  }

  // NPV calculation using the common function
  const npv = calculateNPV(cashFlows, discountRate);

  // IRR Calculation using a combined Newton-Raphson + Bisection solver
  let irr = 0.1;
  let success = false;

  for (let i = 0; i < 100; i++) {
    const npv_rate = calculateNPV(cashFlows, irr);

    // derivative of NPV
    const dnpv = cashFlows.reduce((d, cf, t) => {
      const denom = Math.pow(1 + irr, t + 1);
      if (denom !== 0 && isFinite(denom)) {
        return d - (t * cf) / denom;
      }
      return d;
    }, 0);

    if (Math.abs(dnpv) < 1e-12 || !isFinite(dnpv) || isNaN(dnpv)) {
      break;
    }

    const step = npv_rate / dnpv;
    if (isNaN(step) || !isFinite(step)) {
      break;
    }

    const newRate = irr - step;

    // Prevent Newton-Raphson from jumping into invalid/unstable bounds
    if (newRate < -0.95 || newRate > 10.0) {
      break;
    }

    if (Math.abs(newRate - irr) < 0.00001) {
      irr = newRate;
      success = true;
      break;
    }
    irr = newRate;
  }

  // Bisection Search fallback if Newton-Raphson diverged
  if (!success || isNaN(irr) || !isFinite(irr)) {
    let low = -0.95;
    let high = 10.0;
    irr = 0.1; // reset
    for (let i = 0; i < 100; i++) {
      irr = (low + high) / 2;
      const npv_rate = calculateNPV(cashFlows, irr);
      if (Math.abs(npv_rate) < 0.00001) {
        success = true;
        break;
      }
      if (npv_rate > 0) {
        low = irr;
      } else {
        high = irr;
      }
      if (Math.abs(high - low) < 0.00001) {
        break;
      }
    }
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
