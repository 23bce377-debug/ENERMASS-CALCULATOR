import { NextResponse } from 'next/server';
import { withLicensedApiRoute } from '@/lib/auth/withLicensedApiRoute';
import { getOrSetCache } from '@/lib/cache/redisCache';
import { privateJsonCacheHeaders } from '@/lib/cache/httpCache';
import { z } from 'zod';

const bootstrapQuerySchema = z.object({
  bomLimit: z.coerce.number().min(1).max(10000).default(1000),
  invLimit: z.coerce.number().min(1).max(10000).default(1000),
});

export const dynamic = 'force-dynamic';

function applyOrgVisibility(rows: any[], hidden: Set<string>) {
  const overridden = new Set(
    rows.filter((row) => row.org_id && row.source_global_id).map((row) => row.source_global_id)
  );
  return rows.filter((row) => !(!row.org_id && (hidden.has(row.id) || overridden.has(row.id))));
}

export const GET = withLicensedApiRoute(async (request, context) => {
  const orgId = context.session.orgId;

  const { searchParams } = new URL(request.url);
  const parseResult = bootstrapQuerySchema.safeParse(Object.fromEntries(searchParams.entries()));
  if (!parseResult.success) {
    return NextResponse.json({ error: 'Invalid query parameters', details: parseResult.error.format() }, { status: 400 });
  }
  const { bomLimit, invLimit } = parseResult.data;

  try {
    // Include limits in the cache key to prevent collision/poisoning (P0-7)
      const cacheKey = `erp:bootstrap:${orgId}:v6:bomLimit_${bomLimit}:invLimit_${invLimit}`;
    const data = await getOrSetCache(cacheKey, async () => {
      const { createClient } = await import('@/lib/supabase/server');
      const supabase = await createClient();

      const safeQuery = async (queryPromise: PromiseLike<any>) => {
        try {
          const result = await queryPromise;
          return result;
        } catch (error) {
          return { data: [], error };
        }
      };

      // Chunk 1: Basic Equipment
      const [panelsRes, invertersRes, batteriesRes, metersRes, laRes, commDevicesRes] = await Promise.all([
        safeQuery(supabase.from('eq_panels').select('*').eq('is_active', true)),
        safeQuery(supabase.from('eq_inverters').select('*').eq('is_active', true)),
        safeQuery(supabase.from('eq_batteries').select('*').eq('is_active', true)),
        safeQuery(supabase.from('eq_meters').select('*').eq('is_active', true)),
        safeQuery(supabase.from('eq_lightning_arresters').select('*').eq('is_active', true)),
        safeQuery(supabase.from('eq_communication_devices').select('*').eq('is_active', true)),
      ]);

      // Chunk 2: Structures & App Config
      const [structuresRes, weightLookupsRes, structureComponentsRes, structureBomRes, structureAddonsRes, appSettingsRes, categoryMarginsRes] = await Promise.all([
        safeQuery(supabase.from('eq_mounting_structures').select('*').eq('is_active', true)),
        safeQuery(supabase.from('structure_weight_lookup').select('*')),
        safeQuery(supabase.from('eq_structure_components').select('*').eq('is_active', true)),
        safeQuery(supabase.from('eq_structure_bom').select('*')),
        safeQuery(supabase.from('eq_structure_addons').select('*').eq('is_active', true)),
        safeQuery(supabase.from('app_settings').select('*').eq('org_id', orgId).maybeSingle()),
        safeQuery(supabase.from('category_margins').select('*').eq('org_id', orgId))
      ]);

      // Chunk 3: Rules, Schemes, Vendors, Systems, and GST Master
      const [stateRulesRes, slabsRes, schemesRes, schemeOverridesRes, inventoryRes, vendorsRes, systemsRes, taxHsnRes, taxGstRatesRes, systemStateAvailRes, stateTermsRes, hiddenItemsRes, hiddenSystemsRes] = await Promise.all([
        safeQuery(supabase.from('state_rules').select('*').eq('is_active', true)),
        safeQuery(supabase.from('scheme_slabs').select('*')),
        safeQuery(supabase.from('calculation_schemes').select('*').eq('is_active', true)),
        safeQuery((supabase as any).from('state_scheme_overrides').select('*').eq('is_active', true)),
        safeQuery(supabase.from('inventory_summary').select('*').eq('org_id', orgId).limit(invLimit)),
        safeQuery(supabase.from('vendors').select('*').eq('org_id', orgId).order('name', { ascending: true })),
        safeQuery(supabase.from('systems').select('*, system_items(*)').eq('is_active', true).order('capacity_kw', { ascending: true })),
        safeQuery((supabase as any).from('tax_hsn_sac').select('*').eq('is_active', true)),
        safeQuery((supabase as any).from('tax_gst_rates').select('*')),
        safeQuery((supabase as any).from('system_state_availability').select('system_id, state_id')),
        safeQuery((supabase as any).from('state_terms_templates').select('id, state_id, clauses, is_active, version').eq('is_active', true)),
        safeQuery((supabase as any).from('master_hidden_items').select('entity, global_id').eq('org_id', orgId)),
        safeQuery((supabase as any).from('system_hidden_presets').select('system_id').eq('org_id', orgId))
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
        safeQuery(
          (supabase as any)
            .from('bom_template_items')
            .select('*')
            .eq('is_active', true)
            .or(`org_id.is.null,org_id.eq.${orgId}`)
            .order('category_id', { ascending: true })
            .order('description', { ascending: true })
            .limit(bomLimit)
        ),
        safeQuery(supabase.from('rate_master').select('*').eq('org_id', orgId).eq('is_active', true)),
        safeQuery(supabase.from('structure_accessory_rates').select('*').eq('is_active', true)),
        safeQuery(supabase.from('structure_material_rates').select('*')),
        safeQuery(supabase.from('structure_templates').select('*')),
        safeQuery(supabase.from('structure_template_items').select('*')),
        safeQuery(supabase.from('walkway_templates').select('*')),
        safeQuery(supabase.from('ladder_templates').select('*')),
        safeQuery(supabase.from('structure_component_master').select('*').eq('is_active', true))
      ]);

      // Only throw if core equipment tables fail (panels, inverters, batteries)
      const coreErrors = [panelsRes, invertersRes, batteriesRes]
        .filter(res => res?.error && res.error.code !== 'PGRST116');
      if (coreErrors.length > 0) {
        throw coreErrors[0].error;
      }

      const hiddenRows = (hiddenItemsRes as any)?.data || [];
      const hiddenIds = (entity: string): Set<string> => new Set<string>(
        hiddenRows.filter((row: any) => row.entity === entity).map((row: any) => String(row.global_id))
      );
      const hiddenSystemIds = new Set<string>(
        (((hiddenSystemsRes as any)?.data || []) as any[]).map((row: any) => String(row.system_id))
      );

      return {
        panels: applyOrgVisibility(panelsRes.data || [], hiddenIds('panels')),
        inverters: applyOrgVisibility(invertersRes.data || [], hiddenIds('inverters')),
        batteries: applyOrgVisibility(batteriesRes.data || [], hiddenIds('batteries')),
        meters: metersRes.data || [],
        lightningArresters: laRes.data || [],
        structures: applyOrgVisibility(structuresRes.data || [], hiddenIds('structures')),
        bomItems: applyOrgVisibility(bomItemsRes.data || [], hiddenIds('accessories')),
        commDevices: commDevicesRes.data || [],
        systems: (systemsRes.data || []).filter((row: any) => row.org_id || !hiddenSystemIds.has(String(row.id))),
        systemStateAvailability: (systemStateAvailRes as any)?.data || [],
        stateTermsTemplates: (stateTermsRes as any)?.data || [],
        weightLookups: weightLookupsRes.data || [],
        stateRules: stateRulesRes.data || [],
        slabs: slabsRes.data || [],
        schemes: schemesRes.data || [],
        schemeOverrides: (schemeOverridesRes as any)?.data || [],
        inventorySummary: inventoryRes.data || [],
        vendors: vendorsRes.data || [],
        structureComponents: structureComponentsRes.data || [],
        structureBom: structureBomRes.data || [],
        structureAddons: structureAddonsRes.data || [],
        appSettings: appSettingsRes.data || null,
        categoryMargins: categoryMarginsRes.data || [],
        rateMaster: rateMasterRes.data || [],
        structureVendors: (vendorsRes.data || []).filter((v: any) => v.is_structure_vendor),
        structureAccessoryRates: structureAccessoryRatesRes.data || [],
        structureMaterialRates: structureMaterialRatesRes.data || [],
        structureTemplates: structureTemplatesRes.data || [],
        structureTemplateItems: structureTemplateItemsRes.data || [],
        walkwayTemplates: walkwayTemplatesRes.data || [],
        ladderTemplates: ladderTemplatesRes.data || [],
        structureComponentMasters: structureComponentMasterRes.data || [],
        taxHsnCodes: (taxHsnRes as any)?.data || [],
        taxGstRates: (taxGstRatesRes as any)?.data || []
      };
    }, 300); // Cache for 5 minutes

    return NextResponse.json(data, {
      headers: privateJsonCacheHeaders(120, 300),
    });
  } catch (err: any) {
    console.error('[GET /api/erp/bootstrap] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error during bootstrap load' }, { status: 500 });
  }
}, {
  feature: 'erp',
  roles: ['owner', 'admin', 'manager', 'staff'],
});
