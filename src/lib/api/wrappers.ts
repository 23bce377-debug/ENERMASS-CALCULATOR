import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hasPermission, logAuditEvent } from '@/backend/orm/governance';

export interface AuthContext {
  userId: string;
  orgId: string;
  role: string;
}

export type AuthenticatedRouteHandler = (
  request: Request,
  context: { params: any; auth: AuthContext }
) => Promise<NextResponse> | Promise<Response>;

/**
 * Higher-order Route Handler wrapper that enforces authentication and resolves tenant context (org_id, role).
 */
export function withAuth(handler: AuthenticatedRouteHandler) {
  return async (request: Request, context: { params: any }) => {
    try {
      const supabase = await createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      // Fetch user profile from database to get org_id & role
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('org_id, role')
        .eq('id', user.id)
        .single();

      if (profileError || !profile) {
        return NextResponse.json({ error: 'Org profile not found' }, { status: 404 });
      }

      const authContext: AuthContext = {
        userId: user.id,
        orgId: profile.org_id,
        role: profile.role,
      };

      return await handler(request, { ...context, auth: authContext });
    } catch (error: any) {
      console.error('[API Auth Wrapper Error]:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  };
}

/**
 * Route Handler wrapper that enforces specific user roles.
 */
export function withRole(allowedRoles: string[], handler: AuthenticatedRouteHandler) {
  return withAuth(async (request: Request, context) => {
    if (!allowedRoles.includes(context.auth.role)) {
      return NextResponse.json({ error: 'Forbidden: Insufficient role' }, { status: 403 });
    }
    return await handler(request, context);
  });
}

/**
 * Route Handler wrapper that enforces a specific permission code.
 */
export function withPermission(permissionCode: string, handler: AuthenticatedRouteHandler) {
  return withAuth(async (request: Request, context) => {
    const { userId } = context.auth;
    const hasPerm = await hasPermission(userId, permissionCode);
    if (!hasPerm) {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
    }
    return await handler(request, context);
  });
}

/**
 * Route Handler wrapper that automatically records a successful action to the Audit Logs.
 */
export function withAudit(module: string, action: string, handler: AuthenticatedRouteHandler) {
  return withAuth(async (request: Request, context) => {
    const response = await handler(request, context);
    
    // Log audit event after successful execution (2xx status codes)
    if (response.status >= 200 && response.status < 300) {
      try {
        const { orgId, userId } = context.auth;
        const ip = request.headers.get('x-forwarded-for') || '';
        const userAgent = request.headers.get('user-agent') || '';
        
        await logAuditEvent({
          org_id: orgId,
          module,
          entity_type: 'api_route',
          entity_id: userId,
          action,
          actor_id: userId,
          ip_address: ip,
          user_agent: userAgent,
        });
      } catch (err) {
        console.error('[withAudit] Failed to log audit event:', err);
      }
    }
    return response;
  });
}
