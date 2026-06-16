import { calculateSystem } from './src/lib/engine/calculator';
import { SYSTEMS } from './src/lib/data/bom';

const sys = SYSTEMS[0];
const result = calculateSystem({
  systemId: sys.id,
  systems: [sys],
  state: 'MH',
  projectType: 'residential',
  panelCapacityKW: 12,
  selectedScheme: 'pm_suryaghar',
  orientation: 'South',
  dcCableLengthM: 10,
  acCableLengthM: 10,
  electricityInflationRate: 0.05,
  inverterCapacityKW: 10,
  panelDegradationRate: 0.005,
  structurePricingMode: 'weight',
  solarMeterQty: 1,
  netMeterQty: 1,
  lightningArresterQty: 1,
});

console.log('Subsidy Amount:', result.subsidyAmount);
console.log('Subsidy Result:', result.subsidyResult);
