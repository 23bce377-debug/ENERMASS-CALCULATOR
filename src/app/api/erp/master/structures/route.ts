import { NextResponse } from 'next/server';
import { withLicensedApiRoute } from '@/lib/auth/withLicensedApiRoute';
import { getOrSetCache } from '@/lib/cache/redisCache';
import { privateJsonCacheHeaders } from '@/lib/cache/httpCache';

/**
 * GET /api/erp/master/structures
 * Returns mounting structure catalog, weight lookups, BOM, templates, and accessory/material rates.
 * Applies org-specific structure visibility before returning calculator reference data.
 */
export const dynamic = 'force-dynamic';

function applyOrgVisibility(rows: any[], hidden: Set<string>) {
  const overridden = new Set(
    rows.filter((row) => row.org_id && row.source_global_id).map((row) => row.source_global_id)
  );
  return rows.filter((row) => !(!row.org_id && (hidden.has(row.id) || overridden.has(row.id))));
}

export const GET = withLicensedApiRoute(
  async (_request, _context) => {
    const orgId = _context.session.orgId;
    const cacheKey = `erp:master:structures:${orgId}:v3`;

    try {
      const data = await getOrSetCache(
        cacheKey,
        async () => {
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

          const [
            structuresRes,
            weightLookupsRes,
            structureComponentsRes,
            structureBomRes,
            structureAddonsRes,
            structureAccessoryRatesRes,
            structureMaterialRatesRes,
            structureTemplatesRes,
            structureTemplateItemsRes,
            walkwayTemplatesRes,
            ladderTemplatesRes,
            structureComponentMasterRes,
            hiddenRes,
          ] = await Promise.all([
            safeQuery(
              supabase
                .from('eq_mounting_structures')
                .select('id, org_id, source_global_id, name, material, roof_mount_type, elevation_height_mm, raw_material_rate, fabrication_rate, galvanizing_rate, rate_per_kg, wastage_pct, fastener_weight_pct, base_weight_kg, selling_price, per_watt_rate, gst_pct, description, specification_details, is_active')
                .eq('is_active', true)
            ),
            safeQuery(supabase.from('structure_weight_lookup').select('*')),
            safeQuery(
              supabase
                .from('eq_structure_components')
                .select('id, name, category, description, specification_details, unit, selling_price, gst_pct, is_active')
                .eq('is_active', true)
            ),
            safeQuery(supabase.from('eq_structure_bom').select('*')),
            safeQuery(
              supabase
                .from('eq_structure_addons')
                .select('id, name, material, unit, rate_per_unit, gst_pct, specification_details, is_active')
                .eq('is_active', true)
            ),
            safeQuery(
              supabase
                .from('structure_accessory_rates')
                .select('*')
                .eq('is_active', true)
            ),
            safeQuery(supabase.from('structure_material_rates').select('*')),
            safeQuery(supabase.from('structure_templates').select('*')),
            safeQuery(supabase.from('structure_template_items').select('*')),
            safeQuery(supabase.from('walkway_templates').select('*')),
            safeQuery(supabase.from('ladder_templates').select('*')),
            safeQuery(
              supabase
                .from('structure_component_master')
                .select('id, name, type, weight_per_meter, material, selling_price, gst_pct, specification_details, is_active')
                .eq('is_active', true)
            ),
            safeQuery(
              (supabase as any)
                .from('master_hidden_items')
                .select('entity, global_id')
                .eq('org_id', orgId)
            ),
          ]);

          const hiddenRows = hiddenRes.data ?? [];
          const hiddenStructureIds = new Set<string>(
            hiddenRows.filter((row: any) => row.entity === 'structures').map((row: any) => String(row.global_id))
          );

          return {
            structures: applyOrgVisibility(structuresRes.data ?? [], hiddenStructureIds),
            weightLookups: weightLookupsRes.data ?? [],
            structureComponents: structureComponentsRes.data ?? [],
            structureBom: structureBomRes.data ?? [],
            structureAddons: structureAddonsRes.data ?? [],
            structureAccessoryRates: structureAccessoryRatesRes.data ?? [],
            structureMaterialRates: structureMaterialRatesRes.data ?? [],
            structureTemplates: structureTemplatesRes.data ?? [],
            structureTemplateItems: structureTemplateItemsRes.data ?? [],
            walkwayTemplates: walkwayTemplatesRes.data ?? [],
            ladderTemplates: ladderTemplatesRes.data ?? [],
            structureComponentMasters: structureComponentMasterRes.data ?? [],
          };
        },
        900 // 15 minutes — structure data is essentially static
      );

      return NextResponse.json(data, {
        headers: privateJsonCacheHeaders(900, 1800),
      });
    } catch (err: any) {
      console.error('[GET /api/erp/master/structures] Error:', err);
      return NextResponse.json(
        { error: err.message ?? 'Failed to load structure master data' },
        { status: 500 }
      );
    }
  },
  { feature: 'erp', roles: ['owner', 'admin', 'manager', 'staff'] }
);
