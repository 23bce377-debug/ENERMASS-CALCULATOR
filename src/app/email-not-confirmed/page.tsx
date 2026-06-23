'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, ArrowLeft, Mail, RefreshCw, Send } from 'lucide-react';
import { Button } from '@/components/ui/Button';

function EmailNotConfirmedContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailFromUrl = searchParams.get('email') || '';

  const [email, setEmail] = useState(emailFromUrl);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setStatus('loading');
    setErrorMessage('');

    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.message || 'Failed to resend confirmation email.');
      }

      setStatus('success');
    } catch (err: any) {
      console.error(err);
      setStatus('error');
      setErrorMessage(err.message || 'An unexpected error occurred. Please try again.');
    }
  };

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md animate-fade-in">
        <div className="bg-surface border border-border rounded-2xl shadow-xl overflow-hidden">
          <div className="p-7 border-b border-border/60 bg-surface-hover/30 text-center">
            <div className="mx-auto h-12 w-12 rounded-xl bg-accent/10 text-accent flex items-center justify-center mb-4">
              <Mail size={24} />
            </div>
            <p className="eyebrow mb-1">Email Verification Required</p>
            <h1 className="text-xl font-black text-text-primary tracking-tight">
              Confirm your email address
            </h1>
            <p className="mt-2 text-sm text-text-secondary">
              A verification link was sent when you activated your account. Please click that link to confirm your email.
            </p>
          </div>

          <div className="p-7 space-y-5">
            {status === 'success' ? (
              <div className="space-y-4 animate-fade-in text-center">
                <div className="p-4 rounded-xl bg-success/10 border border-success/20 text-success text-sm font-medium">
                  Verification email sent! Please check your inbox and junk folder.
                </div>
                <p className="text-xs text-text-muted">
                  Note: If you do not see the email within a few minutes, check your spam folder or try again.
                </p>
                <div className="pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push('/login')}
                    className="w-full"
                  >
                    Go to Sign In
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleResend} className="space-y-4">
                {status === 'error' && (
                  <div className="p-4 rounded-xl bg-error/10 border border-error/20 text-error text-sm font-medium flex items-start gap-2.5">
                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-text-muted uppercase tracking-wider">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="name@example.com"
                    className="w-full px-4 py-2.5 rounded-lg bg-background border border-border text-sm text-text-primary outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all shadow-sm"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={status === 'loading' || !email}
                  icon={status === 'loading' ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
                  className="w-full justify-center"
                >
                  {status === 'loading' ? 'Sending...' : 'Resend Verification Email'}
                </Button>

                <div className="flex justify-center pt-2">
                  <button
                    type="button"
                    onClick={() => router.push('/login')}
                    className="inline-flex items-center gap-2 text-xs font-semibold text-text-muted hover:text-text-primary transition-all"
                  >
                    <ArrowLeft size={14} /> Back to Sign In
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

export default function EmailNotConfirmedPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
          <div className="text-sm font-semibold text-text-muted uppercase tracking-widest">
            Loading...
          </div>
        </main>
      }
    >
      <EmailNotConfirmedContent />
    </Suspense>
  );
}
