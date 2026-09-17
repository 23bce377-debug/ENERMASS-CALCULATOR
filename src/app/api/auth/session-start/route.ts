import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
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

    const response = NextResponse.json({ success: true, sessionId });

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
