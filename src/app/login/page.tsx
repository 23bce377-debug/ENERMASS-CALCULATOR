'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/Toast';
import { DeviceClientError, registerOrVerifyDevice } from '@/lib/device/deviceClient';
import { Shield, Mail, Lock, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);

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

  useEffect(() => {
    // Check if already logged in
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast('Please enter both email and password.', 'error');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      if (error) {
        toast(error.message, 'error');
      } else if (data.session) {
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
        <form onSubmit={handleLogin} className="p-8 space-y-6">
          
          <div className="space-y-4">
            {/* Email Field */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-text-muted">
                  <Mail size={16} />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full pl-10 pr-3.5 py-3 rounded-xl border border-border bg-background/50
                    text-sm text-text-primary placeholder:text-text-muted
                    focus:outline-none focus:border-accent/50 focus:bg-background transition-all duration-200"
                  required
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-text-muted">
                  <Lock size={16} />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-3.5 py-3 rounded-xl border border-border bg-background/50
                    text-sm text-text-primary placeholder:text-text-muted
                    focus:outline-none focus:border-accent/50 focus:bg-background transition-all duration-200"
                  required
                />
              </div>
            </div>
          </div>

          {/* Action Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full gold-gradient py-3 px-4 rounded-xl text-background font-bold text-sm
              transition-all duration-200 active:scale-[0.98] shadow-lg shadow-accent/20 hover:brightness-110
              disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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

        </form>

        {/* Footer info */}
        <div className="px-8 py-4 bg-surface-hover/30 border-t border-border/40 text-center space-y-2">
          <button
            type="button"
            onClick={() => router.push('/forgot-password')}
            className="block w-full text-[10px] text-text-muted hover:text-accent transition-colors"
          >
            Forgot your password?
          </button>
          <button
            type="button"
            onClick={() => router.push('/activate')}
            className="block w-full text-[10px] text-text-muted hover:text-accent transition-colors"
          >
            Have an activation key? <span className="text-accent">Activate here</span>
          </button>
          <p className="text-[10px] font-semibold text-text-muted uppercase tracking-widest pt-1">
            Protected Terminal · Pitbull Corporations
          </p>
        </div>

      </div>
    </div>
  );
}
