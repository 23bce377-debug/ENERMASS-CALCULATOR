/**
 * Calculator layout — server-side guard.
 *
 * The calculator page itself is a pure client component ('use client').
 * This layout intercepts all requests to /calculator/* at the server boundary
 * and enforces: authenticated session + active subscription + calculator feature
 * + valid device session + allowed role.
 *
 * If any check fails, Next.js redirect() is invoked before the client
 * component is ever rendered, so the guard cannot be bypassed by
 * disabling JavaScript or calling page routes directly.
 */
import 'server-only';
import type { ReactNode } from 'react';
import { requireLicensedPage } from '@/lib/auth/requireLicensedPage';

export default async function CalculatorLayout({ children }: { children: ReactNode }) {
  // Enforce: authenticated + active subscription + calculator feature + device session
  // Roles that can access the calculator:
  await requireLicensedPage({
    feature: 'calculator',
    roles: ['owner', 'admin', 'manager', 'staff'],
  });

  return <>{children}</>;
}
