'use client'

import React, { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SubscriptionProvider } from '@/lib/hooks/useSubscription'

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 0, // Dynamic/transactional data defaults to 0 for real-time integrity
            refetchOnWindowFocus: false,
          },
        },
      })
  )

  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      if (!reason) return;

      const isFailedToFetch =
        reason instanceof Error &&
        (reason.message === 'Failed to fetch' ||
          reason.message.includes('fetch') ||
          reason.name === 'TypeError');

      const isSupabaseAuth =
        reason.stack?.includes('supabase_auth-js') ||
        reason.stack?.includes('GoTrueClient') ||
        reason.stack?.includes('visibilityChangedCallback') ||
        reason.stack?.includes('visibilitychange');

      if (isFailedToFetch && (isSupabaseAuth || process.env.NODE_ENV === 'development')) {
        // Prevent Next.js / React Dev from displaying a blocking full-screen red error overlay
        event.preventDefault();
        console.warn('Gracefully suppressed unhandled background network error:', reason.message);
      }
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <SubscriptionProvider>
        {children}
      </SubscriptionProvider>
    </QueryClientProvider>
  )
}
