import { NextResponse } from 'next/server';
import { jsonForManagementError } from '@/lib/saas/managementApi';
import { listOrgDevices, requireOrgManagementSession } from '@/lib/saas';

export async function GET() {
  try {
    const session = await requireOrgManagementSession(['owner', 'admin', 'manager']);
    return NextResponse.json({ devices: await listOrgDevices(session.orgId) });
  } catch (error) {
    return jsonForManagementError(error);
  }
}
