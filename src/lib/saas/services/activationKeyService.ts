import 'server-only';

import crypto from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { ActivationKeyRepository, OrgMemberRepository, UserDeviceRepository } from '../repositories';
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
import { assertSeatAvailable } from './seatService';

// ─── Schemas ──────────────────────────────────────────────────────────────────
// Note: Super admin auth is determined exclusively by profiles.is_super_admin.
// See managementService.ts → isSuperAdmin() for the authoritative check.

const generateKeysSchema = z.object({
  orgId: z.string().uuid(),
  count: z.number().int().min(1).max(100),
  createdBy: z.string().uuid(),
  expiresAt: z.string().datetime().optional(),
});

// Password complexity requirements — enforced here and in the UI
export const PASSWORD_RULES = [
  { test: (p: string) => p.length >= 12,            message: 'at least 12 characters' },
  { test: (p: string) => /[A-Z]/.test(p),           message: 'at least one uppercase letter' },
  { test: (p: string) => /[a-z]/.test(p),           message: 'at least one lowercase letter' },
  { test: (p: string) => /[0-9]/.test(p),           message: 'at least one number' },
  { test: (p: string) => /[^A-Za-z0-9]/.test(p),   message: 'at least one special character' },
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
}

// ─── Generate Keys (Super Admin only) ────────────────────────────────────────

/**
 * Generates N activation keys for an org.
 * The raw keys are returned ONCE — they must be shown to the super admin immediately.
 * After this call, raw keys cannot be recovered (only encrypted blobs in DB).
 */
export async function generateActivationKeys(input: z.input<typeof generateKeysSchema>): Promise<KeyGenerationResult> {
  const payload = generateKeysSchema.parse(input);
  const batchId = crypto.randomUUID();
  const repo = new ActivationKeyRepository(createAdminClient);
  const results: GeneratedKey[] = [];

  for (let i = 0; i < payload.count; i++) {
    const rawKey = generateRawActivationKey();
    const hash = hashActivationKey(rawKey);
    const encrypted = encryptActivationKey(rawKey);
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
    });

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

  if (key.status !== 'unused') {
    return { valid: false, reason: 'This key has already been used or revoked.' };
  }

  if (key.expires_at && new Date(key.expires_at) < new Date()) {
    return { valid: false, reason: 'This key has expired.' };
  }

  // Fetch org name
  const client = createAdminClient();
  const { data: org } = await (client as any)
    .from('organisations')
    .select('name')
    .eq('id', key.org_id)
    .maybeSingle();

  return {
    valid: true,
    orgId: key.org_id,
    orgName: org?.name ?? 'Unknown Organisation',
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
  if (key.status !== 'unused') throw new Error('This activation key has already been used.');
  if (key.expires_at && new Date(key.expires_at) < new Date()) {
    throw new Error('This activation key has expired.');
  }

  // Activation keys are invitations, not extra capacity. Enforce the org seat
  // cap before creating the Supabase auth user or any related tenant records.
  await assertSeatAvailable(key.org_id);

  // ── 2. Determine role (first owner or staff) ──────────────────────────────────
  const memberRepo = new OrgMemberRepository(createAdminClient);
  const existingMembers = await memberRepo.listByOrgId(key.org_id);
  const hasOwner = existingMembers.some(m => m.role === 'owner' && m.status === 'active');
  const assignedRole: 'owner' | 'staff' = hasOwner ? 'staff' : 'owner';

  // ── 3. Create Supabase auth user ──────────────────────────────────────────────
  const { data: authData, error: authError } = await (adminClient as any).auth.admin.createUser({
    email: payload.email,
    password: payload.password,
    email_confirm: true,
    user_metadata: {
      full_name: payload.fullName,
      org_id: key.org_id,
    },
    app_metadata: {
      org_id: key.org_id,
      role: assignedRole,
    },
  });

  if (authError || !authData?.user) {
    if (authError?.message?.toLowerCase().includes('already')) {
      throw new Error('An account with this email address already exists.');
    }
    throw new Error(`Failed to create user account: ${authError?.message ?? 'Unknown error'}`);
  }

  const userId = authData.user.id;

  try {
    // ── 5. Create profile ─────────────────────────────────────────────────────────
    await (adminClient as any).from('profiles').insert({
      id: userId,
      org_id: key.org_id,
      full_name: payload.fullName,
      role: assignedRole,
      phone: payload.phone ?? null,
      is_active: true,
    });

    // ── 6. Create org_member ──────────────────────────────────────────────────────
    await memberRepo.create(key.org_id, { user_id: userId, role: assignedRole, status: 'active' });

    // ── 7. Generate device secret and bind device ─────────────────────────────────
    const deviceToken = crypto.randomBytes(32).toString('hex');
    const secretHash = crypto.createHash('sha256').update(deviceToken).digest('hex');

    const deviceRepo = new UserDeviceRepository(createAdminClient);
    const device = await deviceRepo.create(key.org_id, userId, {
      deviceSecretHash: secretHash,
      deviceName: payload.deviceName ?? 'Activation Device',
      browser: payload.browser ?? null,
      os: payload.os ?? null,
    });

    // ── 8. Mark key as activated ──────────────────────────────────────────────────
    await keyRepo.activate(key.id, userId, device.id);

    // ── 9. Audit log ──────────────────────────────────────────────────────────────
    await logLicenseEvent({
      orgId: key.org_id,
      userId,
      entityType: 'activation_key',
      entityId: key.id,
      eventType: 'device_registered',
      eventData: {
        action: 'key_activated',
        role: assignedRole,
        keyPrefix: key.key_prefix,
        deviceId: device.id,
      },
    });

    return { userId, orgId: key.org_id, role: assignedRole, deviceToken };

  } catch (error) {
    // Rollback: delete the Supabase auth user if anything failed
    await (adminClient as any).auth.admin.deleteUser(userId).catch(() => {});
    throw error;
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

  return keys.map(k => ({
    ...k,
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

  return keys.map(k => ({
    ...k,
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
