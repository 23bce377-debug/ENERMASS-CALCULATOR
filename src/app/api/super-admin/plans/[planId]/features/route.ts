import { NextResponse } from 'next/server';
import { jsonForManagementError, parseJson } from '@/lib/saas/managementApi';
import { requireSuperAdminSession, updatePlanFeaturesAsSuperAdmin } from '@/lib/saas/services/managementService';

export async function PATCH(request: Request, context: { params: Promise<{ planId: string }> }) {
  try {
    const [{ planId }, body] = await Promise.all([
      context.params,
      parseJson(request),
      requireSuperAdminSession(),
    ]);
    const plan = await updatePlanFeaturesAsSuperAdmin(planId, body.features ?? {}, body.is_active ?? body.isActive);
    return NextResponse.json({ plan });
  } catch (error) {
    return jsonForManagementError(error);
  }
}
