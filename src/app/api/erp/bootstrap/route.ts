import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/api/wrappers';
import { getOrSetCache } from '@/lib/cache/redisCache';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (request, context) => {
  const { orgId } = context.auth;
  if (!orgId) {
    return NextResponse.json({ error: 'Unauthorized: No org_id associated with profile' }, { status: 401 });
  }

  try {
    const data = await getOrSetCache(`erp:bootstrap:${orgId}`, async () => {
      const supabaseAdmin = createAdminClient();

      const [
        panelsRes,
        invertersRes,
        batteriesRes,
        metersRes,
        laRes,
        structuresRes,
        bomItemsRes,
        commDevicesRes,
        systemsRes,
        weightLookupsRes,
        stateRulesRes,
        slabsRes,
        schemesRes,
        inventoryRes,
        vendorsRes,
        quotesRes
      ] = await Promise.all([
        supabaseAdmin.from('eq_panels').select('*').or(`org_id.eq.${orgId},org_id.is.null`).eq('is_active', true),
        supabaseAdmin.from('eq_inverters').select('*').or(`org_id.eq.${orgId},org_id.is.null`).eq('is_active', true),
        supabaseAdmin.from('eq_batteries').select('*').or(`org_id.eq.${orgId},org_id.is.null`).eq('is_active', true),
        supabaseAdmin.from('eq_meters').select('*').or(`org_id.eq.${orgId},org_id.is.null`).eq('is_active', true),
        supabaseAdmin.from('eq_lightning_arresters').select('*').or(`org_id.eq.${orgId},org_id.is.null`).eq('is_active', true),
        supabaseAdmin.from('eq_mounting_structures').select('*').or(`org_id.eq.${orgId},org_id.is.null`).eq('is_active', true),
        supabaseAdmin.from('eq_bom_items').select('*').or(`org_id.eq.${orgId},org_id.is.null`).eq('is_active', true),
        supabaseAdmin.from('eq_communication_devices').select('*').or(`org_id.eq.${orgId},org_id.is.null`).eq('is_active', true),
        supabaseAdmin.from('systems').select('*, system_items(*)').or(`org_id.eq.${orgId},org_id.is.null`).eq('is_active', true),
        supabaseAdmin.from('structure_weight_lookup').select('*'),
        supabaseAdmin.from('state_rules').select('*').eq('is_active', true),
        supabaseAdmin.from('scheme_slabs').select('*'),
        supabaseAdmin.from('calculation_schemes').select('*').eq('is_active', true),
        supabaseAdmin.from('inventory_summary').select('*').eq('org_id', orgId),
        supabaseAdmin.from('vendors').select('*').eq('org_id', orgId).order('name', { ascending: true }),
        supabaseAdmin.from('quotes').select('*, quote_items(*), quote_additional_costs(*)').eq('org_id', orgId).order('created_at', { ascending: false })
      ]);

      if (panelsRes.error) throw panelsRes.error;
      if (invertersRes.error) throw invertersRes.error;
      if (batteriesRes.error) throw batteriesRes.error;
      if (metersRes.error) throw metersRes.error;
      if (laRes.error) throw laRes.error;
      if (structuresRes.error) throw structuresRes.error;
      if (bomItemsRes.error) throw bomItemsRes.error;
      if (commDevicesRes.error) throw commDevicesRes.error;
      if (systemsRes.error) throw systemsRes.error;
      if (weightLookupsRes.error) throw weightLookupsRes.error;
      if (stateRulesRes.error) throw stateRulesRes.error;
      if (slabsRes.error) throw slabsRes.error;
      if (schemesRes.error) throw schemesRes.error;
      if (inventoryRes.error) throw inventoryRes.error;
      if (vendorsRes.error) throw vendorsRes.error;
      if (quotesRes.error) throw quotesRes.error;

      return {
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
        quotes: quotesRes.data || []
      };
    }, 300); // Cache for 5 minutes

    return NextResponse.json(data);
  } catch (err: any) {
    console.error('[GET /api/erp/bootstrap] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error during bootstrap load' }, { status: 500 });
  }
});
