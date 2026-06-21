import { NextResponse } from 'next/server';
import { logLicenseEvent } from '@/lib/saas/services/licenseAuditService';
import {
  AuthenticationRequiredError,
  isLicensedSessionError,
  requireLicensedSession,
  type LicensedSession,
  type RequireLicensedSessionDeps,
  type RequireLicensedSessionOptions,
} from './requireLicensedSession';

export interface LicensedApiContext<RouteContext extends object = { params?: unknown }> {
  session: LicensedSession;
  route: RouteContext;
}

export type LicensedApiHandler<RouteContext extends object = { params?: unknown }> = (
  request: Request,
  context: LicensedApiContext<RouteContext>
) => Promise<Response> | Response;

export interface LicensedApiRouteOptions extends RequireLicensedSessionOptions {
  deps?: RequireLicensedSessionDeps;
}

function jsonForAuthError(error: unknown) {
  if (error instanceof Response) return error;

  if (isLicensedSessionError(error)) {
    return NextResponse.json(
      {
        error: error.name,
        message: error.userMessage,
        redirectTo: error.redirectTo,
      },
      { status: error.statusCode }
    );
  }

  console.error('[withLicensedApiRoute] Unexpected authorization error:', error);
  return NextResponse.json({ error: 'InternalServerError', message: 'Internal server error' }, { status: 500 });
}



export function withLicensedApiRoute<RouteContext extends object = { params?: unknown }>(
  handler: LicensedApiHandler<RouteContext>,
  options: LicensedApiRouteOptions
) {
  return async (request: Request, routeContext: RouteContext) => {
    try {
      const session = await requireLicensedSession(request, options, options.deps);
      return await handler(request, { route: routeContext, session });
    } catch (error) {
      return jsonForAuthError(error);
    }
  };
}

export { AuthenticationRequiredError };
