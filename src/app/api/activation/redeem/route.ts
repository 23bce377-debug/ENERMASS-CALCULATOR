import { NextResponse } from 'next/server';
import { checkRateLimit, rateLimitResponse, requestIpForRateLimit } from '@/lib/security/rateLimit';
import { redeemActivationKey } from '@/lib/saas/services/activationKeyService';
import { hashActivationKey } from '@/lib/saas/services/activationKeyCrypto';
import { verifyWebAuthnChallenge, verifyWebAuthnRegistration } from '@/lib/security/webauthn';

const DEVICE_TOKEN_COOKIE = 'enermass_device_token';

/**
 * POST /api/activation/redeem
 * Public endpoint — no auth required (this creates the user account).
 * Rate limited: 3 requests per 15 minutes per IP.
 *
 * Body: { key, full_name, email, password, phone?, device_name?, browser?, os?, webauthn_registration }
 * Response: { success, role, orgId, message }
 * Sets HttpOnly device token cookie on success.
 */
export async function POST(request: Request) {
  const ip = requestIpForRateLimit(request);
  const rl = await checkRateLimit({ key: `activation-redeem:${ip}`, limit: 3, windowMs: 15 * 60 * 1000 });
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  try {
    const body = await request.json() as {
      key?: string;
      full_name?: string;
      email?: string;
      password?: string;
      phone?: string | null;
      device_name?: string | null;
      browser?: string | null;
      os?: string | null;
      fingerprint_hash?: string | null;
      webauthn_registration?: {
        id: string;
        rawId: string;
        clientDataJSON: string;
        attestationObject: string;
      } | null;
    };

    if (!body.key || !body.full_name || !body.email || !body.password) {
      return NextResponse.json(
        { success: false, message: 'key, full_name, email, and password are required.' },
        { status: 400 }
      );
    }

    if (!body.webauthn_registration) {
      return NextResponse.json(
        { success: false, message: 'WebAuthn registration (passkey binding) is required.' },
        { status: 400 }
      );
    }

    // Decode and verify challenge from clientDataJSON
    let challenge: string;
    try {
      const clientDataStr = Buffer.from(body.webauthn_registration.clientDataJSON, 'base64url').toString('utf8');
      const clientData = JSON.parse(clientDataStr) as { challenge: string };
      challenge = clientData.challenge;
    } catch {
      return NextResponse.json({ success: false, message: 'Invalid clientDataJSON structure.' }, { status: 400 });
    }

    const keyHash = hashActivationKey(body.key);
    if (!verifyWebAuthnChallenge(challenge, keyHash)) {
      return NextResponse.json({ success: false, message: 'WebAuthn challenge expired or invalid.' }, { status: 400 });
    }

    const host = request.headers.get('host') || 'localhost';
    const expectedOrigin = host.split(':')[0];

    const verification = await verifyWebAuthnRegistration(
      body.webauthn_registration,
      challenge,
      expectedOrigin
    );

    if (!verification.success) {
      return NextResponse.json({ success: false, message: `WebAuthn verification failed: ${verification.error}` }, { status: 400 });
    }

    const publicKeyJwkStr = JSON.stringify(verification.publicKeyJwk);

    const result = await redeemActivationKey({
      rawKey: body.key,
      fullName: body.full_name,
      email: body.email,
      password: body.password,
      phone: body.phone ?? null,
      deviceName: body.device_name ?? null,
      browser: body.browser ?? null,
      os: body.os ?? null,
      publicKey: publicKeyJwkStr,
      fingerprintHash: body.fingerprint_hash ?? null,
    });

    const response = NextResponse.json({
      success: true,
      userId: result.userId,
      orgId: result.orgId,
      role: result.role,
      deviceToken: result.deviceToken, // Return the secret key to be stored on device
      message: result.role === 'owner'
        ? 'Account created. You are the organisation administrator.'
        : 'Account created. You are a member of this organisation.',
    });

    // Set transient session device token cookie
    // HttpOnly: prevents JS access; Secure: HTTPS only in prod; SameSite=Strict: CSRF protection
    response.cookies.set({
      name: DEVICE_TOKEN_COOKIE,
      value: result.deviceToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    });

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Activation failed. Please try again.';
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
