import { createAdminClient } from '@/lib/supabase/server';

type LocalCacheEntry<T> = {
  expiresAt: number;
  value?: T;
  promise?: Promise<T>;
  failedAt?: number;
};

const localCache = new Map<string, LocalCacheEntry<unknown>>();

async function getLocalCached<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>
): Promise<T> {
  const now = Date.now();
  const existing = localCache.get(key) as LocalCacheEntry<T> | undefined;

  if (existing && existing.expiresAt > now) {
    if (existing.value !== undefined) return existing.value;
    if (existing.promise && !existing.failedAt) return existing.promise;
  }

  const promise = loader()
    .then((value) => {
      localCache.set(key, {
        expiresAt: Date.now() + ttlSeconds * 1000,
        value,
      });
      return value;
    })
    .catch((error) => {
      const current = localCache.get(key) as LocalCacheEntry<T> | undefined;
      if (current?.promise === promise) {
        localCache.delete(key);
      }
      throw error;
    });

  localCache.set(key, {
    expiresAt: now + ttlSeconds * 1000,
    promise,
  });

  return promise;
}

export function invalidateServerCalculatorCache(orgId?: string | null) {
  const target = orgId ?? null;
  for (const key of Array.from(localCache.keys())) {
    if (target === null || key.includes(`:${target}:`) || key.endsWith(':global')) {
      localCache.delete(key);
    }
  }
}

function applyHiddenSystems(rows: any[], hiddenRows: any[]) {
  const hiddenIds = new Set((hiddenRows || []).map((row: any) => row.system_id));
  return (rows || []).filter((row: any) => row.org_id || !hiddenIds.has(row.id));
}

function hiddenIdsByEntity(hiddenRows: any[], entity: string): Set<string> {
  return new Set(
    (hiddenRows || [])
      .filter((row: any) => row.entity === entity)
      .map((row: any) => String(row.global_id))
  );
}

function applyOrgVisibility(rows: any[], hiddenIds: Set<string>) {
  const overridden = new Set(
    (rows || [])
      .filter((row: any) => row.org_id && row.source_global_id)
      .map((row: any) => String(row.source_global_id))
  );
  return (rows || []).filter((row: any) => !(!row.org_id && (hiddenIds.has(String(row.id)) || overridden.has(String(row.id)))));
}

function orgVisibleQuery(query: any, orgId: string | null) {
  return orgId ? query.or(`org_id.is.null,org_id.eq.${orgId}`) : query.is('org_id', null);
}

// Equipment master cache (10 min)
export async function getEquipmentMaster(orgId: string | null) {
  return getLocalCached(`calculator:${orgId ?? 'global'}:equipment`, 600, async () => {
    const supabase = createAdminClient();
    const [panels, inverters, batteries, meters, las, commDevices, hiddenItems] = await Promise.all([
      orgVisibleQuery(supabase.from('eq_panels').select('id, org_id, source_global_id, brand, model, wattage_w, selling_price, gst_pct, panel_type').eq('is_active', true), orgId),
      orgVisibleQuery(supabase.from('eq_inverters').select('id, org_id, source_global_id, brand, model, capacity_kw, selling_price, gst_pct, inverter_type, phases').eq('is_active', true), orgId),
      orgVisibleQuery(supabase.from('eq_batteries').select('id, org_id, source_global_id, brand, model, capacity_kwh, selling_price, gst_pct, chemistry, dod_pct').eq('is_active', true), orgId),
      supabase.from('eq_meters').select('id, brand, model, phases, selling_price, gst_pct').eq('is_active', true),
      supabase.from('eq_lightning_arresters').select('id, brand, model, selling_price, gst_pct').eq('is_active', true),
      supabase.from('eq_communication_devices').select('id, brand, model, selling_price, gst_pct').eq('is_active', true),
      orgId
        ? (supabase as any).from('master_hidden_items').select('entity, global_id').eq('org_id', orgId)
        : Promise.resolve({ data: [], error: null }),
    ]);
    const hiddenRows = (hiddenItems as any)?.data || [];
    return { 
      panels: applyOrgVisibility(panels.data || [], hiddenIdsByEntity(hiddenRows, 'panels')),
      inverters: applyOrgVisibility(inverters.data || [], hiddenIdsByEntity(hiddenRows, 'inverters')),
      batteries: applyOrgVisibility(batteries.data || [], hiddenIdsByEntity(hiddenRows, 'batteries')),
      meters: meters.data || [],
      lightningArresters: las.data || [],
      commDevices: commDevices.data || [],
    };
  });
}

// Structures master cache (15 min)
export async function getStructuresMaster(orgId: string | null) {
  return getLocalCached(`calculator:${orgId ?? 'global'}:structures`, 900, async () => {
    const supabase = createAdminClient();
    const [
      structures,
      weightLookups,
      structureComponents,
      structureBom,
      structureAddons,
      structureAccessoryRates,
      structureMaterialRates,
      structureTemplates,
      structureTemplateItems,
      walkwayTemplates,
      ladderTemplates,
      structureComponentMasters,
      hiddenItems
    ] = await Promise.all([
      orgVisibleQuery(supabase.from('eq_mounting_structures').select('*').eq('is_active', true), orgId),
      supabase.from('structure_weight_lookup').select('*'),
      supabase.from('eq_structure_components').select('*').eq('is_active', true),
      supabase.from('eq_structure_bom').select('*'),
      supabase.from('eq_structure_addons').select('*').eq('is_active', true),
      supabase.from('structure_accessory_rates').select('*').eq('is_active', true),
      supabase.from('structure_material_rates').select('*'),
      supabase.from('structure_templates').select('*'),
      supabase.from('structure_template_items').select('*'),
      supabase.from('walkway_templates').select('*'),
      supabase.from('ladder_templates').select('*'),
      supabase.from('structure_component_master').select('*').eq('is_active', true),
      orgId
        ? (supabase as any).from('master_hidden_items').select('entity, global_id').eq('org_id', orgId)
        : Promise.resolve({ data: [], error: null }),
    ]);
    const hiddenRows = (hiddenItems as any)?.data || [];
    
    return {
      structures: applyOrgVisibility(structures.data || [], hiddenIdsByEntity(hiddenRows, 'structures')),
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
  });
}

// Rules master cache (10 min)
export async function getRulesMaster(orgId: string | null) {
  return getLocalCached(`calculator:${orgId ?? 'global'}:rules`, 600, async () => {
    const supabase = createAdminClient();
    const [
      stateRules, slabs, schemes, systems, hiddenSystems, hiddenItems, taxHsn, taxGstRates, bomItems,
      systemStateAvailability, stateTermsTemplates,
    ] = await Promise.all([
      supabase.from('state_rules').select('*').eq('is_active', true),
      supabase.from('scheme_slabs').select('*'),
      supabase.from('calculation_schemes').select('*').eq('is_active', true),
      supabase.from('systems').select('*, system_items(*)').eq('is_active', true).order('capacity_kw', { ascending: true }),
      orgId
        ? (supabase as any).from('system_hidden_presets').select('system_id').eq('org_id', orgId)
        : Promise.resolve({ data: [], error: null }),
      orgId
        ? (supabase as any).from('master_hidden_items').select('entity, global_id').eq('org_id', orgId)
        : Promise.resolve({ data: [], error: null }),
      (supabase as any).from('tax_hsn_sac').select('*').eq('is_active', true),
      (supabase as any).from('tax_gst_rates').select('*'),
      orgVisibleQuery((supabase as any).from('bom_template_items').select('*').eq('is_active', true), orgId)
        .order('category_id', { ascending: true })
        .order('description', { ascending: true })
        .limit(1000),
      // State-driven pipeline datasets (graceful empty fallback if tables absent)
      (supabase as any).from('system_state_availability').select('system_id, state_id'),
      (supabase as any).from('state_terms_templates').select('id, state_id, clauses, is_active, version').eq('is_active', true),
    ]);
    return {
      stateRules: stateRules.data || [],
      slabs: slabs.data || [],
      schemes: schemes.data || [],
      systems: applyHiddenSystems(systems.data || [], (hiddenSystems as any)?.data || []),
      taxHsnCodes: taxHsn?.data || [],
      taxGstRates: taxGstRates?.data || [],
      bomItems: applyOrgVisibility(bomItems.data || [], hiddenIdsByEntity((hiddenItems as any)?.data || [], 'accessories')),
      systemStateAvailability: systemStateAvailability?.data || [],
      stateTermsTemplates: stateTermsTemplates?.data || [],
    };
  });
}

// Org context cache (2 min)
export async function getOrgContext(orgId: string | null) {
  return getLocalCached(`calculator:${orgId ?? 'global'}:org`, 120, async () => {
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
  });
}
