/**
 * GET /api/erp/health — Operational health check.
 *
 * Requires an authenticated session (via the licensed guard) so internal
 * infrastructure metrics are not exposed publicly.
 *
 * Returns database, cache, and storage status with latencies.
 */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { redis } from '@/lib/cache/redis';
import { withLicensedApiRoute } from '@/lib/auth/withLicensedApiRoute';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withLicensedApiRoute(async (_request, _context) => {
  const status: Record<string, unknown> = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    metrics: {} as Record<string, unknown>,
  };

  const metrics = status.metrics as Record<string, unknown>;
  let hasError = false;

  // 1. Audit Database Latency
  const dbStart = Date.now();
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from('organisations').select('id').limit(1);
    if (error) throw error;
    metrics.database_latency_ms = Date.now() - dbStart;
    metrics.database_status = 'connected';
  } catch (err: unknown) {
    hasError = true;
    metrics.database_status = 'disconnected';
    metrics.database_error = err instanceof Error ? err.message : String(err);
  }

  // 2. Audit Cache Latency
  const cacheStart = Date.now();
  try {
    await redis.set('health_check_ping', 'ok', { ex: 5 });
    const cached = await redis.get('health_check_ping');
    if (cached !== 'ok') throw new Error('Cache read mismatch');
    metrics.cache_latency_ms = Date.now() - cacheStart;
    metrics.cache_status = 'connected';
  } catch (err: unknown) {
    hasError = true;
    metrics.cache_status = 'disconnected';
    metrics.cache_error = err instanceof Error ? err.message : String(err);
  }

  // 3. Audit Storage Bucket Accessibility
  const storageStart = Date.now();
  try {
    const supabase = createAdminClient();
    const { data: buckets, error } = await supabase.storage.listBuckets();
    if (error) throw error;
    const quotesBucket = buckets?.find((b) => b.id === 'quotes');
    if (!quotesBucket) throw new Error('Required "quotes" storage bucket not found');
    metrics.storage_latency_ms = Date.now() - storageStart;
    metrics.storage_status = 'connected';
    metrics.storage_bucket = 'verified';
  } catch (err: unknown) {
    hasError = true;
    metrics.storage_status = 'disconnected';
    metrics.storage_error = err instanceof Error ? err.message : String(err);
  }

  if (hasError) {
    status.status = 'unhealthy';
    return NextResponse.json(status, { status: 503 });
  }

  return NextResponse.json(status, { status: 200 });
}, {
  feature: 'erp',
  roles: ['owner', 'admin', 'manager', 'staff', 'viewer'],
});
