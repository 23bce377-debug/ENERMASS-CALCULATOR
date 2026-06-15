export const TAX_CONSTANTS = {
  COMPOSITE_GST_MATERIAL_RATIO: 0.70,
  COMPOSITE_GST_SERVICE_RATIO: 0.30,
  // Standard works contract rate post-Oct 2021
  COMPOSITE_GST_RATE: 0.18,
  COMMERCIAL_GST_RATE: 0.18,          // 18% — supply of goods (commercial ITC-eligible)
  RESIDENTIAL_GST_RATE: 0.05,         // 5% — supply of solar panels to residential
  INSTALLATION_SERVICE_GST: 0.18,     // 18% — installation service component
  ITC_ELIGIBLE_RATE: 0.18,            // 18% for commercial customers (claimable)
  INVERTER_GST_RATE: 0.12,            // 12% for inverters and batteries
  BOS_GST_RATE: 0.18,                 // 18% for Balance of System (accessories, structure)
  EFFECTIVE_DATE: "2021-10-01",
  LAST_VERIFIED: "2026-06-13",
} as const;
