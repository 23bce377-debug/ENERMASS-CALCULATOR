export function privateJsonCacheHeaders(maxAgeSeconds: number, staleSeconds: number): HeadersInit {
  return {
    'Cache-Control': `private, max-age=${maxAgeSeconds}, stale-while-revalidate=${staleSeconds}`,
    'Vary': 'Cookie, Authorization',
  };
}
