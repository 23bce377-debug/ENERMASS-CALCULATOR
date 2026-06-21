import { NextResponse } from 'next/server';
import { withAuthenticatedOrgApiRoute } from '@/lib/auth/withAuthenticatedOrgApiRoute';
import { listPasswordResetRequests } from '@/lib/saas/services/passwordResetService';

/**
 * GET /api/settings/password-resets
 * Org admin only. Lists all password reset requests for the org.
 */
export const GET = withAuthenticatedOrgApiRoute(
  async (_request, context) => {
    try {
      const requests = await listPasswordResetRequests(context.session.orgId);
      return NextResponse.json({ requests });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load password reset requests.';
      return NextResponse.json({ error: message }, { status: 500 });
    }
  },
  { roles: ['owner', 'admin'] }
);
