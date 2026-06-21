import { NextResponse } from 'next/server';
import { jsonForManagementError } from '@/lib/saas/managementApi';
import { approveOrgDeviceResetAsAdmin, requireOrgManagementSession } from '@/lib/saas';

export async function POST(_request: Request, context: { params: Promise<{ requestId: string }> }) {
  try {
    const [{ requestId }, session] = await Promise.all([
      context.params,
      requireOrgManagementSession(['owner', 'admin', 'manager']),
    ]);
    const request = await approveOrgDeviceResetAsAdmin(session.orgId, session.user.id, requestId);
    return NextResponse.json({ request });
  } catch (error) {
    return jsonForManagementError(error);
  }
}
