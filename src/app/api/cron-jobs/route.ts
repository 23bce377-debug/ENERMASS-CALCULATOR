import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { z } from 'zod';
import crypto from 'node:crypto';

const cronQuerySchema = z.object({
  key: z.string().min(1),
});

export const dynamic = 'force-dynamic';

/**
 * GET /api/cron-jobs
 * ==================
 * Background job executor triggered by pg_cron or external scheduler.
 * Enforces key-based token authorization using the service role key.
 */
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    let providedKey = '';

    if (authHeader && authHeader.startsWith('Bearer ')) {
      providedKey = authHeader.slice(7).trim();
    } else {
      const { searchParams } = new URL(request.url);
      const parseResult = cronQuerySchema.safeParse(Object.fromEntries(searchParams.entries()));
      if (parseResult.success) {
        providedKey = parseResult.data.key;
      }
    }

    if (!providedKey) {
      return NextResponse.json({ error: 'Missing or invalid authorization' }, { status: 401 });
    }

    const expectedKey = process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    const providedBuffer = Buffer.from(providedKey);
    const expectedBuffer = Buffer.from(expectedKey);

    const isAuthorized =
      providedBuffer.length === expectedBuffer.length &&
      crypto.timingSafeEqual(providedBuffer, expectedBuffer);

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseAdmin = createAdminClient();

    // 1. Refresh Materialized Views concurrently
    const { error: viewError } = await (supabaseAdmin as any).rpc('refresh_materialized_views');
    if (viewError) {
      console.error('[CRON] Materialized view refresh error:', viewError);
      throw viewError;
    }

    // 2. Auto-expire Quotes older than their valid_until date
    const today = new Date().toISOString().split('T')[0];
    const { error: quoteError } = await (supabaseAdmin.from('quotes') as any)
      .update({ status: 'lost', notes: 'Automatically marked expired by system background worker.' })
      .lt('valid_until', today)
      .eq('status', 'draft');

    if (quoteError) {
      console.error('[CRON] Quote expiry update error:', quoteError);
      throw quoteError;
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      message: 'Reporting views refreshed and quote expiries processed successfully.'
    });
  } catch (err: any) {
    console.error('[CRON] Scheduled background job failure:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
