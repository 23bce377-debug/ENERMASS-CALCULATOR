import { NextResponse } from 'next/server';
import { withLicensedApiRoute } from '@/lib/auth/withLicensedApiRoute';

export const dynamic = 'force-dynamic';

export const GET = withLicensedApiRoute(async (request, context) => {
  const { orgId } = context.session;
  if (!orgId) {
    return NextResponse.json({ error: 'Unauthorized: No org_id associated with profile' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const lastSyncedAt = searchParams.get('lastSyncedAt'); // ISO string
  const bomLimit = Math.min(10000, Math.max(1, parseInt(searchParams.get('bomLimit') || '1000', 10)));
  const invLimit = Math.min(10000, Math.max(1, parseInt(searchParams.get('invLimit') || '1000', 10)));

  try {
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();
    const warnings: Array<{ source: string; message: string }> = [];

    // Utility to conditionally add updated_at filter
    const applySyncFilter = (query: any) => {
      if (lastSyncedAt) {
        // Use gte so we get records updated after or equal to lastSyncedAt
        // We'll trust the client to merge the data properly (upsert by id)
        return query.gte('updated_at', lastSyncedAt);
      }
      return query;
    };

    const activeOnlyForFullSync = (query: any) => {
      if (lastSyncedAt) return query;
      return query.eq('is_active', true);
    };

    const safeData = <T,>(source: string, result: { data?: T | null; error?: any }, fallback: T): T => {
      if (result?.error) {
        console.warn(`[GET /api/sync] ${source} failed:`, result.error);
        warnings.push({ source, message: result.error.message ?? 'Unknown sync query error' });
        return fallback;
      }
      return (result?.data ?? fallback) as T;
    };

    // Note: Some tables might not have updated_at, or it might be named differently.
    // For simplicity, we assume the core master tables have 'updated_at'. If they don't, 
    // applying the filter will throw a postgrest error. In production, tables without 
    // updated_at would need a different strategy (or just return them entirely if small).
    // For this rewrite, we'll fetch everything if lastSyncedAt is not provided, 
    // acting exactly like bootstrap.

    // Chunk 1: Basic Equipment
    const [panelsRes, invertersRes, batteriesRes, metersRes, laRes, commDevicesRes] = await Promise.all([
      applySyncFilter(activeOnlyForFullSync(supabase.from('eq_panels').select('*'))),
      applySyncFilter(activeOnlyForFullSync(supabase.from('eq_inverters').select('*'))),
      applySyncFilter(activeOnlyForFullSync(supabase.from('eq_batteries').select('*'))),
      applySyncFilter(activeOnlyForFullSync(supabase.from('eq_meters').select('*'))),
      applySyncFilter(activeOnlyForFullSync(supabase.from('eq_lightning_arresters').select('*'))),
      applySyncFilter(activeOnlyForFullSync(supabase.from('eq_communication_devices').select('*'))),
    ]);

    // Chunk 2: Structures & App Config
    const [structuresRes, weightLookupsRes, structureComponentsRes, structureBomRes, structureAddonsRes, appSettingsRes, categoryMarginsRes] = await Promise.all([
      applySyncFilter(activeOnlyForFullSync(supabase.from('eq_mounting_structures').select('*'))),
      supabase.from('structure_weight_lookup').select('*'), // Might not have updated_at, static
      applySyncFilter(activeOnlyForFullSync(supabase.from('eq_structure_components').select('*'))),
      supabase.from('eq_structure_bom').select('*'), // static
      applySyncFilter(activeOnlyForFullSync(supabase.from('eq_structure_addons').select('*'))),
      applySyncFilter(supabase.from('app_settings').select('*').eq('org_id', orgId)).maybeSingle(),
      supabase.from('category_margins').select('*').eq('org_id', orgId),
    ]);

    // Chunk 3: Rules, Schemes, Vendors, and Systems
    const [stateRulesRes, slabsRes, schemesRes, schemeOverridesRes, inventoryRes, vendorsRes, systemsRes, systemStateAvailRes, stateTermsRes] = await Promise.all([
      applySyncFilter(activeOnlyForFullSync(supabase.from('state_rules').select('*'))),
      supabase.from('scheme_slabs').select('*'), // static mostly
      applySyncFilter(activeOnlyForFullSync(supabase.from('calculation_schemes').select('*'))),
      applySyncFilter(activeOnlyForFullSync(supabase.from('state_scheme_overrides').select('*'))),
      supabase.from('inventory_summary').select('*').eq('org_id', orgId).limit(invLimit), // Refresh all or handle separately
      applySyncFilter(supabase.from('vendors').select('*').eq('org_id', orgId).order('name', { ascending: true })),
      applySyncFilter(activeOnlyForFullSync(supabase.from('systems').select('*, system_items(*)')).order('capacity_kw', { ascending: true })),
      (supabase as any).from('system_state_availability').select('system_id, state_id'),
      (supabase as any).from('state_terms_templates').select('id, state_id, clauses, is_active, version').eq('is_active', true)
    ]);

    // Chunk 4: Heavy BOM & Structural Templates
    const [
      bomItemsRes,
      rateMasterRes,
      structureAccessoryRatesRes,
      structureMaterialRatesRes,
      structureTemplatesRes,
      structureTemplateItemsRes,
      walkwayTemplatesRes,
      ladderTemplatesRes,
      structureComponentMasterRes
    ] = await Promise.all([
      applySyncFilter(activeOnlyForFullSync(supabase.from('bom_template_items').select('*')).limit(bomLimit)),
      applySyncFilter(activeOnlyForFullSync(supabase.from('rate_master').select('*').eq('org_id', orgId))),
      applySyncFilter(activeOnlyForFullSync(supabase.from('structure_accessory_rates').select('*'))),
      applySyncFilter(supabase.from('structure_material_rates').select('*')),
      applySyncFilter(supabase.from('structure_templates').select('*')),
      supabase.from('structure_template_items').select('*'), // related
      applySyncFilter(supabase.from('walkway_templates').select('*')),
      applySyncFilter(supabase.from('ladder_templates').select('*')),
      applySyncFilter(activeOnlyForFullSync(supabase.from('structure_component_master').select('*')))
    ]);

    const nextSyncAt = new Date().toISOString();

    return NextResponse.json({
      timestamp: nextSyncAt,
      isDelta: !!lastSyncedAt,
      warnings,
      data: {
        panels: safeData('panels', panelsRes, []),
        inverters: safeData('inverters', invertersRes, []),
        batteries: safeData('batteries', batteriesRes, []),
        meters: safeData('meters', metersRes, []),
        lightningArresters: safeData('lightningArresters', laRes, []),
        structures: safeData('structures', structuresRes, []),
        bomItems: safeData('bomItems', bomItemsRes, []),
        rateMaster: safeData('rateMaster', rateMasterRes, []),
        commDevices: safeData('commDevices', commDevicesRes, []),
        systems: safeData('systems', systemsRes, []),
        systemStateAvailability: safeData('systemStateAvailability', systemStateAvailRes as any, []),
        stateTermsTemplates: safeData('stateTermsTemplates', stateTermsRes as any, []),
        weightLookups: safeData('weightLookups', weightLookupsRes, []),
        stateRules: safeData('stateRules', stateRulesRes, []),
        slabs: safeData('slabs', slabsRes, []),
        schemes: safeData('schemes', schemesRes, []),
        schemeOverrides: safeData('schemeOverrides', schemeOverridesRes, []),
        inventorySummary: safeData('inventorySummary', inventoryRes, []),
        vendors: safeData('vendors', vendorsRes, []),
        structureComponents: safeData('structureComponents', structureComponentsRes, []),
        structureBom: safeData('structureBom', structureBomRes, []),
        structureAddons: safeData('structureAddons', structureAddonsRes, []),
        appSettings: safeData('appSettings', appSettingsRes, null),
        categoryMargins: safeData('categoryMargins', categoryMarginsRes, []),
        structureVendors: safeData<any[]>('structureVendors', vendorsRes, []).filter((v: any) => v.is_structure_vendor),
        structureAccessoryRates: safeData('structureAccessoryRates', structureAccessoryRatesRes, []),
        structureMaterialRates: safeData('structureMaterialRates', structureMaterialRatesRes, []),
        structureTemplates: safeData('structureTemplates', structureTemplatesRes, []),
        structureTemplateItems: safeData('structureTemplateItems', structureTemplateItemsRes, []),
        walkwayTemplates: safeData('walkwayTemplates', walkwayTemplatesRes, []),
        ladderTemplates: safeData('ladderTemplates', ladderTemplatesRes, []),
        structureComponentMasters: safeData('structureComponentMasters', structureComponentMasterRes, [])
      }
    });
  } catch (err: any) {
    console.error('[GET /api/sync] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error during sync load' }, { status: 500 });
  }
}, {
  feature: 'master_data',
  roles: ['owner', 'admin', 'manager', 'staff'],
});
