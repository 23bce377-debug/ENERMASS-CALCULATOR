import 'server-only';

import { redirect } from 'next/navigation';
import { AuthenticationRequiredError } from '@/lib/auth/requireLicensedSession';
import {
  requireOrgManagementSession,
  requireSuperAdminSession,
  type ManagementSession,
  type SuperAdminSession,
} from './services/managementService';
import type { OrgMemberRole } from './types';

function redirectFor(error: unknown) {
  if (error instanceof AuthenticationRequiredError) return '/login';
  if (error instanceof Error && error.message === 'MFA_REQUIRED') {
    return '/super-admin/mfa';
  }
  if (error && typeof error === 'object' && 'redirectTo' in error && typeof error.redirectTo === 'string') {
    return error.redirectTo === '/dashboard' ? '/unauthorized' : error.redirectTo;
  }
  throw error;
}

export async function requireOrgAdminPageSession(
  roles: OrgMemberRole[] = ['owner', 'admin', 'manager']
): Promise<ManagementSession> {
  try {
    return await requireOrgManagementSession(roles);
  } catch (error) {
    redirect(redirectFor(error));
  }
}

export async function requireSuperAdminPageSession(): Promise<SuperAdminSession> {
  try {
    return await requireSuperAdminSession();
  } catch (error) {
    redirect(redirectFor(error));
  }
}
