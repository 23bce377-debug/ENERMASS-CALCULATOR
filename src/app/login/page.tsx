'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/Toast';
import { DeviceClientError, registerOrVerifyDevice } from '@/lib/device/deviceClient';
import { Shield, Mail, Lock, Loader2, HelpCircle, AlertCircle, Key } from 'lucide-react';
import { PasswordInput } from '@/components/ui/PasswordInput';

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loginMode, setLoginMode] = useState<'key' | 'credentials'>('key');
  const [licenseKey, setLicenseKey] = useState('');
  const [keyError, setKeyError] = useState('');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // UI states
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  
  // Validation and Error states
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);
  
  // Lockout / Rate limiting states
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutTime, setLockoutTime] = useState(0);

  const redirectForDeviceError = (error: unknown) => {
    if (error instanceof DeviceClientError) {
      if (error.redirectTo) {
        const reason = 'device';
        router.replace(`${error.redirectTo}?reason=${encodeURIComponent(reason)}`);
        return;
      }
      toast(error.message, 'error');
      return;
    }

    toast(error instanceof Error ? error.message : 'Device verification failed. Please try again.', 'error');
  };

  const completeDeviceLogin = async () => {
    await registerOrVerifyDevice();
    toast('Logged in successfully!', 'success');
    router.replace('/calculator');
  };

  // 1. Parse URL query params and load Remembered email
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const reason = params.get('reason');
      if (reason === 'expired') {
        setSessionMessage('Your session has expired. Please sign in again.');
      } else if (reason === 'device') {
        setSessionMessage('This account is registered to another device. Direct login is blocked.');
      } else if (reason === 'unauthorized') {
        setSessionMessage('You do not have permission to access that resource. Please sign in.');
      }

      // Load remembered email
      if (typeof localStorage !== 'undefined') {
        const savedEmail = localStorage.getItem('remembered_email');
        if (savedEmail) {
          setEmail(savedEmail);
          setRememberMe(true);
        }
      }
    }
  }, []);

  // 2. Check active session
  useEffect(() => {
    async function checkSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await completeDeviceLogin();
        }
      } catch (err) {
        console.error('Error checking session:', err);
        redirectForDeviceError(err);
      } finally {
        setVerifying(false);
      }
    }
    checkSession();
  }, [router]);

  // 3. Lockout Countdown Timer
  useEffect(() => {
    if (lockoutTime > 0) {
      const timer = setTimeout(() => {
        setLockoutTime((prev) => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [lockoutTime]);

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

  const validatePassword = (val: string): boolean => {
    if (!val) {
      setPasswordError('Password is required.');
      return false;
    } else if (val.length < 6) {
      setPasswordError('Password must be at least 6 characters.');
      return false;
    }
    setPasswordError('');
    return true;
  };

  const handleKeyLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!licenseKey.trim()) {
      setKeyError('License key is required.');
      return;
    }
    setKeyError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/key-login-init', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ rawKey: licenseKey.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'DeviceLimitReached') {
          router.replace(data.redirectTo || '/device-blocked?reason=device_limit_reached');
          return;
        }
        throw new Error(data.error || 'Login failed.');
      }

      // Login with Supabase using email and the key as password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: licenseKey.trim(),
      });

      if (signInError) {
        throw new Error(signInError.message);
      }

      await completeDeviceLogin();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Login failed.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutTime > 0) return;

    const isEmailValid = validateEmail(email);
    const isPasswordValid = validatePassword(password);

    if (!isEmailValid || !isPasswordValid) {
      if (!isEmailValid) {
        document.getElementById('email-input')?.focus();
      } else {
        document.getElementById('password-input')?.focus();
      }
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      if (error) {
        setFailedAttempts((prev) => {
          const next = prev + 1;
          if (next >= 3) {
            setLockoutTime(30);
            toast('Too many failed attempts. Security lockout active for 30s.', 'error');
            return 0;
          }
          return next;
        });

        if (error.message.toLowerCase().includes('email') || error.message.toLowerCase().includes('user')) {
          setEmailError(error.message);
          document.getElementById('email-input')?.focus();
        } else {
          setPasswordError(error.message);
          document.getElementById('password-input')?.focus();
        }
        toast(error.message, 'error');
      } else if (data.session) {
        if (typeof localStorage !== 'undefined') {
          if (rememberMe) {
            localStorage.setItem('remembered_email', email.trim());
          } else {
            localStorage.removeItem('remembered_email');
          }
        }
        await completeDeviceLogin();
      }
    } catch (err) {
      redirectForDeviceError(err);
    } finally {
      setLoading(false);
    }
  };

  if (verifying) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
        <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-text-muted">
          Verifying Session...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Background radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(184,134,11,0.08)_0%,transparent_70%)] pointer-events-none" />

      <div className="w-full max-w-md glass border border-border/80 rounded-2xl overflow-hidden shadow-2xl animate-fade-in relative z-10">
        
        {/* Banner with Brand */}
        <div className="p-8 pb-6 text-center border-b border-border/40 relative bg-surface-hover/30">
          <div className="mx-auto w-12 h-12 rounded-xl gold-gradient flex items-center justify-center shadow-lg shadow-accent/20 mb-4 animate-pulse-glow">
            <Shield size={22} className="text-background stroke-[2.5]" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-text-primary">
            ENER<span className="text-accent">MASS</span>
          </h2>
          <p className="text-xs text-text-muted mt-1 uppercase tracking-wider font-medium">
            Solar Pricing Terminal
          </p>
        </div>

        {/* Form area */}
        <form onSubmit={loginMode === 'key' ? handleKeyLogin : handleLogin} className="p-8 space-y-5" noValidate>
          
          {/* Session Notification Banner */}
          {sessionMessage && (
            <div className="p-3.5 rounded-xl border border-accent/20 bg-accent/5 text-xs text-accent flex items-start gap-2.5 animate-slide-down">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold uppercase tracking-wider text-[9px]">Alert</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-text-muted">{sessionMessage}</p>
              </div>
            </div>
          )}

          {/* Security Lockout banner */}
          {lockoutTime > 0 && (
            <div className="p-3.5 rounded-xl border border-red-500/30 bg-red-500/10 text-xs text-red-400 flex items-start gap-2.5 animate-pulse">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Security Lockout Active</p>
                <p className="text-[11px] opacity-90 mt-0.5">
                  Too many failed login attempts. Please wait <span className="font-mono font-bold text-sm text-text-primary">{lockoutTime}s</span> before retrying.
                </p>
              </div>
            </div>
          )}

          {loginMode === 'key' ? (
            /* License Key Flow */
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="key-input" className="block text-[10px] font-bold text-text-muted uppercase tracking-widest">
                  License Key
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-text-muted">
                    <Key size={16} />
                  </div>
                  <input
                    id="key-input"
                    type="text"
                    value={licenseKey}
                    disabled={loading}
                    onChange={(e) => {
                      setLicenseKey(e.target.value);
                      if (keyError) setKeyError('');
                    }}
                    placeholder="EMSOL-XXXX-XXXX-XXXX-XXXX"
                    className={`w-full pl-10 pr-3.5 py-3 rounded-xl border bg-background/50
                      text-sm font-mono text-text-primary placeholder:text-text-muted
                      focus:outline-none focus:ring-2 focus:ring-accent/20 focus:bg-background transition-all duration-200 ${
                        keyError ? 'border-red-500/60 focus:border-red-500/80 focus:ring-red-500/10' : 'border-border focus:border-accent/50'
                      }`}
                    required
                    tabIndex={1}
                  />
                </div>
                {keyError && (
                  <p className="text-[10px] text-red-400 flex items-center gap-1.5 mt-1 font-medium animate-slide-down">
                    <AlertCircle size={12} className="shrink-0" />
                    {keyError}
                  </p>
                )}
              </div>

              <div className="space-y-2 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full gold-gradient py-3 px-4 rounded-xl text-background font-bold text-sm
                    transition-all duration-200 active:scale-[0.98] shadow-lg shadow-accent/20 hover:brightness-110
                    disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Authenticating...
                    </>
                  ) : (
                    'Log In with License Key'
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* Traditional Credentials Flow */
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="email-input" className="block text-[10px] font-bold text-text-muted uppercase tracking-widest">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-text-muted">
                    <Mail size={16} />
                  </div>
                  <input
                    id="email-input"
                    type="email"
                    value={email}
                    disabled={loading || lockoutTime > 0}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (emailError) validateEmail(e.target.value);
                    }}
                    onBlur={(e) => validateEmail(e.target.value)}
                    placeholder="name@company.com"
                    className={`w-full pl-10 pr-3.5 py-3 rounded-xl border bg-background/50
                      text-sm text-text-primary placeholder:text-text-muted
                      focus:outline-none focus:ring-2 focus:ring-accent/20 focus:bg-background transition-all duration-200 ${
                        emailError ? 'border-red-500/60 focus:border-red-500/80 focus:ring-red-500/10' : 'border-border focus:border-accent/50'
                      }`}
                    required
                    tabIndex={1}
                  />
                </div>
                {emailError && (
                  <p id="email-error" className="text-[10px] text-red-400 flex items-center gap-1.5 mt-1 font-medium animate-slide-down">
                    <AlertCircle size={12} className="shrink-0" />
                    {emailError}
                  </p>
                )}
              </div>

              <div className="space-y-1.5 relative">
                <PasswordInput
                  id="password-input"
                  label="Password"
                  value={password}
                  disabled={loading || lockoutTime > 0}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (passwordError) validatePassword(e.target.value);
                  }}
                  onBlur={(e) => validatePassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  tabIndex={2}
                  icon={<Lock size={16} />}
                  error={passwordError}
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    tabIndex={4}
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-border bg-background/50 text-accent focus:ring-accent accent-accent cursor-pointer"
                  />
                  <span className="text-xs text-text-muted hover:text-text-primary transition-colors">
                    Remember me
                  </span>
                </label>
                
                <button
                  type="button"
                  tabIndex={5}
                  onClick={() => router.push('/forgot-password')}
                  className="text-xs text-accent hover:text-accent-hover font-medium hover:underline flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <HelpCircle size={13} />
                  Forgot password?
                </button>
              </div>

              <div className="space-y-2">
                <button
                  type="submit"
                  tabIndex={6}
                  disabled={loading || lockoutTime > 0}
                  className="w-full gold-gradient py-3 px-4 rounded-xl text-background font-bold text-sm
                    transition-all duration-200 active:scale-[0.98] shadow-lg shadow-accent/20 hover:brightness-110
                    disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Signing In...
                    </>
                  ) : (
                    'Sign In'
                  )}
                </button>
              </div>
            </div>
          )}

        </form>

        {/* Footer info */}
        <div className="px-8 py-4 bg-surface-hover/30 border-t border-border/40 text-center space-y-2">
          {loginMode === 'key' ? (
            <button
              type="button"
              onClick={() => setLoginMode('credentials')}
              className="block w-full text-xs text-text-muted hover:text-accent transition-colors cursor-pointer font-semibold underline"
            >
              Sign in with Admin Credentials
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setLoginMode('key')}
              className="block w-full text-xs text-text-muted hover:text-accent transition-colors cursor-pointer font-semibold underline"
            >
              Back to License Key Login
            </button>
          )}
          <p className="text-[10px] font-semibold text-text-muted uppercase tracking-widest pt-1">
            Protected Terminal · Pitbull Corporations
          </p>
        </div>

      </div>
    </div>
  );
}
