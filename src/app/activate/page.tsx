'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Key, User, Mail, Lock, Phone, ArrowRight, CheckCircle, Loader2, ChevronLeft } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

type Step = 'key-entry' | 'registration' | 'success';

interface OrgInfo {
  orgId: string;
  orgName: string;
}

function StepIndicator({ step }: { step: Step }) {
  const steps = [
    { id: 'key-entry', label: 'Enter Key', icon: Key },
    { id: 'registration', label: 'Create Account', icon: User },
    { id: 'success', label: 'Activated', icon: CheckCircle },
  ];

  const currentIndex = steps.findIndex(s => s.id === step);

  return (
    <div className="flex items-center gap-0 w-full mb-8">
      {steps.map((s, i) => {
        const isDone = i < currentIndex;
        const isActive = i === currentIndex;
        const Icon = s.icon;

        return (
          <div key={s.id} className="flex items-center" style={{ flex: i < steps.length - 1 ? '1' : 'auto' }}>
            <div className="flex flex-col items-center gap-1">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                isDone
                  ? 'bg-accent border-accent text-background'
                  : isActive
                    ? 'border-accent text-accent bg-accent/10'
                    : 'border-border text-text-muted'
              }`}>
                <Icon size={15} />
              </div>
              <span className={`text-[9px] uppercase tracking-widest font-bold whitespace-nowrap ${
                isActive ? 'text-accent' : isDone ? 'text-accent/60' : 'text-text-muted'
              }`}>{s.label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={`h-[2px] flex-1 mx-2 mb-4 transition-all duration-500 ${isDone ? 'bg-accent' : 'bg-border'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function ActivatePage() {
  const router = useRouter();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>('key-entry');
  const [orgInfo, setOrgInfo] = useState<OrgInfo | null>(null);
  const [assignedRole, setAssignedRole] = useState<'owner' | 'staff'>('staff');

  // Step 1: Key entry
  const [rawKey, setRawKey] = useState('');
  const [validating, setValidating] = useState(false);

  // Step 2: Registration
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [registering, setRegistering] = useState(false);

  // ── Detect browser/OS info for device binding ─────────────────────────────
  const getDeviceInfo = () => ({
    device_name: `${navigator.platform || 'Device'} — ${getOS()}`,
    browser: getBrowser(),
    os: getOS(),
  });

  function getBrowser(): string {
    const ua = navigator.userAgent;
    if (/Edg\//.test(ua)) return 'Microsoft Edge';
    if (/OPR\//.test(ua)) return 'Opera';
    if (/Chrome\//.test(ua)) return 'Chrome';
    if (/Firefox\//.test(ua)) return 'Firefox';
    if (/Safari\//.test(ua)) return 'Safari';
    return 'Unknown';
  }

  function getOS(): string {
    const ua = navigator.userAgent;
    if (/Windows/.test(ua)) return 'Windows';
    if (/Android/.test(ua)) return 'Android';
    if (/iPhone|iPad/.test(ua)) return 'iOS';
    if (/Mac/.test(ua)) return 'macOS';
    if (/Linux/.test(ua)) return 'Linux';
    return 'Unknown OS';
  }

  // ── Step 1: Validate Key ───────────────────────────────────────────────────
  const handleValidateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawKey.trim()) return;
    setValidating(true);

    try {
      const res = await fetch('/api/activation/validate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key: rawKey.trim() }),
      });
      const data = await res.json() as { valid: boolean; orgId?: string; orgName?: string; reason?: string };

      if (data.valid && data.orgId) {
        setOrgInfo({ orgId: data.orgId, orgName: data.orgName ?? 'Your Organisation' });
        setStep('registration');
      } else {
        toast(data.reason ?? 'Invalid activation key. Please check and try again.', 'error');
      }
    } catch {
      toast('Network error. Please check your connection.', 'error');
    } finally {
      setValidating(false);
    }
  };

  // ── Step 2: Register ───────────────────────────────────────────────────────
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || !password.trim()) {
      toast('Please fill in all required fields.', 'error');
      return;
    }
    if (password.length < 8) {
      toast('Password must be at least 8 characters.', 'error');
      return;
    }

    setRegistering(true);
    const deviceInfo = getDeviceInfo();

    try {
      const res = await fetch('/api/activation/redeem', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          key: rawKey.trim(),
          full_name: fullName.trim(),
          email: email.trim(),
          password,
          phone: phone.trim() || null,
          ...deviceInfo,
        }),
      });

      const data = await res.json() as { success: boolean; role?: 'owner' | 'staff'; message?: string };

      if (data.success) {
        setAssignedRole(data.role ?? 'staff');
        setStep('success');
      } else {
        toast(data.message ?? 'Activation failed. Please try again.', 'error');
      }
    } catch {
      toast('Network error. Please check your connection.', 'error');
    } finally {
      setRegistering(false);
    }
  };

  // ── Auto-format key as user types ─────────────────────────────────────────
  const handleKeyInput = (value: string) => {
    // Strip everything except alphanumeric and dashes
    const cleaned = value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
    setRawKey(cleaned);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Background glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(184,134,11,0.08)_0%,transparent_70%)] pointer-events-none" />

      <div className="w-full max-w-lg relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mx-auto w-14 h-14 rounded-2xl gold-gradient flex items-center justify-center shadow-xl shadow-accent/30 mb-4 animate-pulse-glow">
            <Key size={24} className="text-background stroke-[2.5]" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">
            ENER<span className="text-accent">MASS</span>
          </h1>
          <p className="text-xs text-text-muted mt-1 uppercase tracking-wider font-medium">
            Device Activation Portal
          </p>
        </div>

        <div className="glass border border-border/80 rounded-2xl overflow-hidden shadow-2xl">
          <div className="p-8">
            <StepIndicator step={step} />

            {/* ── Step 1: Key Entry ───────────────────────────────────────── */}
            {step === 'key-entry' && (
              <form onSubmit={handleValidateKey} className="space-y-6" id="key-entry-form">
                <div>
                  <h2 className="text-lg font-bold text-text-primary mb-1">Enter Your Activation Key</h2>
                  <p className="text-sm text-text-muted">
                    Enter the activation key provided by your organisation. Format: <span className="text-accent font-mono text-xs">EMSOL-XXXX-XXXX-XXXX-XXXX</span>
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest">
                    Activation Key
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-text-muted">
                      <Key size={16} />
                    </div>
                    <input
                      id="activation-key-input"
                      type="text"
                      value={rawKey}
                      onChange={(e) => handleKeyInput(e.target.value)}
                      placeholder="EMSOL-XXXX-XXXX-XXXX-XXXX"
                      className="w-full pl-10 pr-3.5 py-3 rounded-xl border border-border bg-background/50
                        text-sm text-text-primary placeholder:text-text-muted font-mono tracking-wider
                        focus:outline-none focus:border-accent/50 focus:bg-background transition-all duration-200"
                      maxLength={29}
                      autoComplete="off"
                      autoFocus
                      required
                    />
                  </div>
                  <p className="text-[10px] text-text-muted pl-1">
                    Keys are case-insensitive. Contact your organisation admin if you don&apos;t have one.
                  </p>
                </div>

                <button
                  id="validate-key-button"
                  type="submit"
                  disabled={validating || rawKey.length < 20}
                  className="w-full gold-gradient py-3 px-4 rounded-xl text-background font-bold text-sm
                    transition-all duration-200 active:scale-[0.98] shadow-lg shadow-accent/20 hover:brightness-110
                    disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {validating ? (
                    <><Loader2 size={16} className="animate-spin" /> Validating Key...</>
                  ) : (
                    <><ArrowRight size={16} /> Continue</>
                  )}
                </button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => router.push('/login')}
                    className="text-xs text-text-muted hover:text-text-primary transition-colors"
                  >
                    Already have an account? <span className="text-accent">Sign in</span>
                  </button>
                </div>
              </form>
            )}

            {/* ── Step 2: Registration ─────────────────────────────────────── */}
            {step === 'registration' && orgInfo && (
              <form onSubmit={handleRegister} className="space-y-5" id="registration-form">
                <div>
                  <button
                    type="button"
                    onClick={() => setStep('key-entry')}
                    className="flex items-center gap-1 text-xs text-text-muted hover:text-accent transition-colors mb-3"
                  >
                    <ChevronLeft size={14} /> Back
                  </button>
                  <div className="p-3 rounded-xl bg-accent/10 border border-accent/20 mb-4">
                    <p className="text-xs text-text-muted uppercase tracking-widest font-bold mb-0.5">Activating for</p>
                    <p className="text-sm font-semibold text-accent">{orgInfo.orgName}</p>
                  </div>
                  <h2 className="text-lg font-bold text-text-primary mb-1">Create Your Account</h2>
                  <p className="text-sm text-text-muted">
                    This device will be permanently bound to your account.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {/* Full Name */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest">Full Name *</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-text-muted">
                        <User size={16} />
                      </div>
                      <input
                        id="full-name-input"
                        type="text"
                        value={fullName}
                        onChange={e => setFullName(e.target.value)}
                        placeholder="Your full name"
                        className="w-full pl-10 pr-3.5 py-3 rounded-xl border border-border bg-background/50
                          text-sm text-text-primary placeholder:text-text-muted
                          focus:outline-none focus:border-accent/50 focus:bg-background transition-all duration-200"
                        required autoFocus
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest">Email Address *</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-text-muted">
                        <Mail size={16} />
                      </div>
                      <input
                        id="email-input"
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="name@company.com"
                        className="w-full pl-10 pr-3.5 py-3 rounded-xl border border-border bg-background/50
                          text-sm text-text-primary placeholder:text-text-muted
                          focus:outline-none focus:border-accent/50 focus:bg-background transition-all duration-200"
                        required
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest">Password *</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-text-muted">
                        <Lock size={16} />
                      </div>
                      <input
                        id="password-input"
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="Min. 8 characters"
                        className="w-full pl-10 pr-3.5 py-3 rounded-xl border border-border bg-background/50
                          text-sm text-text-primary placeholder:text-text-muted
                          focus:outline-none focus:border-accent/50 focus:bg-background transition-all duration-200"
                        required minLength={8}
                      />
                    </div>
                  </div>

                  {/* Phone (optional) */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest">Phone <span className="text-text-muted/50">(Optional)</span></label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-text-muted">
                        <Phone size={16} />
                      </div>
                      <input
                        id="phone-input"
                        type="tel"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        placeholder="+91 9876543210"
                        className="w-full pl-10 pr-3.5 py-3 rounded-xl border border-border bg-background/50
                          text-sm text-text-primary placeholder:text-text-muted
                          focus:outline-none focus:border-accent/50 focus:bg-background transition-all duration-200"
                      />
                    </div>
                  </div>
                </div>

                {/* Warning */}
                <div className="p-3 rounded-xl bg-surface-hover border border-border/60">
                  <p className="text-[11px] text-text-muted leading-relaxed">
                    <span className="text-amber-400 font-bold">⚠ Device Lock:</span> This account will be permanently bound to <span className="text-text-primary font-medium">this device and browser</span>. Switching devices requires Super Admin approval.
                  </p>
                </div>

                <button
                  id="activate-submit-button"
                  type="submit"
                  disabled={registering}
                  className="w-full gold-gradient py-3 px-4 rounded-xl text-background font-bold text-sm
                    transition-all duration-200 active:scale-[0.98] shadow-lg shadow-accent/20 hover:brightness-110
                    disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {registering ? (
                    <><Loader2 size={16} className="animate-spin" /> Activating...</>
                  ) : (
                    <><Shield size={16} /> Activate & Create Account</>
                  )}
                </button>
              </form>
            )}

            {/* ── Step 3: Success ──────────────────────────────────────────── */}
            {step === 'success' && (
              <div className="text-center space-y-6 py-4">
                <div className="mx-auto w-16 h-16 rounded-full bg-green-500/10 border-2 border-green-500/40 flex items-center justify-center">
                  <CheckCircle size={32} className="text-green-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-text-primary mb-2">Account Activated!</h2>
                  <p className="text-sm text-text-muted">
                    {assignedRole === 'owner'
                      ? 'You are the Organisation Administrator. Your device has been registered.'
                      : 'Your account has been created as a team member. Your device has been registered.'}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-accent/10 border border-accent/20 text-left">
                  <p className="text-[10px] text-text-muted uppercase tracking-widest font-bold mb-1">Role Assigned</p>
                  <p className="text-sm font-semibold text-accent capitalize">
                    {assignedRole === 'owner' ? '👑 Organisation Admin' : '👤 Team Member'}
                  </p>
                </div>

                <button
                  id="go-to-login-button"
                  onClick={() => router.push('/login')}
                  className="w-full gold-gradient py-3 px-4 rounded-xl text-background font-bold text-sm
                    transition-all duration-200 active:scale-[0.98] shadow-lg shadow-accent/20 hover:brightness-110
                    flex items-center justify-center gap-2"
                >
                  <ArrowRight size={16} /> Go to Login
                </button>
              </div>
            )}
          </div>

          <div className="px-8 py-4 bg-surface-hover/30 border-t border-border/40 text-center">
            <p className="text-[10px] font-semibold text-text-muted uppercase tracking-widest">
              Activation Portal · Pitbull Corporations
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
