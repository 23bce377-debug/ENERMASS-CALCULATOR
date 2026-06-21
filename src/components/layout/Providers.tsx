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

  return (
    <QueryClientProvider client={queryClient}>
      <SubscriptionProvider>
        {children}
      </SubscriptionProvider>
    </QueryClientProvider>
  )
}
