'use client';

import { useRouter } from 'next/navigation';
import { CreditCard, Settings } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function SubscriptionExpiredPage() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md animate-fade-in">
        <div className="bg-surface border border-border rounded-2xl shadow-xl overflow-hidden">
          <div className="p-7 border-b border-border/60 bg-surface-hover/30 text-center">
            <div className="mx-auto h-12 w-12 rounded-xl bg-accent/10 text-accent flex items-center justify-center mb-4">
              <CreditCard size={24} />
            </div>
            <p className="eyebrow mb-1">Subscription required</p>
            <h1 className="text-xl font-black text-text-primary tracking-tight">
              Your plan needs attention
            </h1>
            <p className="mt-3 text-sm text-text-secondary">
              The requested action is blocked because the organization subscription is inactive, expired, or missing the required feature.
            </p>
          </div>
          <div className="p-7 space-y-3">
            <Button type="button" variant="primary" onClick={() => router.push('/settings/billing')} className="w-full">
              <Settings size={16} />
              Open Billing Settings
            </Button>
            <Button type="button" variant="outline" onClick={() => router.push('/calculator')} className="w-full">
              Go to Calculator
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
