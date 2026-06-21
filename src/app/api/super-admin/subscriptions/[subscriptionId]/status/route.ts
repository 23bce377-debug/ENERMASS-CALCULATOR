import { NextResponse } from 'next/server';
import { jsonForManagementError, parseJson } from '@/lib/saas/managementApi';
import { changeSubscriptionStatusAsSuperAdmin, requireSuperAdminSession, type SubscriptionStatus } from '@/lib/saas';

export async function PATCH(request: Request, context: { params: Promise<{ subscriptionId: string }> }) {
  try {
    const [{ subscriptionId }, body] = await Promise.all([
      context.params,
      parseJson(request),
      requireSuperAdminSession(),
    ]);
    const subscription = await changeSubscriptionStatusAsSuperAdmin(subscriptionId, String(body.status ?? 'active') as SubscriptionStatus);
    return NextResponse.json({ subscription });
  } catch (error) {
    return jsonForManagementError(error);
  }
}
