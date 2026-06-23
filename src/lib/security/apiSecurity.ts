import { NextResponse } from 'next/server';
import { z } from 'zod';

export function withValidation<T>(schema: z.ZodType<T>, handler: (data: T) => Promise<NextResponse>) {
  return async (request: Request) => {
    try {
      const body = await request.json();
      const parsed = schema.safeParse(body);
      
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Validation Error', details: parsed.error.format() },
          { status: 400 }
        );
      }
      
      return await handler(parsed.data);
    } catch (err) {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }
  };
}

// In-memory rate limiter for serverless environment (basic protection)
// For true distributed rate limiting, an Upstash Redis approach should be used.
const rateLimitMap = new Map<string, { count: number; expiresAt: number }>();

export async function rateLimit(identifier: string, limit: number, windowMs: number) {
  const now = Date.now();
  const record = rateLimitMap.get(identifier);

  if (!record || now > record.expiresAt) {
    rateLimitMap.set(identifier, { count: 1, expiresAt: now + windowMs });
    return { success: true };
  }

  if (record.count >= limit) {
    return { success: false };
  }

  record.count += 1;
  return { success: true };
}
