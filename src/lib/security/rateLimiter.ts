/**
 * In-process sliding window rate limiter.
 *
 * Stores state in module-level memory — resets on server restart / redeploy.
 * Sufficient for single-instance deployments. For multi-replica production,
 * swap the store with an Upstash Redis client.
 *
 * Usage:
 *   const result = checkRateLimit(`${ip}:validate`, 10, 60_000);
 *   if (!result.allowed) return new Response('Too Many Requests', { status: 429 });
 */

interface RateLimitEntry {
  timestamps: number[];
}

// Module-level store — intentionally not exported
const store = new Map<string, RateLimitEntry>();

/**
 * Checks whether a given key is within the allowed rate.
 * Uses a sliding window: only requests in the last `windowMs` milliseconds count.
 *
 * @param key       Unique key (e.g. `"<ip>:<endpoint>"`)
 * @param limit     Maximum number of requests allowed in the window
 * @param windowMs  Window size in milliseconds
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; retryAfterMs?: number; remaining: number } {
  const now = Date.now();
  const cutoff = now - windowMs;

  const entry = store.get(key) ?? { timestamps: [] };

  // Slide the window: keep only timestamps within the current window
  entry.timestamps = entry.timestamps.filter(t => t > cutoff);

  if (entry.timestamps.length >= limit) {
    // Oldest timestamp in the window tells us when a slot frees up
    const oldest = entry.timestamps[0];
    const retryAfterMs = oldest + windowMs - now;
    store.set(key, entry);
    return { allowed: false, retryAfterMs, remaining: 0 };
  }

  // Record this request
  entry.timestamps.push(now);
  store.set(key, entry);

  return { allowed: true, remaining: limit - entry.timestamps.length };
}

/**
 * Clears all rate limit state. Useful in tests or for admin resets.
 */
export function clearRateLimitStore(): void {
  store.clear();
}

/**
 * Helper: extract the client IP from a Next.js Request.
 * Checks standard proxy headers before falling back to a sentinel.
 */
export function getClientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    request.headers.get('cf-connecting-ip') ??
    'unknown'
  );
}
