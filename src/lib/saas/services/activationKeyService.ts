import 'server-only';

import crypto from 'node:crypto';
import { Client } from 'pg';
import { createAdminClient } from '@/lib/supabase/server';
import z from 'zod';
import { ActivationKeyRepository, OrgMemberRepository, UserDeviceRepository, OrgSubscriptionRepository, SubscriptionPlanRepository } from '../repositories';
import {
  encryptActivationKey,
  generateRawActivationKey,
  hashActivationKey,
  isValidKeyFormat,
  keyPrefix,
  normaliseActivationKey,
} from './activationKeyCrypto';
import { logLicenseEvent } from './licenseAuditService';
import type { ActivationKey } from '../types';
import { profilesByUserId, userEmailsById } from './userDirectory';
import { assertSeatAvailableForActivation } from './seatService';

const CURRENT_VERSION = Number(process.env.ACTIVATION_KEY_CURRENT_VERSION || '1');

// ─── Schemas ──────────────────────────────────────────────────────────────────
// Note: Super admin auth is determined exclusively by profiles.is_super_admin.
// See managementService.ts → isSuperAdmin() for the authoritative check.

const generateKeysSchema = z.object({
  orgId: z.string().uuid(),
  count: z.number().int().min(1).max(100),
  createdBy: z.string().uuid(),
  expiresAt: z.string().datetime().optional(),
  maxUses: z.number().int().min(1).max(9999).optional(),
});

// Password complexity requirements — enforced here and in the UI
export const PASSWORD_RULES = [
  { test: (p: string) => p.length >= 12,           message: 'at least 12 characters' },
  { test: (p: string) => /[A-Z]/.test(p),          message: 'one uppercase letter' },
  { test: (p: string) => /[a-z]/.test(p),          message: 'one lowercase letter' },
  { test: (p: string) => /[0-9]/.test(p),          message: 'one number' },
  { test: (p: string) => /[^A-Za-z0-9]/.test(p),   message: 'one special character' },
];

const redeemKeySchema = z.object({
  rawKey: z.string().min(25).max(30),
  fullName: z.string().min(2).max(100),
  email: z.string().email().toLowerCase(),
  password: z
    .string()
    .min(12, 'Password must be at least 12 characters.')
    .max(128)
    .superRefine((p, ctx) => {
      const failed = PASSWORD_RULES.filter(r => !r.test(p));
      if (failed.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Password must contain: ${failed.map(r => r.message).join(', ')}.`,
        });
      }
    }),
  phone: z.string().optional().nullable(),
  deviceName: z.string().optional().nullable(),
  browser: z.string().optional().nullable(),
  os: z.string().optional().nullable(),
  publicKey: z.string().optional().nullable(),
  fingerprintHash: z.string().optional().nullable(),
});

// ─── Exported Types ───────────────────────────────────────────────────────────

export interface GeneratedKey {
  id: string;
  rawKey: string;        // ONE TIME ONLY — returned to super admin, never stored again
  prefix: string;
}

export interface KeyGenerationResult {
  batchId: string;
  keys: GeneratedKey[];
  orgId: string;
}

export interface KeyValidationResult {
  valid: boolean;
  orgId?: string;
  orgName?: string;
  reason?: string;
  expiresAt?: string | null;
  planName?: string;
  seatLimit?: number;
  activeMembers?: number;
}

export interface KeyRedemptionResult {
  userId: string;
  orgId: string;
  role: 'owner' | 'staff';
  deviceToken: string;
}

export interface MaskedKeyItem {
  id: string;
  org_id: string;
  key_prefix: string;           // "EMSOL-XXXX" — visible
  status: ActivationKey['status'];
  activated_by: string | null;
  activated_by_email?: string | null;
  activated_by_name?: string | null;
  activated_at: string | null;
  device_id: string | null;
  batch_id: string | null;
  created_by: string;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
  key_version: number;
  max_uses: number;
  active_devices_count: number;
}

// ─── Subscription Alignment Helper ───────────────────────────────────────────

async function ensureActiveOrgSubscription(orgId: string, requiredSeats = 1) {
  const orgSubRepo = new OrgSubscriptionRepository(createAdminClient);
  const planRepo = new SubscriptionPlanRepository(createAdminClient);
  
  let subscription = await orgSubRepo.getActiveByOrgId(orgId);
  const now = new Date();
  
  if (subscription) {
    let needsUpdate = false;
    const updates: any = {};
    
    if (subscription.status === 'cancelled' || subscription.status === 'expired') {
      updates.status = 'active';
      needsUpdate = true;
    }
    
    if (subscription.current_period_end && new Date(subscription.current_period_end) <= now) {
      updates.current_period_end = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
      updates.current_period_start = now.toISOString();
      updates.status = 'active';
      needsUpdate = true;
    }
    
    if (subscription.status === 'trialing' && subscription.trial_ends_at && new Date(subscription.trial_ends_at) <= now) {
      updates.trial_ends_at = null;
      updates.current_period_end = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
      updates.current_period_start = now.toISOString();
      updates.status = 'active';
      needsUpdate = true;
    }

    if (subscription.seat_limit < requiredSeats) {
      updates.seat_limit = requiredSeats;
      needsUpdate = true;
    }
    
    if (needsUpdate) {
      await orgSubRepo.update(subscription.id, updates);
    }
    return;
  }
  
  const client = createAdminClient();
  const { data: latestSub } = await (client as any)
    .from('org_subscriptions')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
    
  if (latestSub) {
    await orgSubRepo.update(latestSub.id, {
      status: 'active',
      seat_limit: Math.max(latestSub.seat_limit, requiredSeats),
      current_period_start: now.toISOString(),
      current_period_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      trial_ends_at: null,
      cancelled_at: null,
    });
    return;
  }
  
  let planCode = 'starter';
  if (requiredSeats > 25) {
    planCode = 'enterprise';
  } else if (requiredSeats > 5) {
    planCode = 'business';
  } else if (requiredSeats > 1) {
    planCode = 'team';
  }
  
  let plan = await planRepo.getByCode(planCode);
  if (!plan) {
    const activePlans = await planRepo.listActive();
    plan = activePlans[0] ?? null;
  }
  
  if (!plan) {
    throw new Error('No active subscription plan found. Please ensure plans are seeded or contact support.');
  }
  await orgSubRepo.create(orgId, {
    plan_id: plan.id,
    status: 'active',
    seat_limit: Math.max(plan.seat_limit, requiredSeats),
    billing_cycle: 'manual',
    current_period_start: now.toISOString(),
    current_period_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
  });
}

// ─── Generate Keys (Super Admin only) ────────────────────────────────────────

/**
 * Generates N activation keys for an org.
 * The raw keys are returned ONCE — they must be shown to the super admin immediately.
 * After this call, raw keys cannot be recovered (only encrypted blobs in DB).
 */
export async function generateActivationKeys(input: z.input<typeof generateKeysSchema>): Promise<KeyGenerationResult> {
  const payload = generateKeysSchema.parse(input);
  await ensureActiveOrgSubscription(payload.orgId, payload.count);

  const batchId = crypto.randomUUID();
  const repo = new ActivationKeyRepository(createAdminClient);
  const results: GeneratedKey[] = [];

  for (let i = 0; i < payload.count; i++) {
    const rawKey = generateRawActivationKey();
    const hash = hashActivationKey(rawKey);
    const encrypted = encryptActivationKey(rawKey, CURRENT_VERSION);
    const prefix = keyPrefix(rawKey);

    const row = await repo.create({
      org_id: payload.orgId,
      key_hash: hash,
      key_encrypted: encrypted,
      key_prefix: prefix,
      status: 'unused',
      batch_id: batchId,
      created_by: payload.createdBy,
      expires_at: payload.expiresAt ?? null,
      key_version: CURRENT_VERSION,
      max_uses: payload.maxUses ?? 5,
    } as any);

    // Auto-create Supabase auth user for this key
    const adminClient = createAdminClient();
    const email = `key-${row.id}@enermass.local`;
    const password = rawKey;

    const { data: userData, error: userError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: `Key User ${prefix}`,
        org_id: payload.orgId,
        key_id: row.id,
      }
    });

    if (userError || !userData?.user) {
      console.error('Failed to create auth user for key:', userError);
      throw new Error(`Failed to generate key auth user: ${userError?.message ?? 'Unknown error'}`);
    }

    const userId = userData.user.id;

    // Create Profile
    const { error: profileError } = await adminClient
      .from('profiles')
      .insert({
        id: userId,
        org_id: payload.orgId,
        full_name: `Key User ${prefix}`,
        role: 'staff',
        is_active: true,
        key_id: row.id,
      });

    if (profileError) {
      console.error('Failed to create profile for key user:', profileError);
      throw new Error(`Failed to create profile: ${profileError.message}`);
    }

    // Create Org Member
    const { error: memberError } = await adminClient
      .from('org_members')
      .insert({
        org_id: payload.orgId,
        user_id: userId,
        role: 'staff',
        status: 'active',
      });

    if (memberError) {
      console.error('Failed to create member for key user:', memberError);
      throw new Error(`Failed to create org member: ${memberError.message}`);
    }

    // Link key to user and mark as activated
    const { error: updateError } = await adminClient
      .from('activation_keys')
      .update({
        status: 'activated',
        activated_by: userId,
        activated_at: new Date().toISOString(),
      })
      .eq('id', row.id);

    if (updateError) {
      console.error('Failed to update key status:', updateError);
      throw new Error(`Failed to update key status: ${updateError.message}`);
    }

    results.push({ id: row.id, rawKey, prefix });
  }

  await logLicenseEvent({
    orgId: payload.orgId,
    entityType: 'activation_keys',
    eventType: 'subscription_created',
    actorUserId: payload.createdBy,
    eventData: {
      batchId,
      count: payload.count,
      action: 'keys_generated',
    },
  });

  return { batchId, keys: results, orgId: payload.orgId };
}

// ─── Validate Key (Public — pre-registration step) ────────────────────────────

const orgNameCache = new Map<string, string>();

/**
 * Validates a key without consuming it.
 * Returns org name so the user can confirm before registering.
 * Rate limit must be applied at the API layer.
 */
export async function validateActivationKey(rawKey: string): Promise<KeyValidationResult> {
  const normalised = normaliseActivationKey(rawKey);

  if (!isValidKeyFormat(normalised)) {
    return { valid: false, reason: 'Invalid key format. Expected: EMSOL-XXXX-XXXX-XXXX-XXXX' };
  }

  const hash = hashActivationKey(normalised);
  const repo = new ActivationKeyRepository(createAdminClient);
  const key = await repo.getByHash(hash);

  if (!key) {
    return { valid: false, reason: 'Key not found.' };
  }

  if (key.status === 'revoked') {
    return { valid: false, reason: 'This key has been revoked.' };
  }

  const client = createAdminClient();
  const { count: activatedCount } = await client
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('key_id', key.id);

  const maxUses = key.max_uses ?? 5;
  if ((activatedCount ?? 0) >= maxUses) {
    return { valid: false, reason: `This key has reached its maximum activation limit of ${maxUses} users.` };
  }

  if (key.expires_at && new Date(key.expires_at) < new Date()) {
    return { valid: false, reason: 'This key has expired.' };
  }

  // Fetch org name
  let orgName: string = orgNameCache.get(key.org_id) ?? '';
  if (!orgName) {
    const { data: org } = await (client as any)
      .from('organisations')
      .select('name')
      .eq('id', key.org_id)
      .maybeSingle();
    orgName = (org?.name as string | null | undefined) ?? 'Unknown Organisation';
    orgNameCache.set(key.org_id, orgName);
  }

  // Retrieve plan details and seat limit
  const { data: sub } = await client
    .from('org_subscriptions')
    .select('seat_limit, plan:plan_id(name)')
    .eq('org_id', key.org_id)
    .in('status', ['trialing', 'active', 'past_due'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Retrieve current active members count
  const { count: memberCount } = await client
    .from('org_members')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', key.org_id)
    .in('status', ['active', 'invited']);

  return {
    valid: true,
    orgId: key.org_id,
    orgName,
    expiresAt: key.expires_at ? key.expires_at : undefined,
    planName: sub?.plan && typeof sub.plan === 'object' && 'name' in sub.plan ? (sub.plan as any).name : 'Standard Team Plan',
    seatLimit: sub?.seat_limit ?? 5,
    activeMembers: memberCount ?? 1,
  };
}

// ─── Redeem Key (Public — user registration) ──────────────────────────────────

/**
 * Redeems an activation key, creating a Supabase auth user + profile + org_member + device.
 * First redemption in an org → owner. All subsequent → staff.
 * Device is bound permanently at this point.
 * Returns a device token that must be set as an HttpOnly cookie by the API route.
 */
export async function redeemActivationKey(input: z.input<typeof redeemKeySchema>): Promise<KeyRedemptionResult> {
  const payload = redeemKeySchema.parse(input);
  const normalised = normaliseActivationKey(payload.rawKey);

  if (!isValidKeyFormat(normalised)) {
    throw new Error('Invalid activation key format.');
  }

  const hash = hashActivationKey(normalised);
  const adminClient = createAdminClient();
  const keyRepo = new ActivationKeyRepository(createAdminClient);

  // ── 1. Fetch and validate key ────────────────────────────────────────────────
  const key = await keyRepo.getByHash(hash);
  if (!key) throw new Error('Activation key not found.');
  if (key.status === 'revoked') throw new Error('This activation key has been revoked.');
  if (key.status === 'expired' || (key.expires_at && new Date(key.expires_at) < new Date())) {
    throw new Error('This activation key has expired.');
  }

  // Count how many users have been activated with this key
  const { count: activatedCount, error: countErr } = await adminClient
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('key_id', key.id);

  if (countErr) {
    throw new Error('Failed to verify license activation status.');
  }

  const maxUses = key.max_uses ?? 5;
  if ((activatedCount ?? 0) >= maxUses) {
    throw new Error(`This activation key has reached its maximum activation limit of ${maxUses} users.`);
  }

  // Ensure organization subscription exists and is active with sufficient seats before redemption
  const keyCountResult = await keyRepo.countByOrg(key.org_id);
  const totalSeatsNeeded = Math.max(1, keyCountResult.total);
  await ensureActiveOrgSubscription(key.org_id, totalSeatsNeeded);

  // Activation keys are invitations, not extra capacity. Enforce the org seat
  // cap before creating the Supabase auth user or any related tenant records.
  await assertSeatAvailableForActivation(key.org_id, {
    orgSubscriptionRepository: new OrgSubscriptionRepository(createAdminClient),
    orgMemberRepository: new OrgMemberRepository(createAdminClient),
  });

  // ── 3. Create Supabase auth user using public client to trigger confirmation email ──
  // Note: We use publicClient.auth.signUp instead of adminClient.auth.admin.createUser to trigger confirmation email.
  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js');
  const publicClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  let authData: any = null;
  let authError: any = null;

  const signUpResult = await publicClient.auth.signUp({
    email: payload.email,
    password: payload.password,
    options: {
      data: {
        full_name: payload.fullName,
        org_id: key.org_id,
      },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/auth/confirm`
    }
  });

  authData = signUpResult.data;
  authError = signUpResult.error;

  // Fallback to admin createUser if email rate limit is hit
  if (authError && authError.message?.toLowerCase().includes('rate limit')) {
    const adminCreateResult = await adminClient.auth.admin.createUser({
      email: payload.email,
      password: payload.password,
      email_confirm: true,
      user_metadata: {
        full_name: payload.fullName,
        org_id: key.org_id,
      }
    });
    if (!adminCreateResult.error && adminCreateResult.data?.user) {
      authData = adminCreateResult.data;
      authError = null;
    } else if (adminCreateResult.error) {
      authError = adminCreateResult.error;
    }
  }

  if (authError || !authData?.user) {
    if (authError?.message?.toLowerCase().includes('already')) {
      throw new Error('An account with this email address already exists.');
    }
    throw new Error(`Failed to create user account: ${authError?.message ?? 'Unknown error'}`);
  }

  const userId = authData.user.id;

  const pgClient = new Client({
    connectionString: process.env.DATABASE_URL
  });
  await pgClient.connect();

  let assignedRole: 'owner' | 'staff' = 'staff';
  const deviceToken = crypto.randomBytes(32).toString('hex');
  const secretHash = crypto.createHash('sha256').update(deviceToken).digest('hex');
  const deviceId = crypto.randomUUID();

  try {
    await pgClient.query('BEGIN');

    // 1. SELECT FOR UPDATE on activation_keys to lock and verify key status
    const keyRes = await pgClient.query(
      'SELECT status, expires_at, org_id, max_uses FROM public.activation_keys WHERE id = $1 FOR UPDATE',
      [key.id]
    );
    const dbKey = keyRes.rows[0];
    if (!dbKey) throw new Error('Activation key not found in transaction.');
    if (dbKey.status === 'revoked') throw new Error('This activation key has been revoked.');
    if (dbKey.status === 'expired' || (dbKey.expires_at && new Date(dbKey.expires_at) < new Date())) {
      throw new Error('This activation key has expired.');
    }

    // Check count of profiles already activated by this key
    const pCountRes = await pgClient.query(
      'SELECT COUNT(*) as count FROM public.profiles WHERE key_id = $1',
      [key.id]
    );
    const activatedCount = parseInt(pCountRes.rows[0].count, 10);
    const maxUses = dbKey.max_uses ?? 5;
    if (activatedCount >= maxUses) {
      throw new Error(`This activation key has reached its maximum activation limit of ${maxUses} users.`);
    }

    // 2. Lock organisation row to serialize owner checks and seat usage verification
    const orgRes = await pgClient.query(
      'SELECT id FROM public.organisations WHERE id = $1 FOR UPDATE',
      [key.org_id]
    );
    if (orgRes.rows.length === 0) {
      throw new Error('Organisation not found.');
    }

    // 3. Determine role atomically (first owner or staff)
    const membersRes = await pgClient.query(
      "SELECT role, status FROM public.org_members WHERE org_id = $1",
      [key.org_id]
    );
    const hasOwner = membersRes.rows.some((m: any) => m.role === 'owner' && m.status === 'active');
    assignedRole = hasOwner ? 'staff' : 'owner';

    // 4. Enforce seats atomically inside lock
    const subRes = await pgClient.query(
      "SELECT seat_limit FROM public.org_subscriptions WHERE org_id = $1 AND status IN ('trialing', 'active', 'past_due') LIMIT 1",
      [key.org_id]
    );
    const subscription = subRes.rows[0];
    const countRes = await pgClient.query(
      "SELECT COUNT(*) as count FROM public.org_members WHERE org_id = $1 AND status IN ('active', 'invited')",
      [key.org_id]
    );
    const usedSeats = parseInt(countRes.rows[0].count, 10);
    if (subscription) {
      const seatLimit = subscription.seat_limit;
      if (seatLimit > 0 && usedSeats >= seatLimit) {
        throw new Error(`Seat limit reached. Organization has ${usedSeats} used seats, limit is ${seatLimit}.`);
      }
    }

    // 5. Update user app_metadata in Auth service before committing DB inserts
    const { error: metaError } = await (adminClient as any).auth.admin.updateUserById(userId, {
      app_metadata: {
        org_id: key.org_id,
        role: assignedRole,
      },
    });
    if (metaError) {
      throw new Error(`Failed to initialize user metadata: ${metaError.message}`);
    }

    // 6. Create Profile (with key_id link)
    await pgClient.query(
      `INSERT INTO public.profiles (id, org_id, full_name, role, phone, is_active, key_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, key.org_id, payload.fullName, assignedRole, payload.phone ?? null, true, key.id]
    );

    // 7. Create Org Member
    await pgClient.query(
      `INSERT INTO public.org_members (org_id, user_id, role, status)
       VALUES ($1, $2, $3, $4)`,
      [key.org_id, userId, assignedRole, 'active']
    );

    // 8. Mark activation key as activated (setting device_id to null)
    await pgClient.query(
      `UPDATE public.activation_keys
       SET status = 'activated', activated_by = $1, device_id = NULL, activated_at = NOW(), updated_at = NOW()
       WHERE id = $2`,
      [userId, key.id]
    );

    // 10. Log audit event
    await pgClient.query(
      `INSERT INTO public.license_events (id, org_id, user_id, entity_type, entity_id, event_type, event_data, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [
        crypto.randomUUID(),
        key.org_id,
        userId,
        'activation_key',
        key.id,
        'device_registered',
        JSON.stringify({
          action: 'key_activated',
          role: assignedRole,
          keyPrefix: key.key_prefix,
          deviceId: deviceId,
        }),
      ]
    );

    await pgClient.query('COMMIT');
    return { userId, orgId: key.org_id, role: assignedRole, deviceToken };

  } catch (error) {
    await pgClient.query('ROLLBACK').catch(() => {});
    await (adminClient as any).auth.admin.deleteUser(userId).catch(() => {});
    throw error;
  } finally {
    await pgClient.end().catch(() => {});
  }
}

// ─── List Keys (masked, for admin views) ──────────────────────────────────────

export async function listOrgActivationKeys(orgId: string): Promise<MaskedKeyItem[]> {
  const repo = new ActivationKeyRepository(createAdminClient);
  const keys = await repo.listByOrg(orgId);

  const activatedByIds = [...new Set(keys.filter(k => k.activated_by).map(k => k.activated_by!))];
  const [profiles, emailMap] = await Promise.all([
    profilesByUserId(activatedByIds),
    userEmailsById(activatedByIds),
  ]);

  const supabase = createAdminClient();
  const { data: profileActivations } = await supabase
    .from('profiles')
    .select('id, key_id')
    .eq('org_id', orgId)
    .not('key_id', 'is', null);

  const countMap = new Map<string, number>();
  if (profileActivations) {
    for (const p of profileActivations) {
      if (p.key_id) {
        countMap.set(p.key_id, (countMap.get(p.key_id) ?? 0) + 1);
      }
    }
  }

  return keys.map(k => ({
    ...k,
    max_uses: (k as any).max_uses ?? 5,
    active_devices_count: countMap.get(k.id) ?? 0,
    activated_by_email: k.activated_by ? (emailMap.get(k.activated_by) ?? null) : null,
    activated_by_name: k.activated_by ? (profiles.get(k.activated_by)?.full_name ?? null) : null,
  }));
}

export async function listAllActivationKeys(page = 1, limit = 100): Promise<MaskedKeyItem[]> {
  const repo = new ActivationKeyRepository(createAdminClient);
  const keys = await repo.listAll(page, limit);
  const activatedByIds = [...new Set(keys.filter(k => k.activated_by).map(k => k.activated_by!))];
  const [profiles, emailMap] = await Promise.all([
    profilesByUserId(activatedByIds),
    userEmailsById(activatedByIds),
  ]);

  const supabase = createAdminClient();
  const { data: profileActivations } = await supabase
    .from('profiles')
    .select('id, key_id')
    .not('key_id', 'is', null);

  const countMap = new Map<string, number>();
  if (profileActivations) {
    for (const p of profileActivations) {
      if (p.key_id) {
        countMap.set(p.key_id, (countMap.get(p.key_id) ?? 0) + 1);
      }
    }
  }

  return keys.map(k => ({
    ...k,
    max_uses: (k as any).max_uses ?? 5,
    active_devices_count: countMap.get(k.id) ?? 0,
    activated_by_email: k.activated_by ? (emailMap.get(k.activated_by) ?? null) : null,
    activated_by_name: k.activated_by ? (profiles.get(k.activated_by)?.full_name ?? null) : null,
  }));
}

// ─── Revoke Key (Super Admin only) ────────────────────────────────────────────

export async function revokeActivationKey(keyId: string, revokedBy: string): Promise<ActivationKey> {
  const repo = new ActivationKeyRepository(createAdminClient);
  const key = await repo.getById(keyId) as ActivationKey | null;

  if (!key) throw new Error('Activation key not found.');
  if (key.status !== 'unused') {
    throw new Error('Only unused keys can be revoked.');
  }

  const revoked = await repo.revoke(keyId, revokedBy);

  await logLicenseEvent({
    orgId: key.org_id,
    entityType: 'activation_key',
    entityId: keyId,
    eventType: 'device_reset_rejected',
    actorUserId: revokedBy,
    eventData: { action: 'key_revoked', keyPrefix: key.key_prefix },
  });

  return revoked;
}

export async function countOrgActivationKeys(orgId: string) {
  return new ActivationKeyRepository(createAdminClient).countByOrg(orgId);
}
