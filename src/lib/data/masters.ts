export interface SubsidyRule {
  maxKW: number;
  amount: number;
}

export interface StateData {
  name: string;
  sunHoursPerDay: number;
  performanceRatio: number;
  labourMultiplier: number;
  gstOnOutput: number;
  subsidyRules: SubsidyRule[];
}

/**
 * STATE_DATA is intentionally empty — all state rules are loaded from the
 * database via GET /api/masters and stored in the Zustand dbStateData map.
 * Do NOT add hardcoded state data here.
 */
export const STATE_DATA: Record<string, StateData> = {};


export interface PanelBrand {
  id: string;
  brand: string;
  model: string;
  wattage: number;
  type: 'Mono PERC' | 'TOPCon';
  ratePerWatt: number;
}

/**
 * PANEL_BRANDS, INVERTER_BRANDS, BATTERY_BRANDS are intentionally empty.
 * All equipment data comes from the database via GET /api/masters.
 * Do NOT add hardcoded equipment or rate data here.
 */
export const PANEL_BRANDS: PanelBrand[] = [];

export interface InverterBrand {
  id: string;
  brand: string;
  model: string;
  capacityKW: number;
  type: 'on-grid' | 'hybrid' | 'micro';
  rate: number;
}

export interface BatteryBrand {
  id: string;
  brand: string;
  model: string;
  capacityKWh: number;
  chemistry: 'LFP' | 'Li-Ion';
  rate: number;
  maxDischargeKW: number;
}

export const INVERTER_BRANDS: InverterBrand[] = [];
export const BATTERY_BRANDS: BatteryBrand[] = [];



export interface EquipmentRateOverrides {
  panels: Record<string, number>;
  inverters: Record<string, number>;
  batteries: Record<string, number>;
}

export interface EquipmentCatalogSource {
  customPanels?: PanelBrand[];
  customInverters?: InverterBrand[];
  customBatteries?: BatteryBrand[];
  currentEquipmentRates?: EquipmentRateOverrides;
}

export const EMPTY_EQUIPMENT_RATE_OVERRIDES: EquipmentRateOverrides = {
  panels: {},
  inverters: {},
  batteries: {},
};

export function getActivePanelBrands(source?: EquipmentCatalogSource): PanelBrand[] {
  const rateOverrides = source?.currentEquipmentRates?.panels ?? {};
  return [...PANEL_BRANDS, ...(source?.customPanels ?? [])].map((panel) => ({
    ...panel,
    ratePerWatt: rateOverrides[panel.id] ?? panel.ratePerWatt,
  }));
}

export function getActiveInverterBrands(source?: EquipmentCatalogSource): InverterBrand[] {
  const rateOverrides = source?.currentEquipmentRates?.inverters ?? {};
  return [...INVERTER_BRANDS, ...(source?.customInverters ?? [])].map((inverter) => ({
    ...inverter,
    rate: rateOverrides[inverter.id] ?? inverter.rate,
  }));
}

export function getActiveBatteryBrands(source?: EquipmentCatalogSource): BatteryBrand[] {
  const rateOverrides = source?.currentEquipmentRates?.batteries ?? {};
  return [...BATTERY_BRANDS, ...(source?.customBatteries ?? [])].map((battery) => ({
    ...battery,
    rate: rateOverrides[battery.id] ?? battery.rate,
  }));
}

export interface PricingRef {
  capacityKW: number;
  panels: number;
  inverterKW: number | null;
  premiumPrice: number;
  standardPrice: number;
  subsidy: number | null;
}

export const PRICING_REFERENCE: PricingRef[] = [];
// Pricing reference data lives in the database — do not add hardcoded values here.

export const MAX_VARIANTS = 50;
