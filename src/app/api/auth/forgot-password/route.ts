import { NextResponse } from 'next/server';
import { checkRateLimit, rateLimitResponse, requestIpForRateLimit } from '@/lib/security/rateLimit';
import { requestPasswordReset } from '@/lib/saas/services/passwordResetService';

/**
 * POST /api/auth/forgot-password
 * Public endpoint — no auth required.
 * Rate limited: 3 requests per 15 minutes per IP.
 * Always returns success to prevent email enumeration.
 */
export async function POST(request: Request) {
  const ip = requestIpForRateLimit(request);
  const rl = await checkRateLimit({ key: `forgot-password:${ip}`, limit: 3, windowMs: 15 * 60 * 1000 });
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  try {
    const body = await request.json() as { email?: string };
    const email = typeof body.email === 'string' ? body.email.trim() : '';

    if (!email) {
      return NextResponse.json({ success: false, message: 'Email is required.' }, { status: 400 });
    }

    const res = await requestPasswordReset(email, {
      ipAddress: ip,
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json({
      success: true,
      message: res.success ? res.message : 'If an account with this email exists, your admin has been notified.',
    });
  } catch (err) {
    return NextResponse.json({
      success: true,
      message: 'If an account with this email exists, your admin has been notified.',
    });
  }
}
