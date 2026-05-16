'use client';

import { Sidebar, MobileTabBar, Header } from './Sidebar';
import { useCalculatorStore } from '@/lib/store/calculatorStore';
import { SYSTEMS } from '@/lib/data/bom';
import { ToastProvider } from '@/components/ui/Toast';
import { useMemo } from 'react';
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

    if (pathname.startsWith('/dashboard')) {
      return { contextLabel: 'Page', contextValue: 'Dashboard overview' };
    }
    if (pathname.startsWith('/quotes')) {
      return { contextLabel: 'Page', contextValue: 'Quote management' };
    }
    if (pathname.startsWith('/systems')) {
      return { contextLabel: 'Page', contextValue: 'System browser' };
    }
    if (pathname.startsWith('/rate-master')) {
      return { contextLabel: 'Page', contextValue: 'Rate master' };
    }
    if (pathname.startsWith('/settings')) {
      return { contextLabel: 'Page', contextValue: 'Settings' };
    }

    return { contextLabel: 'Page', contextValue: 'EnerMass Solar' };
  }, [pathname, systemName]);

  return (
    <ToastProvider>
      {/* Desktop sidebar */}
      <Sidebar />

      {/* Main area — offset by sidebar width on desktop */}
      <div className="md:ml-[240px] flex flex-col min-h-screen transition-all duration-300">
        <Header
          contextLabel={headerContext.contextLabel}
          contextValue={headerContext.contextValue}
          quoteCount={quoteCount}
        />
        <main className="flex-1 pb-20 md:pb-0">{children}</main>
      </div>

      {/* Mobile bottom nav */}
      <MobileTabBar />
    </ToastProvider>
  );
}
