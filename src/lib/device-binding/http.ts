import { NextResponse } from 'next/server';
import { z } from 'zod';
import { SaasError } from '@/lib/saas';

export const deviceResetRequestPayloadSchema = z.object({
  device_name: z.string().min(1).nullable().optional(),
  browser: z.string().min(1).nullable().optional(),
  os: z.string().min(1).nullable().optional(),
  reason: z.string().min(1).max(1000).nullable().optional(),
});

export const adminResetPayloadSchema = z.object({
  request_id: z.string().uuid(),
});

export async function parseJsonBody<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new Response(JSON.stringify({ error: 'BadRequest', message: 'Request body must be valid JSON.' }), { status: 400 });
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    throw new Response(
      JSON.stringify({
        error: 'BadRequest',
        message: 'Request body is invalid.',
        issues: result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
      }),
      { status: 400 }
    );
  }

  return result.data;
}

export function requestIp(request: Request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? request.headers.get('x-real-ip') ?? null;
}

export function requestUserAgent(request: Request) {
  return request.headers.get('user-agent');
}

export function jsonForDeviceError(error: unknown) {
  if (error instanceof Response) return error;

  if (error instanceof SaasError) {
    return NextResponse.json(
      { error: error.name, message: error.userMessage, redirectTo: error.redirectTo },
      { status: error.statusCode }
    );
  }

  if (error instanceof Error && error.message === 'Malformed device public key') {
    return NextResponse.json({ error: 'BadRequest', message: 'Device public key is malformed.' }, { status: 400 });
  }

  console.error('[device-binding] Unexpected device API error:', error);
  return NextResponse.json({ error: 'InternalServerError', message: 'Internal server error' }, { status: 500 });
}
