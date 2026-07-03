export const TAX_CONSTANTS = {
  COMPOSITE_GST_MATERIAL_RATIO: 0.70,
  COMPOSITE_GST_SERVICE_RATIO: 0.30,
  COMPOSITE_GST_MATERIAL_RATE: 0.05,
  COMPOSITE_GST_SERVICE_RATE: 0.18,
  // Solar project works contract: 70% goods at 5% + 30% services at 18%.
  PROJECT_COMPOSITE_GST_RATE: 0.089,
  COMPOSITE_GST_RATE: 0.089,
  COMMERCIAL_GST_RATE: 0.18,          // 18% — standard taxable goods / commercial ITC-eligible output
  SOLAR_DEVICE_GST_RATE: 0.05,        // 5% — solar panels / inverters used in solar projects
  PANEL_GST_RATE: 0.05,               // 5% — solar panels / PV modules
  RESIDENTIAL_GST_RATE: 0.05,         // Back-compat alias for solar panel goods GST
  INSTALLATION_SERVICE_GST: 0.18,     // 18% — installation service component
  ITC_ELIGIBLE_RATE: 0.18,            // 18% for commercial customers (claimable)
  INVERTER_GST_RATE: 0.05,            // 5% — solar inverters
  LITHIUM_BATTERY_GST_RATE: 0.18,     // 18% — lithium-ion batteries under HSN 8507 60 00
  NON_LITHIUM_BATTERY_GST_RATE: 0.18, // 18% — battery fallback across chemistries
  BATTERY_GST_RATE: 0.18,             // 18% — solar storage batteries
  RESIDENTIAL_COMPOSITE_GST_RATE: 0.089, // 8.9% composite project GST
  BOS_GST_RATE: 0.18,                 // 18% for Balance of System (accessories, structure)
  EFFECTIVE_DATE: "2026-07-03",
  LAST_VERIFIED: "2026-07-03",
} as const;

type BatteryLike = {
  chemistry?: unknown;
  brand?: unknown;
  model?: unknown;
  description?: unknown;
  specification_details?: unknown;
} | null | undefined;

export function isLithiumBattery(item: BatteryLike): boolean {
  const text = [
    item?.chemistry,
    item?.brand,
    item?.model,
    item?.description,
    item?.specification_details,
  ].map((value) => String(value ?? '').toLowerCase()).join(' ');

  return /\b(li[\s-]?ion|lithium|lfp|life\s?po4|lifepo4|nmc)\b/.test(text);
}

export function getBatteryGstRate(item?: BatteryLike): number {
  return TAX_CONSTANTS.BATTERY_GST_RATE;
}

export type GstComponentKind = 'panel' | 'inverter' | 'battery' | 'other';

export function getComponentGstRate(kind: GstComponentKind): number {
  switch (kind) {
    case 'panel':
      return TAX_CONSTANTS.PANEL_GST_RATE;
    case 'inverter':
      return TAX_CONSTANTS.INVERTER_GST_RATE;
    case 'battery':
      return TAX_CONSTANTS.BATTERY_GST_RATE;
    case 'other':
    default:
      return TAX_CONSTANTS.BOS_GST_RATE;
  }
}

export function getProjectCompositeGstRate(): number {
  return TAX_CONSTANTS.PROJECT_COMPOSITE_GST_RATE;
}

export function calculateProjectGstBreakdown(exclusiveAmount: number) {
  const basePaise = Math.max(0, Math.round(Number(exclusiveAmount || 0) * 100));
  const materialTaxablePaise = Math.round(basePaise * TAX_CONSTANTS.COMPOSITE_GST_MATERIAL_RATIO);
  const serviceTaxablePaise = basePaise - materialTaxablePaise;
  const materialGstPaise = Math.round(materialTaxablePaise * TAX_CONSTANTS.COMPOSITE_GST_MATERIAL_RATE);
  const serviceGstPaise = Math.round(serviceTaxablePaise * TAX_CONSTANTS.COMPOSITE_GST_SERVICE_RATE);

  return {
    materialTaxable: materialTaxablePaise / 100,
    serviceTaxable: serviceTaxablePaise / 100,
    materialGst: materialGstPaise / 100,
    serviceGst: serviceGstPaise / 100,
    totalGst: (materialGstPaise + serviceGstPaise) / 100,
    effectiveRate: TAX_CONSTANTS.PROJECT_COMPOSITE_GST_RATE,
  };
}
