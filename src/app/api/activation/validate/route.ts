import { NextResponse } from 'next/server';
import { checkRateLimit, rateLimitResponse, requestIpForRateLimit } from '@/lib/security/rateLimit';
import { validateActivationKey } from '@/lib/saas/services/activationKeyService';
import { hashActivationKey } from '@/lib/saas/services/activationKeyCrypto';
import { generateWebAuthnChallenge } from '@/lib/security/webauthn';

/**
 * POST /api/activation/validate
 * Public endpoint — no auth required.
 * Rate limited: 5 requests per 10 minutes per IP.
 */
export async function POST(request: Request) {
  const ip = requestIpForRateLimit(request);
  const rl = await checkRateLimit({ key: `activation-validate:${ip}`, limit: 5, windowMs: 10 * 60 * 1000 });
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  try {
    const body = await request.json() as { key?: string };
    const rawKey = typeof body.key === 'string' ? body.key.trim() : '';

    if (!rawKey) {
      return NextResponse.json({ valid: false, reason: 'Activation key is required.' }, { status: 400 });
    }

    const result = await validateActivationKey(rawKey);
    if (result.valid) {
      const keyHash = hashActivationKey(rawKey);
      const challenge = generateWebAuthnChallenge(keyHash);
      const origin = request.headers.get('host') || 'localhost';

      return NextResponse.json({
        ...result,
        challenge,
        rpName: 'Enermass SaaS',
        rpId: origin.split(':')[0],
      }, { status: 200 });
    }

    return NextResponse.json(result, { status: 400 });
  } catch {
    return NextResponse.json({ valid: false, reason: 'Validation failed. Please try again.' }, { status: 500 });
  }
}
