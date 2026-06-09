import { NextResponse } from 'next/server';
import { BundlePresetORM } from '@/backend/orm/bundle';
import { withAuth } from '@/lib/api/wrappers';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (request, context) => {
  const { orgId } = context.auth;
  const presets = await BundlePresetORM.getAll(orgId);
  return NextResponse.json(presets);
});

export const POST = withAuth(async (request, context) => {
  const { orgId, userId } = context.auth;
  const body = await request.json();
  const { name, vendor_id, effective_bundle_price, allocation_strategy, notes, gst_pct, items } = body;

  if (!name) {
    return NextResponse.json({ error: 'Bundle name is required' }, { status: 400 });
  }

  const newPreset = await BundlePresetORM.create(
    {
      org_id: orgId,
      vendor_id: vendor_id || null,
      name,
      effective_bundle_price: Number(effective_bundle_price) || 0,
      allocation_strategy: allocation_strategy || 'proportional_cost',
      notes,
      gst_pct: gst_pct !== undefined ? Number(gst_pct) : 0.18,
      created_by: userId,
      is_active: true
    },
    items || []
  );

  return NextResponse.json(newPreset, { status: 201 });
});

