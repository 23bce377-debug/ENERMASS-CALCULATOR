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

    const body = await parseJsonBody(request, verifyPayloadSchema).catch(() => ({} as z.infer<typeof verifyPayloadSchema>));
    const userDeviceRepository = new UserDeviceRepository();
    
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
        deviceToken = cookieStore.get(DEVICE_TOKEN_COOKIE_NAME)?.value || '';
      } catch {
        // Graceful fallback for non-request environments
      }
    }

    const requestToken = deviceToken || body.device_token;
    let activeDevice: any = null;

    if (requestToken && typeof requestToken === 'string') {
      const secretHash = crypto.createHash('sha256').update(requestToken).digest('hex');
      const supabaseAdmin = createAdminClient();
      const { data } = await supabaseAdmin
        .from('user_devices')
        .select('*')
        .eq('user_id', context.session.user.id)
        .eq('device_secret_hash', secretHash)
        .eq('status', 'active')
        .maybeSingle();
      activeDevice = data;
    }

    let response: NextResponse;

    if (!activeDevice) {
      // Auto-register the device since they have none
      const newToken = crypto.randomBytes(32).toString('hex');
      const secretHash = crypto.createHash('sha256').update(newToken).digest('hex');

      const device = await registerDevice(
        context.session.user.id,
        context.session.orgId,
        {
          deviceSecretHash: secretHash,
          deviceName: body.device_name ?? requestUserAgent(request) ?? 'Unknown Device',
          browser: body.browser,
          os: body.os,
          publicKey: body.public_key,
          fingerprintHash: body.fingerprint_hash,
        }
      );

      response = NextResponse.json({
        device: {
          id: device.id,
          status: device.status,
        },
      });

      const isLocalhost = request.headers.get('host')?.includes('localhost') || request.headers.get('host')?.includes('127.0.0.1');
      response.cookies.set({
        name: DEVICE_TOKEN_COOKIE_NAME,
        value: newToken,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production' && !isLocalhost,
        sameSite: 'strict',
        path: '/',
      });

    } else {
      // Validate the device token (from cookie or request body)
      let tokenValid = false;
      
      if (requestToken && typeof requestToken === 'string') {
        const secretHash = crypto.createHash('sha256').update(requestToken).digest('hex');
        if (secretHash === activeDevice.device_secret_hash) {
          tokenValid = true;
        }
      }

      // Cryptographic verification
      let storedPubKey = (activeDevice as any).public_key;
      let storedFingerprint = (activeDevice as any).fingerprint_hash;

      // Handle legacy upgrade if token is valid and public key is supplied
      if (tokenValid && !storedPubKey && body.public_key) {
        await userDeviceRepository.update(activeDevice.id, {
          publicKey: body.public_key,
          fingerprintHash: body.fingerprint_hash,
        });
        storedPubKey = body.public_key;
        storedFingerprint = body.fingerprint_hash;
      }

      let cryptoVerified = false;
      if (storedPubKey && body.signature && body.challenge_str) {
        // Validate challenge freshness to prevent replay attacks (5 mins window)
        try {
          const challenge = JSON.parse(body.challenge_str);
          const timeDiff = Math.abs(Date.now() - Number(challenge.timestamp));
          if (!isNaN(timeDiff) && timeDiff <= 60 * 1000) {
            // Verify ECDSA signature
            const isSigValid = verifySignature(storedPubKey, body.challenge_str, body.signature);
            // Verify fingerprint hash
            const isFingerprintValid = !storedFingerprint || !body.fingerprint_hash || storedFingerprint === body.fingerprint_hash;

            if (isSigValid && isFingerprintValid) {
              cryptoVerified = true;
            }
          }
        } catch (err) {
          console.error('[DeviceVerify] Fallback signature validation failed:', err);
        }
      }

      // If neither token is valid nor crypto verification succeeded, block access
      if (!tokenValid && !cryptoVerified) {
        throw new DeviceMismatchError({
          orgId: context.session.orgId,
          userId: context.session.user.id,
          activeDeviceId: activeDevice.id,
          reason: (!requestToken || typeof requestToken !== 'string') ? 'Device token missing and signature invalid' : 'Device token mismatch and signature invalid',
        });
      }

      // If cookie is missing but verification succeeded (either via token in body or crypto fallback), re-issue the cookie
      if (!deviceToken && (tokenValid || cryptoVerified)) {
        const tokenToUse = (tokenValid && typeof body.device_token === 'string') ? body.device_token : crypto.randomBytes(32).toString('hex');
        
        if (!tokenValid) {
          const secretHash = crypto.createHash('sha256').update(tokenToUse).digest('hex');
          await userDeviceRepository.update(activeDevice.id, {
            deviceSecretHash: secretHash,
          });
        }

        response = NextResponse.json({
          device: {
            id: activeDevice.id,
            status: activeDevice.status,
          },
        });

        const isLocalhost = request.headers.get('host')?.includes('localhost') || request.headers.get('host')?.includes('127.0.0.1');
        response.cookies.set({
          name: DEVICE_TOKEN_COOKIE_NAME,
          value: tokenToUse,
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production' && !isLocalhost,
          sameSite: 'strict',
          path: '/',
        });
      } else {
        // Normal path: token was valid in the cookie
        await userDeviceRepository.touch(activeDevice.id);

        response = NextResponse.json({
          device: {
            id: activeDevice.id,
            status: activeDevice.status,
          },
        });
      }
    }

    return response;
  } catch (error) {
    return jsonForDeviceError(error);
  }
}, { deps: { assertActiveSubscription: bypassSubscriptionGate } });
