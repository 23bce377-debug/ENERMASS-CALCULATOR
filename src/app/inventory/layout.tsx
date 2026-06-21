import 'server-only';
import type { ReactNode } from 'react';
import { requireLicensedPage } from '@/lib/auth/requireLicensedPage';

export default async function InventoryLayout({ children }: { children: ReactNode }) {
  await requireLicensedPage({
    feature: 'inventory',
    roles: ['owner', 'admin', 'manager'],
  });

  return <>{children}</>;
}
