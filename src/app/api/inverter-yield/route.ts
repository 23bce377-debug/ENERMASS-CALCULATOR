import { NextResponse } from 'next/server';
import { z } from 'zod';

const yieldQuerySchema = z.object({
  id: z.string().optional(),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parseResult = yieldQuerySchema.safeParse(Object.fromEntries(searchParams.entries()));
  if (!parseResult.success) {
    return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 });
  }
  const { id: inverterId } = parseResult.data;

  // Mock inverter yield data
  return NextResponse.json({
    inverterId: inverterId || 'INV-001',
    dailyYieldKwh: 15.4,
    monthlyYieldKwh: 450.2,
    totalYieldKwh: 5400.8,
    status: 'online',
    lastUpdated: new Date().toISOString()
  });
}
