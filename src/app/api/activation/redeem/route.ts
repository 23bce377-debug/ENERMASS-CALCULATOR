import { NextResponse } from 'next/server';
import { checkRateLimit, rateLimitResponse, requestIpForRateLimit } from '@/lib/security/rateLimit';
import { redeemActivationKey } from '@/lib/saas/services/activationKeyService';

const DEVICE_TOKEN_COOKIE = 'enermass_device_token';

/**
 * POST /api/activation/redeem
 * Public endpoint — no auth required (this creates the user account).
 * Rate limited: 3 requests per 15 minutes per IP.
 *
 * Body: { key, full_name, email, password, phone?, device_name?, browser?, os? }
 * Response: { success, role, orgId, message }
 * Sets HttpOnly device token cookie on success.
 */
export async function POST(request: Request) {
  const ip = requestIpForRateLimit(request);
  const rl = checkRateLimit({ key: `activation-redeem:${ip}`, limit: 3, windowMs: 15 * 60 * 1000 });
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
    };

    if (!body.key || !body.full_name || !body.email || !body.password) {
      return NextResponse.json(
        { success: false, message: 'key, full_name, email, and password are required.' },
        { status: 400 }
      );
    }

    const result = await redeemActivationKey({
      rawKey: body.key,
      fullName: body.full_name,
      email: body.email,
      password: body.password,
      phone: body.phone ?? null,
      deviceName: body.device_name ?? null,
      browser: body.browser ?? null,
      os: body.os ?? null,
    });

    const response = NextResponse.json({
      success: true,
      userId: result.userId,
      orgId: result.orgId,
      role: result.role,
      message: result.role === 'owner'
        ? 'Account created. You are the organisation administrator.'
        : 'Account created. You are a member of this organisation.',
    });

    // Set device token cookie — 10 year expiry
    const expires = new Date();
    expires.setFullYear(expires.getFullYear() + 10);

    response.cookies.set({
      name: DEVICE_TOKEN_COOKIE,
      value: result.deviceToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires,
    });

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Activation failed. Please try again.';
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
