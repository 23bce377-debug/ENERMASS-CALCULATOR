import 'server-only';
import type { ReactNode } from 'react';
import { requireOrgAdminPageSession } from '@/lib/saas/managementPageGuards';

export default async function SettingsLayout({ children }: { children: ReactNode }) {
  await requireOrgAdminPageSession(['owner', 'admin', 'manager', 'staff', 'viewer']);

  return <>{children}</>;
}
