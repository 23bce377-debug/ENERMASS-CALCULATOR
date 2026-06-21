import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { createAdminClient } from '@/lib/supabase/server';
const adminClient = createAdminClient();

// Mock createClient so all service layer calls use the adminClient instead of next/headers cookies()
vi.mock('@/lib/supabase/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/server')>();
  return {
    ...actual,
    createClient: () => adminClient,
  };
});

import { 
  changeSubscriptionStatusAsSuperAdmin,
  createOrganisationAsSuperAdmin
} from '@/lib/saas';
import { randomUUID } from 'node:crypto';
import { UserDeviceRepository } from '@/lib/saas/repositories';
import { assertFeatureAccess } from '@/lib/saas/services/featureAccessService';

describe('SaaS Live Smoke Test', () => {
  let testOrgId: string;
  let testUserId: string;
  let testDeviceId: string;
  let testSubId: string;

  beforeAll(async () => {
    const smokeEmail = `smoke-${Date.now()}@test.com`;

    // Create real auth user
    const { data: authUser } = await adminClient.auth.admin.createUser({
      email: smokeEmail,
      email_confirm: true,
    });
    if (!authUser || !authUser.user) throw new Error('Failed to create auth user');
    testUserId = authUser.user.id;

    // Ensure we have a plan
    const { data: plan, error: planError } = await adminClient
      .from('subscription_plans')
      .select('id')
      .eq('code', 'team')
      .maybeSingle();
    if (planError) throw planError;
    if (!plan) throw new Error('Team seed plan not found in database');
    const planId = plan.id;

    // Create a temporary org
    const org = await createOrganisationAsSuperAdmin({
      name: `Smoke Test Org ${Date.now()}`,
    });
    testOrgId = org.id;

    // We also need to map the owner user id. 
    await adminClient.from('profiles').insert({ 
      id: testUserId,
      org_id: testOrgId,
      full_name: 'Smoke Tester'
    });
    await adminClient.from('org_members').insert({
      org_id: testOrgId,
      user_id: testUserId,
      role: 'owner',
      status: 'active'
    });

    // assign plan and ensure it has calculator access
    const { assignPlanAsSuperAdmin, updatePlanFeaturesAsSuperAdmin } = await import('@/lib/saas');
    await updatePlanFeaturesAsSuperAdmin(planId, {
      calculator: true,
      erp: true,
      inventory: true,
      reports: true,
      master_data: true,
      device_management: true,
      billing: true,
    });
    
    const sub = await assignPlanAsSuperAdmin({
      orgId: testOrgId,
      planId,
      seatLimit: 1,
      billingCycle: 'trial'
    });
    testSubId = sub.id;
  });

  afterAll(async () => {
    if (!testOrgId) return;
    await adminClient.from('organisations').delete().eq('id', testOrgId);
    try {
      await adminClient.from('profiles').delete().eq('id', testUserId);
      await adminClient.auth.admin.deleteUser(testUserId);
    } catch (e) {}
  });

  it('1. Activating a subscription sets limits and status', async () => {
    const activated = await changeSubscriptionStatusAsSuperAdmin(testSubId, 'active');
    expect(activated.status).toBe('active');
  });

  it('2. Device Registration works for active subscription', async () => {
    const repo = new UserDeviceRepository(() => adminClient);
    const device = await repo.create(testOrgId, testUserId, {
      deviceSecretHash: 'dummy-secret-hash',
      deviceName: 'Smoke Test Machine',
      browser: 'Vitest',
      os: 'Node',
    });
    expect(device).toBeDefined();
    expect(device.status).toBe('active');
    testDeviceId = device.id;
  });

  it('3. Device is mapped and active in the database', async () => {
    const repo = new UserDeviceRepository(() => adminClient);
    const active = await repo.getActiveForUser(testUserId);
    expect(active).toBeDefined();
    expect(active?.id).toBe(testDeviceId);
    expect(active?.device_secret_hash).toBe('dummy-secret-hash');
  });

  it('4. Feature gate allows access when active', async () => {
    await expect(assertFeatureAccess(testOrgId, 'calculator'))
      .resolves.not.toThrow();
  });

  it('5. Expiring the subscription blocks feature gate access', async () => {
    await changeSubscriptionStatusAsSuperAdmin(testSubId, 'expired');
    
    await expect(assertFeatureAccess(testOrgId, 'calculator'))
      .rejects.toThrow();
  });
});
