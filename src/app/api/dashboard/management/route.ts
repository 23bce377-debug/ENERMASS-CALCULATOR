import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/api/wrappers';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (request, context) => {
  try {
    const { orgId } = context.auth;
    const supabase = await createClient();

    // 1. Total Revenue (YTD) - from quotes
    const { data: revenueData, error: revError } = await supabase
      .from('quotes')
      .select('total_inc_gst')
      .eq('org_id', orgId)
      .eq('status', 'won');
    if (revError) throw revError;
    const totalRevenue = revenueData?.reduce((acc, q) => acc + Number(q.total_inc_gst || 0), 0) || 0;

    // 2. Avg Margin - from quotes
    const { data: marginData, error: marginError } = await supabase
      .from('quotes')
      .select('margin_pct')
      .eq('org_id', orgId)
      .eq('status', 'won');
    if (marginError) throw marginError;
    const avgMargin = marginData && marginData.length > 0
      ? marginData.reduce((acc, q) => acc + Number(q.margin_pct || 0), 0) / marginData.length
      : 0;

    // 3. Active Projects - from quotes or projects. Fallback to won quotes count if projects table not mapped yet
    const { count: activeProjectsCount, error: projError } = await supabase
      .from('quotes')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('status', 'won');
    if (projError) throw projError;

    // 4. Project Profitability
    const { data: profitabilityData, error: profError } = await supabase
      .from('v_project_profitability')
      .select('*')
      .eq('org_id', orgId)
      .limit(10);
    if (profError) throw profError;

    return NextResponse.json({
      totalRevenue,
      avgMargin,
      activeProjectsCount: activeProjectsCount || 0,
      profitability: profitabilityData || []
    });
  } catch (err) {
    console.error('[GET /api/dashboard/management] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
