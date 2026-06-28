import { describe, expect, it, vi } from 'vitest';
import {
  DeviceMismatchError,
  FeatureNotEnabledError,
  MembershipMissingError,
  SeatLimitReachedError,
  SubscriptionExpiredError,
  assertActiveSubscription,
  assertFeatureAccess,
  assertSeatAvailable,
  disableOrgUser,
  getActiveSubscriptionForOrg,
  getSeatUsage,
  inviteOrgUser,
  logLicenseEvent,
  registerDevice,
  requestDeviceReset,
  approveDeviceReset,
  rejectDeviceReset,
} from '@/lib/saas';
import type {
  DeviceResetRequest,
  LicenseEventPayload,
  OrgMember,
  OrgSubscription,
  SubscriptionPayment,
  SubscriptionPlan,
  UserDevice,
} from '@/lib/saas';

const orgId = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';
const adminUserId = '33333333-3333-4333-8333-333333333333';
const planId = '44444444-4444-4444-8444-444444444444';
const subscriptionId = '55555555-5555-4555-8555-555555555555';
const memberId = '66666666-6666-4666-8666-666666666666';
const deviceId = '77777777-7777-4777-8777-777777777777';
const resetRequestId = '88888888-8888-4888-8888-888888888888';
const now = new Date('2026-06-20T12:00:00.000Z');

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

function payment(overrides: Partial<SubscriptionPayment> = {}): SubscriptionPayment {
  return {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    org_id: orgId,
    subscription_id: subscriptionId,
    amount: 1000,
    currency: 'INR',
    payment_status: 'paid',
    payment_method: 'manual',
    invoice_number: null,
    paid_at: '2026-06-19T00:00:00.000Z',
    created_at: '2026-06-19T00:00:00.000Z',
    ...overrides,
  };
}

function plan(overrides: Partial<SubscriptionPlan> = {}): SubscriptionPlan {
  return {
    id: planId,
    name: 'Pro',
    code: 'pro',
    monthly_price: 1000,
    yearly_price: 10000,
    seat_limit: 2,
    features: { calculator: true, inventory: false },
    is_active: true,
    created_at: '2026-06-01T00:00:00.000Z',
    updated_at: '2026-06-01T00:00:00.000Z',
    ...overrides,
  };
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

function device(overrides: Partial<UserDevice> = {}): UserDevice {
  return {
    id: deviceId,
    org_id: orgId,
    user_id: userId,
    device_secret_hash: '3cfa76e2826d4493e80c422850621cfda299f1c713b1b369db402a5a54b39178', // SHA-256 of 'token'
    device_name: 'Chrome on Windows',
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

function resetRequest(overrides: Partial<DeviceResetRequest> = {}): DeviceResetRequest {
  return {
    id: resetRequestId,
    org_id: orgId,
    user_id: userId,
    old_device_id: deviceId,
    requested_device_info: { deviceName: 'New laptop' },
    status: 'pending',
    requested_at: '2026-06-20T12:00:00.000Z',
    reviewed_by: null,
    reviewed_at: null,
    ...overrides,
  };
}

describe('SaaS subscription service', () => {
  it('returns the active subscription for an org', async () => {
    const repo = { getActiveByOrgId: vi.fn().mockResolvedValue(subscription()) };

    await expect(getActiveSubscriptionForOrg(orgId, { orgSubscriptionRepository: repo })).resolves.toMatchObject({
      id: subscriptionId,
    });
    expect(repo.getActiveByOrgId).toHaveBeenCalledWith(orgId);
  });

  it('blocks expired subscription access and writes an audit event', async () => {
    const audit = vi.fn();
    await expect(
      assertActiveSubscription(orgId, {
        orgSubscriptionRepository: { getActiveByOrgId: vi.fn().mockResolvedValue(subscription({ status: 'expired' })) },
        subscriptionPaymentRepository: { listByOrgId: vi.fn().mockResolvedValue([]) },
        audit,
        now: () => now,
      })
    ).rejects.toBeInstanceOf(SubscriptionExpiredError);

    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'subscription_expired', orgId }));
  });

  it('allows active subscription access', async () => {
    await expect(
      assertActiveSubscription(orgId, {
        orgSubscriptionRepository: { getActiveByOrgId: vi.fn().mockResolvedValue(subscription()) },
        subscriptionPaymentRepository: { listByOrgId: vi.fn().mockResolvedValue([]) },
        audit: vi.fn(),
        now: () => now,
      })
    ).resolves.toMatchObject({ id: subscriptionId });
  });

  it('allows an expired trial when an active payment exists', async () => {
    await expect(
      assertActiveSubscription(orgId, {
        orgSubscriptionRepository: {
          getActiveByOrgId: vi.fn().mockResolvedValue(
            subscription({
              status: 'trialing',
              trial_ends_at: '2026-06-01T00:00:00.000Z',
              current_period_end: '2026-06-01T00:00:00.000Z',
            })
          ),
        },
        subscriptionPaymentRepository: { listByOrgId: vi.fn().mockResolvedValue([payment()]) },
        audit: vi.fn(),
        now: () => now,
      })
    ).resolves.toMatchObject({ status: 'trialing' });
  });
});

describe('SaaS seat service', () => {
  const activeSubscriptionDeps = {
    orgSubscriptionRepository: { getActiveByOrgId: vi.fn().mockResolvedValue(subscription()) },
    subscriptionPaymentRepository: { listByOrgId: vi.fn().mockResolvedValue([]) },
    now: () => now,
  };

  it('reports seat usage', async () => {
    await expect(
      getSeatUsage(orgId, {
        ...activeSubscriptionDeps,
        orgMemberRepository: {
          countBillableSeats: vi.fn().mockResolvedValue({ active: 1, invited: 1 }),
          create: vi.fn(),
          disableByOrgAndUser: vi.fn(),
        },
      })
    ).resolves.toEqual({ activeSeats: 1, invitedSeats: 1, usedSeats: 2, seatLimit: 2, overLimitBy: 0 });
  });

  it('blocks invite when seat limit is reached', async () => {
    const audit = vi.fn();
    await expect(
      assertSeatAvailable(orgId, {
        ...activeSubscriptionDeps,
        orgMemberRepository: {
          countBillableSeats: vi.fn().mockResolvedValue({ active: 2, invited: 0 }),
          create: vi.fn(),
          disableByOrgAndUser: vi.fn(),
        },
        audit,
      })
    ).rejects.toBeInstanceOf(SeatLimitReachedError);
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'seat_limit_reached' }));
  });

  it('invites and disables organization users with audit logs', async () => {
    const audit = vi.fn();
    const createdMember = member({ status: 'invited' });
    const disabledMember = member({ status: 'disabled' });
    const orgMemberRepository = {
      countBillableSeats: vi.fn().mockResolvedValue({ active: 1, invited: 0 }),
      create: vi.fn().mockResolvedValue(createdMember),
      disableByOrgAndUser: vi.fn().mockResolvedValue(disabledMember),
    };

    await expect(
      inviteOrgUser(orgId, 'USER@EXAMPLE.COM', 'staff', {
        ...activeSubscriptionDeps,
        orgMemberRepository,
        resolveUserIdByEmail: vi.fn().mockResolvedValue(userId),
        audit,
      })
    ).resolves.toEqual(createdMember);
    await expect(disableOrgUser(orgId, userId, { orgMemberRepository, audit })).resolves.toEqual(disabledMember);

    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'user_invited', userId }));
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'user_disabled', userId }));
  });
});

describe('SaaS feature access service', () => {
  it('blocks disabled features', async () => {
    const audit = vi.fn();
    await expect(
      assertFeatureAccess(orgId, 'inventory', {
        orgSubscriptionRepository: { getActiveByOrgId: vi.fn().mockResolvedValue(subscription()) },
        subscriptionPaymentRepository: { listByOrgId: vi.fn().mockResolvedValue([]) },
        subscriptionPlanRepository: { getById: vi.fn().mockResolvedValue(plan()) },
        audit,
        now: () => now,
      })
    ).rejects.toBeInstanceOf(FeatureNotEnabledError);
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'feature_access_denied' }));
  });
});

describe('SaaS device service (simplified)', () => {
  it('registers a first device and blocks a mismatched second device', async () => {
    const audit = vi.fn();
    const repo = {
      getActiveForUser: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(device()),
      create: vi.fn().mockResolvedValue(device()),
      touch: vi.fn(),
      update: vi.fn(),
    };
    const deps = {
      orgMemberRepository: { getByOrgAndUser: vi.fn().mockResolvedValue(member()) },
      userDeviceRepository: repo,
      audit,
    };

    await expect(
      registerDevice(userId, orgId, {
        deviceSecretHash: '3cfa76e2826d4493e80c422850621cfda299f1c713b1b369db402a5a54b39178',
        deviceName: 'Chrome on Windows',
      }, deps)
    ).resolves.toMatchObject({ id: deviceId });

    await expect(
      registerDevice(userId, orgId, {
        deviceSecretHash: 'different-hash',
        deviceName: 'Chrome on Windows',
      }, deps)
    ).rejects.toBeInstanceOf(DeviceMismatchError);

    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'device_registered' }));
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'device_mismatch_blocked' }));
  });
});

describe('SaaS device reset service', () => {
  it('requests, approves, and rejects device resets with audit logs', async () => {
    const audit = vi.fn();
    const oldRequest = resetRequest();
    const approvedRequest = resetRequest({ status: 'approved', reviewed_by: adminUserId, reviewed_at: now.toISOString() });
    const rejectedRequest = resetRequest({ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', status: 'rejected' });
    const deviceResetRequestRepository = {
      create: vi.fn().mockResolvedValue(oldRequest),
      getById: vi.fn().mockResolvedValueOnce(oldRequest).mockResolvedValueOnce(rejectedRequest),
      approve: vi.fn().mockResolvedValue(approvedRequest),
      reject: vi.fn().mockResolvedValue(rejectedRequest),
    };
    const userDeviceRepository = {
      getActiveForUser: vi.fn().mockResolvedValue(device()),
      revoke: vi.fn().mockResolvedValue(device({ status: 'revoked' })),
    };
    const orgMemberRepository = {
      getByOrgAndUser: vi.fn().mockImplementation(async (_org: string, lookupUserId: string) =>
        lookupUserId === adminUserId ? member({ user_id: adminUserId, role: 'admin' }) : member()
      ),
    };

    await expect(
      requestDeviceReset(userId, orgId, { deviceName: 'New laptop' }, {
        orgMemberRepository,
        userDeviceRepository,
        deviceResetRequestRepository,
        audit,
      })
    ).resolves.toEqual(oldRequest);

    await expect(
      approveDeviceReset(resetRequestId, adminUserId, {
        orgMemberRepository,
        userDeviceRepository,
        deviceResetRequestRepository,
        audit,
      })
    ).resolves.toEqual(approvedRequest);

    await expect(
      rejectDeviceReset('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', adminUserId, {
        orgMemberRepository,
        userDeviceRepository,
        deviceResetRequestRepository,
        audit,
      })
    ).resolves.toEqual(rejectedRequest);

    expect(userDeviceRepository.revoke).toHaveBeenCalledWith(deviceId);
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'device_reset_requested' }));
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'device_reset_approved' }));
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'device_reset_rejected' }));
  });
});

describe('SaaS audit service', () => {
  it('writes license audit events through the repository', async () => {
    const event: LicenseEventPayload = {
      orgId,
      userId,
      entityType: 'org_subscription',
      entityId: subscriptionId,
      eventType: 'subscription_updated',
      eventData: { source: 'test' },
    };
    const licenseEventRepository = { create: vi.fn().mockResolvedValue({ id: 'event-1', ...event }) };

    await expect(logLicenseEvent(event, { licenseEventRepository })).resolves.toMatchObject({ id: 'event-1' });
    expect(licenseEventRepository.create).toHaveBeenCalledWith(event);
  });
});
