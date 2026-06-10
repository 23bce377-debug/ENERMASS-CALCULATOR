import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { redis } from '@/lib/cache/redis';

export async function GET() {
  const status: Record<string, any> = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    metrics: {}
  };

  let hasError = false;

  // 1. Audit Database Latency
  const dbStart = Date.now();
  try {
    const supabase = createAdminClient();
    // Simple fast query
    const { error } = await supabase.from('organisations').select('id').limit(1);
    if (error) throw error;
    status.metrics.database_latency_ms = Date.now() - dbStart;
    status.metrics.database_status = 'connected';
  } catch (err: any) {
    hasError = true;
    status.metrics.database_status = 'disconnected';
    status.metrics.database_error = err.message || err;
  }

  // 2. Audit Cache Latency
  const cacheStart = Date.now();
  try {
    await redis.set('health_check_ping', 'ok', { ex: 5 });
    const cached = await redis.get('health_check_ping');
    if (cached !== 'ok') throw new Error('Cache read mismatch');
    status.metrics.cache_latency_ms = Date.now() - cacheStart;
    status.metrics.cache_status = 'connected';
  } catch (err: any) {
    hasError = true;
    status.metrics.cache_status = 'disconnected';
    status.metrics.cache_error = err.message || err;
  }

  // 3. Audit Storage Bucket Accessibility
  const storageStart = Date.now();
  try {
    const supabase = createAdminClient();
    const { data: buckets, error } = await supabase.storage.listBuckets();
    if (error) throw error;
    
    const quotesBucket = buckets?.find(b => b.id === 'quotes');
    if (!quotesBucket) {
      throw new Error('Required "quotes" storage bucket not found');
    }

    status.metrics.storage_latency_ms = Date.now() - storageStart;
    status.metrics.storage_status = 'connected';
    status.metrics.storage_bucket = 'verified';
  } catch (err: any) {
    hasError = true;
    status.metrics.storage_status = 'disconnected';
    status.metrics.storage_error = err.message || err;
  }

  if (hasError) {
    status.status = 'unhealthy';
    return NextResponse.json(status, { status: 503 });
  }

  return NextResponse.json(status, { status: 200 });
}
export const dynamic = 'force-dynamic';
export const revalidate = 0;
