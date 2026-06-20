import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { MasterData, MasterDataPayload } from './masterCacheTypes';

export const CACHE_VERSION = '2.0.0';
export const CACHE_TAG = 'master-data';

export function orgCacheKey(orgId: string, entity: string): string {
  return `org:${orgId}:masters:${entity}`;
}

export async function getCachedMasterData(orgId?: string): Promise<MasterDataPayload> {
  const supabase = await createClient();

  const [
    panelsRes, invertersRes, batteriesRes,
    stateRulesRes, slabsRes, schemesRes, schemeOverridesRes,
    bomCategoriesRes, bomTemplateItemsRes,
    metersRes, lightningArrestersRes, structuresRes,
    weightLookupsRes, orientationMultipliersRes, structureVendorsRes,
    structureMaterialRatesRes, structureTemplatesRes, structureTemplateItemsRes,
    walkwayTemplatesRes, ladderTemplatesRes, structureAccessoryRatesRes
  ] = await Promise.all([
    supabase.from('eq_panels').select('id, brand, model, wattage_w, rate_per_watt, gst_pct, is_active').eq('is_active', true),
    supabase.from('eq_inverters').select('id, brand, model, capacity_kw, phase, rate, gst_pct, is_active').eq('is_active', true),
    supabase.from('eq_batteries').select('id, brand, model, capacity_kwh, voltage_v, rate, gst_pct, is_active').eq('is_active', true),
    supabase.from('state_rules').select('id, state_code, state_name, is_active').eq('is_active', true),
    supabase.from('scheme_slabs').select('id, scheme_id, slab_index, start_kw, end_kw, rate_per_kw, is_fixed_amount, fixed_amount'),
    supabase.from('calculation_schemes').select('id, name, max_capacity_kw, applies_to').eq('is_active', true),
    supabase.from('state_scheme_overrides').select('id, scheme_id, state_id, max_absolute_override, additional_state_subsidy').eq('is_active', true),
    supabase.from('bom_categories').select('id, name, display_order, is_optional').order('display_order'),
    supabase.from('bom_template_items').select('id, category_id, sku_code, description, unit, unit_rate_min, unit_rate_max, default_rate, qty_formula, is_survey_dependent, civil_required_only, notes'),
    supabase.from('eq_meters').select('id, brand, model, rate, gst_pct, meter_type, description'),
    supabase.from('eq_lightning_arresters').select('id, brand, model, rate, gst_pct, description, max_capacity_kw'),
    supabase.from('eq_mounting_structures').select('id, name, material, roof_mount_type, flat_rate, per_watt_rate, gst_pct, raw_material_rate, fabrication_rate, galvanizing_rate, base_weight_kg, wastage_pct, fastener_weight_pct, rate_per_kg'),
    supabase.from('structure_weight_lookup').select('id, structure_id, capacity_kw_min, capacity_kw_max, total_weight_kg'),
    supabase.from('eq_orientation_multipliers').select('orientation, multiplier'),
    supabase.from('vendors').select('id, name').eq('is_structure_vendor', true),
    supabase.from('structure_material_rates').select('id, vendor_id, material_type, rate_per_kg'),
    supabase.from('structure_templates').select('id, structure_type, capacity_kw'),
    supabase.from('structure_template_items').select('id, template_id, vendor_id, item, qty, weight'),
    supabase.from('walkway_templates').select('id, template, cost_per_meter'),
    supabase.from('ladder_templates').select('id, template, cost_per_meter'),
    supabase.from('structure_accessory_rates').select('id, item_name, unit, rate').eq('is_active', true),
  ]);

  return {
    version: CACHE_VERSION,
    generatedAt: new Date().toISOString(),
    panels: panelsRes.data || [],
    inverters: invertersRes.data || [],
    batteries: batteriesRes.data || [],
    stateRules: stateRulesRes.data || [],
    slabs: slabsRes.data || [],
    schemes: schemesRes.data || [],
    schemeOverrides: schemeOverridesRes.data || [],
    bomCategories: bomCategoriesRes.data || [],
    bomTemplateItems: bomTemplateItemsRes.data || [],
    meters: metersRes.data || [],
    lightningArresters: lightningArrestersRes.data || [],
    structures: structuresRes.data || [],
    weightLookups: weightLookupsRes.data || [],
    orientationMultipliers: orientationMultipliersRes.data || [],
    structureVendors: structureVendorsRes.data || [],
    structureMaterialRates: structureMaterialRatesRes.data || [],
    structureTemplates: structureTemplatesRes.data || [],
    structureTemplateItems: structureTemplateItemsRes.data || [],
    walkwayTemplates: walkwayTemplatesRes.data || [],
    ladderTemplates: ladderTemplatesRes.data || [],
    structureAccessoryRates: structureAccessoryRatesRes.data || [],
  };
}

export async function invalidateMasterCache(orgId?: string): Promise<void> {
  // In a real implementation this would clear redis/memcached
  // Currently a placeholder as requested.
  console.log(`[Cache] Invalidated master cache (global${orgId ? ` and org ${orgId}` : ''})`);
}

export async function invalidateOrgCache(orgId: string): Promise<void> {
  console.log(`[Cache] Invalidated org cache for ${orgId}`);
}
