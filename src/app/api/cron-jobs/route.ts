import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { z } from 'zod';

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
    const { searchParams } = new URL(request.url);
    const parseResult = cronQuerySchema.safeParse(Object.fromEntries(searchParams.entries()));
    if (!parseResult.success) {
      return NextResponse.json({ error: 'Missing or invalid key parameter' }, { status: 400 });
    }
    const { key } = parseResult.data;
    
    if (key !== process.env.SUPABASE_SERVICE_ROLE_KEY) {
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
