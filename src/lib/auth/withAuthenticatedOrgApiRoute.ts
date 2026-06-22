import { NextResponse } from 'next/server';
import {
  isLicensedSessionError,
  requireAuthenticatedOrgSession,
  type AuthenticatedOrgSession,
  type RequireAuthenticatedOrgSessionDeps,
} from './requireLicensedSession';
import type { OrgMemberRole } from '@/lib/saas/types';

export interface AuthenticatedOrgApiContext<RouteContext extends object = { params?: unknown }> {
  session: AuthenticatedOrgSession;
  route: RouteContext;
}

export type AuthenticatedOrgApiHandler<RouteContext extends object = { params?: unknown }> = (
  request: Request,
  context: AuthenticatedOrgApiContext<RouteContext>
) => Promise<Response> | Response;

export interface AuthenticatedOrgApiRouteOptions {
  roles?: OrgMemberRole[];
  deps?: RequireAuthenticatedOrgSessionDeps;
}

export function jsonForLicensedError(error: unknown) {
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

  console.error('[withAuthenticatedOrgApiRoute] Unexpected authorization error:', error);
  return NextResponse.json({ error: 'InternalServerError', message: 'Internal server error' }, { status: 500 });
}

export function withAuthenticatedOrgApiRoute<RouteContext extends object = { params?: unknown }>(
  handler: AuthenticatedOrgApiHandler<RouteContext>,
  options: AuthenticatedOrgApiRouteOptions = {}
) {
  return async (request: Request, routeContext: RouteContext) => {
    try {
      const session = await requireAuthenticatedOrgSession({ roles: options.roles }, options.deps);
      return await handler(request, { route: routeContext, session });
    } catch (error) {
      return jsonForLicensedError(error);
    }
  };
}
