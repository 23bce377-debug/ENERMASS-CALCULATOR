import { NextResponse } from 'next/server';
import { BundlePresetORM } from '@/backend/orm/bundle';
import { withLicensedApiRoute } from '@/lib/auth/withLicensedApiRoute';
import { z } from 'zod';

const createBundleSchema = z.object({
  name: z.string().min(1, 'Bundle name is required'),
  vendor_id: z.string().nullable().optional(),
  effective_bundle_price: z.coerce.number().default(0),
  allocation_strategy: z.string().default('proportional_cost'),
  notes: z.string().optional(),
  gst_pct: z.coerce.number().default(0.18),
  items: z.array(z.any()).default([]),
});

export const dynamic = 'force-dynamic';

const BundleCreateSchema = z.object({
  name: z.string().min(1, 'Bundle name is required'),
  vendor_id: z.string().uuid().nullable().optional(),
  effective_bundle_price: z.number().optional().default(0),
  allocation_strategy: z.enum(['proportional_cost', 'proportional_qty', 'manual']).optional().default('proportional_cost'),
  notes: z.string().nullable().optional(),
  gst_pct: z.number().min(0).max(1).optional().default(0.18),
  items: z.array(z.any()).optional().default([])
});

export const GET = withLicensedApiRoute(async (_request, context) => {
  const { orgId } = context.session;
  const presets = await BundlePresetORM.getAll(orgId);
  return NextResponse.json(presets);
}, {
  feature: 'inventory',
  roles: ['owner', 'admin', 'manager'],
});

export const POST = withLicensedApiRoute(async (request, context) => {
  const { orgId, user } = context.session;
  const body = await request.json();
  
  const parsed = BundleCreateSchema.safeParse(body);
  
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.format() }, { status: 400 });
  }

  const { name, vendor_id, effective_bundle_price, allocation_strategy, notes, gst_pct, items } = parsed.data;

  const newPreset = await BundlePresetORM.create(
    {
      org_id: orgId,
      vendor_id: vendor_id || null,
      name,
      effective_bundle_price,
      allocation_strategy,
      notes,
      gst_pct,
      created_by: user.id,
      is_active: true
    },
    items
  );

  return NextResponse.json(newPreset, { status: 201 });
}, {
  feature: 'inventory',
  roles: ['owner', 'admin'],
});
