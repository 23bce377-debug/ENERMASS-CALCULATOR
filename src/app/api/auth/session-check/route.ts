import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ active: false, reason: 'unauthenticated' }, { status: 401 });
    }

    const cookieStore = await cookies();
    const cookieSessionId = cookieStore.get('enermass_session_id')?.value;

    if (!cookieSessionId) {
      // No active session cookie found on this device
      return NextResponse.json({ active: false, reason: 'missing_session_cookie' });
    }

    const admin = createAdminClient();
    const { data: profile, error: profileError } = await (admin as any)
      .from('profiles')
      .select('active_session_id')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json({ active: false, reason: 'profile_not_found' });
    }

    if (profile.active_session_id && profile.active_session_id !== cookieSessionId) {
      // The session has been superseded by a more recent login on another device
      return NextResponse.json({ active: false, reason: 'superseded' });
    }

    return NextResponse.json({ active: true });
  } catch (error) {
    console.error('[session-check] Unexpected error:', error);
    return NextResponse.json({ active: false, error: 'Internal server error' }, { status: 500 });
  }
}
