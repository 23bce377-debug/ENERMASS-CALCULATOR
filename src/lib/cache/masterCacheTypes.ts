export interface MasterData {
  panels: any[];
  inverters: any[];
  batteries: any[];
  stateRules: any[];
  slabs: any[];
  schemes: any[];
  schemeOverrides: any[];
  bomCategories: any[];
  bomTemplateItems: any[];
  meters: any[];
  lightningArresters: any[];
  structures: any[];
  weightLookups: any[];
  orientationMultipliers: any[];
  structureVendors: any[];
  structureMaterialRates: any[];
  structureTemplates: any[];
  structureTemplateItems: any[];
  walkwayTemplates: any[];
  ladderTemplates: any[];
  structureAccessoryRates: any[];
}

export interface CachedPanel { id: string; brand: string; model: string; wattage_w: number; rate_per_watt: number; gst_pct: number; is_active: boolean; }
export interface CachedInverter { id: string; brand: string; model: string; capacity_kw: number; phase: number; rate: number; gst_pct: number; is_active: boolean; }
export interface CachedBattery { id: string; brand: string; model: string; capacity_kwh: number; voltage_v: number; rate: number; gst_pct: number; is_active: boolean; }
export interface CachedStateRule { id: string; state_code: string; state_name: string; is_active: boolean; }
export interface CachedSlab { id: string; scheme_id: string; slab_index: number; start_kw: number; end_kw: number | null; rate_per_kw: number; is_fixed_amount: boolean; fixed_amount: number | null; }

export interface CachedMeter { id: string; brand: string; model: string; rate: number; gst_pct: number; meter_type: string; description: string; }
export interface CachedLightningArrester { id: string; brand: string | null; model: string; rate: number; gst_pct: number; description: string; max_capacity_kw: number | null; }
export interface CachedStructure { id: string; name: string; material: string; roof_mount_type: string; flat_rate: number | null; per_watt_rate: number | null; gst_pct: number; raw_material_rate: number | null; fabrication_rate: number | null; galvanizing_rate: number | null; base_weight_kg: number; wastage_pct: number; fastener_weight_pct: number; rate_per_kg: number | null; }
export interface CachedWeightLookup { id: string; structure_id: string; capacity_kw_min: number; capacity_kw_max: number; total_weight_kg: number; }
export interface CachedOrientationMultiplier { orientation: string; multiplier: number; }
export interface CachedBomCategory { id: string; name: string; display_order: number; is_optional: boolean; }
export interface CachedBomTemplateItem { id: string; category_id: string; sku_code: string; description: string; unit: string; unit_rate_min: number | null; unit_rate_max: number | null; default_rate: number | null; qty_formula: string | null; is_survey_dependent: boolean; civil_required_only: boolean; notes: string | null; }
export interface CachedStructureVendor { id: string; name: string; }
export interface CachedStructureMaterialRate { id: string; vendor_id: string; material_type: string; rate_per_kg: number; }
export interface CachedStructureTemplate { id: string; structure_type: string; capacity_kw: number; }
export interface CachedStructureTemplateItem { id: string; template_id: string; vendor_id: string | null; item: string; qty: number; weight: number | null; }
export interface CachedWalkwayTemplate { id: string; template: string; cost_per_meter: number; }
export interface CachedLadderTemplate { id: string; template: string; cost_per_meter: number; }
export interface CachedStructureAccessoryRate { id: string; item_name: string; unit: string; rate: number; }
export interface CachedScheme { id: string; name: string; max_capacity_kw: number; applies_to: string; }
export interface CachedSchemeOverride { id: string; scheme_id: string; state_id: string; max_absolute_override: number | null; additional_state_subsidy: number | null; }

export interface MasterDataPayload extends MasterData {
  version: string;
  generatedAt: string;
}
