import { unstable_cache } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/server';

// Equipment master cache (10 min)
export const getEquipmentMaster = unstable_cache(
  async (orgId: string | null) => {
    const supabase = createAdminClient();
    const [panels, inverters, batteries, meters, las, commDevices] = await Promise.all([
      supabase.from('eq_panels').select('id, brand, model, wattage_w, selling_price, gst_pct, panel_type').eq('is_active', true),
      supabase.from('eq_inverters').select('id, brand, model, capacity_kw, selling_price, gst_pct, inverter_type, phases').eq('is_active', true),
      supabase.from('eq_batteries').select('id, brand, model, capacity_kwh, selling_price, gst_pct, chemistry, dod_pct').eq('is_active', true),
      supabase.from('eq_meters').select('id, brand, model, phases, selling_price, gst_pct').eq('is_active', true),
      supabase.from('eq_lightning_arresters').select('id, brand, model, selling_price, gst_pct').eq('is_active', true),
      supabase.from('eq_communication_devices').select('id, brand, model, selling_price, gst_pct').eq('is_active', true),
    ]);
    return { 
      panels: panels.data || [], 
      inverters: inverters.data || [], 
      batteries: batteries.data || [],
      meters: meters.data || [],
      lightningArresters: las.data || [],
      commDevices: commDevices.data || [],
    };
  },
  ['master-equipment'],
  { tags: ['master-data', 'equipment'], revalidate: 600 }
);

// Structures master cache (15 min)
export const getStructuresMaster = unstable_cache(
  async (orgId: string | null) => {
    const supabase = createAdminClient();
    const [structures, weightLookups, structureComponents, structureBom, structureAddons] = await Promise.all([
      supabase.from('eq_mounting_structures').select('*').eq('is_active', true),
      supabase.from('structure_weight_lookup').select('*'),
      supabase.from('eq_structure_components').select('*').eq('is_active', true),
      supabase.from('eq_structure_bom').select('*'),
      supabase.from('eq_structure_addons').select('*').eq('is_active', true),
    ]);
    // Also adding heavy structural templates
    const [structureAccessoryRates, structureMaterialRates, structureTemplates, structureTemplateItems, walkwayTemplates, ladderTemplates, structureComponentMasters] = await Promise.all([
      supabase.from('structure_accessory_rates').select('*').eq('is_active', true),
      supabase.from('structure_material_rates').select('*'),
      supabase.from('structure_templates').select('*'),
      supabase.from('structure_template_items').select('*'),
      supabase.from('walkway_templates').select('*'),
      supabase.from('ladder_templates').select('*'),
      supabase.from('structure_component_master').select('*').eq('is_active', true)
    ]);
    
    return {
      structures: structures.data || [],
      weightLookups: weightLookups.data || [],
      structureComponents: structureComponents.data || [],
      structureBom: structureBom.data || [],
      structureAddons: structureAddons.data || [],
      structureAccessoryRates: structureAccessoryRates.data || [],
      structureMaterialRates: structureMaterialRates.data || [],
      structureTemplates: structureTemplates.data || [],
      structureTemplateItems: structureTemplateItems.data || [],
      walkwayTemplates: walkwayTemplates.data || [],
      ladderTemplates: ladderTemplates.data || [],
      structureComponentMasters: structureComponentMasters.data || [],
    };
  },
  ['master-structures'],
  { tags: ['master-data', 'structures'], revalidate: 900 }
);

// Rules master cache (10 min)
export const getRulesMaster = unstable_cache(
  async (orgId: string | null) => {
    const supabase = createAdminClient();
    const [stateRules, slabs, schemes, systems, taxHsn, taxGstRates, bomItems] = await Promise.all([
      supabase.from('state_rules').select('*').eq('is_active', true),
      supabase.from('scheme_slabs').select('*'),
      supabase.from('calculation_schemes').select('*').eq('is_active', true),
      supabase.from('systems').select('*, system_items(*)').eq('is_active', true).order('capacity_kw', { ascending: true }),
      (supabase as any).from('tax_hsn_sac').select('*').eq('is_active', true),
      (supabase as any).from('tax_gst_rates').select('*'),
      supabase.from('bom_template_items').select('*').limit(1000)
    ]);
    return {
      stateRules: stateRules.data || [],
      slabs: slabs.data || [],
      schemes: schemes.data || [],
      systems: systems.data || [],
      taxHsnCodes: taxHsn?.data || [],
      taxGstRates: taxGstRates?.data || [],
      bomItems: bomItems.data || []
    };
  },
  ['master-rules'],
  { tags: ['master-data', 'rules'], revalidate: 600 }
);

// Org context cache (2 min)
export const getOrgContext = unstable_cache(
  async (orgId: string | null) => {
    if (!orgId) return { inventorySummary: [], vendors: [], appSettings: null, structureVendors: [] };
    const supabase = createAdminClient();
    const [inventory, vendors, appSettings] = await Promise.all([
      supabase.from('inventory_summary').select('*').eq('org_id', orgId).limit(1000),
      supabase.from('vendors').select('*').eq('org_id', orgId).order('name', { ascending: true }),
      supabase.from('app_settings').select('*').eq('org_id', orgId).maybeSingle()
    ]);
    const vData = vendors.data || [];
    return {
      inventorySummary: inventory.data || [],
      vendors: vData,
      appSettings: appSettings.data || null,
      structureVendors: vData.filter((v: any) => v.is_structure_vendor)
    };
  },
  ['master-org'],
  { tags: ['master-data', 'org'], revalidate: 120 }
);
