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

export const STATE_DATA: Record<string, StateData> = {
  Gujarat: {
    name: 'Gujarat',
    sunHoursPerDay: 5.5,
    performanceRatio: 0.78,
    labourMultiplier: 1.00,
    gstOnOutput: 0.089,
    subsidyRules: [
      { maxKW: 2, amount: 30000 },
      { maxKW: 3, amount: 48600 },
      { maxKW: 10, amount: 78000 },
      { maxKW: Infinity, amount: 78000 }
    ]
  },
  Rajasthan: {
    name: 'Rajasthan',
    sunHoursPerDay: 6.0,
    performanceRatio: 0.80,
    labourMultiplier: 0.95,
    gstOnOutput: 0.089,
    subsidyRules: [
      { maxKW: 2, amount: 30000 },
      { maxKW: 3, amount: 48600 },
      { maxKW: 10, amount: 78000 },
      { maxKW: Infinity, amount: 78000 }
    ]
  },
  'Madhya Pradesh': {
    name: 'Madhya Pradesh',
    sunHoursPerDay: 5.4,
    performanceRatio: 0.78,
    labourMultiplier: 0.92,
    gstOnOutput: 0.089,
    subsidyRules: [
      { maxKW: 2, amount: 30000 },
      { maxKW: 3, amount: 48600 },
      { maxKW: 10, amount: 78000 },
      { maxKW: Infinity, amount: 78000 }
    ]
  },
  'Uttar Pradesh': {
    name: 'Uttar Pradesh',
    sunHoursPerDay: 5.0,
    performanceRatio: 0.76,
    labourMultiplier: 0.90,
    gstOnOutput: 0.089,
    subsidyRules: [
      { maxKW: 2, amount: 30000 },
      { maxKW: 3, amount: 48600 },
      { maxKW: 10, amount: 78000 },
      { maxKW: Infinity, amount: 78000 }
    ]
  },
  Haryana: {
    name: 'Haryana',
    sunHoursPerDay: 5.0,
    performanceRatio: 0.77,
    labourMultiplier: 1.03,
    gstOnOutput: 0.089,
    subsidyRules: [
      { maxKW: 2, amount: 30000 },
      { maxKW: 3, amount: 48600 },
      { maxKW: 10, amount: 78000 },
      { maxKW: Infinity, amount: 78000 }
    ]
  },
  Punjab: {
    name: 'Punjab',
    sunHoursPerDay: 4.8,
    performanceRatio: 0.76,
    labourMultiplier: 1.05,
    gstOnOutput: 0.089,
    subsidyRules: [
      { maxKW: 2, amount: 30000 },
      { maxKW: 3, amount: 48600 },
      { maxKW: 10, amount: 78000 },
      { maxKW: Infinity, amount: 78000 }
    ]
  },
  Maharashtra: {
    name: 'Maharashtra',
    sunHoursPerDay: 5.0,
    performanceRatio: 0.76,
    labourMultiplier: 1.10,
    gstOnOutput: 0.138,
    subsidyRules: [
      { maxKW: 2, amount: 30000 },
      { maxKW: 3, amount: 48600 },
      { maxKW: 10, amount: 78000 },
      { maxKW: Infinity, amount: 78000 }
    ]
  },
  Karnataka: {
    name: 'Karnataka',
    sunHoursPerDay: 5.1,
    performanceRatio: 0.77,
    labourMultiplier: 1.08,
    gstOnOutput: 0.089,
    subsidyRules: [
      { maxKW: 2, amount: 30000 },
      { maxKW: 3, amount: 48600 },
      { maxKW: 10, amount: 78000 },
      { maxKW: Infinity, amount: 78000 }
    ]
  },
  'Andhra Pradesh': {
    name: 'Andhra Pradesh',
    sunHoursPerDay: 5.2,
    performanceRatio: 0.77,
    labourMultiplier: 1.00,
    gstOnOutput: 0.089,
    subsidyRules: [
      { maxKW: 2, amount: 30000 },
      { maxKW: 3, amount: 48600 },
      { maxKW: 10, amount: 78000 },
      { maxKW: Infinity, amount: 78000 }
    ]
  },
  Telangana: {
    name: 'Telangana',
    sunHoursPerDay: 5.3,
    performanceRatio: 0.78,
    labourMultiplier: 1.02,
    gstOnOutput: 0.089,
    subsidyRules: [
      { maxKW: 2, amount: 30000 },
      { maxKW: 3, amount: 48600 },
      { maxKW: 10, amount: 78000 },
      { maxKW: Infinity, amount: 78000 }
    ]
  },
  'Tamil Nadu': {
    name: 'Tamil Nadu',
    sunHoursPerDay: 5.0,
    performanceRatio: 0.77,
    labourMultiplier: 1.05,
    gstOnOutput: 0.138,
    subsidyRules: [
      { maxKW: 2, amount: 30000 },
      { maxKW: 3, amount: 48600 },
      { maxKW: 10, amount: 78000 },
      { maxKW: Infinity, amount: 78000 }
    ]
  },
  Kerala: {
    name: 'Kerala',
    sunHoursPerDay: 4.5,
    performanceRatio: 0.75,
    labourMultiplier: 1.15,
    gstOnOutput: 0.138,
    subsidyRules: []
  }
};

export interface PanelBrand {
  id: string;
  brand: string;
  model: string;
  wattage: number;
  type: 'Mono PERC' | 'TOPCon';
  ratePerWatt: number;
}

export const PANEL_BRANDS: PanelBrand[] = [
  { id: 'adani_545_mono', brand: 'Adani', model: 'Adani 545W Mono', wattage: 545, type: 'Mono PERC', ratePerWatt: 22.0 },
  { id: 'adani_550_mono', brand: 'Adani', model: 'Adani 550W Mono', wattage: 550, type: 'Mono PERC', ratePerWatt: 22.5 },
  { id: 'adani_580_mono', brand: 'Adani', model: 'Adani 580W Mono', wattage: 580, type: 'Mono PERC', ratePerWatt: 23.5 },
  { id: 'adani_620_mono', brand: 'Adani', model: 'Adani 620W Mono', wattage: 620, type: 'Mono PERC', ratePerWatt: 26.5 },
  { id: 'waaree_540', brand: 'Waaree', model: 'Waaree 540W', wattage: 540, type: 'Mono PERC', ratePerWatt: 21.0 },
  { id: 'waaree_545', brand: 'Waaree', model: 'Waaree 545W', wattage: 545, type: 'Mono PERC', ratePerWatt: 21.5 },
  { id: 'waaree_580', brand: 'Waaree', model: 'Waaree 580W', wattage: 580, type: 'Mono PERC', ratePerWatt: 23.0 },
  { id: 'waaree_620_topcon', brand: 'Waaree', model: 'Waaree 620W TOPCon', wattage: 620, type: 'TOPCon', ratePerWatt: 27.0 },
  { id: 'upl_545', brand: 'UPL', model: 'UPL 545W', wattage: 545, type: 'Mono PERC', ratePerWatt: 20.5 },
  { id: 'gautam_590', brand: 'Gautam Solar', model: 'Gautam 590W', wattage: 590, type: 'Mono PERC', ratePerWatt: 25.5 },
  { id: 'gautam_620', brand: 'Gautam Solar', model: 'Gautam 620W', wattage: 620, type: 'Mono PERC', ratePerWatt: 27.0 },
  { id: 'vikram_545', brand: 'Vikram Solar', model: 'Vikram 545W', wattage: 545, type: 'Mono PERC', ratePerWatt: 22.5 },
  { id: 'tata_545', brand: 'Tata Power', model: 'Tata 545W', wattage: 545, type: 'Mono PERC', ratePerWatt: 23.0 },
];

export interface InverterBrand {
  id: string;
  brand: string;
  model: string;
  capacityKW: number;
  type: 'on-grid' | 'hybrid' | 'micro';
  rate: number;
}

export const INVERTER_BRANDS: InverterBrand[] = [
  { id: 'growatt_1.8', brand: 'Growatt', model: 'Growatt 1.8kW', capacityKW: 1.8, type: 'on-grid', rate: 8500 },
  { id: 'growatt_3', brand: 'Growatt', model: 'Growatt 3kW', capacityKW: 3, type: 'on-grid', rate: 13800 },
  { id: 'growatt_3.6', brand: 'Growatt', model: 'Growatt 3.6kW', capacityKW: 3.6, type: 'on-grid', rate: 14425 },
  { id: 'growatt_5', brand: 'Growatt', model: 'Growatt 5kW', capacityKW: 5, type: 'on-grid', rate: 22500 },
  { id: 'growatt_5_3ph', brand: 'Growatt', model: 'Growatt 5kW 3-phase', capacityKW: 5, type: 'on-grid', rate: 38000 },
  { id: 'growatt_8', brand: 'Growatt', model: 'Growatt 8kW', capacityKW: 8, type: 'on-grid', rate: 46000 },
  { id: 'growatt_10', brand: 'Growatt', model: 'Growatt 10kW', capacityKW: 10, type: 'on-grid', rate: 44000 },
  { id: 'deye_5_hybrid', brand: 'Deye', model: 'Deye 5kW hybrid', capacityKW: 5, type: 'hybrid', rate: 74000 },
  { id: 'deye_8_hybrid', brand: 'Deye', model: 'Deye 8kW hybrid', capacityKW: 8, type: 'hybrid', rate: 75000 },
  { id: 'deye_10_hybrid', brand: 'Deye', model: 'Deye 10kW hybrid', capacityKW: 10, type: 'hybrid', rate: 155000 },
  { id: 'deye_15_hybrid', brand: 'Deye', model: 'Deye 15kW hybrid', capacityKW: 15, type: 'hybrid', rate: 190000 },
  { id: 'deye_25', brand: 'Deye', model: 'Deye 25kW', capacityKW: 25, type: 'on-grid', rate: 72468 },
  { id: 'deye_30', brand: 'Deye', model: 'Deye 30kW', capacityKW: 30, type: 'on-grid', rate: 87000 },
  { id: 'utl_5_hybrid', brand: 'UTL', model: 'UTL 5kW hybrid', capacityKW: 5, type: 'hybrid', rate: 75000 },
  { id: 'utl_8', brand: 'UTL', model: 'UTL 8kW', capacityKW: 8, type: 'on-grid', rate: 44152 },
  { id: 'solaredge_5', brand: 'SolarEdge', model: 'SolarEdge 5kW', capacityKW: 5, type: 'on-grid', rate: 42000 },
  { id: 'hoymiles_hm600', brand: 'Hoymiles', model: 'Hoymiles HM-600 micro', capacityKW: 0.6, type: 'micro', rate: 8500 },
  { id: 'solis_5', brand: 'Solis', model: 'Solis 5kW', capacityKW: 5, type: 'on-grid', rate: 20000 },
  { id: 'solis_10', brand: 'Solis', model: 'Solis 10kW', capacityKW: 10, type: 'on-grid', rate: 44000 },
];

export interface BatteryBrand {
  id: string;
  brand: string;
  model: string;
  capacityKWh: number;
  chemistry: 'LFP' | 'Li-Ion';
  rate: number;
  maxDischargeKW: number;
}

export const BATTERY_BRANDS: BatteryBrand[] = [
  { id: 'deye_5kwh_lfp', brand: 'Deye', model: 'Deye 5kWh LFP', capacityKWh: 5, chemistry: 'LFP', rate: 68000, maxDischargeKW: 2.5 },
  { id: 'deye_10kwh_lfp', brand: 'Deye', model: 'Deye 10kWh LFP', capacityKWh: 10, chemistry: 'LFP', rate: 148000, maxDischargeKW: 5.0 },
  { id: 'utl_5kwh_lfp', brand: 'UTL', model: 'UTL 5kWh LFP', capacityKWh: 5, chemistry: 'LFP', rate: 74000, maxDischargeKW: 2.5 },
  { id: 'utl_10kwh_lfp', brand: 'UTL', model: 'UTL 10kWh LFP', capacityKWh: 10, chemistry: 'LFP', rate: 150000, maxDischargeKW: 5.0 },
  { id: 'luminous_5kwh_liion', brand: 'Luminous', model: 'Luminous 5kWh Li-Ion', capacityKWh: 5, chemistry: 'Li-Ion', rate: 75000, maxDischargeKW: 2.5 },
  { id: 'amaze_5kwh_liion', brand: 'Amaze', model: 'Amaze 5kWh Li-Ion', capacityKWh: 5, chemistry: 'Li-Ion', rate: 72000, maxDischargeKW: 2.5 },
];

export interface PricingRef {
  capacityKW: number;
  panels: number;
  inverterKW: number | null;
  premiumPrice: number;
  standardPrice: number;
  subsidy: number | null;
}

export const PRICING_REFERENCE: PricingRef[] = [
  { capacityKW: 1.5, panels: 3, inverterKW: 2, premiumPrice: 82000, standardPrice: 75000, subsidy: 48600 },
  { capacityKW: 2, panels: 4, inverterKW: 2.2, premiumPrice: 92500, standardPrice: 87500, subsidy: 62880 },
  { capacityKW: 3, panels: 6, inverterKW: 3.4, premiumPrice: 125000, standardPrice: 115000, subsidy: 78000 },
  { capacityKW: 4, panels: 8, inverterKW: 4.4, premiumPrice: 185000, standardPrice: 175000, subsidy: null },
  { capacityKW: 5, panels: 9, inverterKW: 5, premiumPrice: 220000, standardPrice: 200000, subsidy: null },
  { capacityKW: 5, panels: 10, inverterKW: null, premiumPrice: 235000, standardPrice: 220000, subsidy: null },
  { capacityKW: 6, panels: 11, inverterKW: 6, premiumPrice: 290000, standardPrice: 270000, subsidy: null },
  { capacityKW: 8, panels: 15, inverterKW: 8, premiumPrice: 358000, standardPrice: 325000, subsidy: null },
  { capacityKW: 10, panels: 19, inverterKW: 10, premiumPrice: 430000, standardPrice: 415000, subsidy: null },
];

export const GRID_TARIFF_PER_KWH = 8.0;
export const MAX_VARIANTS = 50;
