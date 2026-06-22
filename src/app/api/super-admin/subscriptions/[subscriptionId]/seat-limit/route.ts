import { NextResponse } from 'next/server';
import { jsonForManagementError, parseJson } from '@/lib/saas/managementApi';
import { requireSuperAdminSession, setSubscriptionSeatLimitAsSuperAdmin } from '@/lib/saas/services/managementService';

export async function PATCH(request: Request, context: { params: Promise<{ subscriptionId: string }> }) {
  try {
    const [{ subscriptionId }, body] = await Promise.all([
      context.params,
      parseJson(request),
      requireSuperAdminSession(),
    ]);
    const subscription = await setSubscriptionSeatLimitAsSuperAdmin(subscriptionId, Number(body.seat_limit ?? body.seatLimit ?? 1));
    return NextResponse.json({ subscription });
  } catch (error) {
    return jsonForManagementError(error);
  }
}
