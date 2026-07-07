import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withLicensedApiRoute } from '@/lib/auth/withLicensedApiRoute';
import { z } from 'zod';

const profileQuerySchema = z.object({
  id: z.string().optional().nullable(),
});

const profileUpdateSchema = z.object({
  full_name: z.string().min(1, 'Full name is required').optional(),
  phone: z.string().optional(),
});

export const dynamic = 'force-dynamic';

export const GET = withLicensedApiRoute(async (request, context) => {
  const { searchParams } = new URL(request.url);
  const parseResult = profileQuerySchema.safeParse(Object.fromEntries(searchParams.entries()));
  if (!parseResult.success) {
    return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 });
  }
  const targetId = parseResult.data.id;
  const userId = context.session.user.id;

  const fetchId = targetId || userId;

  const supabase = await createClient();
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', fetchId)
    .maybeSingle();

  if (profileError || !profile) {
    console.error('[GET /api/profile] Profile fetch error:', profileError);
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  // RLS ensures the fetched profile is within the user's tenant if they don't have global permissions

  return NextResponse.json(profile);
}, {
  feature: 'calculator',
  roles: ['owner', 'admin', 'manager', 'staff', 'viewer'],
});

export const PUT = withLicensedApiRoute(async (request, context) => {
  const userId = context.session.user.id;
  const body = await request.json();
  const parseResult = profileUpdateSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parseResult.error.format() }, { status: 400 });
  }
  const updates = parseResult.data;

  const supabase = await createClient();
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .update({
      ...(updates.full_name !== undefined && { full_name: updates.full_name }),
      ...(updates.phone !== undefined && { phone: updates.phone }),
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .select()
    .maybeSingle();

  if (profileError || !profile) {
    console.error('[PUT /api/profile] Profile update error:', profileError);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }

  return NextResponse.json(profile);
}, {
  feature: 'calculator',
  roles: ['owner', 'admin', 'manager', 'staff', 'viewer'],
});

