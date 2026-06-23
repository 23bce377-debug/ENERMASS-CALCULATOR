import { NextResponse } from 'next/server';
import { withLicensedApiRoute } from '@/lib/auth/withLicensedApiRoute';
import { getOrSetCache } from '@/lib/cache/redisCache';

/**
 * GET /api/erp/master/equipment
 * Returns active equipment catalog: panels, inverters, batteries, meters,
 * lightning arresters, communication devices.
 *
 * Cached 10 minutes (equipment data changes rarely).
 * Projected columns only — no SELECT *.
 */
export const dynamic = 'force-dynamic';

export const GET = withLicensedApiRoute(
  async (_request, context) => {
    const orgId = context.session.orgId;
    const cacheKey = `erp:master:equipment:${orgId}`;

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

          const [panelsRes, invertersRes, batteriesRes, metersRes, laRes, commDevicesRes] =
            await Promise.all([
              safeQuery(
                supabase
                  .from('eq_panels')
                  .select(
                    'id, name, brand, watt_peak, voc, isc, dimensions, weight_kg, price, is_active, created_at'
                  )
                  .eq('is_active', true)
                  .order('watt_peak', { ascending: true })
              ),
              safeQuery(
                supabase
                  .from('eq_inverters')
                  .select(
                    'id, name, brand, capacity_kw, type, phases, efficiency, price, is_active, created_at'
                  )
                  .eq('is_active', true)
                  .order('capacity_kw', { ascending: true })
              ),
              safeQuery(
                supabase
                  .from('eq_batteries')
                  .select(
                    'id, name, brand, capacity_kwh, chemistry, voltage, price, is_active, created_at'
                  )
                  .eq('is_active', true)
              ),
              safeQuery(
                supabase
                  .from('eq_meters')
                  .select('id, name, brand, type, price, is_active')
                  .eq('is_active', true)
              ),
              safeQuery(
                supabase
                  .from('eq_lightning_arresters')
                  .select('id, name, brand, type, price, is_active')
                  .eq('is_active', true)
              ),
              safeQuery(
                supabase
                  .from('eq_communication_devices')
                  .select('id, name, brand, type, price, is_active')
                  .eq('is_active', true)
              ),
            ]);

          const coreErrors = [panelsRes, invertersRes, batteriesRes].filter(
            (res) => res?.error && res.error.code !== 'PGRST116'
          );
          if (coreErrors.length > 0) throw coreErrors[0].error;

          return {
            panels: panelsRes.data ?? [],
            inverters: invertersRes.data ?? [],
            batteries: batteriesRes.data ?? [],
            meters: metersRes.data ?? [],
            lightningArresters: laRes.data ?? [],
            commDevices: commDevicesRes.data ?? [],
          };
        },
        600 // 10 minutes
      );

      return NextResponse.json(data);
    } catch (err: any) {
      console.error('[GET /api/erp/master/equipment] Error:', err);
      return NextResponse.json(
        { error: err.message ?? 'Failed to load equipment master data' },
        { status: 500 }
      );
    }
  },
  { feature: 'erp', roles: ['owner', 'admin', 'manager', 'staff'] }
);
