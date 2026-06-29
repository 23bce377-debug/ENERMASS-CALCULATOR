import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withLicensedApiRoute } from '@/lib/auth/withLicensedApiRoute';
import { createAdminClient } from '@/lib/supabase/server';
import { invalidateCacheKeys } from '@/lib/cache/redisCache';

export const dynamic = 'force-dynamic';

const termsSchema = z.object({
  stateId: z.string().uuid().nullable(),
  clauses: z.array(z.string().trim().min(1)).min(1),
});

async function loadTerms() {
  const supabase = createAdminClient();

  const [statesRes, termsRes] = await Promise.all([
    supabase
      .from('state_rules')
      .select('id, state_code, state_name, discom_name, is_active')
      .eq('is_active', true)
      .order('state_name', { ascending: true }),
    (supabase as any)
      .from('state_terms_templates')
      .select('id, state_id, clauses, is_active, version, updated_at')
      .eq('is_active', true),
  ]);

  if (statesRes.error) throw statesRes.error;
  if (termsRes.error) throw termsRes.error;

  return {
    states: statesRes.data ?? [],
    templates: termsRes.data ?? [],
  };
}

type EmptyRouteContext = { params: Promise<Record<string, never>> };

export const GET = withLicensedApiRoute<EmptyRouteContext>(
  async () => {
    try {
      return NextResponse.json(await loadTerms());
    } catch (err: any) {
      console.error('[GET /api/erp/master/terms] Error:', err);
      return NextResponse.json(
        { error: err.message ?? 'Failed to load terms templates' },
        { status: 500 }
      );
    }
  },
  { feature: 'master_data', roles: ['owner', 'admin', 'manager', 'staff'] }
);

export const PUT = withLicensedApiRoute<EmptyRouteContext>(
  async (request) => {
    const parseResult = termsSchema.safeParse(await request.json());
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid terms payload', details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const { stateId, clauses } = parseResult.data;
    const supabase = createAdminClient();

    try {
      const existingQuery = (supabase as any)
        .from('state_terms_templates')
        .select('id, version')
        .eq('is_active', true);

      const { data: existing, error: existingError } = stateId
        ? await existingQuery.eq('state_id', stateId).maybeSingle()
        : await existingQuery.is('state_id', null).maybeSingle();

      if (existingError) throw existingError;

      if (existing?.id) {
        const { error } = await (supabase as any)
          .from('state_terms_templates')
          .update({
            clauses,
            version: Number(existing.version ?? 1) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from('state_terms_templates')
          .insert({
            state_id: stateId,
            clauses,
            is_active: true,
            version: 1,
          });
        if (error) throw error;
      }

      await invalidateCacheKeys('erp:master:rules:global:v3:bomLimit_500');
      return NextResponse.json(await loadTerms());
    } catch (err: any) {
      console.error('[PUT /api/erp/master/terms] Error:', err);
      return NextResponse.json(
        { error: err.message ?? 'Failed to save terms template' },
        { status: 500 }
      );
    }
  },
  { feature: 'master_data', roles: ['owner', 'admin', 'manager'] }
);
