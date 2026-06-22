import { NextResponse } from 'next/server';
import { jsonForManagementError } from '@/lib/saas/managementApi';
import { listOrgDeviceResetRequests, requireOrgManagementSession } from '@/lib/saas/services/managementService';

export async function GET() {
  try {
    const session = await requireOrgManagementSession(['owner', 'admin', 'manager']);
    return NextResponse.json({ requests: await listOrgDeviceResetRequests(session.orgId) });
  } catch (error) {
    return jsonForManagementError(error);
  }
}
