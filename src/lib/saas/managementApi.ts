import { NextResponse } from 'next/server';
import { AuthenticationRequiredError } from '@/lib/auth/requireLicensedSession';

export async function parseJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

export function jsonForManagementError(error: unknown) {
  if (error instanceof Response) return error;
  if (error instanceof AuthenticationRequiredError) {
    return NextResponse.json({ error: error.name, message: error.userMessage, redirectTo: error.redirectTo }, { status: error.statusCode });
  }
  if (error && typeof error === 'object' && 'statusCode' in error && 'userMessage' in error) {
    const authError = error as { name?: string; statusCode: number; userMessage: string; redirectTo?: string };
    return NextResponse.json(
      { error: authError.name ?? 'SaasError', message: authError.userMessage, redirectTo: authError.redirectTo },
      { status: authError.statusCode }
    );
  }
  console.error('[managementApi] Unexpected error:', error);
  return NextResponse.json({ error: 'InternalServerError', message: 'Internal server error' }, { status: 500 });
}
