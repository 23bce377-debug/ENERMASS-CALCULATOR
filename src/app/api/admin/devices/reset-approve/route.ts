import { NextResponse } from 'next/server';
import { requireSuperAdminSession } from '@/lib/saas/services/managementService';
import { approveDeviceReset } from '@/lib/saas/services/deviceResetService';
import { jsonForManagementError } from '@/lib/saas/managementApi';
import {
  adminResetPayloadSchema,
  parseJsonBody,
} from '@/lib/device-binding/http';

export async function POST(request: Request) {
  try {
    const session = await requireSuperAdminSession();
    const body = await parseJsonBody(request, adminResetPayloadSchema);
    const resetRequest = await approveDeviceReset(body.request_id, session.user.id);

    return NextResponse.json({
      request: {
        id: resetRequest.id,
        status: resetRequest.status,
        reviewed_by: resetRequest.reviewed_by,
        reviewed_at: resetRequest.reviewed_at,
      },
    });
  } catch (error) {
    return jsonForManagementError(error);
  }
}
