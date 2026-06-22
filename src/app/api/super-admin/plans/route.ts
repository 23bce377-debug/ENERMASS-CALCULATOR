import { NextResponse } from 'next/server';
import { jsonForManagementError, parseJson } from '@/lib/saas/managementApi';
import { createPlanAsSuperAdmin, listSuperAdminPlans, requireSuperAdminSession } from '@/lib/saas/services/managementService';

export async function GET() {
  try {
    await requireSuperAdminSession();
    return NextResponse.json({ plans: await listSuperAdminPlans() });
  } catch (error) {
    return jsonForManagementError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireSuperAdminSession();
    const body = await parseJson(request);
    const plan = await createPlanAsSuperAdmin({
      name: String(body.name ?? ''),
      code: String(body.code ?? ''),
      monthlyPrice: Number(body.monthly_price ?? body.monthlyPrice ?? 0),
      yearlyPrice: Number(body.yearly_price ?? body.yearlyPrice ?? 0),
      seatLimit: Number(body.seat_limit ?? body.seatLimit ?? 1),
      features: body.features ?? {},
      isActive: body.is_active ?? body.isActive ?? true,
    });
    return NextResponse.json({ plan }, { status: 201 });
  } catch (error) {
    return jsonForManagementError(error);
  }
}
