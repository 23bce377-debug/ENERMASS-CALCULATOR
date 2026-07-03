export const TAX_CONSTANTS = {
  COMPOSITE_GST_MATERIAL_RATIO: 0.70,
  COMPOSITE_GST_SERVICE_RATIO: 0.30,
  // Standard works contract rate post-Oct 2021
  COMPOSITE_GST_RATE: 0.18,
  COMMERCIAL_GST_RATE: 0.18,          // 18% — standard taxable goods / commercial ITC-eligible output
  SOLAR_DEVICE_GST_RATE: 0.12,        // 12% — renewable energy devices and parts under Ch. 84/85/94
  PANEL_GST_RATE: 0.12,               // 12% — solar panels / PV modules
  RESIDENTIAL_GST_RATE: 0.12,         // Back-compat alias for solar panel goods GST
  INSTALLATION_SERVICE_GST: 0.18,     // 18% — installation service component
  ITC_ELIGIBLE_RATE: 0.18,            // 18% for commercial customers (claimable)
  INVERTER_GST_RATE: 0.18,            // 18% — inverters / static converters under HSN 8504
  LITHIUM_BATTERY_GST_RATE: 0.18,     // 18% — lithium-ion batteries under HSN 8507 60 00
  NON_LITHIUM_BATTERY_GST_RATE: 0.28, // 28% — other electric accumulators under HSN 8507
  BATTERY_GST_RATE: 0.18,             // Default for new solar storage batteries (usually lithium/LFP)
  RESIDENTIAL_COMPOSITE_GST_RATE: 0.138, // 13.8% composite works contract GST
  BOS_GST_RATE: 0.18,                 // 18% for Balance of System (accessories, structure)
  EFFECTIVE_DATE: "2021-10-01",
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
  return isLithiumBattery(item)
    ? TAX_CONSTANTS.LITHIUM_BATTERY_GST_RATE
    : TAX_CONSTANTS.NON_LITHIUM_BATTERY_GST_RATE;
}
