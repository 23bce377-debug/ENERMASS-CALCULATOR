import 'server-only';
import type { ReactNode } from 'react';
import { requireLicensedPage } from '@/lib/auth/requireLicensedPage';

export default async function QuotesLayout({ children }: { children: ReactNode }) {
  await requireLicensedPage({
    feature: 'calculator',
    roles: ['owner', 'admin', 'manager', 'staff'],
  });

  return <>{children}</>;
}
