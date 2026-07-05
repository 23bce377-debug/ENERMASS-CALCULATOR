import { Redis } from '@upstash/redis'

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

  async ttl(key: string): Promise<number> {
    const entry = this.cache.get(key)
    if (!entry) return -2
    const ttlSeconds = Math.ceil((entry.expiry - Date.now()) / 1000)
    if (ttlSeconds <= 0) {
      this.cache.delete(key)
      return -2
    }
    return ttlSeconds
  }

  async incr(key: string): Promise<number> {
    const existing = this.cache.get(key)
    const now = Date.now()
    const current = existing && now <= existing.expiry ? Number(existing.value ?? 0) : 0
    const next = current + 1
    const expiry = existing && now <= existing.expiry ? existing.expiry : now + 3600 * 1000
    this.cache.set(key, { value: next, expiry })
    return next
  }

  async scan(cursor: number | string = 0, options?: { match?: string; count?: number }): Promise<[number, string[]]> {
    const pattern = options?.match;
    const count = Math.max(1, options?.count ?? 100);
    const start = Math.max(0, Number(cursor) || 0);
    const keys = Array.from(this.cache.keys()).filter((key) => {
      const entry = this.cache.get(key)
      if (!entry || Date.now() > entry.expiry) {
        this.cache.delete(key)
        return false
      }
      if (!pattern) return true
      if (pattern.endsWith('*')) return key.startsWith(pattern.slice(0, -1))
      return key === pattern
    })
    const page = keys.slice(start, start + count)
    const nextCursor = start + count >= keys.length ? 0 : start + count
    return [nextCursor, page]
  }
  
  async flushall(): Promise<'OK'> {
    this.cache.clear()
    return 'OK'
  }
}

let redisClient: Redis | null = null
let warnedAboutMemoryFallback = false

function isRedisConfigured() {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  return !!(url && !url.includes('your-database-name') && token && token !== 'your-rest-token')
}

export function getRedis(): Redis {
  if (redisClient) return redisClient

  const isProduction = process.env.NODE_ENV === 'production'
  const isProductionBuild = process.env.NEXT_PHASE === 'phase-production-build'
  const configured = isRedisConfigured()

  if (isProduction && !configured && !isProductionBuild) {
    throw new Error('CRITICAL: Upstash Redis is not configured. Redis is MANDATORY in production environments.')
  }

  redisClient = configured
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL!,
        token: process.env.UPSTASH_REDIS_REST_TOKEN!,
      })
    : (new MemoryCache() as unknown as Redis)

  if (!configured && !warnedAboutMemoryFallback) {
    warnedAboutMemoryFallback = true
    console.warn('Upstash Redis is not fully configured. Falling back to server-side in-memory cache.')
  }

  return redisClient
}

export const redis = new Proxy({} as Redis, {
  get(_target, prop, receiver) {
    const client = getRedis() as any
    const value = Reflect.get(client, prop, receiver)
    return typeof value === 'function' ? value.bind(client) : value
  },
})
