import { NextResponse } from 'next/server';
import { withAuthenticatedOrgApiRoute } from '@/lib/auth/withAuthenticatedOrgApiRoute';
import { createAdminClient } from '@/lib/supabase/server';
import { DeviceResetRequestRepository } from '@/lib/saas/repositories';
import { logLicenseEvent } from '@/lib/saas/services/licenseAuditService';

export const POST = withAuthenticatedOrgApiRoute(async (request, context) => {
  try {
    const { id } = await request.json() as { id?: string };

    if (!id) {
      return NextResponse.json({ error: 'MissingRequestID', message: 'Request ID is required' }, { status: 400 });
    }

    const repo = new DeviceResetRequestRepository(createAdminClient);
    const resetRequest = await repo.getById(id);

    if (!resetRequest) {
      return NextResponse.json({ error: 'NotFound', message: 'Reset request not found' }, { status: 404 });
    }

    // Security check: user can only cancel their own requests
    if (resetRequest.user_id !== context.session.user.id) {
      return NextResponse.json({ error: 'Unauthorized', message: 'Access denied' }, { status: 403 });
    }

    const cancelled = await repo.update(id, {
      status: 'cancelled',
      reviewed_by: context.session.user.id,
      reviewed_at: new Date().toISOString(),
    });

    await logLicenseEvent({
      orgId: context.session.orgId,
      userId: context.session.user.id,
      entityType: 'device_reset_request',
      entityId: id,
      eventType: 'device_reset_rejected', // using rejected/cancelled audit event
      eventData: { action: 'cancelled_by_user', oldDeviceId: resetRequest.old_device_id },
    });

    return NextResponse.json({
      success: true,
      id: cancelled.id,
      status: cancelled.status,
    });
  } catch (error) {
    console.error('Failed to cancel reset request:', error);
    return NextResponse.json({ error: 'InternalServerError', message: 'Internal server error' }, { status: 500 });
  }
});
