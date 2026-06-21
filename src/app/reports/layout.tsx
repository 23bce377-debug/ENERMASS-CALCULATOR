import 'server-only';
import type { ReactNode } from 'react';
import { requireLicensedPage } from '@/lib/auth/requireLicensedPage';

export default async function ReportsLayout({ children }: { children: ReactNode }) {
  await requireLicensedPage({
    feature: 'reports',
    roles: ['owner', 'admin', 'manager', 'viewer'],
  });

  return <>{children}</>;
}
