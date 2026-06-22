import { NextResponse } from 'next/server';
import { jsonForManagementError } from '@/lib/saas/managementApi';
import { requireOrgManagementSession, revokeOrgDeviceAsAdmin } from '@/lib/saas/services/managementService';

export async function POST(_request: Request, context: { params: Promise<{ deviceId: string }> }) {
  try {
    const [{ deviceId }, session] = await Promise.all([
      context.params,
      requireOrgManagementSession(['owner', 'admin', 'manager']),
    ]);
    const device = await revokeOrgDeviceAsAdmin(session.orgId, session.user.id, deviceId);
    return NextResponse.json({ device });
  } catch (error) {
    return jsonForManagementError(error);
  }
}
