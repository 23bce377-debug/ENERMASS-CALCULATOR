import { NextResponse } from 'next/server';
import { getCachedMasterData, CACHE_VERSION } from '@/lib/cache/masterCache';
import crypto from 'crypto';

export async function GET(request: Request) {
  try {
    const data = await getCachedMasterData();
    
    // Generate ETag based on version and generation time
    const etag = crypto
      .createHash('md5')
      .update(`${CACHE_VERSION}:${data.generatedAt}`)
      .digest('hex');

    const ifNoneMatch = request.headers.get('If-None-Match');
    if (ifNoneMatch === etag) {
      return new NextResponse(null, { status: 304 });
    }

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=60',
        'ETag': etag,
        'Content-Type': 'application/json; charset=utf-8'
      }
    });
  } catch (error) {
    console.error('[API/Master] Failed to fetch master data:', error);
    return NextResponse.json({ error: 'Failed to fetch master data' }, { status: 500 });
  }
}
