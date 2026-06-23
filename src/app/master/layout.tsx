import 'server-only';
import type { ReactNode } from 'react';
import { requireLicensedPage } from '@/lib/auth/requireLicensedPage';
import { MasterTabs } from './MasterTabs';

export default async function MastersLayout({ children }: { children: ReactNode }) {
  await requireLicensedPage({
    feature: 'master_data',
    roles: ['owner', 'admin', 'manager', 'staff'],
  });

  return (
    <div className="p-4 md:p-6 space-y-6 relative">
      <MasterTabs />
      <div className="min-h-[500px]">{children}</div>
    </div>
  );
}
