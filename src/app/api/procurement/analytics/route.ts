import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withLicensedApiRoute } from '@/lib/auth/withLicensedApiRoute';
import { z } from 'zod';

const analyticsQuerySchema = z.object({
  presetId: z.string().optional().nullable(),
});

export const dynamic = 'force-dynamic';

export const GET = withLicensedApiRoute(async (request, context) => {
  try {
    const { orgId } = context.session;
    const { searchParams } = new URL(request.url);
    const parseResult = analyticsQuerySchema.safeParse(Object.fromEntries(searchParams.entries()));
    if (!parseResult.success) {
      return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 });
    }
    const { presetId } = parseResult.data;

    const supabase = await createClient();

    // 1. Fetch procurement spend from mv_procurement_spend
    const { data: spends, error: spendError } = await supabase
      .from('mv_procurement_spend' as any)
      .select('*')
      .eq('org_id', orgId);
    if (spendError) throw spendError;

    // 2. Fetch inventory valuation from mv_inventory_valuation
    const { data: valuations, error: valError } = await supabase
      .from('mv_inventory_valuation' as any)
      .select('*')
      .eq('org_id', orgId);
    if (valError) throw valError;

    // 3. Fetch margin trends from mv_margin_trends
    const { data: margins, error: marginError } = await supabase
      .from('mv_margin_trends' as any)
      .select('*')
      .eq('org_id', orgId);
    if (marginError) throw marginError;

    // 4. Fetch purchase requests from the canonical procurement table for adoptionRate
    const { data: prs, error: prError } = await supabase
      .from('proc_purchase_orders' as any)
      .select('pr_status')
      .eq('org_id', orgId)
      .in('pr_status', ['draft', 'pending', 'approved', 'rejected', 'po_generated']);
    if (prError) throw prError;
    
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
      total: Number(m.won_quotes_count),
      standard: Number(m.won_quotes_count),
      bundle: 0
    })) || [];

    const marginTrend = margins?.map((m: any) => ({
      month: m.month_label,
      margin: Math.round(Number(m.avg_margin_pct) * 100)
    })) || [];

    const totalProcurementSpend = totalBundleSpend;
    const totalBundleProcureVal = totalBundleSpend;
    
    // Compute adoptionRate from real PR data
    let adoptionRate = 0;
    if (prs && prs.length > 0) {
      const adoptedCount = prs.filter((pr: any) => pr.pr_status === 'po_generated').length;
      adoptionRate = adoptedCount / prs.length;
    }
    
    const inventoryMovement = valuations?.reduce((sum: number, v: any) => sum + Number(v.total_valuation), 0) || 0;

    return NextResponse.json({
      totalBundleSpend,
      totalProcurementSpend,
      totalBundleProcureVal,
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
}, {
  feature: 'inventory',
  roles: ['owner', 'admin', 'manager', 'staff'],
});

function formatINR(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(value);
}
