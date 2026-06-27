import 'server-only';

import { NextResponse } from 'next/server';
import { redis } from '@/lib/cache/redis';

const isProduction = process.env.NODE_ENV === 'production';
const isRedisActive = !!(process.env.UPSTASH_REDIS_REST_URL && 
                     !process.env.UPSTASH_REDIS_REST_URL.includes('your-database-name'));

const isProductionBuild = process.env.NEXT_PHASE === 'phase-production-build';
if (isProduction && !isRedisActive && !isProductionBuild) {
  throw new Error('CRITICAL: Upstash Redis is not configured. Redis is MANDATORY in production environments.');
}

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitOptions {
  key: string;
  limit: number;
  windowMs: number;
}

export function requestIpForRateLimit(request: Request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown-ip';
}

export async function checkRateLimit(options: RateLimitOptions, now = Date.now()) {
  const limit = process.env.NODE_ENV === 'production' ? options.limit : 1000;

  if (isRedisActive) {
    try {
      const key = `rl:${options.key}`;
      const current = await redis.get<number>(key);
      if (current === null) {
        await redis.set(key, 1, { ex: Math.ceil(options.windowMs / 1000) });
        return { allowed: true, remaining: limit - 1, resetAt: now + options.windowMs };
      }
      if (Number(current) >= limit) {
        const ttl = await redis.ttl(key);
        return { allowed: false, remaining: 0, resetAt: now + (ttl * 1000) };
      }
      const newCount = await redis.incr(key);
      const ttl = await redis.ttl(key);
      return { allowed: true, remaining: limit - newCount, resetAt: now + (ttl * 1000) };
    } catch (err) {
      console.error('[RateLimit] Redis error, falling back to memory:', err);
    }
  }

  const existing = buckets.get(options.key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(options.key, { count: 1, resetAt: now + options.windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + options.windowMs };
  }

  if (existing.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }

  existing.count += 1;
  return { allowed: true, remaining: limit - existing.count, resetAt: existing.resetAt };
}

export function rateLimitResponse(resetAt: number) {
  const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
  return NextResponse.json(
    { error: 'TooManyRequests', message: 'Too many attempts. Please wait and try again.' },
    { status: 429, headers: { 'retry-after': String(retryAfter) } }
  );
}

export async function enforceRateLimit(request: Request, options: Omit<RateLimitOptions, 'key'> & { keyPrefix: string; userId?: string }) {
  const key = `${options.keyPrefix}:${options.userId ?? 'anonymous'}:${requestIpForRateLimit(request)}`;
  const result = await checkRateLimit({ key, limit: options.limit, windowMs: options.windowMs });
  return result.allowed ? null : rateLimitResponse(result.resetAt);
}
