import { NextResponse } from 'next/server';
import { jsonForManagementError } from '@/lib/saas/managementApi';
import { listSuperAdminDeviceResets, requireSuperAdminSession } from '@/lib/saas/services/managementService';

export async function GET() {
  try {
    await requireSuperAdminSession();
    return NextResponse.json({ resets: await listSuperAdminDeviceResets() });
  } catch (error) {
    return jsonForManagementError(error);
  }
}
