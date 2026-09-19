import 'server-only';

import { headers, cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  AuthenticationRequiredError,
  requireLicensedSession,
  type LicensedSession,
  type RequireLicensedSessionDeps,
  type RequireLicensedSessionOptions,
} from './requireLicensedSession';
import {
  ConcurrentSessionError,
  DeviceMismatchError,
  DeviceNotRegisteredError,
  FeatureNotEnabledError,
  MembershipMissingError,
  SubscriptionExpiredError,
  UnauthorizedRoleError,
  SeatLimitReachedError,
  EmailNotConfirmedError,
} from '@/lib/saas/errors';

export interface LicensedPageOptions extends RequireLicensedSessionOptions {
  deps?: RequireLicensedSessionDeps;
}

function redirectPathForError(error: unknown) {
  if (error instanceof AuthenticationRequiredError || error instanceof MembershipMissingError) {
    return '/login';
  }

  if (error instanceof ConcurrentSessionError) {
    return '/login?reason=concurrent_session';
  }

  if (error instanceof EmailNotConfirmedError) {
    return '/email-not-confirmed';
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
    const cookieStore = await cookies();
    const cookieStr = cookieStore.getAll().map((c) => `${c.name}=${c.value}`).join('; ');
    const headerList = new Headers(await headers());
    if (cookieStr) {
      headerList.set('cookie', cookieStr);
    }
    const request = new Request('https://licensed-page.local', { headers: headerList });
    return await requireLicensedSession(request, options, options.deps);
  } catch (error) {
    redirect(redirectPathForError(error));
  }
}


