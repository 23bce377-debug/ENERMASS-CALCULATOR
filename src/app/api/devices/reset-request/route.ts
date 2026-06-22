import { NextResponse } from 'next/server';
import { withAuthenticatedOrgApiRoute } from '@/lib/auth/withAuthenticatedOrgApiRoute';
import { requestDeviceReset } from '@/lib/saas/services/deviceResetService';
import { enforceRateLimit } from '@/lib/security/rateLimit';
import {
  jsonForDeviceError,
  parseJsonBody,
  requestUserAgent,
} from '@/lib/device-binding/http';
import { z } from 'zod';

const resetPayloadSchema = z.object({
  device_name: z.string().nullable().optional(),
  browser: z.string().nullable().optional(),
  os: z.string().nullable().optional(),
  reason: z.string().nullable().optional(),
}).passthrough();

export const POST = withAuthenticatedOrgApiRoute(async (request, context) => {
  try {
    const limited = await enforceRateLimit(request, { keyPrefix: 'device-reset-request', userId: context.session.user.id, limit: 5, windowMs: 60_000 });
    if (limited) return limited;

    const body = await parseJsonBody(request, resetPayloadSchema).catch(() => ({} as z.infer<typeof resetPayloadSchema>));
    const resetRequest = await requestDeviceReset(context.session.user.id, context.session.orgId, {
      deviceName: body.device_name ?? null,
      browser: body.browser ?? null,
      os: body.os ?? null,
      reason: body.reason ?? null,
      userAgent: requestUserAgent(request),
    });

    return NextResponse.json({
      request: {
        id: resetRequest.id,
        status: resetRequest.status,
        old_device_id: resetRequest.old_device_id,
      },
    }, { status: 201 });
  } catch (error) {
    return jsonForDeviceError(error);
  }
});
