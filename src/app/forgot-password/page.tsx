'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/Toast';
import { Shield, Mail, ArrowLeft, CheckCircle, Loader2, Lock, AlertCircle, RefreshCw, HelpCircle } from 'lucide-react';
import { PasswordInput } from '@/components/ui/PasswordInput';

const PASSWORD_RULES = [
  { test: (p: string) => p.length >= 12,           label: 'At least 12 characters' },
  { test: (p: string) => /[A-Z]/.test(p),          label: 'One uppercase letter' },
  { test: (p: string) => /[a-z]/.test(p),          label: 'One lowercase letter' },
  { test: (p: string) => /[0-9]/.test(p),          label: 'One number' },
  { test: (p: string) => /[^A-Za-z0-9]/.test(p),   label: 'One special character' },
];

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  
  // Resend Countdown
  const [resendCooldown, setResendCooldown] = useState(0);

  // Recovery Token Update Mode
  const [token, setToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newPasswordError, setNewPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resetComplete, setResetComplete] = useState(false);

  // Check if loaded with recovery callback/code
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const hash = window.location.hash;
      const isRecovery = hash.includes('type=recovery') || params.get('type') === 'recovery';
      
      if (code || isRecovery) {
        setToken(code || 'recovery_token');
      }
    }
  }, []);

  // Cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => {
        setResendCooldown((prev) => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const validateEmail = (val: string): boolean => {
    if (!val.trim()) {
      setEmailError('Email address is required.');
      return false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim())) {
      setEmailError('Please enter a valid email address.');
      return false;
    }
    setEmailError('');
    return true;
  };

  const validateNewPassword = (val: string): boolean => {
    const failedRules = PASSWORD_RULES.filter(r => !r.test(val));
    if (!val) {
      setNewPasswordError('Password is required.');
      return false;
    } else if (failedRules.length > 0) {
      setNewPasswordError(`Password must contain: ${failedRules.map(r => r.label.toLowerCase()).join(', ')}.`);
      return false;
    }
    setNewPasswordError('');
    return true;
  };

  const validateConfirmPassword = (val: string, pass: string): boolean => {
    if (!val) {
      setConfirmPasswordError('Please confirm your new password.');
      return false;
    } else if (val !== pass) {
      setConfirmPasswordError('Passwords do not match.');
      return false;
    }
    setConfirmPasswordError('');
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateEmail(email)) {
      document.getElementById('forgot-email-input')?.focus();
      return;
    }
    setLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      if (res.status === 429) {
        toast('Rate limit exceeded. Please wait 15 minutes before requesting again.', 'error');
        setLoading(false);
        return;
      }

      setSubmitted(true);
      setResendCooldown(60);
      toast('Reset request submitted successfully!', 'success');
    } catch {
      // Fallback success for enumeration safety
      setSubmitted(true);
      setResendCooldown(60);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const isPassValid = validateNewPassword(newPassword);
    const isConfirmValid = validateConfirmPassword(confirmPassword, newPassword);

    if (!isPassValid || !isConfirmValid) {
      if (!isPassValid) document.getElementById('new-password-input')?.focus();
      else document.getElementById('confirm-password-input')?.focus();
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        toast(error.message, 'error');
        setNewPasswordError(error.message);
      } else {
        toast('Password updated successfully!', 'success');
        setResetComplete(true);
      }
    } catch (err: any) {
      toast(err.message || 'Failed to update password.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Background radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(184,134,11,0.08)_0%,transparent_70%)] pointer-events-none" />

      <div className="w-full max-w-md relative z-10 animate-fade-in">
        <div className="glass border border-border/80 rounded-2xl overflow-hidden shadow-2xl">

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
            
            {/* ── Flow A: Reset Password Form (Token present) ────────────────── */}
            {token && !resetComplete && (
              <form onSubmit={handleUpdatePassword} className="space-y-5" noValidate>
                <div>
                  <h3 className="text-base font-bold text-text-primary mb-1">Set New Password</h3>
                  <p className="text-sm text-text-muted">
                    Choose a strong, compliant password to complete your recovery.
                  </p>
                </div>

                {/* New Password */}
                <div className="space-y-1.5 relative">
                  <PasswordInput
                    id="new-password-input"
                    label="New Password"
                    value={newPassword}
                    disabled={loading}
                    onChange={e => {
                      setNewPassword(e.target.value);
                      if (newPasswordError) setNewPasswordError('');
                    }}
                    placeholder="Min. 12 characters"
                    required
                    icon={<Lock size={16} />}
                    aria-describedby={newPasswordError ? 'new-password-error' : undefined}
                    error={newPasswordError}
                  />
                  <ul className="grid grid-cols-1 gap-1 p-3 rounded-xl border border-border bg-background/30 mt-2">
                    <p className="text-[9px] font-bold text-text-muted uppercase tracking-wider mb-1">New Requirements</p>
                    {PASSWORD_RULES.map((rule) => {
                      const ok = newPassword ? rule.test(newPassword) : false;
                      return (
                        <li key={rule.label} className={`flex items-center gap-1.5 text-[9px] font-medium transition-colors duration-200 ${
                          !newPassword ? 'text-text-muted/60' : ok ? 'text-green-400' : 'text-red-400/80'
                        }`}>
                          <CheckCircle size={10} className="shrink-0" />
                          {rule.label}
                        </li>
                      );
                    })}
                  </ul>
                </div>

                {/* Confirm Password */}
                <div className="space-y-1.5 relative">
                  <PasswordInput
                    id="confirm-password-input"
                    label="Confirm Password"
                    value={confirmPassword}
                    disabled={loading}
                    onChange={e => {
                      setConfirmPassword(e.target.value);
                      if (confirmPasswordError) setConfirmPasswordError('');
                    }}
                    placeholder="Re-enter password"
                    required
                    icon={<Lock size={16} />}
                    aria-describedby={confirmPasswordError ? 'confirm-password-error' : undefined}
                    error={confirmPasswordError}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full gold-gradient py-3 px-4 rounded-xl text-background font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? <><Loader2 size={16} className="animate-spin" /> Updating...</> : 'Update Password & Log In'}
                </button>
              </form>
            )}

            {/* ── Flow B: Reset Completed successfully ───────────────────────── */}
            {token && resetComplete && (
              <div className="text-center space-y-6 py-4 animate-fade-in">
                <div className="mx-auto w-16 h-16 rounded-full bg-green-500/10 border-2 border-green-500/40 flex items-center justify-center">
                  <CheckCircle size={32} className="text-green-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-text-primary mb-2">Password Updated!</h3>
                  <p className="text-sm text-text-muted">
                    Your password has been successfully reset. You can now log in to the terminal.
                  </p>
                </div>
                <button
                  onClick={() => router.push('/login')}
                  className="w-full gold-gradient py-3 px-4 rounded-xl text-background font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ArrowLeft size={16} /> Go to Login
                </button>
              </div>
            )}

            {/* ── Flow C: Request Reset (Default Input) ─────────────────────── */}
            {!token && !submitted && (
              <form onSubmit={handleSubmit} className="space-y-6" id="forgot-password-form" noValidate>
                <div>
                  <h3 className="text-base font-bold text-text-primary mb-1">Reset Your Password</h3>
                  <p className="text-sm text-text-muted leading-relaxed">
                    Enter your email address. A password reset request will be submitted to your organisation administrator for approval.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="forgot-email-input" className="block text-[10px] font-bold text-text-muted uppercase tracking-widest">
                    Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-text-muted">
                      <Mail size={16} />
                    </div>
                    <input
                      id="forgot-email-input"
                      type="email"
                      value={email}
                      disabled={loading}
                      onChange={e => {
                        setEmail(e.target.value);
                        if (emailError) validateEmail(e.target.value);
                      }}
                      onBlur={e => validateEmail(e.target.value)}
                      placeholder="name@company.com"
                      className={`w-full pl-10 pr-3.5 py-3 rounded-xl border bg-background/50
                        text-sm text-text-primary placeholder:text-text-muted
                        focus:outline-none focus:ring-2 focus:ring-accent/20 focus:bg-background transition-all duration-200 ${
                          emailError ? 'border-red-500/60 focus:border-red-500/80' : 'border-border focus:border-accent/50'
                        }`}
                      required
                      autoFocus
                      aria-describedby={emailError ? 'email-error' : undefined}
                    />
                  </div>
                  {emailError && (
                    <p id="email-error" className="text-[10px] text-red-400 flex items-center gap-1.5 mt-1 font-medium animate-slide-down">
                      <AlertCircle size={12} className="shrink-0" />
                      {emailError}
                    </p>
                  )}
                </div>

                <button
                  id="forgot-password-submit"
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="w-full gold-gradient py-3 px-4 rounded-xl text-background font-bold text-sm
                    transition-all duration-200 active:scale-[0.98] shadow-lg shadow-accent/20 hover:brightness-110
                    disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
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
                    className="flex items-center justify-center gap-1 text-xs text-text-muted hover:text-accent transition-colors mx-auto cursor-pointer"
                  >
                    <ArrowLeft size={12} /> Back to Sign In
                  </button>
                </div>
              </form>
            )}

            {/* ── Flow D: Request Submitted (Success preview) ──────────────── */}
            {!token && submitted && (
              <div className="text-center space-y-6 py-4 animate-fade-in">
                <div className="mx-auto w-16 h-16 rounded-full bg-green-500/10 border-2 border-green-500/40 flex items-center justify-center">
                  <CheckCircle size={32} className="text-green-400" />
                </div>
                
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-bold text-text-primary mb-2">Request Submitted</h3>
                    
                    {/* Clear success message & SLA indicator (Item 31 & 33) */}
                    <p className="text-xs text-text-muted leading-relaxed">
                      Your password reset request has been logged. Requests are typically approved by your organisation administrator <span className="text-accent font-semibold">within 4 hours</span>. Once approved, a password reset link will be sent to your email address. Please check your inbox and spam folder in 5-10 minutes.
                    </p>
                  </div>

                  {/* Enumeration protection warning (Item 35) */}
                  <div className="p-3 rounded-xl border border-border bg-surface-hover/30 text-[10px] text-text-muted leading-normal flex items-start gap-2 text-left">
                    <HelpCircle size={16} className="shrink-0 text-accent mt-0.5" />
                    <span>
                      For security reasons, we will show a submission success message even if the email entered is not registered in our database.
                    </span>
                  </div>

                  {/* Alternative Recovery fallback details (Item 34) */}
                  <div className="p-3 rounded-xl border border-border bg-surface-hover/30 text-[10px] text-text-muted leading-normal flex items-start gap-2 text-left">
                    <AlertCircle size={16} className="shrink-0 text-amber-500 mt-0.5" />
                    <span>
                      If you cannot access your email, please contact your organisation administrator directly or send a message to <a href="mailto:support@pitbullcorporations.com" className="text-accent underline font-semibold">support@pitbullcorporations.com</a>.
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  {/* Resend Cooldown triggers (Item 32) */}
                  <button
                    type="button"
                    disabled={resendCooldown > 0}
                    onClick={handleSubmit}
                    className="w-full py-2.5 px-4 border border-border hover:bg-surface-hover rounded-xl text-text-muted font-bold text-xs uppercase tracking-wider transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Request'}
                  </button>

                  <button
                    id="back-to-login-button"
                    onClick={() => router.push('/login')}
                    className="w-full gold-gradient py-3 px-4 rounded-xl text-background font-bold text-sm
                      transition-all duration-200 active:scale-[0.98] shadow-lg shadow-accent/20 hover:brightness-110
                      flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <ArrowLeft size={16} /> Back to Sign In
                  </button>
                </div>
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
