'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, ArrowLeft, Mail, RefreshCw, Send, HelpCircle, Shield, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/Toast';

function EmailNotConfirmedContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailFromUrl = searchParams.get('email') || '';
  const { toast } = useToast();

  const [email, setEmail] = useState(emailFromUrl);
  const [emailError, setEmailError] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  
  // Manual token entry states
  const [showManualVerify, setShowManualVerify] = useState(false);
  const [verificationToken, setVerificationToken] = useState('');
  const [verifyingToken, setVerifyingToken] = useState(false);

  const validateEmail = (val: string): boolean => {
    if (!val.trim()) {
      setEmailError('Email is required.');
      return false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim())) {
      setEmailError('Please enter a valid email address.');
      return false;
    }
    setEmailError('');
    return true;
  };

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateEmail(email)) return;

    setStatus('loading');
    setErrorMessage('');

    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.message || 'Failed to resend confirmation email.');
      }

      setStatus('success');
      toast('Verification link resent successfully!', 'success');
    } catch (err: any) {
      console.error(err);
      setStatus('error');
      setErrorMessage(err.message || 'An unexpected error occurred. Please try again.');
    }
  };

  const handleVerifyManualToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationToken.trim()) return;
    if (!validateEmail(email)) return;

    setVerifyingToken(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: verificationToken.trim(),
        type: 'signup',
      });

      if (error) {
        toast(error.message, 'error');
      } else {
        toast('Email verified successfully! Logging you in...', 'success');
        router.push('/login?reason=verified');
      }
    } catch (err: any) {
      toast(err.message || 'Verification failed. Please try again.', 'error');
    } finally {
      setVerifyingToken(false);
    }
  };

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
      {/* Background radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(184,134,11,0.08)_0%,transparent_70%)] pointer-events-none" />

      <div className="w-full max-w-md animate-fade-in relative z-10">
        <div className="bg-surface border border-border rounded-2xl shadow-xl overflow-hidden glass">
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
              <div className="space-y-4 animate-fade-in">
                <div className="p-4 rounded-xl bg-success/10 border border-success/20 text-success text-sm font-medium text-center">
                  Verification email sent! Please check your inbox and junk folder.
                </div>
                
                {/* Spam folder guidance (Item 37) */}
                <div className="p-3.5 rounded-xl border border-border bg-surface-hover/30 text-xs text-text-muted space-y-2">
                  <p className="font-semibold text-text-primary">Can't find the email?</p>
                  <ul className="space-y-1.5 list-disc pl-4 text-[11px] leading-relaxed">
                    <li><span className="font-semibold text-text-muted">Gmail:</span> Check the <span className="text-accent">Promotions</span> or <span className="text-accent">Updates</span> tabs.</li>
                    <li><span className="font-semibold text-text-muted">Outlook/Hotmail:</span> Check the <span className="text-accent">Junk Email</span> folder or the "Other" inbox filter.</li>
                    <li><span className="font-semibold text-text-muted">Custom Domains:</span> Check if your organisation has external filters delaying incoming mail.</li>
                  </ul>
                </div>

                <div className="pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push('/login')}
                    className="w-full justify-center"
                  >
                    Go to Sign In
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {status === 'error' && (
                  <div className="p-4 rounded-xl bg-error/10 border border-error/20 text-error text-sm font-medium flex items-start gap-2.5">
                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                <form onSubmit={handleResend} className="space-y-4">
                  {/* Email Field with change hint (Item 36) */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Email Address</label>
                      <span className="text-[10px] text-accent italic">Mistyped email? Change it below</span>
                    </div>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (emailError) validateEmail(e.target.value);
                      }}
                      onBlur={(e) => validateEmail(e.target.value)}
                      required
                      placeholder="name@example.com"
                      className={`w-full px-4 py-2.5 rounded-xl bg-background/50 border text-sm text-text-primary outline-none focus:ring-1 focus:ring-accent/20 focus:bg-background transition-all ${
                        emailError ? 'border-red-500/60' : 'border-border focus:border-accent/50'
                      }`}
                    />
                    {emailError && (
                      <p className="text-[10px] text-red-400 flex items-center gap-1.5 mt-1 font-medium animate-slide-down">
                        <AlertCircle size={12} className="shrink-0" />
                        {emailError}
                      </p>
                    )}
                  </div>

                  {/* Expiry notice (Item 38) */}
                  <div className="text-[10px] text-text-muted flex items-center gap-1">
                    <Shield size={11} className="text-accent" />
                    <span>Verification links expire in <span className="font-bold text-accent">24 hours</span> for security.</span>
                  </div>

                  <Button
                    type="submit"
                    disabled={status === 'loading' || !email}
                    icon={status === 'loading' ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
                    className="w-full justify-center cursor-pointer"
                  >
                    {status === 'loading' ? 'Sending...' : 'Resend Verification Email'}
                  </Button>
                </form>

                {/* Manual verification entry (Item 39) */}
                <div className="pt-2 border-t border-border/40">
                  {!showManualVerify ? (
                    <button
                      type="button"
                      onClick={() => setShowManualVerify(true)}
                      className="text-xs text-accent hover:underline cursor-pointer flex items-center gap-1 mx-auto"
                    >
                      <HelpCircle size={13} />
                      Having trouble with the link? Enter code manually
                    </button>
                  ) : (
                    <form onSubmit={handleVerifyManualToken} className="space-y-3 animate-slide-down">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Manual Verification Code</label>
                        <input
                          type="text"
                          value={verificationToken}
                          onChange={(e) => setVerificationToken(e.target.value)}
                          placeholder="6-digit verification code"
                          className="w-full px-4 py-2 rounded-xl bg-background/50 border border-border text-sm text-text-primary text-center font-mono tracking-widest outline-none focus:border-accent"
                          required
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="submit"
                          disabled={verifyingToken || !verificationToken}
                          className="flex-1 justify-center cursor-pointer"
                        >
                          {verifyingToken ? 'Verifying...' : 'Verify Code'}
                        </Button>
                        <button
                          type="button"
                          onClick={() => setShowManualVerify(false)}
                          className="px-3 border border-border rounded-xl text-xs hover:bg-surface-hover text-text-muted transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}
                </div>

                <div className="flex justify-center pt-2">
                  <button
                    type="button"
                    onClick={() => router.push('/login')}
                    className="inline-flex items-center gap-2 text-xs font-semibold text-text-muted hover:text-text-primary transition-all cursor-pointer"
                  >
                    <ArrowLeft size={14} /> Back to Sign In
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Support fallback notice (Item 40) */}
          <div className="px-7 py-4 bg-surface-hover/30 border-t border-border/40 text-center space-y-1.5">
            <p className="text-[10px] text-text-muted leading-relaxed">
              Email still not arriving? Contact <a href="mailto:support@pitbullcorporations.com" className="text-accent underline font-semibold">support@pitbullcorporations.com</a> or speak directly to your organisation administrator.
            </p>
            <p className="text-[9px] font-semibold text-text-muted uppercase tracking-widest pt-1">
              Protected Terminal · Pitbull Corporations
            </p>
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
