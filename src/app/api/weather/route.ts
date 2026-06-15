import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat');
  const lon = searchParams.get('lon');

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
