import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { withAuthenticatedOrgApiRoute } from '@/lib/auth/withAuthenticatedOrgApiRoute';
import { UserDeviceRepository } from '@/lib/saas/repositories';
import { DeviceMismatchError } from '@/lib/saas/errors';
import { enforceRateLimit } from '@/lib/security/rateLimit';
import { jsonForDeviceError, parseJsonBody, requestUserAgent } from '@/lib/device-binding/http';
import { z } from 'zod';
import { registerDevice } from '@/lib/saas/services/deviceService';

const DEVICE_TOKEN_COOKIE_NAME = 'enermass_device_token';

// Accept optional deviceInfo payload (which matches the old http payload but vastly simplified)
const verifyPayloadSchema = z.object({
  device_name: z.string().nullable().optional(),
  browser: z.string().nullable().optional(),
  os: z.string().nullable().optional(),
}).passthrough();

export const POST = withAuthenticatedOrgApiRoute(async (request, context) => {
  try {
    const limited = enforceRateLimit(request, { keyPrefix: 'device-verify', userId: context.session.user.id, limit: 20, windowMs: 60_000 });
    if (limited) return limited;

    const body = await parseJsonBody(request, verifyPayloadSchema).catch(() => ({} as z.infer<typeof verifyPayloadSchema>));
    const userDeviceRepository = new UserDeviceRepository();
    const activeDevice = await userDeviceRepository.getActiveForUser(context.session.user.id);
    
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
        }
      );

      response = NextResponse.json({
        device: {
          id: device.id,
          status: device.status,
        },
      });

      // 10 years expiry for persistent device token
      const expires = new Date();
      expires.setFullYear(expires.getFullYear() + 10);

      response.cookies.set({
        name: DEVICE_TOKEN_COOKIE_NAME,
        value: newToken,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        expires,
      });

    } else {
      // Validate the device token
      if (!deviceToken) {
        throw new DeviceMismatchError({ orgId: context.session.orgId, userId: context.session.user.id, activeDeviceId: activeDevice.id });
      }

      const secretHash = crypto.createHash('sha256').update(deviceToken).digest('hex');
      if (secretHash !== activeDevice.device_secret_hash) {
        throw new DeviceMismatchError({ orgId: context.session.orgId, userId: context.session.user.id, activeDeviceId: activeDevice.id });
      }

      await userDeviceRepository.touch(activeDevice.id);

      response = NextResponse.json({
        device: {
          id: activeDevice.id,
          status: activeDevice.status,
        },
      });
    }

    return response;
  } catch (error) {
    return jsonForDeviceError(error);
  }
});
