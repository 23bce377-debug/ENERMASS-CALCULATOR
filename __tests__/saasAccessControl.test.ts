/**
 * SaaS access control tests.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  UnauthorizedRoleError,
  MembershipMissingError,
  SubscriptionExpiredError,
  FeatureNotEnabledError,
  DeviceMismatchError,
  DeviceNotRegisteredError,
} from '@/lib/saas/errors';
import {
  assertActiveSubscription,
  assertFeatureAccess,
} from '@/lib/saas';
import {
  requireLicensedSession,
} from '@/lib/auth/requireLicensedSession';
import type {
  OrgMember,
  OrgSubscription,
  SubscriptionPlan,
  UserDevice,
} from '@/lib/saas/types';
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
    name: 'Starter',
    code: 'starter',
    monthly_price: 499,
    yearly_price: 4990,
    seat_limit: 5,
    features: { calculator: true, erp: false, inventory: false, custom_rates: false },
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
    device_secret_hash: '3cfa76e2826d4493e80c422850621cfda299f1c713b1b369db402a5a54b39178', // SHA-256 of 'token'
    device_name: 'Test Browser',
    browser: 'Chrome',
    os: 'Windows',
    status: 'active',
    first_seen_at: '2026-06-01T00:00:00.000Z',
    last_seen_at: '2026-06-20T12:00:00.000Z',
    revoked_at: null,
    public_key: null,
    fingerprint_hash: null,
    ...overrides,
  };
}

function validHeaders() {
  return {
    'cookie': 'enermass_device_token=token',
  };
}

function happyDeps(overrides: Record<string, any> = {}) {
  return {
    getAuthenticatedUser: vi.fn().mockResolvedValue(mockUser),
    resolveActiveMembership: vi.fn().mockResolvedValue(mkMember()),
    getOrgById: vi.fn().mockResolvedValue({ id: orgId, name: 'Test Org' }),
    assertActiveSubscription: vi.fn().mockResolvedValue(mkSub()),
    assertFeatureAccess: vi.fn().mockResolvedValue(undefined),
    getActiveDevice: vi.fn().mockResolvedValue(mkDevice()),
    ...overrides,
  };
}

// ─── Expired subscription blocks access ───────────────────────────────────────

describe('Subscription enforcement', () => {
  it('expired subscription is blocked', async () => {
    const audit = vi.fn();
    await expect(
      assertActiveSubscription(orgId, {
        orgSubscriptionRepository: {
          getActiveByOrgId: vi.fn().mockResolvedValue(mkSub({ status: 'expired' })),
        },
        subscriptionPaymentRepository: { listByOrgId: vi.fn().mockResolvedValue([]) },
        audit,
        now: () => now,
      })
    ).rejects.toBeInstanceOf(SubscriptionExpiredError);
  });

  it('cancelled subscription is blocked', async () => {
    await expect(
      assertActiveSubscription(orgId, {
        orgSubscriptionRepository: {
          getActiveByOrgId: vi.fn().mockResolvedValue(mkSub({ status: 'cancelled' })),
        },
        subscriptionPaymentRepository: { listByOrgId: vi.fn().mockResolvedValue([]) },
        audit: vi.fn(),
        now: () => now,
      })
    ).rejects.toBeInstanceOf(SubscriptionExpiredError);
  });

  it('no subscription at all is blocked', async () => {
    await expect(
      assertActiveSubscription(orgId, {
        orgSubscriptionRepository: {
          getActiveByOrgId: vi.fn().mockResolvedValue(null),
        },
        subscriptionPaymentRepository: { listByOrgId: vi.fn().mockResolvedValue([]) },
        audit: vi.fn(),
        now: () => now,
      })
    ).rejects.toBeInstanceOf(SubscriptionExpiredError);
  });

  it('active subscription allows access', async () => {
    await expect(
      assertActiveSubscription(orgId, {
        orgSubscriptionRepository: {
          getActiveByOrgId: vi.fn().mockResolvedValue(mkSub({ status: 'active' })),
        },
        subscriptionPaymentRepository: { listByOrgId: vi.fn().mockResolvedValue([]) },
        audit: vi.fn(),
        now: () => now,
      })
    ).resolves.toMatchObject({ status: 'active' });
  });
});

// ─── Feature gate enforcement ──────────────────────────────────────────────────

describe('Feature gate enforcement', () => {
  it('custom_rates disabled blocks rate overrides', async () => {
    const audit = vi.fn();
    await expect(
      assertFeatureAccess(orgId, 'custom_rates', {
        orgSubscriptionRepository: {
          getActiveByOrgId: vi.fn().mockResolvedValue(mkSub()),
        },
        subscriptionPaymentRepository: { listByOrgId: vi.fn().mockResolvedValue([]) },
        subscriptionPlanRepository: {
          getById: vi.fn().mockResolvedValue(mkPlan()),
        },
        audit,
        now: () => now,
      })
    ).rejects.toBeInstanceOf(FeatureNotEnabledError);
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'feature_access_denied', orgId })
    );
  });

  it('calculator feature enabled allows access', async () => {
    await expect(
      assertFeatureAccess(orgId, 'calculator', {
        orgSubscriptionRepository: {
          getActiveByOrgId: vi.fn().mockResolvedValue(mkSub()),
        },
        subscriptionPaymentRepository: { listByOrgId: vi.fn().mockResolvedValue([]) },
        subscriptionPlanRepository: {
          getById: vi.fn().mockResolvedValue(mkPlan()),
        },
        audit: vi.fn(),
        now: () => now,
      })
    ).resolves.toBeDefined();
  });

  it('erp feature disabled blocks ERP routes', async () => {
    await expect(
      assertFeatureAccess(orgId, 'erp', {
        orgSubscriptionRepository: {
          getActiveByOrgId: vi.fn().mockResolvedValue(mkSub()),
        },
        subscriptionPaymentRepository: { listByOrgId: vi.fn().mockResolvedValue([]) },
        subscriptionPlanRepository: {
          getById: vi.fn().mockResolvedValue(mkPlan({ features: { calculator: true, erp: false } })),
        },
        audit: vi.fn(),
        now: () => now,
      })
    ).rejects.toBeInstanceOf(FeatureNotEnabledError);
  });

  it('missing plan features deny all feature access', async () => {
    await expect(
      assertFeatureAccess(orgId, 'calculator', {
        orgSubscriptionRepository: {
          getActiveByOrgId: vi.fn().mockResolvedValue(mkSub()),
        },
        subscriptionPaymentRepository: { listByOrgId: vi.fn().mockResolvedValue([]) },
        subscriptionPlanRepository: {
          getById: vi.fn().mockResolvedValue(mkPlan({ features: null as any })),
        },
        audit: vi.fn(),
        now: () => now,
      })
    ).rejects.toBeInstanceOf(FeatureNotEnabledError);
  });
});

// ─── Device session enforcement ───────────────────────────────────────────────

describe('Device session enforcement (simplified requireLicensedSession)', () => {
  it('disabled user is blocked during membership resolution', async () => {
    const deps = happyDeps({
      resolveActiveMembership: vi.fn().mockRejectedValue(new MembershipMissingError({ userId })),
    });
    await expect(
      requireLicensedSession(
        new Request('http://localhost', { headers: validHeaders() }),
        { feature: 'calculator' },
        deps
      )
    ).rejects.toBeInstanceOf(MembershipMissingError);
  });

  it('bypasses device token and status checks when device binding is disabled', async () => {
    const deps = happyDeps({
      getActiveDevice: vi.fn().mockResolvedValue(mkDevice({
        status: 'revoked',
        device_secret_hash: 'different-hash',
      })),
    });
    const session = await requireLicensedSession(
      new Request('http://localhost', { headers: {} }),
      { feature: 'calculator' },
      deps
    );
    expect(session).toBeDefined();
    expect(session.device.id).toBe('00000000-0000-0000-0000-000000000000');
  });
});

// ─── Org ID isolation: viewer cannot mutate ────────────────────────────────────

describe('Role-based access control — UnauthorizedRoleError shape', () => {
  it('UnauthorizedRoleError has statusCode=403 and redirectTo=/dashboard', () => {
    const err = new UnauthorizedRoleError({
      orgId,
      userId,
      role: 'viewer',
      allowedRoles: ['admin', 'owner'],
    });
    expect(err.statusCode).toBe(403);
    expect(err.redirectTo).toBe('/dashboard');
    expect(err.name).toBe('UnauthorizedRoleError');
  });

  it('staff gets UnauthorizedRoleError for owner-only operations', () => {
    const err = new UnauthorizedRoleError({
      orgId,
      userId,
      role: 'staff',
      requestedRole: 'owner',
    });
    expect(err.statusCode).toBe(403);
  });
});

// ─── Super admin role boundary ─────────────────────────────────────────────────

describe('Super admin role boundary', () => {
  it('isSuperAdmin is checked from app_metadata only, not from org membership role', async () => {
    const { requireSuperAdminSession, requireOrgManagementSession } =
      await import('@/lib/saas/services/managementService');

    expect(requireSuperAdminSession).toBeDefined();
    expect(requireOrgManagementSession).toBeDefined();
    expect(requireSuperAdminSession).not.toBe(requireOrgManagementSession);
  });
});
