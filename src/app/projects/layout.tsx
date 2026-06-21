import 'server-only';
import type { ReactNode } from 'react';
import { requireLicensedPage } from '@/lib/auth/requireLicensedPage';

export default async function ProjectsLayout({ children }: { children: ReactNode }) {
  await requireLicensedPage({
    feature: 'erp',
    roles: ['owner', 'admin', 'manager'],
  });

  return <>{children}</>;
}
