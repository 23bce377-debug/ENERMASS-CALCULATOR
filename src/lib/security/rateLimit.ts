import 'server-only';

import { NextResponse } from 'next/server';

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

export function checkRateLimit(options: RateLimitOptions, now = Date.now()) {
  const existing = buckets.get(options.key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(options.key, { count: 1, resetAt: now + options.windowMs });
    return { allowed: true, remaining: options.limit - 1, resetAt: now + options.windowMs };
  }

  if (existing.count >= options.limit) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }

  existing.count += 1;
  return { allowed: true, remaining: options.limit - existing.count, resetAt: existing.resetAt };
}

export function rateLimitResponse(resetAt: number) {
  const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
  return NextResponse.json(
    { error: 'TooManyRequests', message: 'Too many attempts. Please wait and try again.' },
    { status: 429, headers: { 'retry-after': String(retryAfter) } }
  );
}

export function enforceRateLimit(request: Request, options: Omit<RateLimitOptions, 'key'> & { keyPrefix: string; userId?: string }) {
  const key = `${options.keyPrefix}:${options.userId ?? 'anonymous'}:${requestIpForRateLimit(request)}`;
  const result = checkRateLimit({ key, limit: options.limit, windowMs: options.windowMs });
  return result.allowed ? null : rateLimitResponse(result.resetAt);
}
