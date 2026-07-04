import { redis } from './redis'

const pendingLoads = new Map<string, Promise<unknown>>();

/**
 * Get a value from Redis cache. If not found, fetch it with the function,
 * store it in Redis, and return it.
 */
export async function getOrSetCache<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttlSeconds: number
): Promise<T> {
  try {
    const cached = await redis.get<T>(key)
    if (cached !== null && cached !== undefined) {
      return cached
    }
  } catch (err) {
    console.error(`[RedisCache] Error reading key "${key}":`, err)
  }

  const pending = pendingLoads.get(key);
  if (pending) {
    return pending as Promise<T>;
  }

  const loadPromise = (async () => {
    const freshData = await fetchFn()

    try {
      await redis.set(key, freshData, { ex: ttlSeconds })
    } catch (err) {
      console.error(`[RedisCache] Error writing key "${key}":`, err)
    }

    return freshData
  })();

  pendingLoads.set(key, loadPromise);

  try {
    return await loadPromise;
  } finally {
    pendingLoads.delete(key);
  }
}

/**
 * Delete one or more keys from Redis.
 */
export async function invalidateCacheKeys(...keys: string[]): Promise<void> {
  try {
    if (keys.length > 0) {
      await redis.del(...keys)
      keys.forEach((key) => pendingLoads.delete(key));
    }
  } catch (err) {
    console.error(`[RedisCache] Error invalidating keys ${JSON.stringify(keys)}:`, err)
  }
}

/**
 * Delete every key that starts with one of the supplied prefixes.
 * Used for versioned ERP master keys such as erp:bootstrap:<org>:v6:...
 */
export async function invalidateCachePrefixes(...prefixes: string[]): Promise<void> {
  const uniquePrefixes = Array.from(new Set(prefixes.filter(Boolean)));
  if (uniquePrefixes.length === 0) return;

  try {
    const client = redis as any;
    if (typeof client.scan !== 'function') {
      console.warn('[RedisCache] Redis client does not support SCAN; prefix invalidation skipped:', uniquePrefixes);
      return;
    }

    for (const prefix of uniquePrefixes) {
      const keysToDelete: string[] = [];
      let cursor: number | string = 0;

      do {
        const result: [number | string, string[]] | { cursor?: number | string; keys?: string[] } =
          await client.scan(cursor, { match: `${prefix}*`, count: 500 });
        const nextCursor: number | string = Array.isArray(result) ? result[0] : (result.cursor ?? 0);
        const keys: unknown = Array.isArray(result) ? result[1] : result.keys;

        if (Array.isArray(keys)) {
          keysToDelete.push(...keys.map(String));
        }

        cursor = nextCursor ?? 0;
      } while (String(cursor) !== '0');

      if (keysToDelete.length > 0) {
        await redis.del(...keysToDelete);
        keysToDelete.forEach((key) => pendingLoads.delete(key));
      }
    }
  } catch (err) {
    console.error(`[RedisCache] Error invalidating prefixes ${JSON.stringify(uniquePrefixes)}:`, err)
  }
}

/**
 * Directly set a value in Redis (Write-Through Caching).
 */
export async function setCacheKey<T>(key: string, data: T, ttlSeconds: number): Promise<void> {
  try {
    await redis.set(key, data, { ex: ttlSeconds })
  } catch (err) {
    console.error(`[RedisCache] Error writing key "${key}":`, err)
  }
}
