import 'server-only';

import type { User } from '@supabase/supabase-js';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import {
  DeviceMismatchError,
  DeviceNotRegisteredError,
  MembershipMissingError,
  SaasError,
  UnauthorizedRoleError,
  assertActiveSubscription,
  assertFeatureAccess,
  registerDevice,
} from '@/lib/saas';
import crypto from 'node:crypto';
import { UserDeviceRepository } from '@/lib/saas/repositories';
import { logLicenseEvent } from '@/lib/saas/services/licenseAuditService';
import type { OrgMember, OrgMemberRole, OrgSubscription, UserDevice } from '@/lib/saas';
import type { Database } from '@/lib/types/schema.types';

export type LicensedOrg = Database['public']['Tables']['organisations']['Row'];
export type LicensedPermission = 'billing:manage' | 'org:manage' | 'users:manage' | 'devices:manage' | 'settings:read';

export interface LicensedPermissions {
  role: OrgMemberRole;
  allowedRoles: OrgMemberRole[];
  canManageBilling: boolean;
  canManageOrg: boolean;
  canManageUsers: boolean;
  canManageDevices: boolean;
  permissions: LicensedPermission[];
}

export interface LicensedSession {
  user: User;
  org: LicensedOrg | null;
  orgId: string;
  member: OrgMember;
  subscription: OrgSubscription;
  device: UserDevice;
  permissions: LicensedPermissions;
}

export interface AuthenticatedOrgSession {
  user: User;
  org: LicensedOrg | null;
  orgId: string;
  member: OrgMember;
  subscription: OrgSubscription;
  permissions: LicensedPermissions;
}

export interface RequireLicensedSessionOptions {
  feature: string;
  roles?: OrgMemberRole[];
}

export interface RequireLicensedSessionDeps {
  getAuthenticatedUser?: () => Promise<User | null>;
  resolveActiveMembership?: (user: User) => Promise<OrgMember>;
  getOrgById?: (orgId: string) => Promise<LicensedOrg | null>;
  assertActiveSubscription?: typeof assertActiveSubscription;
  assertFeatureAccess?: typeof assertFeatureAccess;
  getDeviceById?: (deviceId: string) => Promise<UserDevice | null>;
  getActiveDevice?: (userId: string) => Promise<UserDevice | null>;
  audit?: typeof logLicenseEvent;
}

export type RequireAuthenticatedOrgSessionDeps = Pick<
  RequireLicensedSessionDeps,
  'getAuthenticatedUser' | 'resolveActiveMembership' | 'getOrgById' | 'assertActiveSubscription'
>;

export class AuthenticationRequiredError extends Error {
  readonly statusCode = 401;
  readonly redirectTo = '/login';
  readonly userMessage = 'Please sign in to continue.';
  readonly internalMessage = 'Licensed session guard blocked an unauthenticated request.';

  constructor() {
    super('Please sign in to continue.');
    this.name = 'AuthenticationRequiredError';
  }
}

const roleOrder: OrgMemberRole[] = ['viewer', 'staff', 'manager', 'admin', 'owner'];
const rolePermissions: Record<OrgMemberRole, LicensedPermission[]> = {
  owner: ['billing:manage', 'org:manage', 'users:manage', 'devices:manage', 'settings:read'],
  admin: ['org:manage', 'users:manage', 'devices:manage', 'settings:read'],
  manager: ['users:manage', 'settings:read'],
  staff: ['settings:read'],
  viewer: ['settings:read'],
};

function asOrgMemberRole(role: string): OrgMemberRole {
  return roleOrder.includes(role as OrgMemberRole) ? (role as OrgMemberRole) : 'staff';
}

function hasAllowedRole(role: OrgMemberRole, allowedRoles: OrgMemberRole[] | undefined) {
  return !allowedRoles?.length || allowedRoles.includes(role);
}

function buildPermissions(role: OrgMemberRole, allowedRoles: OrgMemberRole[] | undefined): LicensedPermissions {
  const permissions = rolePermissions[role] ?? rolePermissions.staff;

  return {
    role,
    allowedRoles: allowedRoles ?? roleOrder,
    canManageBilling: permissions.includes('billing:manage'),
    canManageOrg: permissions.includes('org:manage'),
    canManageUsers: permissions.includes('users:manage'),
    canManageDevices: permissions.includes('devices:manage'),
    permissions,
  };
}

function sessionPreferredOrgId(user: User) {
  const appMetadata = user.app_metadata as Record<string, unknown> | undefined;
  const userMetadata = user.user_metadata as Record<string, unknown> | undefined;
  const value =
    appMetadata?.active_org_id ??
    appMetadata?.org_id ??
    userMetadata?.active_org_id ??
    userMetadata?.org_id;

  return typeof value === 'string' && value.length > 0 ? value : null;
}

async function requestedOrgIdFromClient(request: Request) {
  const url = new URL(request.url);
  const queryOrgId = url.searchParams.get('orgId') ?? url.searchParams.get('org_id');
  const headerOrgId = request.headers.get('x-org-id');
  if (queryOrgId || headerOrgId) return queryOrgId ?? headerOrgId;

  const forwardedSearch = request.headers.get('x-enermass-search');
  if (forwardedSearch) {
    const params = new URLSearchParams(forwardedSearch.startsWith('?') ? forwardedSearch.slice(1) : forwardedSearch);
    const forwardedOrgId = params.get('orgId') ?? params.get('org_id');
    if (forwardedOrgId) return forwardedOrgId;
  }

  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) return null;

  try {
    const body = (await request.clone().json()) as unknown;
    if (!body || typeof body !== 'object') return null;
    const payload = body as Record<string, unknown>;
    const bodyOrgId = payload.orgId ?? payload.org_id;
    return typeof bodyOrgId === 'string' && bodyOrgId.length > 0 ? bodyOrgId : null;
  } catch {
    return null;
  }
}

async function assertNoClientOrgSpoof(
  request: Request,
  orgId: string,
  userId: string,
  audit: typeof logLicenseEvent = logLicenseEvent
) {
  const requestedOrgId = await requestedOrgIdFromClient(request);
  if (!requestedOrgId || requestedOrgId === orgId) return;

  await audit({
    orgId,
    userId,
    entityType: 'licensed_session',
    eventType: 'cross_org_attempt',
    eventData: { path: new URL(request.url).pathname, requestedOrgId },
  });

  throw new UnauthorizedRoleError({
    orgId,
    userId,
    requestedOrgId,
    reason: 'client_org_context_mismatch',
  });
}

async function defaultGetAuthenticatedUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

async function defaultResolveActiveMembership(user: User): Promise<OrgMember> {
  const supabase = createAdminClient();
  const preferredOrgId = sessionPreferredOrgId(user);

  const membersResult = await (supabase as any)
    .from('org_members')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });

  if (membersResult.error) {
    throw new MembershipMissingError({ userId: user.id, reason: membersResult.error.message });
  }

  const members = (membersResult.data ?? []) as OrgMember[];
  const activeMembers = members.filter((member) => member.status === 'active');
  const preferredMember = preferredOrgId
    ? activeMembers.find((member) => member.org_id === preferredOrgId)
    : null;

  const member = preferredMember ?? activeMembers[0] ?? null;
  if (member) return member;

  throw new MembershipMissingError({
    userId: user.id,
    preferredOrgId,
    memberCount: members.length,
  });
}

async function defaultGetOrgById(orgId: string) {
  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from('organisations')
    .select('*')
    .eq('id', orgId)
    .maybeSingle();

  if (error) throw new MembershipMissingError({ orgId, reason: error.message });
  return (data ?? null) as LicensedOrg | null;
}

async function defaultGetDeviceById(deviceId: string) {
  return new UserDeviceRepository().getById(deviceId) as Promise<UserDevice | null>;
}

async function defaultGetActiveDevice(userId: string) {
  return new UserDeviceRepository().getActiveForUser(userId) as Promise<UserDevice | null>;
}

export function isLicensedSessionError(error: unknown): error is SaasError | AuthenticationRequiredError {
  return error instanceof SaasError || error instanceof AuthenticationRequiredError;
}

export async function requireAuthenticatedOrgSession(
  options: { roles?: OrgMemberRole[] } = {},
  deps: RequireAuthenticatedOrgSessionDeps = {}
): Promise<AuthenticatedOrgSession> {
  const getAuthenticatedUser = deps.getAuthenticatedUser ?? defaultGetAuthenticatedUser;
  const user = await getAuthenticatedUser();

  if (!user) {
    throw new AuthenticationRequiredError();
  }

  const resolveActiveMembership = deps.resolveActiveMembership ?? defaultResolveActiveMembership;
  const member = await resolveActiveMembership(user);
  const orgId = member.org_id;
  const role = asOrgMemberRole(member.role);

  if (!hasAllowedRole(role, options.roles)) {
    throw new UnauthorizedRoleError({ orgId, userId: user.id, role, allowedRoles: options.roles ?? [] });
  }

  const assertSubscription = deps.assertActiveSubscription ?? assertActiveSubscription;
  const subscription = await assertSubscription(orgId);

  const getOrgById = deps.getOrgById ?? defaultGetOrgById;
  const org = await getOrgById(orgId);

  return {
    user,
    org,
    orgId,
    member: { ...member, role },
    subscription,
    permissions: buildPermissions(role, options.roles),
  };
}

export async function requireLicensedSession(
  request: Request,
  options: RequireLicensedSessionOptions,
  deps: RequireLicensedSessionDeps = {}
): Promise<LicensedSession> {
  const getAuthenticatedUser = deps.getAuthenticatedUser ?? defaultGetAuthenticatedUser;
  const user = await getAuthenticatedUser();

  if (!user) {
    throw new AuthenticationRequiredError();
  }

  const resolveActiveMembership = deps.resolveActiveMembership ?? defaultResolveActiveMembership;
  const member = await resolveActiveMembership(user);
  const orgId = member.org_id;
  const role = asOrgMemberRole(member.role);
  await assertNoClientOrgSpoof(request, orgId, user.id, deps.audit);

  const assertSubscription = deps.assertActiveSubscription ?? assertActiveSubscription;
  const subscription = await assertSubscription(orgId);

  const getActiveDevice = deps.getActiveDevice ?? defaultGetActiveDevice;
  let activeDevice = await getActiveDevice(user.id);

  let deviceToken = '';
  const cookieHeader = request.headers.get('cookie');
  if (cookieHeader) {
    const match = cookieHeader.match(/(?:^|;\s*)enermass_device_token=([^;]*)/);
    if (match) {
      deviceToken = match[1];
    }
  }

  if (!deviceToken) {
    try {
      const { cookies } = require('next/headers');
      const cookieStore = await cookies();
      deviceToken = cookieStore.get('enermass_device_token')?.value || '';
    } catch {
      // Graceful fallback for non-request environments (e.g., test runners)
    }
  }

  // Case 1: No device exists at all → auto-register one
  if (!activeDevice) {
    // If we have a device token cookie, use it to register; otherwise we cannot proceed
    // from SSR context (we can't set cookies from a Server Component render).
    // Throw DeviceNotRegisteredError so the client-side verify flow takes over.
    if (!deviceToken) {
      throw new DeviceNotRegisteredError({ orgId, userId: user.id, deviceId: 'none' });
    }

    // We have a cookie but no device record → auto-register using the cookie token
    const secretHash = crypto.createHash('sha256').update(deviceToken).digest('hex');
    const userAgent = request.headers.get('user-agent') ?? 'Unknown Device';

    const newDevice = await registerDevice(user.id, orgId, {
      deviceSecretHash: secretHash,
      deviceName: userAgent,
      browser: null,
      os: null,
    });

    activeDevice = newDevice;
  } else {
    // Case 2: Device exists → verify status and token
    if (activeDevice.status !== 'active' || activeDevice.user_id !== user.id || activeDevice.org_id !== orgId) {
      throw new DeviceNotRegisteredError({ orgId, userId: user.id, deviceId: activeDevice.id });
    }

    if (!deviceToken) {
      throw new DeviceMismatchError({ orgId, userId: user.id, activeDeviceId: activeDevice.id });
    }

    const secretHash = crypto.createHash('sha256').update(deviceToken).digest('hex');
    if (secretHash !== activeDevice.device_secret_hash) {
      throw new DeviceMismatchError({ orgId, userId: user.id, activeDeviceId: activeDevice.id });
    }
  }

  const device = activeDevice;

  const assertFeature = deps.assertFeatureAccess ?? assertFeatureAccess;
  await assertFeature(orgId, options.feature);

  if (!hasAllowedRole(role, options.roles)) {
    throw new UnauthorizedRoleError({ orgId, userId: user.id, role, allowedRoles: options.roles ?? [] });
  }

  const getOrgById = deps.getOrgById ?? defaultGetOrgById;
  const org = await getOrgById(orgId);

  return {
    user,
    org,
    orgId,
    member: { ...member, role },
    subscription,
    device,
    permissions: buildPermissions(role, options.roles),
  };
}
