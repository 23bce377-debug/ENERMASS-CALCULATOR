import 'server-only';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  AuthenticationRequiredError,
  requireLicensedSession,
  type LicensedSession,
  type RequireLicensedSessionDeps,
  type RequireLicensedSessionOptions,
} from './requireLicensedSession';
import {
  DeviceMismatchError,
  DeviceNotRegisteredError,
  FeatureNotEnabledError,
  MembershipMissingError,
  SubscriptionExpiredError,
  UnauthorizedRoleError,
  SeatLimitReachedError,
} from '@/lib/saas/errors';

export interface LicensedPageOptions extends RequireLicensedSessionOptions {
  deps?: RequireLicensedSessionDeps;
}

function redirectPathForError(error: unknown) {
  if (error instanceof AuthenticationRequiredError || error instanceof MembershipMissingError) {
    return '/login';
  }

  if (
    error instanceof SubscriptionExpiredError ||
    error instanceof FeatureNotEnabledError ||
    error instanceof SeatLimitReachedError
  ) {
    return '/subscription-expired';
  }

  if (error instanceof DeviceMismatchError || error instanceof DeviceNotRegisteredError) {
    return '/device-blocked';
  }

  if (error instanceof UnauthorizedRoleError) {
    return '/unauthorized';
  }

  throw error;
}

export async function requireLicensedPage(options: LicensedPageOptions): Promise<LicensedSession> {
  try {
    const headerList = await headers();
    const request = new Request('https://licensed-page.local', { headers: headerList });
    return await requireLicensedSession(request, options, options.deps);
  } catch (error) {
    redirect(redirectPathForError(error));
  }
}

