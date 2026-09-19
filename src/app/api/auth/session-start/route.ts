import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function POST(request?: Request) {
  try {
    let user: any = null;

    // 1. Try resolving user from cookies
    try {
      const supabase = await createClient();
      const { data: { user: cookieUser } } = await supabase.auth.getUser();
      if (cookieUser) {
        user = cookieUser;
      }
    } catch {
      // Cookie reading may fail or be absent
    }

    // 2. Fall back to Bearer token or request body if cookie resolution returned no user
    if (!user && request) {
      try {
        const authHeader = request.headers.get('authorization');
        let token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

        if (!token) {
          const cloned = request.clone();
          const body = await cloned.json().catch(() => null);
          if (body && typeof body.accessToken === 'string') {
            token = body.accessToken.trim();
          }
        }

        if (token) {
          const admin = createAdminClient();
          const { data: { user: tokenUser } } = await admin.auth.getUser(token);
          if (tokenUser) {
            user = tokenUser;
          }
        }
      } catch (err) {
        console.warn('[session-start] Fallback token verification error:', err);
      }
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sessionId = crypto.randomUUID();
    const admin = createAdminClient();

    const { error: updateError } = await (admin as any)
      .from('profiles')
      .update({
        active_session_id: sessionId,
        active_session_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('[session-start] Error setting active_session_id:', updateError);
      return NextResponse.json({ error: 'Failed to initialize session' }, { status: 500 });
    }

    const response = NextResponse.json({ success: true, sessionId, userId: user.id });

    response.cookies.set({
      name: 'enermass_session_id',
      value: sessionId,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    return response;
  } catch (error) {
    console.error('[session-start] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

