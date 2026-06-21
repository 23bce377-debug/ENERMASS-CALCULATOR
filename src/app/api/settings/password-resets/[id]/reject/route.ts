import { NextResponse } from 'next/server';
import { withAuthenticatedOrgApiRoute } from '@/lib/auth/withAuthenticatedOrgApiRoute';
import { rejectPasswordResetRequest } from '@/lib/saas/services/passwordResetService';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/settings/password-resets/[id]/reject
 * Org admin only. Rejects a password reset request.
 */
export const POST = withAuthenticatedOrgApiRoute<RouteContext>(
  async (_request, context) => {
    try {
      const { id } = await context.route.params;
      await rejectPasswordResetRequest(id, context.session.user.id);
      return NextResponse.json({ success: true, message: 'Password reset request rejected.' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to reject password reset.';
      return NextResponse.json({ error: message }, { status: 400 });
    }
  },
  { roles: ['owner', 'admin'] }
);
