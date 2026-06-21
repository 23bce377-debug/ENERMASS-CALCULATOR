import { NextResponse } from 'next/server';
import { jsonForManagementError, parseJson } from '@/lib/saas/managementApi';
import {
  assignPlanAsSuperAdmin,
  listSuperAdminSubscriptions,
  requireSuperAdminSession,
  type BillingCycle,
  type SubscriptionStatus,
} from '@/lib/saas';

export async function GET() {
  try {
    await requireSuperAdminSession();
    return NextResponse.json({ subscriptions: await listSuperAdminSubscriptions() });
  } catch (error) {
    return jsonForManagementError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireSuperAdminSession();
    const body = await parseJson(request);
    const subscription = await assignPlanAsSuperAdmin({
      orgId: String(body.org_id ?? body.orgId ?? ''),
      planId: String(body.plan_id ?? body.planId ?? ''),
      seatLimit: Number(body.seat_limit ?? body.seatLimit ?? 1),
      billingCycle: String(body.billing_cycle ?? body.billingCycle ?? 'monthly') as BillingCycle,
      status: String(body.status ?? 'active') as SubscriptionStatus,
    });
    return NextResponse.json({ subscription }, { status: 201 });
  } catch (error) {
    return jsonForManagementError(error);
  }
}
