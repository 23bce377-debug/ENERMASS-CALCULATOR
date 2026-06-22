import { NextResponse } from 'next/server';
import { requireSuperAdminSession } from '@/lib/saas/services/managementService';
import { revokeActivationKey } from '@/lib/saas/services/activationKeyService';
import { enforceRateLimit } from '@/lib/security/rateLimit';
import { jsonForManagementError } from '@/lib/saas/managementApi';

interface RouteContext {
  params: Promise<{ keyId: string }>;
}

/**
 * POST /api/super-admin/activation-keys/[keyId]/revoke
 * Revokes an unused activation key. Activated keys cannot be revoked.
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await requireSuperAdminSession();
    const { keyId } = await context.params;

    const limited = await enforceRateLimit(request, {
      keyPrefix: 'sa-key-revoke',
      userId: session.user.id,
      limit: 30,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const revoked = await revokeActivationKey(keyId, session.user.id);
    return NextResponse.json({
      success: true,
      key: {
        id: revoked.id,
        org_id: revoked.org_id,
        key_prefix: revoked.key_prefix,
        status: revoked.status,
        revoked_at: revoked.revoked_at,
      },
    });
  } catch (error) {
    return jsonForManagementError(error);
  }
}
