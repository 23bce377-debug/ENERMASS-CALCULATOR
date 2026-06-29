'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function UnauthorizedPage() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md animate-fade-in">
        <div className="bg-surface border border-border rounded-2xl shadow-xl overflow-hidden">
          <div className="p-7 border-b border-border/60 bg-surface-hover/30 text-center">
            <div className="mx-auto h-12 w-12 rounded-xl bg-error/10 text-error flex items-center justify-center mb-4">
              <ShieldAlert size={24} />
            </div>
            <p className="eyebrow mb-1">Access restricted</p>
            <h1 className="text-xl font-black text-text-primary tracking-tight">
              You do not have permission to view this page
            </h1>
            <p className="mt-3 text-sm text-text-secondary">
              Your account is active, but this area needs a higher role or an enabled plan feature.
            </p>
          </div>
          <div className="p-7 space-y-3">
            <Button type="button" variant="primary" onClick={() => router.push('/calculator')} className="w-full">
              Go to Calculator
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()} className="w-full">
              <ArrowLeft size={16} />
              Go Back
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
