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
import { CommandPalette } from './CommandPalette';
import { KeyboardHelpModal } from './KeyboardHelpModal';
import { OnboardingTour } from './OnboardingTour';
import { OfflineBanner } from './OfflineBanner';
import { SyncConflictResolver } from './SyncConflictResolver';
import { PwaPrompt } from './PwaPrompt';
import { useQuotesQuery } from '@/lib/hooks/useQuotes';

/**
 * AppShell wraps all pages with the sidebar, header, and mobile tab bar.
 * This must be a client component because it reads from the Zustand store.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { settings } = useSettings();
  const selectedSystemId = useCalculatorStore((s) => s.selectedSystemId);
  const storeQuoteCount = useCalculatorStore((s) => s.quotes.length);
  const dbSystems = useCalculatorStore((s) => s.dbSystems);
  const dbLoaded = useCalculatorStore((s) => s.dbLoaded);
  const fetchMasterData = useCalculatorStore((s) => s.fetchMasterData);

  const [loadingSession, setLoadingSession] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const publicRoutes = useMemo(() => new Set([
    '/login',
    '/signup',
    '/activate',
    '/forgot-password',
    '/device-blocked',
    '/device-reset-request',
    '/subscription-expired',
    '/unauthorized',
  ]), []);
  const isPublicRoute = publicRoutes.has(pathname);
  const { data: hydratedQuotes = [] } = useQuotesQuery({ enabled: isAuthenticated && !isPublicRoute });
  const quoteCount = hydratedQuotes.length || storeQuoteCount;
  const shouldBootstrapMasterData = useMemo(() => {
    const bootstrapPrefixes = [
      '/systems',
      '/quotes',
      '/rate-master',
      '/master',
      '/presets',
      '/dashboard',
      '/dashboards',
      '/erp',
      '/inventory',
      '/procurement',
      '/reports',
      '/amc',
      '/warranty',
    ];

    return bootstrapPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  }, [pathname]);

  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('is_super_admin, is_active')
            .eq('id', session.user.id)
            .maybeSingle();
          if (mounted) {
            setIsAuthenticated(true);
            setIsSuperAdmin(profile?.is_active !== false && (profile?.is_super_admin ?? false));
          }
        } else {
          if (!isPublicRoute) {
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
      if (event === 'PASSWORD_RECOVERY') {
        router.push('/profile?recovery=true');
        return;
      }

      if (session) {
        setIsAuthenticated(true);
        supabase
          .from('profiles')
          .select('is_super_admin, is_active')
          .eq('id', session.user.id)
          .maybeSingle()
          .then(({ data }) => setIsSuperAdmin(data?.is_active !== false && (data?.is_super_admin ?? false)));
      } else {
        setIsAuthenticated(false);
        setIsSuperAdmin(false);
        if (!isPublicRoute) {
          router.replace('/login');
        }
      }
      setLoadingSession(false);
    });

    if (isPublicRoute) {
      setLoadingSession(false);
    } else {
      checkSession();
    }

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [isPublicRoute, pathname, router]);

  useEffect(() => {
    if (isAuthenticated && shouldBootstrapMasterData) {
      fetchMasterData();
    }
  }, [isAuthenticated, shouldBootstrapMasterData, fetchMasterData]);

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
    if (pathname.startsWith('/rate-master')) {
      return {
        contextLabel: 'Finance',
        contextValue: 'Rate Master',
      };
    }
    if (pathname === '/master' || pathname.startsWith('/master/')) {
      return {
        contextLabel: 'Price Masters',
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
  const [isCmdOpen, setIsCmdOpen] = useState(false);
  const [isKbdOpen, setIsKbdOpen] = useState(false);

  // Keyboard shortcut listeners (Item 124 & 125)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCmdOpen((prev) => !prev);
      }
      if (e.key === '?') {
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA' && !target.isContentEditable) {
          e.preventDefault();
          setIsKbdOpen((prev) => !prev);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const persisted = localStorage.getItem('enermass-sidebar-collapsed');
    if (persisted !== null) {
      setSidebarCollapsed(persisted === 'true');
    }
  }, []);

  const handleSetSidebarCollapsed = (val: boolean | ((prev: boolean) => boolean)) => {
    setSidebarCollapsed((prev) => {
      const next = typeof val === 'function' ? val(prev) : val;
      localStorage.setItem('enermass-sidebar-collapsed', String(next));
      return next;
    });
  };

  const isLoginPage = isPublicRoute;

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
        <Sidebar collapsed={sidebarCollapsed} setCollapsed={handleSetSidebarCollapsed} isSuperAdmin={isSuperAdmin} />

        {/* Main area — responsive offset based on sidebar state */}
        <div className={`flex flex-col min-h-screen transition-all duration-300 ${sidebarCollapsed ? 'md:ml-[62px]' : 'md:ml-[228px]'}`}>
          <Header
            contextLabel={headerContext.contextLabel}
            contextValue={headerContext.contextValue}
            quoteCount={quoteCount}
          />
          <main id="main-content" className="flex-1 pb-20 md:pb-0" tabIndex={-1}>{children}</main>
        </div>

        {/* Mobile bottom nav */}
        <MobileTabBar />

        {/* Global palettes & helpers */}
        <CommandPalette isOpen={isCmdOpen} onClose={() => setIsCmdOpen(false)} />
        <KeyboardHelpModal isOpen={isKbdOpen} onClose={() => setIsKbdOpen(false)} />
        <OnboardingTour />
        <OfflineBanner />
        <SyncConflictResolver />
        <PwaPrompt />
      </ConfirmProvider>
    </ToastProvider>
  );
}
