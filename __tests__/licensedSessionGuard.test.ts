import { describe, expect, it, vi, beforeEach } from 'vitest';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const nextMocks = vi.hoisted(() => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  headers: vi.fn(async () => new Headers({ 'cookie': 'enermass_device_token=token' })),
  cookies: vi.fn(async () => ({
    getAll: () => [],
    get: () => undefined,
    set: () => undefined,
  })),
}));

vi.mock('next/navigation', () => ({
  redirect: nextMocks.redirect,
}));

vi.mock('next/headers', () => ({
  headers: nextMocks.headers,
  cookies: nextMocks.cookies,
}));

import { requireLicensedSession, type RequireLicensedSessionDeps } from '@/lib/auth/requireLicensedSession';
import { withLicensedApiRoute } from '@/lib/auth/withLicensedApiRoute';
import { requireLicensedPage } from '@/lib/auth/requireLicensedPage';
import {
  FeatureNotEnabledError,
  MembershipMissingError,
  SubscriptionExpiredError,
  UnauthorizedRoleError,
  DeviceMismatchError,
} from '@/lib/saas';
import type { OrgMember, OrgSubscription, UserDevice } from '@/lib/saas';
import type { User } from '@supabase/supabase-js';

const orgId = '11111111-1111-4111-8111-111111111111';
const spoofedOrgId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const userId = '22222222-2222-4222-8222-222222222222';
const subscriptionId = '33333333-3333-4333-8333-333333333333';
const planId = '44444444-4444-4444-8444-444444444444';
const memberId = '55555555-5555-4555-8555-555555555555';
const deviceId = '66666666-6666-4666-8666-666666666666';

function user(overrides: Partial<User> = {}): User {
  return {
    id: userId,
    aud: 'authenticated',
    role: 'authenticated',
    email: 'user@example.com',
    email_confirmed_at: '2026-06-01T00:00:00.000Z',
    app_metadata: { active_org_id: orgId },
    user_metadata: {},
    created_at: '2026-06-01T00:00:00.000Z',
    ...overrides,
  } as User;
}

function member(overrides: Partial<OrgMember> = {}): OrgMember {
  return {
    id: memberId,
    org_id: orgId,
    user_id: userId,
    role: 'staff',
    status: 'active',
    created_at: '2026-06-01T00:00:00.000Z',
    updated_at: '2026-06-01T00:00:00.000Z',
    ...overrides,
  };
}

function subscription(overrides: Partial<OrgSubscription> = {}): OrgSubscription {
  return {
    id: subscriptionId,
    org_id: orgId,
    plan_id: planId,
    status: 'active',
    seat_limit: 2,
    billing_cycle: 'monthly',
    current_period_start: '2026-06-01T00:00:00.000Z',
    current_period_end: '2026-07-01T00:00:00.000Z',
    trial_ends_at: null,
    cancelled_at: null,
    created_at: '2026-06-01T00:00:00.000Z',
    updated_at: '2026-06-01T00:00:00.000Z',
    ...overrides,
  };
}

function device(overrides: Partial<UserDevice> = {}): UserDevice {
  return {
    id: deviceId,
    org_id: orgId,
    user_id: userId,
    device_secret_hash: '3c469e9d6c5875d37a43f353d4f88e61fcf812c66eee3457465a40b0da4153e0', // SHA-256 of 'token'
    device_name: 'Chrome',
    browser: 'Chrome',
    os: 'Windows',
    status: 'active',
    first_seen_at: '2026-06-01T00:00:00.000Z',
    last_seen_at: '2026-06-01T00:00:00.000Z',
    revoked_at: null,
    public_key: null,
    fingerprint_hash: null,
    ...overrides,
  };
}

function licensedDeps(overrides: Partial<RequireLicensedSessionDeps> = {}): RequireLicensedSessionDeps {
  return {
    getAuthenticatedUser: vi.fn().mockResolvedValue(user()),
    resolveActiveMembership: vi.fn().mockResolvedValue(member()),
    getOrgById: vi.fn().mockResolvedValue({ id: orgId, name: 'EnerMass' }),
    assertActiveSubscription: vi.fn().mockResolvedValue(subscription()),
    assertFeatureAccess: vi.fn().mockResolvedValue({}),
    getActiveDevice: vi.fn().mockResolvedValue(device()),
    getDeviceById: vi.fn().mockResolvedValue(device()),
    audit: vi.fn().mockResolvedValue({}),
    ...overrides,
  };
}

describe('requireLicensedSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthenticated requests', async () => {
    const handler = vi.fn();
    const GET = withLicensedApiRoute(handler, {
      feature: 'calculator',
      roles: ['staff'],
      deps: licensedDeps({ getAuthenticatedUser: vi.fn().mockResolvedValue(null) }),
    });

    const response = await GET(new Request('https://app.test/api/master', { headers: { 'cookie': 'enermass_device_token=token' } }), {});
    await expect(response.json()).resolves.toMatchObject({
      error: 'AuthenticationRequiredError',
      redirectTo: '/login',
    });
    expect(response.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it('redirects expired orgs from page guards', async () => {
    await expect(
      requireLicensedPage({
        feature: 'calculator',
        roles: ['staff'],
        deps: licensedDeps({
          assertActiveSubscription: vi.fn().mockRejectedValue(new SubscriptionExpiredError()),
        }),
      })
    ).rejects.toThrow('REDIRECT:/subscription-expired');
    expect(nextMocks.redirect).toHaveBeenCalledWith('/subscription-expired');
  });

  it('rejects users with the wrong role', async () => {
    await expect(
      requireLicensedSession(
        new Request('https://app.test/calculator', { headers: { 'cookie': 'enermass_device_token=token' } }),
        {
          feature: 'calculator',
          roles: ['admin'],
        },
        licensedDeps()
      )
    ).rejects.toBeInstanceOf(UnauthorizedRoleError);
  });

  it('rejects disabled users during membership resolution', async () => {
    await expect(
      requireLicensedSession(
        new Request('https://app.test/calculator', { headers: { 'cookie': 'enermass_device_token=token' } }),
        {
          feature: 'calculator',
          roles: ['staff'],
        },
        licensedDeps({
          resolveActiveMembership: vi.fn().mockRejectedValue(new MembershipMissingError()),
        })
      )
    ).rejects.toBeInstanceOf(MembershipMissingError);
  });

  it('rejects disabled features', async () => {
    await expect(
      requireLicensedSession(
        new Request('https://app.test/inventory', { headers: { 'cookie': 'enermass_device_token=token' } }),
        {
          feature: 'inventory',
          roles: ['staff'],
        },
        licensedDeps({
          assertFeatureAccess: vi.fn().mockRejectedValue(new FeatureNotEnabledError()),
        })
      )
    ).rejects.toBeInstanceOf(FeatureNotEnabledError);
  });

  it('accepts a valid licensed user', async () => {
    await expect(
      requireLicensedSession(
        new Request('https://app.test/calculator', { headers: { 'cookie': 'enermass_device_token=token' } }),
        {
          feature: 'calculator',
          roles: ['staff'],
        },
        licensedDeps()
      )
    ).resolves.toMatchObject({
      orgId,
      member: { id: memberId },
      subscription: { id: subscriptionId },
      device: { id: '00000000-0000-0000-0000-000000000000' },
      permissions: { role: 'staff' },
    });
  });

  it('rejects spoofed org_id query and body values with 403 Unauthorized', async () => {
    const handler = vi.fn(async (_request, context) => Response.json({ orgId: context.session.orgId }));
    const POST = withLicensedApiRoute(handler, {
      feature: 'calculator',
      roles: ['staff'],
      deps: licensedDeps(),
    });

    const response = await POST(
      new Request(`https://app.test/api/master?org_id=${spoofedOrgId}&orgId=${spoofedOrgId}`, {
        method: 'POST',
        headers: { 'cookie': 'enermass_device_token=token' },
        body: JSON.stringify({ org_id: spoofedOrgId, orgId: spoofedOrgId }),
      }),
      {}
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: 'UnauthorizedRoleError',
      redirectTo: '/dashboard',
    });
  });

  it('protects direct API calls before route logic runs', async () => {
    const handler = vi.fn(async () => Response.json({ ok: true }));
    const GET = withLicensedApiRoute(handler, {
      feature: 'calculator',
      roles: ['staff'],
      deps: licensedDeps({
        resolveActiveMembership: vi.fn().mockRejectedValue(new MembershipMissingError()),
      }),
    });

    const response = await GET(new Request('https://app.test/api/master', { headers: { 'cookie': 'enermass_device_token=token' } }), {});

    expect(response.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      error: 'MembershipMissingError',
    });
  });
});
