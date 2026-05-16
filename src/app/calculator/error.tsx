'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[EnerMass Error Boundary]', error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-8">
      <div className="max-w-md w-full text-center space-y-4 p-8 rounded-2xl bg-surface border border-border">
        <div className="w-12 h-12 mx-auto rounded-full bg-error/10 flex items-center justify-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-error">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <h2 className="text-lg font-bold text-text-primary">Something went wrong</h2>
        <p className="text-sm text-text-muted">
          {error.message || 'An unexpected error occurred in the calculator.'}
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent text-background font-semibold text-sm hover:bg-accent-hover transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
