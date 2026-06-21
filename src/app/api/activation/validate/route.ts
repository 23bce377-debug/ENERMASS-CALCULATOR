import { NextResponse } from 'next/server';
import { checkRateLimit, rateLimitResponse, requestIpForRateLimit } from '@/lib/security/rateLimit';
import { validateActivationKey } from '@/lib/saas/services/activationKeyService';

/**
 * POST /api/activation/validate
 * Public endpoint — no auth required.
 * Rate limited: 5 requests per 10 minutes per IP.
 */
export async function POST(request: Request) {
  const ip = requestIpForRateLimit(request);
  const rl = checkRateLimit({ key: `activation-validate:${ip}`, limit: 5, windowMs: 10 * 60 * 1000 });
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  try {
    const body = await request.json() as { key?: string };
    const rawKey = typeof body.key === 'string' ? body.key.trim() : '';

    if (!rawKey) {
      return NextResponse.json({ valid: false, reason: 'Activation key is required.' }, { status: 400 });
    }

    const result = await validateActivationKey(rawKey);
    return NextResponse.json(result, { status: result.valid ? 200 : 400 });
  } catch {
    return NextResponse.json({ valid: false, reason: 'Validation failed. Please try again.' }, { status: 500 });
  }
}
