import { NextResponse } from 'next/server';
import { withLicensedApiRoute } from '@/lib/auth/withLicensedApiRoute';
import { getOrSetCache } from '@/lib/cache/redisCache';

/**
 * GET /api/erp/master/org
 * Returns org-scoped runtime data: inventory summary, vendors, and app settings.
 * Short-lived cache (2 minutes) since inventory/vendor changes are frequent.
 *
 * Query params:
 *   invLimit  – max inventory_summary rows (default 200, max 2000)
 */
export const dynamic = 'force-dynamic';

import { z } from 'zod';

const querySchema = z.object({
  invLimit: z.coerce.number().min(1).max(2000).default(200),
});

export const GET = withLicensedApiRoute(
  async (request, context) => {
    const orgId = context.session.orgId;

    const { searchParams } = new URL(request.url);
    const parseResult = querySchema.safeParse(Object.fromEntries(searchParams.entries()));
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: parseResult.error.format() },
        { status: 400 }
      );
    }
    const { invLimit } = parseResult.data;
    const cacheKey = `erp:master:org:${orgId}:invLimit_${invLimit}`;

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

          const [inventoryRes, vendorsRes, appSettingsRes] = await Promise.all([
            safeQuery(
              supabase
                .from('inventory_summary')
                .select('id, item_name, sku, quantity, unit, warehouse_id, org_id')
                .eq('org_id', orgId)
                .limit(invLimit)
            ),
            safeQuery(
              supabase
                .from('vendors')
                .select('id, name, contact_person, phone, email, is_structure_vendor, org_id')
                .eq('org_id', orgId)
                .order('name', { ascending: true })
            ),
            safeQuery(
              supabase
                .from('app_settings')
                .select('*')
                .eq('org_id', orgId)
                .maybeSingle()
            ),
          ]);

          const vendors = vendorsRes.data ?? [];

          return {
            inventorySummary: inventoryRes.data ?? [],
            vendors,
            structureVendors: vendors.filter((v: any) => v.is_structure_vendor),
            appSettings: appSettingsRes.data ?? null,
          };
        },
        120 // 2 minutes — inventory and vendor data change frequently
      );

      return NextResponse.json(data);
    } catch (err: any) {
      console.error('[GET /api/erp/master/org] Error:', err);
      return NextResponse.json(
        { error: err.message ?? 'Failed to load org master data' },
        { status: 500 }
      );
    }
  },
  { feature: 'erp', roles: ['owner', 'admin', 'manager', 'staff'] }
);
