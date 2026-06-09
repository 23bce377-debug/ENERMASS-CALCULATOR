import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/api/wrappers';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (request, context) => {
  const { searchParams } = new URL(request.url);
  const targetId = searchParams.get('id');
  const { orgId, userId } = context.auth;

  const fetchId = targetId || userId;

  const supabaseAdmin = createAdminClient();
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', fetchId)
    .single();

  if (profileError || !profile) {
    console.error('[GET /api/profile] Profile fetch error:', profileError);
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  // Tenant isolation verification
  if (profile.org_id !== orgId) {
    console.error(`[GET /api/profile] Tenant mismatch: requester org ${orgId} vs target org ${profile.org_id}`);
    return NextResponse.json({ error: 'Forbidden: Access denied' }, { status: 403 });
  }

  return NextResponse.json(profile);
});

export const PUT = withAuth(async (request, context) => {
  const { userId } = context.auth;
  const updates = await request.json();

  const supabaseAdmin = createAdminClient();
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .update({
      full_name: updates.full_name,
      phone: updates.phone,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .select()
    .single();

  if (profileError) {
    console.error('[PUT /api/profile] Profile update error:', profileError);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }

  return NextResponse.json(profile);
});


