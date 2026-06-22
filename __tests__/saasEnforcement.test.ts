import { describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';
import {
  SubscriptionExpiredError,
  FeatureNotEnabledError,
  DeviceMismatchError,
  UnauthorizedRoleError,
} from '@/lib/saas/errors';
import {
  AuthenticationRequiredError,
  requireLicensedSession,
} from '@/lib/auth/requireLicensedSession';
import { withLicensedApiRoute } from '@/lib/auth/withLicensedApiRoute';
import type { OrgMember, OrgSubscription, SubscriptionPlan, UserDevice } from '@/lib/saas/types';
import type { User } from '@supabase/supabase-js';

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const orgId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const userId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const planId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const subscriptionId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const deviceId = '22222222-2222-4222-8222-222222222222';
const now = new Date('2026-06-20T12:00:00.000Z');

const mockUser: User = {
  id: userId,
  aud: 'authenticated',
  email: 'user@test.com',
  role: 'authenticated',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  app_metadata: { provider: 'email' },
  user_metadata: {},
  identities: [],
} as unknown as User;

function mkSub(overrides: Partial<OrgSubscription> = {}): OrgSubscription {
  return {
    id: subscriptionId,
    org_id: orgId,
    plan_id: planId,
    status: 'active',
    seat_limit: 5,
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

function mkPlan(overrides: Partial<SubscriptionPlan> = {}): SubscriptionPlan {
  return {
    id: planId,
    name: 'Pro',
    code: 'pro',
    monthly_price: 999,
    yearly_price: 9990,
    seat_limit: 5,
    features: { calculator: true, erp: true, custom_rates: false },
    is_active: true,
    created_at: '2026-06-01T00:00:00.000Z',
    updated_at: '2026-06-01T00:00:00.000Z',
    ...overrides,
  };
}

function mkMember(overrides: Partial<OrgMember> = {}): OrgMember {
  return {
    id: 'mem-1',
    org_id: orgId,
    user_id: userId,
    role: 'staff',
    status: 'active',
    created_at: '2026-06-01T00:00:00.000Z',
    updated_at: '2026-06-01T00:00:00.000Z',
    ...overrides,
  };
}

function mkDevice(overrides: Partial<UserDevice> = {}): UserDevice {
  return {
    id: deviceId,
    org_id: orgId,
    user_id: userId,
    device_secret_hash: '397a2a9c5bf5e2ccec38c2596b682bb1bd05fe6e4ecea6c10cf42755ff225403', // SHA-256 of 'valid-token'
    device_name: 'Test Browser',
    browser: 'Chrome',
    os: 'Windows',
    status: 'active',
    first_seen_at: '2026-06-01T00:00:00.000Z',
    last_seen_at: '2026-06-20T12:00:00.000Z',
    revoked_at: null,
    public_key: null,
    ...overrides,
  };
}

function makeRequest(headers: Record<string, string> = {}) {
  return new Request('https://app.local/api/test', { headers });
}

function validHeaders() {
  return {
    'cookie': 'enermass_device_token=valid-token',
  };
}

/** Builds deps that represent a fully licensed, healthy session. */
function happyDeps(overrides: Record<string, unknown> = {}) {
  return {
    getAuthenticatedUser: vi.fn().mockResolvedValue(mockUser),
    resolveActiveMembership: vi.fn().mockResolvedValue(mkMember({ role: 'staff' })),
    getOrgById: vi.fn().mockResolvedValue({ id: orgId, name: 'Test Org', created_at: '2026-01-01T00:00:00.000Z' }),
    assertActiveSubscription: vi.fn().mockResolvedValue(mkSub()),
    assertFeatureAccess: vi.fn().mockResolvedValue(undefined),
    getActiveDevice: vi.fn().mockResolvedValue(mkDevice()),
    audit: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

// ─── requireLicensedSession — core guard tests ────────────────────────────────

describe('requireLicensedSession', () => {
  it('throws AuthenticationRequiredError when user is not authenticated', async () => {
    const deps = {
      ...happyDeps(),
      getAuthenticatedUser: vi.fn().mockResolvedValue(null),
    };
    await expect(
      requireLicensedSession(makeRequest(validHeaders()), { feature: 'calculator' }, deps)
    ).rejects.toBeInstanceOf(AuthenticationRequiredError);
  });

  it('throws SubscriptionExpiredError when subscription is expired', async () => {
    const deps = {
      ...happyDeps(),
      assertActiveSubscription: vi.fn().mockRejectedValue(
        new SubscriptionExpiredError({ orgId, subscription: mkSub({ status: 'expired' }) })
      ),
    };
    await expect(
      requireLicensedSession(makeRequest(validHeaders()), { feature: 'calculator' }, deps)
    ).rejects.toBeInstanceOf(SubscriptionExpiredError);
  });

  it('throws FeatureNotEnabledError when custom_rates is disabled', async () => {
    const deps = {
      ...happyDeps(),
      assertFeatureAccess: vi.fn().mockRejectedValue(
        new FeatureNotEnabledError({ orgId, feature: 'custom_rates' })
      ),
    };
    await expect(
      requireLicensedSession(makeRequest(validHeaders()), { feature: 'custom_rates' }, deps)
    ).rejects.toBeInstanceOf(FeatureNotEnabledError);
  });

  it('throws DeviceMismatchError when device fingerprint changes', async () => {
    const deps = {
      ...happyDeps(),
      getActiveDevice: vi.fn().mockResolvedValue(mkDevice({
        device_secret_hash: 'different-hash',
      })),
    };
    await expect(
      requireLicensedSession(makeRequest(validHeaders()), { feature: 'calculator' }, deps)
    ).rejects.toBeInstanceOf(DeviceMismatchError);
  });

  it('throws UnauthorizedRoleError when viewer role tries admin route', async () => {
    const deps = {
      ...happyDeps(),
      resolveActiveMembership: vi.fn().mockResolvedValue(mkMember({ role: 'viewer' })),
    };
    await expect(
      requireLicensedSession(makeRequest(validHeaders()), { feature: 'calculator', roles: ['admin', 'owner'] }, deps)
    ).rejects.toBeInstanceOf(UnauthorizedRoleError);
  });

  it('succeeds for a fully licensed staff user accessing a staff-allowed route', async () => {
    const deps = happyDeps();
    const session = await requireLicensedSession(
      makeRequest(validHeaders()),
      { feature: 'calculator', roles: ['owner', 'admin', 'manager', 'staff'] },
      deps
    );
    expect(session.orgId).toBe(orgId);
    expect(session.user.id).toBe(userId);
    expect(session.device.id).toBe(deviceId);
  });

  it('org_id is derived from session, not from query params (spoofing blocked)', async () => {
    const evilOrgId = 'evil-org-id-0000-0000-0000-0000000000';
    const request = new Request(
      `https://app.local/api/test?org_id=${evilOrgId}`,
      { headers: validHeaders() }
    );
    const deps = happyDeps();
    await expect(
      requireLicensedSession(request, { feature: 'calculator' }, deps)
    ).rejects.toBeInstanceOf(UnauthorizedRoleError);
  });
});

// ─── withLicensedApiRoute — HTTP response wrapping ───────────────────────────

describe('withLicensedApiRoute HTTP responses', () => {
  it('returns 401 JSON for unauthenticated requests', async () => {
    const handler = withLicensedApiRoute(
      async () => NextResponse.json({ ok: true }),
      {
        feature: 'calculator',
        deps: {
          ...happyDeps(),
          getAuthenticatedUser: vi.fn().mockResolvedValue(null),
        },
      }
    );
    const response = await handler(makeRequest(validHeaders()), {});
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('AuthenticationRequiredError');
  });

  it('returns 402/403 for expired subscription', async () => {
    const handler = withLicensedApiRoute(
      async () => NextResponse.json({ ok: true }),
      {
        feature: 'calculator',
        deps: {
          ...happyDeps(),
          assertActiveSubscription: vi.fn().mockRejectedValue(
            new SubscriptionExpiredError({ orgId, subscription: mkSub({ status: 'expired' }) })
          ),
        },
      }
    );
    const response = await handler(makeRequest(validHeaders()), {});
    expect(response.status).toBeGreaterThanOrEqual(402);
    expect(response.status).toBeLessThanOrEqual(403);
  });

  it('returns 403 for feature access denied', async () => {
    const handler = withLicensedApiRoute(
      async () => NextResponse.json({ ok: true }),
      {
        feature: 'custom_rates',
        deps: {
          ...happyDeps(),
          assertFeatureAccess: vi.fn().mockRejectedValue(
            new FeatureNotEnabledError({ orgId, feature: 'custom_rates' })
          ),
        },
      }
    );
    const response = await handler(makeRequest(validHeaders()), {});
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe('FeatureNotEnabledError');
  });

  it('returns 403 for device mismatch', async () => {
    const handler = withLicensedApiRoute(
      async () => NextResponse.json({ ok: true }),
      {
        feature: 'calculator',
        deps: {
          ...happyDeps(),
          getActiveDevice: vi.fn().mockResolvedValue(mkDevice({
            device_secret_hash: 'different-hash',
          })),
        },
      }
    );
    const response = await handler(makeRequest(validHeaders()), {});
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe('DeviceMismatchError');
  });

  it('returns 403 for insufficient role (viewer on admin route)', async () => {
    const handler = withLicensedApiRoute(
      async () => NextResponse.json({ ok: true }),
      {
        feature: 'calculator',
        roles: ['admin', 'owner'],
        deps: {
          ...happyDeps(),
          resolveActiveMembership: vi.fn().mockResolvedValue(mkMember({ role: 'viewer' })),
        },
      }
    );
    const response = await handler(makeRequest(validHeaders()), {});
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe('UnauthorizedRoleError');
  });

  it('passes session to handler on success', async () => {
    let capturedOrgId: string | null = null;
    const handler = withLicensedApiRoute(
      async (_req, context) => {
        capturedOrgId = context.session.orgId;
        return NextResponse.json({ ok: true });
      },
      {
        feature: 'calculator',
        deps: happyDeps(),
      }
    );
    const response = await handler(makeRequest(validHeaders()), {});
    expect(response.status).toBe(200);
    expect(capturedOrgId).toBe(orgId);
  });
});

// ─── Route inventory verification ─────────────────────────────────────────────

describe('Route inventory — withLicensedApiRoute is used for protected modules', () => {
  it('withLicensedApiRoute and withAuth wrapper are different APIs', async () => {
    const { withLicensedApiRoute: licensed } = await import('@/lib/auth/withLicensedApiRoute');
    const { withAuth } = await import('@/lib/api/wrappers');
    expect(licensed).toBeDefined();
    expect(withAuth).toBeDefined();
    expect(licensed).not.toBe(withAuth);
  });

  it('AuthenticationRequiredError has statusCode=401 and redirectTo=/login', () => {
    const err = new AuthenticationRequiredError();
    expect(err.statusCode).toBe(401);
    expect(err.redirectTo).toBe('/login');
    expect(err.name).toBe('AuthenticationRequiredError');
  });
});
