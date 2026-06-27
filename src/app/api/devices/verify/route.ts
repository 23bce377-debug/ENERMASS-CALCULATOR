import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { withAuthenticatedOrgApiRoute } from '@/lib/auth/withAuthenticatedOrgApiRoute';
import { createAdminClient } from '@/lib/supabase/server';
import { UserDeviceRepository } from '@/lib/saas/repositories';
import { DeviceMismatchError } from '@/lib/saas/errors';
import { enforceRateLimit } from '@/lib/security/rateLimit';
import { jsonForDeviceError, parseJsonBody, requestUserAgent } from '@/lib/device-binding/http';
import { z } from 'zod';
import { registerDevice } from '@/lib/saas/services/deviceService';
import type { OrgSubscription } from '@/lib/saas/types';

/**
 * Device verification is part of the login flow.
 * It must NOT require an active subscription — users need to log in
 * even when their subscription is expired (to see billing/renewal pages).
 * We pass a stub `assertActiveSubscription` that always resolves.
 */
const STUB_SUBSCRIPTION: OrgSubscription = {
  id: 'device-verify-bypass',
  org_id: '',
  plan_id: '',
  status: 'active',
  seat_limit: 999,
  billing_cycle: 'manual',
  current_period_start: new Date().toISOString(),
  current_period_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
  trial_ends_at: null,
  cancelled_at: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};
const bypassSubscriptionGate = async (_orgId: string) => ({ ...STUB_SUBSCRIPTION, org_id: _orgId });

const DEVICE_TOKEN_COOKIE_NAME = 'enermass_device_token';

const verifyPayloadSchema = z.object({
  device_name: z.string().nullable().optional(),
  browser: z.string().nullable().optional(),
  os: z.string().nullable().optional(),
  fingerprint_hash: z.string().nullable().optional(),
  public_key: z.string().nullable().optional(),
  challenge_str: z.string().nullable().optional(),
  signature: z.string().nullable().optional(),
  device_token: z.string().nullable().optional(),
}).passthrough();

function verifySignature(publicKeyJwkStr: string, challengeStr: string, signatureB64: string): boolean {
  try {
    const jwk = JSON.parse(publicKeyJwkStr);
    const key = crypto.createPublicKey({
      format: 'jwk',
      key: jwk,
    });
    const verifier = crypto.createVerify('SHA256');
    verifier.update(challengeStr);
    return verifier.verify(key, signatureB64, 'base64');
  } catch (err) {
    console.error('[DeviceVerify] Signature verification failed:', err);
    return false;
  }
}

export const POST = withAuthenticatedOrgApiRoute(async (request, context) => {
  try {
    const limited = await enforceRateLimit(request, { keyPrefix: 'device-verify', userId: context.session.user.id, limit: 20, windowMs: 60_000 });
    if (limited) return limited;
    return NextResponse.json({
      device: {
        id: '00000000-0000-0000-0000-000000000000',
        status: 'active',
      },
    });
  } catch (error) {
    return jsonForDeviceError(error);
  }
}, { deps: { assertActiveSubscription: bypassSubscriptionGate } });
