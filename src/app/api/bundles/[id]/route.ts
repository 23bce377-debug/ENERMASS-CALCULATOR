import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { BundlePresetORM } from '@/backend/orm/bundle';

export const dynamic = 'force-dynamic';

async function getAuthContext() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Ignore cookies write errors inside route handlers
          }
        },
      },
    }
  );

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { errorResponse: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  // Use service client to fetch profile & verify org_id
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('org_id')
    .eq('id', user.id)
    .single();

  if (profileError || !profile?.org_id) {
    return { errorResponse: NextResponse.json({ error: 'Org profile not found' }, { status: 404 }) };
  }

  return { orgId: profile.org_id, supabaseAdmin };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { orgId, errorResponse } = await getAuthContext();
    if (errorResponse) return errorResponse;

    const { id } = await params;
    const preset = await BundlePresetORM.getById(id);

    // Verify tenant ownership
    if (preset.org_id !== orgId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json(preset);
  } catch (err) {
    console.error('[GET /api/bundles/[id]] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { orgId, errorResponse } = await getAuthContext();
    if (errorResponse) return errorResponse;

    const { id } = await params;
    const preset = await BundlePresetORM.getById(id);

    // Verify tenant ownership
    if (preset.org_id !== orgId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { name, vendor_id, effective_bundle_price, allocation_strategy, notes, gst_pct, items } = body;

    const updatedPreset = await BundlePresetORM.update(
      id,
      {
        name: name !== undefined ? name : preset.name,
        vendor_id: vendor_id !== undefined ? (vendor_id || null) : preset.vendor_id,
        effective_bundle_price: effective_bundle_price !== undefined ? Number(effective_bundle_price) : preset.effective_bundle_price,
        allocation_strategy: allocation_strategy !== undefined ? allocation_strategy : preset.allocation_strategy,
        notes: notes !== undefined ? notes : preset.notes,
        gst_pct: gst_pct !== undefined ? Number(gst_pct) : preset.gst_pct
      },
      items
    );

    return NextResponse.json(updatedPreset);
  } catch (err) {
    console.error('[PUT /api/bundles/[id]] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { orgId, errorResponse } = await getAuthContext();
    if (errorResponse) return errorResponse;

    const { id } = await params;
    const preset = await BundlePresetORM.getById(id);

    // Verify tenant ownership
    if (preset.org_id !== orgId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await BundlePresetORM.delete(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/bundles/[id]] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
