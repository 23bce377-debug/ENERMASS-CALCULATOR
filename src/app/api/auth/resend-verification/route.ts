import { NextResponse } from 'next/server';
import { enforceRateLimit } from '@/lib/security/rateLimit';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { email } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Enforce Rate Limit: max 3 resend attempts per 15 minutes per email/IP
    const limited = await enforceRateLimit(request, {
      keyPrefix: 'resend-verify',
      userId: normalizedEmail,
      limit: 3,
      windowMs: 15 * 60 * 1000,
    });
    if (limited) return limited;

    const supabase = createAdminClient();

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: normalizedEmail,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/auth/confirm`
      }
    });

    if (error) {
      console.error('[Resend Verification] Supabase Auth resend failed:', error.message);
    }

    // Return ok: true always to prevent account enumeration attacks
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[Resend Verification] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
