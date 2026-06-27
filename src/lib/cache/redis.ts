import { Redis } from '@upstash/redis'

const url = process.env.UPSTASH_REDIS_REST_URL
const token = process.env.UPSTASH_REDIS_REST_TOKEN

const isProduction = process.env.NODE_ENV === 'production';
const isConfigured = !!(url && !url.includes('your-database-name') && token && token !== 'your-rest-token');

const isProductionBuild = process.env.NEXT_PHASE === 'phase-production-build';
if (isProduction && !isConfigured && !isProductionBuild) {
  throw new Error('CRITICAL: Upstash Redis is not configured. Redis is MANDATORY in production environments.');
}

// In-memory fallback if Redis is not configured
class MemoryCache {
  private cache = new Map<string, { value: any; expiry: number }>()

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key)
    if (!entry) return null
    if (Date.now() > entry.expiry) {
      this.cache.delete(key)
      return null
    }
    return entry.value as T
  }

  async set(key: string, value: any, options?: { ex?: number }): Promise<'OK'> {
    const ttl = options?.ex ? options.ex * 1000 : 3600 * 1000 // default 1 hour
    this.cache.set(key, {
      value,
      expiry: Date.now() + ttl
    })
    return 'OK'
  }

  async del(...keys: string[]): Promise<number> {
    let deletedCount = 0
    for (const key of keys) {
      if (this.cache.delete(key)) {
        deletedCount++
      }
    }
    return deletedCount
  }
  
  async flushall(): Promise<'OK'> {
    this.cache.clear()
    return 'OK'
  }
}

export const redis = isConfigured
  ? new Redis({ url: url!, token: token! })
  : (new MemoryCache() as unknown as Redis)

if (!isConfigured) {
  console.warn('Upstash Redis is not fully configured. Falling back to server-side in-memory cache.')
}
