/**
 * GET /api/masters
 * =================
 * Returns all cached master data (panels, inverters, batteries,
 * state rules, subsidy slabs) in a single payload.
 *
 * The client store calls this once on boot. Response is cached
 * server-side for 5 minutes via unstable_cache (tag: 'masters').
 */

import { NextResponse } from 'next/server';
import { getCachedMasterData } from '@/lib/cache/masterCache';

export const dynamic = 'force-dynamic'; // Always run server-side, never statically pre-rendered

export async function GET() {
  try {
    const data = await getCachedMasterData();
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'no-store', // client should not cache; server cache handles it
      },
    });
  } catch (err) {
    console.error('[GET /api/masters] Error:', err);
    return NextResponse.json(
      { error: 'Failed to load master data from database' },
      { status: 500 }
    );
  }
}
