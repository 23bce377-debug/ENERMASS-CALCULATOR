import { redis } from './redis'

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

  // Fetch fresh data
  const freshData = await fetchFn()

  try {
    await redis.set(key, freshData, { ex: ttlSeconds })
  } catch (err) {
    console.error(`[RedisCache] Error writing key "${key}":`, err)
  }

  return freshData
}

/**
 * Delete one or more keys from Redis.
 */
export async function invalidateCacheKeys(...keys: string[]): Promise<void> {
  try {
    if (keys.length > 0) {
      await redis.del(...keys)
    }
  } catch (err) {
    console.error(`[RedisCache] Error invalidating keys ${JSON.stringify(keys)}:`, err)
  }
}
