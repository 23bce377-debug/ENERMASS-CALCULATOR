import { NextResponse } from 'next/server';
import { requireSuperAdminSession } from '@/lib/saas/services/managementService';
import { generateActivationKeys } from '@/lib/saas/services/activationKeyService';
import { enforceRateLimit } from '@/lib/security/rateLimit';
import { jsonForManagementError } from '@/lib/saas/managementApi';
import { createAdminClient } from '@/lib/supabase/server';
import z from 'zod';

const schema = z.object({
  orgId: z.string().uuid().optional(),
  count: z.number().int().min(1).max(100),
  maxUses: z.number().int().min(1).max(9999).optional(),
  expiresAt: z.string().datetime({ offset: true }).optional(),
});

/**
 * POST /api/super-admin/activation-keys/generate
 * Super admin only.
 * Generates N activation keys for an org and returns raw keys (ONE TIME ONLY).
 */
export async function POST(request: Request) {
  try {
    const session = await requireSuperAdminSession();

    const limited = await enforceRateLimit(request, {
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

    let orgId = payload.data.orgId;
    if (!orgId) {
      const client = createAdminClient();
      const { data: orgs } = await client.from('organisations').select('id').limit(1);
      if (orgs && orgs.length > 0) {
        orgId = orgs[0].id;
      } else {
        // Create fallback system tenant if none exists
        const { data: newOrg, error: createOrgError } = await client
          .from('organisations')
          .insert({
            name: 'Enermass Solar Org',
            quote_counter: 1000,
            quote_prefix: 'QM',
            version: 1
          })
          .select('id')
          .single();
        if (createOrgError) throw createOrgError;
        orgId = newOrg.id;
      }
    }

    const result = await generateActivationKeys({
      orgId,
      count: payload.data.count,
      maxUses: payload.data.maxUses ?? 5,
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
