import { NextResponse } from 'next/server';
import { BundlePresetORM } from '@/backend/orm/bundle';
import { withAuth, withRole } from '@/lib/api/wrappers';
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
import { z } from 'zod';

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

export const GET = withAuth(async (request, context) => {
  const { orgId } = context.auth;
  const presets = await BundlePresetORM.getAll(orgId);
  return NextResponse.json(presets);
});

export const POST = withRole(['owner', 'admin'], async (request, context) => {
  const { orgId, userId } = context.auth;
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
      created_by: userId,
      is_active: true
    },
    items
  );

  return NextResponse.json(newPreset, { status: 201 });
});

