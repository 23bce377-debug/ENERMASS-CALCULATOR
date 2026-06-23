import { NextResponse } from 'next/server';
import { withLicensedApiRoute } from '@/lib/auth/withLicensedApiRoute';
import { getOrSetCache } from '@/lib/cache/redisCache';

/**
 * GET /api/erp/master/rules
 * Returns calculation rules: state rules, scheme slabs, calculation schemes,
 * solar systems catalog, GST/HSN codes, and BOM templates.
 *
 * Query params:
 *   bomLimit  – max bom_template_items rows (default 500, max 5000)
 *
 * Cached 10 minutes.
 */
export const dynamic = 'force-dynamic';

import { z } from 'zod';

const querySchema = z.object({
  bomLimit: z.coerce.number().min(1).max(5000).default(500),
});

export const GET = withLicensedApiRoute(
  async (request, _context) => {
    const { searchParams } = new URL(request.url);
    const parseResult = querySchema.safeParse(Object.fromEntries(searchParams.entries()));
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: parseResult.error.format() },
        { status: 400 }
      );
    }
    const { bomLimit } = parseResult.data;
    const cacheKey = `erp:master:rules:global:bomLimit_${bomLimit}`;

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

          const [stateRulesRes, slabsRes, schemesRes, systemsRes, taxHsnRes, taxGstRatesRes, bomItemsRes] =
            await Promise.all([
              safeQuery(
                supabase
                  .from('state_rules')
                  .select('*')
                  .eq('is_active', true)
              ),
              safeQuery(supabase.from('scheme_slabs').select('*')),
              safeQuery(
                supabase
                  .from('calculation_schemes')
                  .select('id, code, name, description, applies_to, max_capacity_kw, max_absolute_subsidy, is_active, created_at')
                  .eq('is_active', true)
              ),
              safeQuery(
                supabase
                  .from('systems')
                  .select('*, system_items(*)')
                  .eq('is_active', true)
                  .order('capacity_kw', { ascending: true })
              ),
              safeQuery(
                (supabase as any)
                  .from('tax_hsn_sac')
                  .select('id, code, description, gst_rate, is_active')
                  .eq('is_active', true)
              ),
              safeQuery((supabase as any).from('tax_gst_rates').select('*')),
              safeQuery(
                supabase.from('bom_template_items').select('*').limit(bomLimit)
              ),
            ]);

          return {
            stateRules: stateRulesRes.data ?? [],
            slabs: slabsRes.data ?? [],
            schemes: schemesRes.data ?? [],
            systems: systemsRes.data ?? [],
            taxHsnCodes: (taxHsnRes as any)?.data ?? [],
            taxGstRates: (taxGstRatesRes as any)?.data ?? [],
            bomItems: bomItemsRes.data ?? [],
          };
        },
        600 // 10 minutes
      );

      return NextResponse.json(data);
    } catch (err: any) {
      console.error('[GET /api/erp/master/rules] Error:', err);
      return NextResponse.json(
        { error: err.message ?? 'Failed to load rules master data' },
        { status: 500 }
      );
    }
  },
  { feature: 'erp', roles: ['owner', 'admin', 'manager', 'staff'] }
);
