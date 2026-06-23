import 'server-only';
import type { ReactNode } from 'react';
import { requireLicensedPage } from '@/lib/auth/requireLicensedPage';

export default async function DashboardsLayout({ children }: { children: ReactNode }) {
  await requireLicensedPage({
    feature: 'reports',
    roles: ['owner', 'admin', 'manager', 'staff'],
  });

  return <>{children}</>;
}
