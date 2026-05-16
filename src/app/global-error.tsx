'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[EnerMass Global Error]', error);
  }, [error]);

  return (
    <html>
      <body className="bg-background text-text-primary font-sans">
        <div className="flex items-center justify-center min-h-screen p-8">
          <div className="max-w-md w-full text-center space-y-4 p-8 rounded-2xl bg-surface border border-border">
            <h2 className="text-lg font-bold">Something went wrong</h2>
            <p className="text-sm text-text-muted">
              {error.message || 'An unexpected error occurred.'}
            </p>
            <button
              onClick={reset}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent text-background font-semibold text-sm hover:bg-accent-hover transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
