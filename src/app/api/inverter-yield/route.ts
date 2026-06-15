import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const inverterId = searchParams.get('id');

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
