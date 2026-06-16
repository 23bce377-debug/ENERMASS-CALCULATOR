import { NextResponse } from 'next/server';
import { BundlePresetORM } from '@/backend/orm/bundle';
import { z } from 'zod';

const updateBundleSchema = z.object({
  name: z.string().optional(),
  vendor_id: z.string().nullable().optional(),
  effective_bundle_price: z.coerce.number().optional(),
  allocation_strategy: z.string().optional(),
  notes: z.string().optional(),
  gst_pct: z.coerce.number().optional(),
  items: z.array(z.any()).optional(),
});
import { withAuth } from '@/lib/api/wrappers';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const BundleUpdateSchema = z.object({
  name: z.string().optional(),
  vendor_id: z.string().uuid().nullable().optional(),
  effective_bundle_price: z.number().optional(),
  allocation_strategy: z.enum(['proportional_cost', 'proportional_qty', 'manual']).optional(),
  notes: z.string().nullable().optional(),
  gst_pct: z.number().min(0).max(1).optional(),
  items: z.array(z.any()).optional()
});

export const GET = withAuth(async (request, context) => {
  try {
    const { orgId } = context.auth;
    const { id } = await context.params;
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
});

export const PUT = withAuth(async (request, context) => {
  try {
    const { orgId, role } = context.auth;
    const { id } = await context.params;
    const preset = await BundlePresetORM.getById(id);

    // Verify tenant ownership
    if (preset.org_id !== orgId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (role !== 'owner' && role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Insufficient role' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = BundleUpdateSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload', details: parsed.error.format() }, { status: 400 });
    }

    const { name, vendor_id, effective_bundle_price, allocation_strategy, notes, gst_pct, items } = parsed.data;

    const updatedPreset = await BundlePresetORM.update(
      id,
      {
        name: name !== undefined ? name : preset.name,
        vendor_id: vendor_id !== undefined ? vendor_id : preset.vendor_id,
        effective_bundle_price: effective_bundle_price !== undefined ? effective_bundle_price : preset.effective_bundle_price,
        allocation_strategy: allocation_strategy !== undefined ? allocation_strategy : preset.allocation_strategy,
        notes: notes !== undefined ? notes : preset.notes,
        gst_pct: gst_pct !== undefined ? gst_pct : preset.gst_pct
      },
      items
    );

    return NextResponse.json(updatedPreset);
  } catch (err) {
    console.error('[PUT /api/bundles/[id]] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

export const DELETE = withAuth(async (request, context) => {
  try {
    const { orgId, role } = context.auth;
    const { id } = await context.params;
    const preset = await BundlePresetORM.getById(id);

    // Verify tenant ownership
    if (preset.org_id !== orgId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (role !== 'owner' && role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Insufficient role' }, { status: 403 });
    }

    await BundlePresetORM.delete(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/bundles/[id]] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
