/**
 * /api/debug — Disabled in all environments.
 *
 * This route previously exposed raw DB data without authentication.
 * It has been locked down to prevent accidental data exposure.
 * Monitoring and debugging should be done via /api/erp/health (authenticated).
 */
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    { error: 'Forbidden', message: 'Debug endpoint is disabled.' },
    { status: 403 }
  );
}
