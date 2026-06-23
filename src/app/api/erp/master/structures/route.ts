import { NextResponse } from 'next/server';
import { withLicensedApiRoute } from '@/lib/auth/withLicensedApiRoute';
import { getOrSetCache } from '@/lib/cache/redisCache';

/**
 * GET /api/erp/master/structures
 * Returns mounting structure catalog, weight lookups, BOM, templates, and accessory/material rates.
 * These are all global (non-org-specific) reference tables — cached aggressively for 15 minutes.
 */
export const dynamic = 'force-dynamic';

export const GET = withLicensedApiRoute(
  async (_request, _context) => {
    const cacheKey = `erp:master:structures:global`;

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
          ] = await Promise.all([
            safeQuery(
              supabase
                .from('eq_mounting_structures')
                .select('id, name, type, material, price, is_active')
                .eq('is_active', true)
            ),
            safeQuery(supabase.from('structure_weight_lookup').select('*')),
            safeQuery(
              supabase
                .from('eq_structure_components')
                .select('id, name, type, material, unit, price, is_active')
                .eq('is_active', true)
            ),
            safeQuery(supabase.from('eq_structure_bom').select('*')),
            safeQuery(
              supabase
                .from('eq_structure_addons')
                .select('id, name, type, unit, price, is_active')
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
                .select('id, name, type, unit, is_active')
                .eq('is_active', true)
            ),
          ]);

          return {
            structures: structuresRes.data ?? [],
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

      return NextResponse.json(data);
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
