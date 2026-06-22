import { NextResponse } from 'next/server';
import { requireSuperAdminSession } from '@/lib/saas/services/managementService';
import { listAllActivationKeys } from '@/lib/saas/services/activationKeyService';
import { enforceRateLimit } from '@/lib/security/rateLimit';
import { jsonForManagementError } from '@/lib/saas/managementApi';

/**
 * GET /api/super-admin/activation-keys
 * Returns all activation keys (masked — no raw key, no ciphertext) across all orgs.
 */
export async function GET(request: Request) {
  try {
    const session = await requireSuperAdminSession();

    const limited = await enforceRateLimit(request, {
      keyPrefix: 'sa-key-list',
      userId: session.user.id,
      limit: 60,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const keys = await listAllActivationKeys();
    return NextResponse.json({ keys });
  } catch (error) {
    return jsonForManagementError(error);
  }
}
