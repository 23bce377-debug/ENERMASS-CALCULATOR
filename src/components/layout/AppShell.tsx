'use client';

import { Sidebar, MobileTabBar, Header } from './Sidebar';
import { useCalculatorStore } from '@/lib/store/calculatorStore';
import { SYSTEMS } from '@/lib/data/bom';
import { ToastProvider } from '@/components/ui/Toast';
import { ConfirmProvider } from '@/components/ui/Confirm';
import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useSettings } from '@/lib/hooks/useSettings';
import { supabase } from '@/lib/supabase/client';
import { Loader2 } from 'lucide-react';

/**
 * AppShell wraps all pages with the sidebar, header, and mobile tab bar.
 * This must be a client component because it reads from the Zustand store.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { settings } = useSettings();
  const selectedSystemId = useCalculatorStore((s) => s.selectedSystemId);
  const quoteCount = useCalculatorStore((s) => s.quotes.length);
  const dbSystems = useCalculatorStore((s) => s.dbSystems);
  const dbLoaded = useCalculatorStore((s) => s.dbLoaded);
  const fetchMasterData = useCalculatorStore((s) => s.fetchMasterData);

  const [loadingSession, setLoadingSession] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          if (mounted) {
            setIsAuthenticated(true);
          }
        } else {
          if (pathname !== '/login') {
            router.replace('/login');
          }
        }
      } catch (err) {
        console.error('Error checking session in AppShell:', err);
      } finally {
        if (mounted) {
          setLoadingSession(false);
        }
      }
    }

    // Subscribe to auth state updates
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        setIsAuthenticated(true);
        if (pathname === '/login') {
          router.replace('/calculator');
        }
      } else {
        setIsAuthenticated(false);
        if (pathname !== '/login') {
          router.replace('/login');
        }
      }
      setLoadingSession(false);
    });

    if (pathname === '/login') {
      setLoadingSession(false);
    } else {
      checkSession();
    }

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [pathname, router]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchMasterData();
    }
  }, [isAuthenticated, fetchMasterData]);

  const systemName = useMemo(() => {
    if (!selectedSystemId) return null;
    const allSystems = dbLoaded && dbSystems.length > 0
      ? [...dbSystems, ...(settings.customSystems ?? [])]
      : [...SYSTEMS, ...(settings.customSystems ?? [])];
    return allSystems.find((s) => s.id === selectedSystemId)?.name ?? null;
  }, [selectedSystemId, settings.customSystems, dbSystems, dbLoaded]);

  const headerContext = useMemo(() => {
    if (pathname.startsWith('/calculator')) {
      return {
        contextLabel: 'System',
        contextValue: systemName ?? 'No system selected',
      };
    }
    if (pathname.startsWith('/systems')) {
      return {
        contextLabel: 'Engineering',
        contextValue: 'System Presets',
      };
    }
    if (pathname.startsWith('/quotes')) {
      return {
        contextLabel: 'CRM',
        contextValue: 'Quote Management',
      };
    }
    if (pathname.startsWith('/acquisition')) {
      return {
        contextLabel: 'Finance',
        contextValue: 'Acquisition & Inventory',
      };
    }
    if (pathname.startsWith('/earnings')) {
      return {
        contextLabel: 'Finance',
        contextValue: 'Management Dashboard',
      };
    }
    if (pathname.startsWith('/rate-master')) {
      return {
        contextLabel: 'Finance',
        contextValue: 'Rate Master',
      };
    }
    if (pathname === '/master' || pathname.startsWith('/master/')) {
      return {
        contextLabel: 'ERP Masters',
        contextValue: 'Master Data Management',
      };
    }
    if (pathname.startsWith('/presets')) {
      return {
        contextLabel: 'Engineering',
        contextValue: 'Bundle Presets',
      };
    }
    if (pathname.startsWith('/settings')) {
      return {
        contextLabel: 'System',
        contextValue: 'Organization Settings',
      };
    }
    if (pathname.startsWith('/profile')) {
      return {
        contextLabel: 'User',
        contextValue: 'User Profile',
      };
    }

    return { contextLabel: 'Page', contextValue: 'Solar Solutions' };
  }, [pathname, systemName]);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const isLoginPage = pathname === '/login';

  if (isLoginPage) {
    return (
      <ToastProvider>
        <ConfirmProvider>
          <main className="min-h-screen bg-background flex-1">{children}</main>
        </ConfirmProvider>
      </ToastProvider>
    );
  }

  if (loadingSession || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
        <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-text-muted">
          Verifying Authorization...
        </p>
      </div>
    );
  }

  return (
    <ToastProvider>
      <ConfirmProvider>
        {/* Desktop sidebar */}
        <Sidebar collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />

        {/* Main area — responsive offset based on sidebar state */}
        <div className={`flex flex-col min-h-screen transition-all duration-300 ${sidebarCollapsed ? 'md:ml-[62px]' : 'md:ml-[228px]'}`}>
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
