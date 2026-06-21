import { NextResponse } from 'next/server';
import { withAuthenticatedOrgApiRoute } from '@/lib/auth/withAuthenticatedOrgApiRoute';
import { approvePasswordResetRequest, rejectPasswordResetRequest } from '@/lib/saas/services/passwordResetService';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/settings/password-resets/[id]/approve
 * Org admin only. Approves a password reset request and sends the Supabase reset email.
 */
export const POST = withAuthenticatedOrgApiRoute<RouteContext>(
  async (_request, context) => {
    try {
      const { id } = await context.route.params;
      await approvePasswordResetRequest(id, context.session.user.id);
      return NextResponse.json({ success: true, message: 'Password reset link has been sent to the user.' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to approve password reset.';
      return NextResponse.json({ error: message }, { status: 400 });
    }
  },
  { roles: ['owner', 'admin'] }
);
