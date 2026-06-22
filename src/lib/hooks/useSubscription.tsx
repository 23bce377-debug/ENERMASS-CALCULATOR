'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { SubscriptionPlan, OrgSubscription, FeatureMap, SeatUsage } from '@/lib/saas/types';

interface SubscriptionContextState {
  plan: SubscriptionPlan | null;
  subscription: OrgSubscription | null;
  features: FeatureMap;
  seatUsage: SeatUsage | null;
  isLoading: boolean;
  error: Error | null;
  isFeatureEnabled: (feature: string) => boolean;
  refresh: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextState | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{
    plan: SubscriptionPlan | null;
    subscription: OrgSubscription | null;
    features: FeatureMap;
    seatUsage: SeatUsage | null;
    isLoading: boolean;
    error: Error | null;
  }>({
    plan: null,
    subscription: null,
    features: {},
    seatUsage: null,
    isLoading: true,
    error: null,
  });

  const fetchSubscription = async () => {
    try {
      setState(s => ({ ...s, isLoading: true, error: null }));
      const res = await fetch('/api/saas/subscription');
      if (!res.ok) {
        if (res.status === 401) {
          // Unauthenticated, probably public route
          setState({ plan: null, subscription: null, features: {}, seatUsage: null, isLoading: false, error: null });
          return;
        }
        throw new Error(`Failed to fetch subscription: ${res.statusText}`);
      }
      const data = await res.json();
      setState({
        plan: data.plan,
        subscription: data.subscription,
        features: data.features || {},
        seatUsage: data.seatUsage,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      setState(s => ({ ...s, isLoading: false, error: error instanceof Error ? error : new Error('Unknown error') }));
    }
  };

  useEffect(() => {
    fetchSubscription();
  }, []);

  const isFeatureEnabled = (feature: string) => {
    if (!state.features) return false;
    const value = state.features[feature];
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value > 0;
    if (typeof value === 'string') return value.length > 0;
    return Boolean(value);
  };

  return (
    <SubscriptionContext.Provider value={{ ...state, isFeatureEnabled, refresh: fetchSubscription }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
}
