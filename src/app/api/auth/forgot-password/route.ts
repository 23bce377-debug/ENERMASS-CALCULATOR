import { NextResponse } from 'next/server';
import { checkRateLimit, rateLimitResponse, requestIpForRateLimit } from '@/lib/security/rateLimit';
import { createAdminClient } from '@/lib/supabase/server';

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

    const adminClient = createAdminClient();
    const redirectTo = `${new URL(request.url).origin}/profile?recovery=true`;
    
    const { error: emailError } = await adminClient.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (emailError) {
      console.error('[ForgotPassword] Reset password error:', emailError.message);
    }

    return NextResponse.json({
      success: true,
      message: 'If an account with this email exists, a password reset link has been sent.',
    });
  } catch (err) {
    return NextResponse.json({
      success: true,
      message: 'If an account with this email exists, a password reset link has been sent.',
    });
  }
}
