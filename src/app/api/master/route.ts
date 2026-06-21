/**
 * GET /api/masters — Versioned master data API endpoint.
 *
 * Features:
 * - Single request returns all 24 datasets in one payload.
 * - ETag-based conditional requests (304 Not Modified on cache hit).
 * - Cache-Control: stale-while-revalidate for CDN/edge caching.
 * - Accepts ?org_id= query param to include org-specific rate overrides.
 * - Returns X-Cache-Version header for client-side version validation.
 * - Payload is typed — MasterDataPayload interface enforced at runtime return.
 *
 * Cache strategy:
 * - Server-side: in-memory SWR cache (masterCache.ts) — 5min global, 2min org.
 * - HTTP: Cache-Control max-age=300 (5min), stale-while-revalidate=60.
 * - Client should treat ETag as the canonical freshness signal.
 *
 * Security:
 * - org_id is resolved exclusively from the licensed session guard.
 * - The ?org_id= query param is NOT honoured — it is ignored entirely.
 * - A valid session with a profile.org_id is required or the request is rejected 401.
 */

import { NextResponse } from 'next/server';
import { getCachedMasterData, CACHE_VERSION } from '@/lib/cache/masterCache';
import { withLicensedApiRoute } from '@/lib/auth/withLicensedApiRoute';

export const runtime = 'nodejs';
// Opt out of full route caching — we manage our own SWR at the function level
export const dynamic = 'force-dynamic';

export const GET = withLicensedApiRoute(async (request, context) => {
  try {
    const orgId = context.session.orgId;

    const data = await getCachedMasterData(orgId);

    // Content-hash ETag (set by cache loader, stable across SWR refreshes
    // when underlying data has not changed)
    const etag = `"${data.etag}"`;

    // ETag conditional request — 304 Not Modified
    const ifNoneMatch = request.headers.get('if-none-match');
    if (ifNoneMatch === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          'ETag': etag,
          'Cache-Control': 'public, max-age=300, stale-while-revalidate=60',
          'X-Cache-Version': CACHE_VERSION,
        },
      });
    }

    return NextResponse.json(data, {
      status: 200,
      headers: {
        // 5 min max-age + 60s SWR window so clients see fresh data within 6 min
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=60',
        'ETag': etag,
        'Content-Type': 'application/json; charset=utf-8',
        'X-Cache-Version': CACHE_VERSION,
        'X-Generated-At': data.generatedAt,
        // CORS — allow all origins (master data is non-sensitive public data)
        'Vary': 'Accept-Encoding',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API/masters] Failed to fetch master data:', message);
    return NextResponse.json(
      {
        error: 'Failed to fetch master data',
        detail: process.env.NODE_ENV === 'development' ? message : undefined,
        version: CACHE_VERSION,
      },
      { status: 500 }
    );
  }
}, {
  feature: 'calculator',
  roles: ['owner', 'admin', 'manager', 'staff', 'viewer'],
});
