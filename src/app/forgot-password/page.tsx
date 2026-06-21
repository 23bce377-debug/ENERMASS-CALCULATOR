'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Mail, ArrowLeft, CheckCircle, Loader2 } from 'lucide-react';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);

    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      // Always show success regardless of response to prevent enumeration
      setSubmitted(true);
    } catch {
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(184,134,11,0.08)_0%,transparent_70%)] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="glass border border-border/80 rounded-2xl overflow-hidden shadow-2xl animate-fade-in">

          {/* Header */}
          <div className="p-8 pb-6 text-center border-b border-border/40 relative bg-surface-hover/30">
            <div className="mx-auto w-12 h-12 rounded-xl gold-gradient flex items-center justify-center shadow-lg shadow-accent/20 mb-4 animate-pulse-glow">
              <Shield size={22} className="text-background stroke-[2.5]" />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-text-primary">
              ENER<span className="text-accent">MASS</span>
            </h2>
            <p className="text-xs text-text-muted mt-1 uppercase tracking-wider font-medium">
              Password Reset Request
            </p>
          </div>

          <div className="p-8">
            {!submitted ? (
              <form onSubmit={handleSubmit} className="space-y-6" id="forgot-password-form">
                <div>
                  <h3 className="text-base font-bold text-text-primary mb-1">Reset Your Password</h3>
                  <p className="text-sm text-text-muted leading-relaxed">
                    Enter your email address. Your organisation admin will be notified and must approve the reset before a link is sent.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest">
                    Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-text-muted">
                      <Mail size={16} />
                    </div>
                    <input
                      id="forgot-password-email"
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="name@company.com"
                      className="w-full pl-10 pr-3.5 py-3 rounded-xl border border-border bg-background/50
                        text-sm text-text-primary placeholder:text-text-muted
                        focus:outline-none focus:border-accent/50 focus:bg-background transition-all duration-200"
                      required
                      autoFocus
                    />
                  </div>
                </div>

                <button
                  id="forgot-password-submit"
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="w-full gold-gradient py-3 px-4 rounded-xl text-background font-bold text-sm
                    transition-all duration-200 active:scale-[0.98] shadow-lg shadow-accent/20 hover:brightness-110
                    disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <><Loader2 size={16} className="animate-spin" /> Sending Request...</>
                  ) : (
                    'Request Password Reset'
                  )}
                </button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => router.push('/login')}
                    className="flex items-center justify-center gap-1 text-xs text-text-muted hover:text-accent transition-colors mx-auto"
                  >
                    <ArrowLeft size={12} /> Back to Sign In
                  </button>
                </div>
              </form>
            ) : (
              <div className="text-center space-y-6 py-4">
                <div className="mx-auto w-16 h-16 rounded-full bg-green-500/10 border-2 border-green-500/40 flex items-center justify-center">
                  <CheckCircle size={32} className="text-green-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-text-primary mb-2">Request Sent</h3>
                  <p className="text-sm text-text-muted leading-relaxed">
                    If an account with this email exists, your organisation admin has been notified. You&apos;ll receive a reset link once they approve.
                  </p>
                </div>
                <button
                  id="back-to-login-button"
                  onClick={() => router.push('/login')}
                  className="w-full gold-gradient py-3 px-4 rounded-xl text-background font-bold text-sm
                    transition-all duration-200 active:scale-[0.98] shadow-lg shadow-accent/20 hover:brightness-110
                    flex items-center justify-center gap-2"
                >
                  <ArrowLeft size={16} /> Back to Sign In
                </button>
              </div>
            )}
          </div>

          <div className="px-8 py-4 bg-surface-hover/30 border-t border-border/40 text-center">
            <p className="text-[10px] font-semibold text-text-muted uppercase tracking-widest">
              Protected Terminal · Pitbull Corporations
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
