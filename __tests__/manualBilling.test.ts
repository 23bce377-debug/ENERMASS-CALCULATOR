import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  recordManualPaymentAsSuperAdmin,
  extendSubscriptionPeriodAsSuperAdmin,
  cancelSubscriptionAsSuperAdmin,
} from '@/lib/saas';
import {
  assertActiveSubscription,
  getActiveSubscriptionForOrg,
} from '@/lib/saas/services/subscriptionService';
import {
  OrgSubscriptionRepository,
  SubscriptionPaymentRepository,
} from '@/lib/saas/repositories';
import { SubscriptionExpiredError } from '@/lib/saas/errors';
import type { OrgSubscription, SubscriptionPayment } from '@/lib/saas/types';

vi.mock('@/lib/saas/services/licenseAuditService', () => ({
  logLicenseEvent: vi.fn().mockResolvedValue(undefined),
}));

// Mock repositories
vi.mock('@/lib/saas/repositories', () => {
  return {
    OrgSubscriptionRepository: vi.fn(),
    SubscriptionPaymentRepository: vi.fn(),
  };
});

describe('Manual Billing & Subscriptions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('extendSubscriptionPeriodAsSuperAdmin', () => {
    it('extends period by N days and forces status', async () => {
      const mockSub: OrgSubscription = {
        id: 'sub-1',
        org_id: 'org-1',
        plan_id: 'plan-1',
        status: 'past_due',
        seat_limit: 5,
        billing_cycle: 'monthly',
        current_period_start: '2023-01-01T00:00:00.000Z',
        current_period_end: '2023-02-01T00:00:00.000Z',
        trial_ends_at: null,
        cancelled_at: null,
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z',
      };

      const mockUpdate = vi.fn().mockImplementation((id, data) => ({ ...mockSub, ...data }));
      OrgSubscriptionRepository.prototype.getById = vi.fn().mockResolvedValue(mockSub);
      OrgSubscriptionRepository.prototype.update = mockUpdate;

      const result = await extendSubscriptionPeriodAsSuperAdmin('sub-1', 10, { forceStatus: 'active' });

      expect(mockUpdate).toHaveBeenCalledWith('sub-1', expect.objectContaining({
        status: 'active',
        current_period_end: expect.any(String),
      }));

      expect(result.current_period_end).toBe('2023-02-11T00:00:00.000Z');
    });
  });

  describe('cancelSubscriptionAsSuperAdmin', () => {
    it('cancels an active subscription', async () => {
      const mockSub: OrgSubscription = {
        id: 'sub-1',
        org_id: 'org-1',
        plan_id: 'plan-1',
        status: 'active',
        seat_limit: 5,
        billing_cycle: 'monthly',
        current_period_start: '2023-01-01T00:00:00.000Z',
        current_period_end: '2023-02-01T00:00:00.000Z',
        trial_ends_at: null,
        cancelled_at: null,
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z',
      };

      const mockCancel = vi.fn().mockResolvedValue({ ...mockSub, status: 'cancelled' });
      OrgSubscriptionRepository.prototype.getById = vi.fn().mockResolvedValue(mockSub);
      OrgSubscriptionRepository.prototype.cancel = mockCancel;

      const result = await cancelSubscriptionAsSuperAdmin('sub-1');

      expect(mockCancel).toHaveBeenCalledWith('sub-1');
      expect(result.status).toBe('cancelled');
    });

    it('returns immediately if already cancelled', async () => {
      const mockSub: OrgSubscription = {
        id: 'sub-1',
        org_id: 'org-1',
        plan_id: 'plan-1',
        status: 'cancelled',
        seat_limit: 5,
        billing_cycle: 'monthly',
        current_period_start: '2023-01-01T00:00:00.000Z',
        current_period_end: '2023-02-01T00:00:00.000Z',
        trial_ends_at: null,
        cancelled_at: null,
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z',
      };

      const mockCancel = vi.fn();
      OrgSubscriptionRepository.prototype.getById = vi.fn().mockResolvedValue(mockSub);
      OrgSubscriptionRepository.prototype.cancel = mockCancel;

      const result = await cancelSubscriptionAsSuperAdmin('sub-1');

      expect(mockCancel).not.toHaveBeenCalled();
      expect(result.status).toBe('cancelled');
    });
  });

  describe('Grace Period Enforcement', () => {
    it('blocks access immediately if grace period is 0 and period has expired', async () => {
      const now = new Date('2023-02-05T00:00:00.000Z');
      const mockSub: OrgSubscription = {
        id: 'sub-1',
        org_id: 'org-1',
        plan_id: 'plan-1',
        status: 'active',
        seat_limit: 5,
        billing_cycle: 'monthly',
        current_period_start: '2023-01-01T00:00:00.000Z',
        current_period_end: '2023-02-01T00:00:00.000Z', // Expired 4 days ago
        trial_ends_at: null,
        cancelled_at: null,
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z',
      };

      await expect(assertActiveSubscription('org-1', {
        orgSubscriptionRepository: { getActiveByOrgId: vi.fn().mockResolvedValue(mockSub) },
        subscriptionPaymentRepository: { listByOrgId: vi.fn().mockResolvedValue([]) },
        now: () => now,
        graceDays: 0,
      })).rejects.toThrow(SubscriptionExpiredError);
    });

    it('allows access if within grace period', async () => {
      const now = new Date('2023-02-03T00:00:00.000Z');
      const mockSub: OrgSubscription = {
        id: 'sub-1',
        org_id: 'org-1',
        plan_id: 'plan-1',
        status: 'past_due',
        seat_limit: 5,
        billing_cycle: 'monthly',
        current_period_start: '2023-01-01T00:00:00.000Z',
        current_period_end: '2023-02-01T00:00:00.000Z', // Expired 2 days ago
        trial_ends_at: null,
        cancelled_at: null,
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z',
      };

      const result = await assertActiveSubscription('org-1', {
        orgSubscriptionRepository: { getActiveByOrgId: vi.fn().mockResolvedValue(mockSub) },
        subscriptionPaymentRepository: { listByOrgId: vi.fn().mockResolvedValue([]) },
        now: () => now,
        graceDays: 3, // 3 day grace
      });

      expect(result.id).toBe('sub-1');
    });

    it('blocks access if past grace period', async () => {
      const now = new Date('2023-02-05T00:00:00.000Z');
      const mockSub: OrgSubscription = {
        id: 'sub-1',
        org_id: 'org-1',
        plan_id: 'plan-1',
        status: 'past_due',
        seat_limit: 5,
        billing_cycle: 'monthly',
        current_period_start: '2023-01-01T00:00:00.000Z',
        current_period_end: '2023-02-01T00:00:00.000Z', // Expired 4 days ago
        trial_ends_at: null,
        cancelled_at: null,
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z',
      };

      await expect(assertActiveSubscription('org-1', {
        orgSubscriptionRepository: { getActiveByOrgId: vi.fn().mockResolvedValue(mockSub) },
        subscriptionPaymentRepository: { listByOrgId: vi.fn().mockResolvedValue([]) },
        now: () => now,
        graceDays: 3, // 3 day grace
      })).rejects.toThrow(SubscriptionExpiredError);
    });
  });
});
