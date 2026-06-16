export interface ROIInputs {
  systemKw: number;
  systemCost: number;           // post-subsidy net cost
  electricityRatePerUnit: number; // ₹/kWh current
  electricityEscalation: number;  // % per year (default 5%)
  discountRate: number;           // % for NPV calc (default 8% = long-term FD rate)
  location: string;
  systemLifeYears: number;        // default 25
  maintenanceCostPerYear: number; // default ₹1,500/kW/year
}

export interface ROIYearData {
  year: number;
  annualGeneration: number;
  electricityRate: string;
  grossSavings: number;
  maintenanceCost: number;
  netSavings: number;
  cumulativeSavings: number;
}

export interface ROIResult {
  yearlyData: ROIYearData[];
  paybackYear?: number;
  npv: number;
  irr: number;
  lcoe: number;
  totalGeneration: number;
}

// Monthly sun-hour correction factors by location (MNRE solar radiation data)
export const MONTHLY_CORRECTION: Record<string, number[]> = {
  // Northern States (Higher summer/spring peaks, lower winter dips, moderate monsoon dips)
  "jammu and kashmir": [0.85, 0.90, 1.05, 1.15, 1.20, 1.15, 1.00, 0.95, 1.05, 1.10, 0.95, 0.85],
  "himachal pradesh":  [0.85, 0.90, 1.05, 1.15, 1.20, 1.15, 1.00, 0.95, 1.05, 1.10, 0.95, 0.85],
  "punjab":            [0.85, 0.95, 1.10, 1.15, 1.20, 1.10, 0.95, 0.90, 1.05, 1.10, 0.95, 0.85],
  "haryana":           [0.85, 0.95, 1.10, 1.15, 1.20, 1.10, 0.95, 0.90, 1.05, 1.10, 0.95, 0.85],
  "uttarakhand":       [0.85, 0.95, 1.10, 1.15, 1.20, 1.10, 0.95, 0.90, 1.05, 1.10, 0.95, 0.85],
  "delhi":             [0.85, 0.95, 1.10, 1.15, 1.20, 1.10, 0.95, 0.90, 1.05, 1.10, 0.95, 0.85],
  "uttar pradesh":     [0.90, 0.98, 1.10, 1.15, 1.18, 1.05, 0.85, 0.85, 0.95, 1.05, 0.95, 0.88],
  "chandigarh":        [0.85, 0.95, 1.10, 1.15, 1.20, 1.10, 0.95, 0.90, 1.05, 1.10, 0.95, 0.85],

  // Western & Central States (High overall irradiance, mild monsoon dips)
  "rajasthan":         [1.08, 1.10, 1.08, 1.05, 1.03, 0.85, 0.82, 0.84, 0.92, 1.05, 1.07, 1.08],
  "gujarat":           [1.05, 1.08, 1.06, 1.02, 0.97, 0.72, 0.68, 0.70, 0.88, 1.02, 1.04, 1.05],
  "maharashtra":       [1.04, 1.06, 1.05, 1.01, 0.95, 0.65, 0.62, 0.65, 0.85, 1.00, 1.03, 1.04],
  "madhya pradesh":    [1.02, 1.05, 1.10, 1.12, 1.10, 0.85, 0.75, 0.75, 0.95, 1.05, 1.02, 1.00],
  "chhattisgarh":      [1.00, 1.03, 1.08, 1.10, 1.05, 0.80, 0.70, 0.70, 0.85, 1.00, 1.00, 1.00],
  "goa":               [1.04, 1.06, 1.05, 1.01, 0.95, 0.55, 0.50, 0.55, 0.85, 1.00, 1.03, 1.04],
  "dadra and nagar haveli and daman and diu": [1.04, 1.06, 1.05, 1.01, 0.95, 0.60, 0.55, 0.60, 0.85, 1.00, 1.03, 1.04],

  // Eastern & North-Eastern States (Lower overall irradiance, prolonged heavy monsoon dips)
  "bihar":             [0.90, 0.98, 1.08, 1.10, 1.05, 0.80, 0.75, 0.75, 0.85, 0.95, 0.95, 0.90],
  "jharkhand":         [0.92, 1.00, 1.08, 1.10, 1.05, 0.80, 0.70, 0.75, 0.85, 0.95, 0.95, 0.92],
  "west bengal":       [0.95, 1.02, 1.05, 1.05, 1.00, 0.75, 0.65, 0.70, 0.80, 0.90, 0.95, 0.95],
  "odisha":            [0.98, 1.02, 1.05, 1.05, 1.00, 0.75, 0.65, 0.70, 0.80, 0.90, 0.95, 0.98],
  "assam":             [0.90, 0.95, 1.00, 0.95, 0.90, 0.70, 0.65, 0.70, 0.80, 0.90, 0.95, 0.90],
  "sikkim":            [0.85, 0.90, 0.95, 0.95, 0.90, 0.65, 0.60, 0.65, 0.75, 0.85, 0.90, 0.85],
  "meghalaya":         [0.85, 0.90, 0.95, 0.95, 0.90, 0.60, 0.55, 0.60, 0.75, 0.85, 0.90, 0.85],
  "arunachal pradesh": [0.85, 0.90, 0.95, 0.95, 0.90, 0.65, 0.60, 0.65, 0.75, 0.85, 0.90, 0.85],
  "nagaland":          [0.88, 0.92, 0.98, 0.95, 0.90, 0.65, 0.60, 0.65, 0.75, 0.85, 0.90, 0.88],
  "manipur":           [0.88, 0.92, 0.98, 0.95, 0.90, 0.65, 0.60, 0.65, 0.75, 0.85, 0.90, 0.88],
  "mizoram":           [0.88, 0.92, 0.98, 0.95, 0.90, 0.65, 0.60, 0.65, 0.75, 0.85, 0.90, 0.88],
  "tripura":           [0.90, 0.95, 1.00, 0.95, 0.90, 0.65, 0.60, 0.65, 0.75, 0.85, 0.92, 0.90],

  // Southern States (Consistent year-round with sharp monsoon dips in Jun-Aug, plus NE monsoon in Nov for TN)
  "karnataka":         [1.00, 1.02, 1.05, 1.02, 0.95, 0.70, 0.65, 0.70, 0.85, 0.95, 0.98, 1.00],
  "kerala":            [1.02, 1.05, 1.05, 1.00, 0.90, 0.55, 0.50, 0.55, 0.80, 0.90, 0.95, 1.00],
  "tamil nadu":        [0.98, 1.02, 1.05, 1.05, 1.00, 0.85, 0.80, 0.85, 0.95, 0.85, 0.80, 0.95],
  "andhra pradesh":    [1.00, 1.05, 1.08, 1.08, 1.05, 0.85, 0.80, 0.85, 0.95, 0.95, 0.95, 0.98],
  "telangana":         [1.02, 1.05, 1.08, 1.10, 1.08, 0.85, 0.75, 0.80, 0.95, 1.00, 1.00, 1.02],
  "puducherry":        [0.98, 1.02, 1.05, 1.05, 1.00, 0.85, 0.80, 0.85, 0.95, 0.85, 0.80, 0.95],
  "andaman and nicobar islands": [0.95, 1.00, 1.05, 1.05, 0.90, 0.65, 0.65, 0.65, 0.75, 0.85, 0.85, 0.90],
  "lakshadweep":       [1.02, 1.05, 1.05, 1.00, 0.90, 0.60, 0.55, 0.60, 0.80, 0.90, 0.95, 1.00],

  default:             [1.02, 1.04, 1.02, 0.98, 0.94, 0.76, 0.73, 0.75, 0.88, 0.99, 1.01, 1.02],
};

export const BASE_SUN_HOURS = 5.0; // conservative base (not 5.5)
export const DEGRADATION_RATE = 0.005; // 0.5% per year

export function calculateROI(inputs: ROIInputs): ROIResult {
  const yearlyData: ROIYearData[] = [];
  let cumulativeSavings = 0;
  const cashFlows = [-inputs.systemCost];  // Year 0: investment

  for (let year = 1; year <= inputs.systemLifeYears; year++) {
    const degradationFactor = Math.pow(1 - DEGRADATION_RATE, year - 1);
    const electricityRate = inputs.electricityRatePerUnit *
      Math.pow(1 + inputs.electricityEscalation / 100, year - 1);

    // Monthly generation with sun-hour correction
    const corrections = MONTHLY_CORRECTION[inputs.location] || MONTHLY_CORRECTION['default'];
    let annualGeneration = 0;
    for (let month = 0; month < 12; month++) {
      const monthlyDays = 365.2425 / 12;
      const monthlyGen = inputs.systemKw * BASE_SUN_HOURS *
        corrections[month] * monthlyDays * degradationFactor;
      annualGeneration += monthlyGen;
    }

    const grossSavings = annualGeneration * electricityRate;
    const inflationRate = inputs.electricityEscalation / 100;
    const maintenanceCost = inputs.maintenanceCostPerYear * inputs.systemKw * Math.pow(1 + inflationRate, year - 1);
    const netSavings = grossSavings - maintenanceCost;

    cashFlows.push(netSavings);
    cumulativeSavings += netSavings;

    yearlyData.push({
      year, 
      annualGeneration: Math.round(annualGeneration),
      electricityRate: electricityRate.toFixed(2),
      grossSavings: Math.round(grossSavings),
      maintenanceCost: Math.round(maintenanceCost),
      netSavings: Math.round(netSavings),
      cumulativeSavings: Math.round(cumulativeSavings),
    });
  }

  const paybackYear = yearlyData.find(y => y.cumulativeSavings >= inputs.systemCost)?.year;
  const npv = calculateNPV(cashFlows, inputs.discountRate / 100);
  const irr = calculateIRR(cashFlows);
  const totalGeneration = yearlyData.reduce((sum, y) => sum + y.annualGeneration, 0);
  const lcoe = inputs.systemCost / totalGeneration; // ₹/kWh

  return { yearlyData, paybackYear, npv, irr, lcoe, totalGeneration };
}

function calculateNPV(cashFlows: number[], rate: number): number {
  return cashFlows.reduce((npv, cf, t) => npv + cf / Math.pow(1 + rate, t), 0);
}

function calculateIRR(cashFlows: number[]): number {
  // Newton-Raphson method
  let rate = 0.1;
  for (let i = 0; i < 100; i++) {
    const npv = calculateNPV(cashFlows, rate);
    const dnpv = cashFlows.reduce((d, cf, t) =>
      d - (t * cf) / Math.pow(1 + rate, t + 1), 0);
    
    // Check if derivative is too close to 0
    if (Math.abs(dnpv) < 0.0001) break;
    
    let step = npv / dnpv;
    step = Math.max(-0.1, Math.min(step, 0.1));
    const newRate = rate - step;
    if (Math.abs(newRate - rate) < 0.0001) return Math.max(0, Math.min(newRate, 0.5)) * 100;
    rate = newRate;
  }
  return Math.max(0, Math.min(rate, 0.5)) * 100;
}
