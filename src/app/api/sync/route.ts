import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/wrappers';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (request, context) => {
  const { orgId } = context.auth;
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

    // Utility to conditionally add updated_at filter
    const applySyncFilter = (query: any) => {
      if (lastSyncedAt) {
        // Use gte so we get records updated after or equal to lastSyncedAt
        // We'll trust the client to merge the data properly (upsert by id)
        return query.gte('updated_at', lastSyncedAt);
      }
      return query;
    };

    // Note: Some tables might not have updated_at, or it might be named differently.
    // For simplicity, we assume the core master tables have 'updated_at'. If they don't, 
    // applying the filter will throw a postgrest error. In production, tables without 
    // updated_at would need a different strategy (or just return them entirely if small).
    // For this rewrite, we'll fetch everything if lastSyncedAt is not provided, 
    // acting exactly like bootstrap.

    // Chunk 1: Basic Equipment
    const [panelsRes, invertersRes, batteriesRes, metersRes, laRes, commDevicesRes] = await Promise.all([
      applySyncFilter(supabase.from('eq_panels').select('*').eq('is_active', true)),
      applySyncFilter(supabase.from('eq_inverters').select('*').eq('is_active', true)),
      applySyncFilter(supabase.from('eq_batteries').select('*').eq('is_active', true)),
      applySyncFilter(supabase.from('eq_meters').select('*').eq('is_active', true)),
      applySyncFilter(supabase.from('eq_lightning_arresters').select('*').eq('is_active', true)),
      applySyncFilter(supabase.from('eq_communication_devices').select('*').eq('is_active', true)),
    ]);

    // Chunk 2: Structures & App Config
    const [structuresRes, weightLookupsRes, structureComponentsRes, structureBomRes, structureAddonsRes, appSettingsRes] = await Promise.all([
      applySyncFilter(supabase.from('eq_mounting_structures').select('*').eq('is_active', true)),
      supabase.from('structure_weight_lookup').select('*'), // Might not have updated_at, static
      applySyncFilter(supabase.from('eq_structure_components').select('*').eq('is_active', true)),
      supabase.from('eq_structure_bom').select('*'), // static
      applySyncFilter(supabase.from('eq_structure_addons').select('*').eq('is_active', true)),
      applySyncFilter(supabase.from('app_settings').select('*').eq('org_id', orgId)).maybeSingle()
    ]);

    // Chunk 3: Rules, Schemes, Vendors, and Systems
    const [stateRulesRes, slabsRes, schemesRes, inventoryRes, vendorsRes, systemsRes] = await Promise.all([
      applySyncFilter(supabase.from('state_rules').select('*').eq('is_active', true)),
      supabase.from('scheme_slabs').select('*'), // static mostly
      applySyncFilter(supabase.from('calculation_schemes').select('*').eq('is_active', true)),
      supabase.from('inventory_summary').select('*').eq('org_id', orgId).limit(invLimit), // Refresh all or handle separately
      applySyncFilter(supabase.from('vendors').select('*').eq('org_id', orgId).order('name', { ascending: true })),
      applySyncFilter(supabase.from('systems').select('*, system_items(*)').eq('is_active', true).order('capacity_kw', { ascending: true }))
    ]);

    // Chunk 4: Heavy BOM & Structural Templates
    const [
      bomItemsRes,
      structureAccessoryRatesRes,
      structureMaterialRatesRes,
      structureTemplatesRes,
      structureTemplateItemsRes,
      walkwayTemplatesRes,
      ladderTemplatesRes,
      structureComponentMasterRes
    ] = await Promise.all([
      applySyncFilter(supabase.from('bom_template_items').select('*').limit(bomLimit)),
      applySyncFilter(supabase.from('structure_accessory_rates').select('*').eq('is_active', true)),
      applySyncFilter(supabase.from('structure_material_rates').select('*')),
      applySyncFilter(supabase.from('structure_templates').select('*')),
      supabase.from('structure_template_items').select('*'), // related
      applySyncFilter(supabase.from('walkway_templates').select('*')),
      applySyncFilter(supabase.from('ladder_templates').select('*')),
      applySyncFilter(supabase.from('structure_component_master').select('*').eq('is_active', true))
    ]);

    const errors = [
      panelsRes, invertersRes, batteriesRes, metersRes, laRes, commDevicesRes,
      structuresRes, weightLookupsRes, structureComponentsRes, structureBomRes, structureAddonsRes, appSettingsRes,
      stateRulesRes, slabsRes, schemesRes, inventoryRes, vendorsRes, systemsRes,
      bomItemsRes, structureAccessoryRatesRes, structureMaterialRatesRes, structureTemplatesRes, structureTemplateItemsRes, walkwayTemplatesRes, ladderTemplatesRes, structureComponentMasterRes
    ].filter(res => res.error);

    if (errors.length > 0) {
      console.warn('Sync encountered errors. Returning full data or failing gracefully.', errors);
      // For resilience, we could fallback, but let's throw to let the client retry
      throw errors[0].error;
    }

    const nextSyncAt = new Date().toISOString();

    return NextResponse.json({
      timestamp: nextSyncAt,
      isDelta: !!lastSyncedAt,
      data: {
        panels: panelsRes.data || [],
        inverters: invertersRes.data || [],
        batteries: batteriesRes.data || [],
        meters: metersRes.data || [],
        lightningArresters: laRes.data || [],
        structures: structuresRes.data || [],
        bomItems: bomItemsRes.data || [],
        commDevices: commDevicesRes.data || [],
        systems: systemsRes.data || [],
        weightLookups: weightLookupsRes.data || [],
        stateRules: stateRulesRes.data || [],
        slabs: slabsRes.data || [],
        schemes: schemesRes.data || [],
        inventorySummary: inventoryRes.data || [],
        vendors: vendorsRes.data || [],
        structureComponents: structureComponentsRes.data || [],
        structureBom: structureBomRes.data || [],
        structureAddons: structureAddonsRes.data || [],
        appSettings: appSettingsRes.data || null,
        structureVendors: (vendorsRes.data || []).filter((v: any) => v.is_structure_vendor),
        structureAccessoryRates: structureAccessoryRatesRes.data || [],
        structureMaterialRates: structureMaterialRatesRes.data || [],
        structureTemplates: structureTemplatesRes.data || [],
        structureTemplateItems: structureTemplateItemsRes.data || [],
        walkwayTemplates: walkwayTemplatesRes.data || [],
        ladderTemplates: ladderTemplatesRes.data || [],
        structureComponentMasters: structureComponentMasterRes.data || []
      }
    });
  } catch (err: any) {
    console.error('[GET /api/sync] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error during sync load' }, { status: 500 });
  }
});
