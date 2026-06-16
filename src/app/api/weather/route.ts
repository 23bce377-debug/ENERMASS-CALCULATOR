import { NextResponse } from 'next/server';
import { z } from 'zod';

const weatherQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90).optional(),
  lon: z.coerce.number().min(-180).max(180).optional(),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parseResult = weatherQuerySchema.safeParse(Object.fromEntries(searchParams.entries()));
  if (!parseResult.success) {
    return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 });
  }
  const { lat, lon } = parseResult.data;

  // Mock weather data
  return NextResponse.json({
    location: { lat, lon },
    current: {
      temperature: 32,
      condition: 'Sunny',
      cloudCover: 10,
      irradiance: 850 // W/m2
    },
    forecast: [
      { day: 'Tomorrow', condition: 'Clear', temp: 33 },
      { day: 'Day 3', condition: 'Partly Cloudy', temp: 31 }
    ]
  });
}
