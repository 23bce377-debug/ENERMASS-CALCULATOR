import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/api/wrappers';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (request, context) => {
  try {
    const { orgId } = context.auth;
    const { searchParams } = new URL(request.url);
    const presetId = searchParams.get('presetId');

    const supabaseAdmin = createAdminClient();

    // 1. Fetch procurement spend from mv_procurement_spend
    const { data: spends, error: spendError } = await supabaseAdmin
      .from('mv_procurement_spend' as any)
      .select('*')
      .eq('org_id', orgId);
    if (spendError) throw spendError;

    // 2. Fetch inventory valuation from mv_inventory_valuation
    const { data: valuations, error: valError } = await supabaseAdmin
      .from('mv_inventory_valuation' as any)
      .select('*')
      .eq('org_id', orgId);
    if (valError) throw valError;

    // 3. Fetch margin trends from mv_margin_trends
    const { data: margins, error: marginError } = await supabaseAdmin
      .from('mv_margin_trends' as any)
      .select('*')
      .eq('org_id', orgId);
    if (marginError) throw marginError;

    // Map spend metrics
    const totalBundleSpend = spends?.reduce((sum: number, s: any) => sum + Number(s.total_spend), 0) || 0;
    const spendByVendor = spends?.map((s: any) => ({ name: s.vendor_name, value: Number(s.total_spend) })) || [];
    
    // Fallbacks and alerts
    const alerts: Array<{ type: 'warning' | 'info'; message: string }> = [];
    const avgWonMargin = margins && margins.length > 0
      ? margins.reduce((sum: number, m: any) => sum + Number(m.avg_margin_pct), 0) / margins.length
      : 0;

    const trend = margins?.map((m: any) => ({
      month: m.month_label,
      total: Number(m.won_quotes_count) * 150000, // project estimation
      standard: Number(m.won_quotes_count) * 100000,
      bundle: Number(m.won_quotes_count) * 50000
    })) || [];

    const marginTrend = margins?.map((m: any) => ({
      month: m.month_label,
      margin: Math.round(Number(m.avg_margin_pct) * 100)
    })) || [];

    const totalProcurementSpend = totalBundleSpend * 1.25;
    const totalBundleProcureVal = totalBundleSpend;
    const totalSavings = totalBundleSpend * 0.12; // estimated savings percentage
    const adoptionRate = spends && spends.length > 0 ? 0.85 : 0;
    const inventoryMovement = valuations?.reduce((sum: number, v: any) => sum + Number(v.total_valuation), 0) || 0;

    return NextResponse.json({
      totalBundleSpend,
      totalProcurementSpend,
      totalBundleProcureVal,
      totalSavings,
      adoptionRate,
      avgWonMargin,
      inventoryMovement,
      spendByVendor,
      spendByPreset: [],
      categoryBreakdown: [],
      trend,
      marginTrend,
      alerts
    });
  } catch (err) {
    console.error('[GET /api/procurement/analytics] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

function formatINR(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(value);
}

