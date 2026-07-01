/**
 * masterCacheTypes.ts — Concrete typed interfaces for the master data payload.
 *
 * All `any[]` arrays from the original draft have been replaced with typed
 * interfaces that exactly match the columns selected in masterCache.ts.
 *
 * Rules:
 * - These are READ-ONLY views of DB rows (select subsets, not full Row types).
 * - `MasterData` is the runtime payload — all fields required.
 * - `MasterDataPayload` extends MasterData with cache metadata.
 * - Fields added by migrations (org_id, rate_per_watt, rate) are reflected here.
 */

// ─── Equipment ────────────────────────────────────────────────────────────────

export interface CachedPanel {
  id: string;
  brand: string;
  model: string;
  wattage_w: number;
  /** GENERATED ALWAYS AS (selling_price / NULLIF(wattage_w, 0)) STORED */
  rate_per_watt: number;
  gst_pct: number;
  is_active: boolean;
}

export interface CachedInverter {
  id: string;
  brand: string;
  model: string;
  capacity_kw: number;
  /** DB column is `phases` (plural) */
  phases: number;
  /** GENERATED ALWAYS AS (selling_price) STORED */
  rate: number;
  gst_pct: number;
  is_active: boolean;
}

export interface CachedBattery {
  id: string;
  brand: string;
  model: string;
  capacity_kwh: number;
  voltage_v: number;
  /** GENERATED ALWAYS AS (selling_price) STORED */
  rate: number;
  gst_pct: number;
  is_active: boolean;
}

export interface CachedMeter {
  id: string;
  brand: string;
  model: string;
  /** DB column: selling_price */
  selling_price: number;
  gst_pct: number;
  meter_type: string;
  description: string;
}

export interface CachedLightningArrester {
  id: string;
  brand: string | null;
  model: string;
  /** DB column: selling_price */
  selling_price: number;
  gst_pct: number;
  description: string;
  max_capacity_kw: number | null;
}

// ─── State / Subsidy ──────────────────────────────────────────────────────────

export interface CachedStateRule {
  id: string;
  state_code: string;
  state_name: string;
  /** Distribution utility name shown on the quotation (e.g. 'KSEB') */
  discom_name: string | null;
  is_active: boolean;
}

/** State-scoped preset availability. No rows for a system = global (all states). */
export interface CachedSystemStateAvailability {
  system_id: string;
  state_id: string;
}

/** State-specific Terms & Conditions master template. state_id NULL = global default. */
export interface CachedStateTermsTemplate {
  id: string;
  state_id: string | null;
  clauses: string[];
  is_active: boolean;
  version: number;
}

export interface CachedSlab {
  id: string;
  scheme_id: string;
  slab_index: number;
  start_kw: number;
  end_kw: number | null;
  rate_per_kw: number;
  is_fixed_amount: boolean;
  fixed_amount: number | null;
}

export interface CachedScheme {
  id: string;
  name: string;
  max_capacity_kw: number;
  max_absolute_subsidy: number;
  applies_to: string;
}

export interface CachedSchemeOverride {
  id: string;
  scheme_id: string;
  state_id: string;
  max_absolute_override: number | null;
  additional_state_subsidy: number | null;
}

// ─── BOM ──────────────────────────────────────────────────────────────────────

export interface CachedBomCategory {
  id: string;
  /** null = global category visible to all orgs */
  org_id: string | null;
  name: string;
  display_order: number;
  is_optional: boolean;
}

export interface CachedBomTemplateItem {
  id: string;
  /** null = global template item visible to all orgs */
  org_id: string | null;
  category_id: string;
  sku_code: string;
  description: string;
  unit: string;
  unit_rate_min: number | null;
  unit_rate_max: number | null;
  default_rate: number | null;
  qty_formula: string | null;
  is_survey_dependent: boolean;
  civil_required_only: boolean;
  notes: string | null;
}

// ─── Structure ────────────────────────────────────────────────────────────────

export interface CachedStructure {
  id: string;
  name: string;
  material: string;
  roof_mount_type: string;
  /** DB column: selling_price (replaces removed flat_rate) */
  selling_price: number | null;
  per_watt_rate: number | null;
  gst_pct: number;
  raw_material_rate: number | null;
  fabrication_rate: number | null;
  galvanizing_rate: number | null;
  base_weight_kg: number;
  wastage_pct: number;
  fastener_weight_pct: number;
  rate_per_kg: number | null;
}

export interface CachedWeightLookup {
  id: string;
  structure_id: string;
  capacity_kw_min: number;
  capacity_kw_max: number;
  total_weight_kg: number;
}

export interface CachedOrientationMultiplier {
  orientation: string;
  multiplier: number;
}

export interface CachedStructureVendor {
  id: string;
  name: string;
}

export interface CachedStructureMaterialRate {
  id: string;
  vendor_id: string;
  material_type: string;
  rate_per_kg: number;
}

export interface CachedStructureTemplate {
  id: string;
  structure_type: string;
  capacity_kw: number;
}

export interface CachedStructureTemplateItem {
  id: string;
  template_id: string;
  vendor_id: string | null;
  item: string;
  qty: number;
  weight: number | null;
}

export interface CachedWalkwayTemplate {
  id: string;
  template: string;
  cost_per_meter: number;
}

export interface CachedLadderTemplate {
  id: string;
  template: string;
  cost_per_meter: number;
}

export interface CachedStructureAccessoryRate {
  id: string;
  item_name: string;
  unit: string;
  rate: number;
}

// ─── Org Overrides ────────────────────────────────────────────────────────────

/**
 * A single entry from the rate_master table.
 * The rate_master is the org-level BOM item rate override table.
 * Key is item_name; value is the override rate.
 */
export interface CachedRateMasterEntry {
  item_name: string;
  override_rate: number;
  is_active: boolean;
}

export interface CachedCategoryMargin {
  category: string;
  default_margin_pct: number;
}

export interface CachedAppSettings {
  default_grid_tariff_inr: number;
  default_validity_days: number;
  electricity_inflation_pct: number;
  orientation_factor: number;
}

// ─── Payload ──────────────────────────────────────────────────────────────────

/**
 * The full typed master data payload.
 *
 * All fields are required (not optional) — callers must always receive
 * a complete dataset. Empty arrays are returned when a table has no rows.
 */
export interface MasterData {
  // Equipment
  panels: CachedPanel[];
  inverters: CachedInverter[];
  batteries: CachedBattery[];
  meters: CachedMeter[];
  lightningArresters: CachedLightningArrester[];

  // State / Subsidy
  stateRules: CachedStateRule[];
  slabs: CachedSlab[];
  schemes: CachedScheme[];
  schemeOverrides: CachedSchemeOverride[];
  systemStateAvailability: CachedSystemStateAvailability[];
  stateTermsTemplates: CachedStateTermsTemplate[];

  // BOM
  bomCategories: CachedBomCategory[];
  bomTemplateItems: CachedBomTemplateItem[];

  // Structure
  structures: CachedStructure[];
  weightLookups: CachedWeightLookup[];
  orientationMultipliers: CachedOrientationMultiplier[];
  structureVendors: CachedStructureVendor[];
  structureMaterialRates: CachedStructureMaterialRate[];
  structureTemplates: CachedStructureTemplate[];
  structureTemplateItems: CachedStructureTemplateItem[];
  walkwayTemplates: CachedWalkwayTemplate[];
  ladderTemplates: CachedLadderTemplate[];
  structureAccessoryRates: CachedStructureAccessoryRate[];

  // Org Overrides (org-specific — populated when orgId is provided to cache loader)
  rateMaster: CachedRateMasterEntry[];
  categoryMargins: CachedCategoryMargin[];
  appSettings: CachedAppSettings | null;
}

export interface MasterDataPayload extends MasterData {
  /** Semantic version of the cache schema — bump when MasterData shape changes */
  version: string;
  /** ISO 8601 timestamp of when this payload was generated */
  generatedAt: string;
  /** MD5 content hash of the payload — used as HTTP ETag */
  etag: string;
  /** The orgId this payload was resolved for — null = global data only */
  orgId: string | null;
}
