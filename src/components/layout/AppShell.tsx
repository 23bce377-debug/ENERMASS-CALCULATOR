'use client';

import { Sidebar, MobileTabBar, Header } from './Sidebar';
import { useCalculatorStore } from '@/lib/store/calculatorStore';
import { SYSTEMS } from '@/lib/data/bom';
import { ToastProvider } from '@/components/ui/Toast';
import { ConfirmProvider } from '@/components/ui/Confirm';
import { useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useSettings } from '@/lib/hooks/useSettings';

/**
 * AppShell wraps all pages with the sidebar, header, and mobile tab bar.
 * This must be a client component because it reads from the Zustand store.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { settings } = useSettings();
  const selectedSystemId = useCalculatorStore((s) => s.selectedSystemId);
  const quoteCount = useCalculatorStore((s) => s.quotes.length);

  const systemName = useMemo(() => {
    if (!selectedSystemId) return null;
    const allSystems = [...SYSTEMS, ...(settings.customSystems ?? [])];
    return allSystems.find((s) => s.id === selectedSystemId)?.name ?? null;
  }, [selectedSystemId, settings.customSystems]);

  const headerContext = useMemo(() => {
    if (pathname.startsWith('/calculator')) {
      return {
        contextLabel: 'System',
        contextValue: systemName ?? 'No system selected',
      };
    }

    return { contextLabel: 'Page', contextValue: 'Solar Solutions' };
  }, [pathname, systemName]);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <ToastProvider>
      <ConfirmProvider>
        {/* Desktop sidebar */}
        <Sidebar collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />

        {/* Main area — responsive offset based on sidebar state */}
        <div className={`flex flex-col min-h-screen transition-all duration-300 ${sidebarCollapsed ? 'md:ml-[68px]' : 'md:ml-[240px]'}`}>
          <Header
            contextLabel={headerContext.contextLabel}
            contextValue={headerContext.contextValue}
            quoteCount={quoteCount}
          />
          <main className="flex-1 pb-20 md:pb-0">{children}</main>
        </div>

        {/* Mobile bottom nav */}
        <MobileTabBar />
      </ConfirmProvider>
    </ToastProvider>
  );
}
