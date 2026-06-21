import { NextResponse } from 'next/server';
import { requireSuperAdminSession } from '@/lib/saas/services/managementService';
import { generateActivationKeys } from '@/lib/saas/services/activationKeyService';
import { enforceRateLimit } from '@/lib/security/rateLimit';
import { jsonForManagementError } from '@/lib/saas/managementApi';
import { z } from 'zod';

const schema = z.object({
  orgId: z.string().uuid(),
  count: z.number().int().min(1).max(100),
  expiresAt: z.string().datetime().optional(),
});

/**
 * POST /api/super-admin/activation-keys/generate
 * Super admin only.
 * Generates N activation keys for an org and returns raw keys (ONE TIME ONLY).
 */
export async function POST(request: Request) {
  try {
    const session = await requireSuperAdminSession();

    const limited = enforceRateLimit(request, {
      keyPrefix: 'sa-key-generate',
      userId: session.user.id,
      limit: 20,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = await request.json();
    const payload = schema.safeParse(body);
    if (!payload.success) {
      return NextResponse.json({ error: 'Invalid input', details: payload.error.flatten() }, { status: 400 });
    }

    const result = await generateActivationKeys({
      orgId: payload.data.orgId,
      count: payload.data.count,
      createdBy: session.user.id,
      expiresAt: payload.data.expiresAt,
    });

    return NextResponse.json({
      success: true,
      batchId: result.batchId,
      orgId: result.orgId,
      count: result.keys.length,
      // Raw keys — shown ONCE. Never stored in plaintext again.
      keys: result.keys.map(k => ({ id: k.id, key: k.rawKey, prefix: k.prefix })),
      warning: 'These activation keys will not be shown again. Copy them now.',
    });
  } catch (error) {
    return jsonForManagementError(error);
  }
}
