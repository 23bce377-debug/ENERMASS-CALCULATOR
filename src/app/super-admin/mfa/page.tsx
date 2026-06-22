'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/Toast';
import { Shield, KeyRound, Loader2, ArrowLeft, CheckCircle2, QrCode } from 'lucide-react';

export default function SuperAdminMfaPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  // Enrollment State
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  
  // Verification State
  const [code, setCode] = useState('');
  const [isEnrolling, setIsEnrolling] = useState(false);

  useEffect(() => {
    async function checkSuperAdmin() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.replace('/login');
          return;
        }

        // Verify they are super admin or org admin
        const { data: profile, error: profileErr } = await supabase
          .from('profiles')
          .select('is_super_admin, is_active, role')
          .eq('id', session.user.id)
          .maybeSingle();

        const isOrgAdmin = ['owner', 'admin', 'manager'].includes(profile?.role ?? '');
        if (profileErr || !profile || profile.is_active === false || (!profile.is_super_admin && !isOrgAdmin)) {
          router.replace('/unauthorized');
          return;
        }

        setUserId(session.user.id);
        setIsSuperAdmin(Boolean(profile.is_super_admin));

        // Check if already has factors enrolled
        const { data: factors, error: factorsErr } = await supabase.auth.mfa.listFactors();
        if (factorsErr) throw factorsErr;

        const totpFactors = factors.all.filter(f => f.factor_type === 'totp' && f.status === 'verified');
        
        if (totpFactors.length > 0) {
          // Already enrolled, setup verification challenge
          setFactorId(totpFactors[0].id);
          setIsEnrolling(false);
        } else {
          // Start enrollment
          setIsEnrolling(true);
          const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
          const { data: enrollData, error: enrollErr } = await supabase.auth.mfa.enroll({
            factorType: 'totp',
            issuer: 'EnerMass',
            friendlyName: `SuperAdmin TOTP (${suffix})`
          });

          if (enrollErr) throw enrollErr;

          setFactorId(enrollData.id);
          setQrCodeData(enrollData.totp.qr_code);
          setSecret(enrollData.totp.secret);
        }
      } catch (err) {
        console.error('MFA setup error:', err);
        toast(err instanceof Error ? err.message : 'Failed to initialize MFA setup.', 'error');
      } finally {
        setLoading(false);
      }
    }

    checkSuperAdmin();
  }, [router, toast]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6 || !factorId) return;

    setVerifying(true);
    try {
      // 1. Challenge the factor
      const { data: challengeData, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId });
      if (challengeErr) throw challengeErr;

      // 2. Verify the challenge
      const { data: verifyData, error: verifyErr } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code,
      });

      if (verifyErr) throw verifyErr;

      // Clean up any unverified factors now that we have elevated to AAL2
      try {
        const { data: listData } = await supabase.auth.mfa.listFactors();
        if (listData?.all) {
          const unverified = listData.all.filter(f => f.factor_type === 'totp' && f.status === 'unverified');
          for (const uf of unverified) {
            await supabase.auth.mfa.unenroll({ factorId: uf.id });
          }
        }
      } catch (cleanupErr) {
        console.warn('Failed to clean up unverified factors:', cleanupErr);
      }

      toast('MFA Verification successful!', 'success');
      if (isSuperAdmin) {
        router.replace('/super-admin/orgs');
      } else {
        router.replace('/settings');
      }
    } catch (err) {
      console.error('MFA challenge failed:', err);
      toast(err instanceof Error ? err.message : 'Invalid verification code.', 'error');
      setCode('');
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
        <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-text-muted">
          Loading Security Console...
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
            2FA Security Verification
          </p>
        </div>

        {/* Content Area */}
        <div className="p-8">
          {isEnrolling ? (
            // Enrollment flow
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-bold text-text-primary mb-1 flex items-center gap-2">
                  <QrCode size={18} className="text-accent" />
                  Configure 2-Factor Authentication
                </h3>
                <p className="text-sm text-text-muted leading-relaxed">
                  Scan the QR code below using your authenticator app (Google Authenticator, Microsoft Authenticator, etc.) to enroll.
                </p>
              </div>

              {/* QR Code display */}
              {qrCodeData && (
                <div className="bg-white p-4 rounded-xl w-48 h-48 mx-auto flex items-center justify-center border-2 border-border shadow-inner">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrCodeData} alt="MFA QR Code" className="w-full h-full object-contain" />
                </div>
              )}

              {/* Text secret key alternative */}
              {secret && (
                <div className="space-y-1 text-center">
                  <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest block">
                    Or Enter Code Manually
                  </span>
                  <code className="text-xs font-mono bg-background px-2.5 py-1.5 rounded-lg border border-border select-all inline-block break-all max-w-full text-text-primary">
                    {secret}
                  </code>
                </div>
              )}

              <form onSubmit={handleVerify} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest">
                    Verification Code
                  </label>
                  <input
                    type="text"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="123456"
                    className="w-full text-center tracking-[0.5em] font-mono py-3 rounded-xl border border-border bg-background/50
                      text-lg font-bold text-text-primary focus:outline-none focus:border-accent/50 focus:bg-background transition-all duration-200"
                    required
                    autoFocus
                  />
                </div>

                <button
                  type="submit"
                  disabled={verifying || code.length !== 6}
                  className="w-full gold-gradient py-3 px-4 rounded-xl text-background font-bold text-sm
                    transition-all duration-200 active:scale-[0.98] shadow-lg shadow-accent/20 hover:brightness-110
                    disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {verifying ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Verifying Setup...
                    </>
                  ) : (
                    'Verify & Setup'
                  )}
                </button>
              </form>
            </div>
          ) : (
            // Challenge Verification Flow
            <form onSubmit={handleVerify} className="space-y-6">
              <div>
                <h3 className="text-base font-bold text-text-primary mb-1 flex items-center gap-2">
                  <KeyRound size={18} className="text-accent" />
                  MFA Required
                </h3>
                <p className="text-sm text-text-muted leading-relaxed">
                  Please enter the 6-digit verification code generated by your authenticator app to complete authentication.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest">
                  Verification Code
                </label>
                <input
                  type="text"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="123456"
                  className="w-full text-center tracking-[0.5em] font-mono py-3 rounded-xl border border-border bg-background/50
                    text-lg font-bold text-text-primary focus:outline-none focus:border-accent/50 focus:bg-background transition-all duration-200"
                  required
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={verifying || code.length !== 6}
                className="w-full gold-gradient py-3 px-4 rounded-xl text-background font-bold text-sm
                  transition-all duration-200 active:scale-[0.98] shadow-lg shadow-accent/20 hover:brightness-110
                  disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {verifying ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Verifying Code...
                  </>
                ) : (
                  'Verify Identity'
                )}
              </button>
            </form>
          )}
        </div>

        {/* Footer info */}
        <div className="px-8 py-4 bg-surface-hover/30 border-t border-border/40 text-center space-y-2">
          <button
            type="button"
            onClick={async () => {
              await supabase.auth.signOut();
              router.replace('/login');
            }}
            className="flex items-center justify-center gap-1 text-xs text-text-muted hover:text-accent transition-colors mx-auto"
          >
            <ArrowLeft size={12} /> Sign Out & Go Back
          </button>
          <p className="text-[10px] font-semibold text-text-muted uppercase tracking-widest pt-1">
            Protected Terminal · Pitbull Corporations
          </p>
        </div>

      </div>
    </div>
  );
}
