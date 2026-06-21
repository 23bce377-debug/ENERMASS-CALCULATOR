import { NextResponse } from 'next/server';
import { withAuthenticatedOrgApiRoute } from '@/lib/auth/withAuthenticatedOrgApiRoute';
import { getBillingOverview } from '@/lib/saas';

export const GET = withAuthenticatedOrgApiRoute(async (request, context) => {
  try {
    const { orgId } = context.session;
    const overview = await getBillingOverview(orgId);
    
    return NextResponse.json({
      plan: overview.plan,
      subscription: overview.subscription,
      features: overview.plan?.features ?? {},
      seatUsage: overview.seatUsage,
    });
  } catch (error) {
    console.error('Failed to get subscription:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
