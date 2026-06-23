import { NextResponse } from 'next/server';
import { withAuthenticatedOrgApiRoute } from '@/lib/auth/withAuthenticatedOrgApiRoute';
import { createAdminClient } from '@/lib/supabase/server';
import { DeviceResetRequestRepository } from '@/lib/saas/repositories';

export const GET = withAuthenticatedOrgApiRoute(async (request, context) => {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'MissingRequestID', message: 'Request ID is required' }, { status: 400 });
    }

    const repo = new DeviceResetRequestRepository(createAdminClient);
    const resetRequest = await repo.getById(id);

    if (!resetRequest) {
      return NextResponse.json({ error: 'NotFound', message: 'Reset request not found' }, { status: 404 });
    }

    // Secure checking: only allow the owner or admin of the request's org, or the requesting user themselves
    if (resetRequest.user_id !== context.session.user.id && resetRequest.org_id !== context.session.orgId) {
      return NextResponse.json({ error: 'Unauthorized', message: 'Access denied' }, { status: 403 });
    }

    return NextResponse.json({
      id: resetRequest.id,
      status: resetRequest.status,
      requested_at: resetRequest.requested_at,
    });
  } catch (error) {
    console.error('Failed to get reset request status:', error);
    return NextResponse.json({ error: 'InternalServerError', message: 'Internal server error' }, { status: 500 });
  }
});
