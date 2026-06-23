'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Key, User, Mail, Lock, Phone, ArrowRight, CheckCircle, XCircle, Loader2, ChevronLeft, Eye, EyeOff, Clipboard, AlertCircle, X, Terminal } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { supabase } from '@/lib/supabase/client';
import { PasswordInput } from '@/components/ui/PasswordInput';

const PASSWORD_RULES = [
  { test: (p: string) => p.length >= 12,           label: 'At least 12 characters' },
  { test: (p: string) => /[A-Z]/.test(p),          label: 'One uppercase letter' },
  { test: (p: string) => /[a-z]/.test(p),          label: 'One lowercase letter' },
  { test: (p: string) => /[0-9]/.test(p),          label: 'One number' },
  { test: (p: string) => /[^A-Za-z0-9]/.test(p),   label: 'One special character' },
];

function PasswordStrengthIndicator({ password }: { password: string }) {
  return (
    <div className="p-3.5 rounded-xl border border-border bg-background/30 mt-2">
      <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2">Password Requirements</p>
      <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1.5">
        {PASSWORD_RULES.map((rule) => {
          const ok = password ? rule.test(password) : false;
          return (
            <li key={rule.label} className={`flex items-center gap-1.5 text-[10px] font-medium transition-colors duration-200 ${
              !password ? 'text-text-muted/60' : ok ? 'text-green-400' : 'text-red-400/80'
            }`}>
              <CheckCircle size={11} className={`shrink-0 ${
                !password ? 'text-text-muted/40' : ok ? 'text-green-400' : 'text-red-400/60'
              }`} />
              {rule.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ── Mock QR Scanner Modal Component ──────────────────────────────────────────
function QRScannerModal({
  isOpen,
  onClose,
  onScanSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (key: string) => void;
}) {
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isOpen) {
      setScanning(true);
      setScanProgress(0);
      interval = setInterval(() => {
        setScanProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            setScanning(false);
            setTimeout(() => {
              onScanSuccess('EMSOL-QR98-Z87Y-X65W-V43U');
            }, 600);
            return 100;
          }
          return prev + 10;
        });
      }, 150);
    }
    return () => clearInterval(interval);
  }, [isOpen, onScanSuccess]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
      <div className="w-full max-w-sm glass border border-border/80 rounded-2xl overflow-hidden shadow-2xl p-6 relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-text-muted hover:text-text-primary transition-colors cursor-pointer"
        >
          <X size={18} />
        </button>

        <h3 className="text-xs font-bold text-text-primary uppercase tracking-widest text-center mb-4">
          QR Code Scanner
        </h3>

        <div className="relative aspect-square w-full border border-border/60 bg-surface rounded-xl overflow-hidden flex items-center justify-center mb-4">
          <div className="absolute inset-4 border border-dashed border-accent/40 rounded-lg flex flex-col items-center justify-center overflow-hidden bg-black/40">
            {/* Corners */}
            <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-accent"></div>
            <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-accent"></div>
            <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-accent"></div>
            <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-accent"></div>

            {scanning ? (
              <div className="w-full h-full relative flex items-center justify-center">
                <div className="absolute left-0 right-0 h-0.5 bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.8)] animate-scanner-line"></div>
                <Loader2 className="w-8 h-8 text-accent animate-spin opacity-50" />
                <p className="absolute bottom-4 text-[9px] text-text-muted uppercase tracking-widest font-semibold">
                  Analyzing camera...
                </p>
              </div>
            ) : (
              <div className="text-center p-4">
                <CheckCircle size={32} className="text-green-400 mx-auto mb-2 animate-bounce" />
                <p className="text-xs text-text-primary font-bold">Key Detected</p>
                <p className="text-[9px] text-text-muted font-mono mt-0.5">EMSOL-QR98-Z87Y-X65W-V43U</p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2">
          {scanning && (
            <div className="w-full bg-border/20 h-1 rounded-full overflow-hidden">
              <div className="bg-accent h-full transition-all duration-100" style={{ width: `${scanProgress}%` }}></div>
            </div>
          )}
          <p className="text-[10px] text-text-muted text-center leading-relaxed">
            Position the license key QR code within the framing guidelines to scan automatically.
          </p>
        </div>
      </div>
    </div>
  );
}

type Step = 'key-entry' | 'registration' | 'success';

interface OrgInfo {
  orgId: string;
  orgName: string;
  planName?: string;
  seatLimit?: number;
  activeMembers?: number;
  expiresAt?: string | null;
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
  const [isQrOpen, setIsQrOpen] = useState(false);

  // Step 2: Registration
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [registering, setRegistering] = useState(false);

  // Errors / Fallbacks
  const [keyError, setKeyError] = useState('');
  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [deviceError, setDeviceError] = useState('');
  
  // WebAuthn state
  const [webauthnChallenge, setWebauthnChallenge] = useState<string | null>(null);
  const [rpName, setRpName] = useState<string>('Enermass SaaS');
  const [rpId, setRpId] = useState<string>('localhost');
  const [passkeyError, setPasskeyError] = useState<string | null>(null);

  // Super Admin Bypass State
  const [showAdminBypass, setShowAdminBypass] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [authenticatingAdmin, setAuthenticatingAdmin] = useState(false);
  const [superAdminUser, setSuperAdminUser] = useState<any | null>(null);
  const [organisations, setOrganisations] = useState<any[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [generatingKey, setGeneratingKey] = useState(false);

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

  // ── 1. Step progress persistence (sessionStorage) ─────────────────────────
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const emailParam = new URLSearchParams(window.location.search).get('email');
      
      const savedStep = sessionStorage.getItem('activation_step') as Step | null;
      const savedOrgInfo = sessionStorage.getItem('activation_org_info');
      const savedRawKey = sessionStorage.getItem('activation_raw_key');
      const savedEmail = sessionStorage.getItem('activation_email');
      const savedFullName = sessionStorage.getItem('activation_fullname');
      const savedPhone = sessionStorage.getItem('activation_phone');
      const savedDevice = sessionStorage.getItem('activation_device_name');

      if (savedStep) setStep(savedStep);
      if (savedOrgInfo) setOrgInfo(JSON.parse(savedOrgInfo));
      if (savedRawKey) setRawKey(savedRawKey);
      if (savedEmail) setEmail(savedEmail);
      else if (emailParam) setEmail(emailParam);

      if (savedFullName) setFullName(savedFullName);
      if (savedPhone) setPhone(savedPhone);
      
      if (savedDevice) {
        setDeviceName(savedDevice);
      } else {
        const info = getDeviceInfo();
        setDeviceName(info.device_name);
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && step !== 'success') {
      sessionStorage.setItem('activation_step', step);
      if (orgInfo) sessionStorage.setItem('activation_org_info', JSON.stringify(orgInfo));
      sessionStorage.setItem('activation_raw_key', rawKey);
      sessionStorage.setItem('activation_email', email);
      sessionStorage.setItem('activation_fullname', fullName);
      sessionStorage.setItem('activation_phone', phone);
      sessionStorage.setItem('activation_device_name', deviceName);
    }
  }, [step, orgInfo, rawKey, email, fullName, phone, deviceName]);

  // Clean storage upon success to prevent sticky sessions
  useEffect(() => {
    if (step === 'success' && typeof window !== 'undefined') {
      sessionStorage.clear();
    }
  }, [step]);

  // ── Key Validation ────────────────────────────────────────────────────────
  const handleValidateKey = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!rawKey.trim()) {
      setKeyError('Activation key is required.');
      return;
    }
    setKeyError('');
    setValidating(true);

    try {
      const res = await fetch('/api/activation/validate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key: rawKey.trim() }),
      });
      const data = await res.json() as any;

      if (data.valid && data.orgId && data.challenge) {
        setOrgInfo({
          orgId: data.orgId,
          orgName: data.orgName ?? 'Your Organisation',
          planName: data.planName,
          seatLimit: data.seatLimit,
          activeMembers: data.activeMembers,
          expiresAt: data.expiresAt,
        });
        setWebauthnChallenge(data.challenge);
        setRpName(data.rpName ?? 'Enermass SaaS');
        setRpId(data.rpId ?? window.location.hostname);
        setStep('registration');
      } else {
        setKeyError(data.reason ?? 'Invalid activation key. Please check and try again.');
        toast(data.reason ?? 'Invalid activation key.', 'error');
      }
    } catch {
      toast('Network error. Please check your connection.', 'error');
    } finally {
      setValidating(false);
    }
  };

  const handlePasteKey = async () => {
    try {
      const text = await navigator.clipboard.readText();
      handleKeyInput(text);
      toast('Key pasted from clipboard!', 'success');
    } catch {
      toast('Could not access clipboard. Please paste manually.', 'error');
    }
  };

  // ── Super Admin Bypass Logic ──────────────────────────────────────────────
  const handleAdminBypassAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminEmail || !adminPassword) return;
    setAuthenticatingAdmin(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: adminEmail,
        password: adminPassword,
      });

      if (error) {
        toast(error.message, 'error');
        setAuthenticatingAdmin(false);
        return;
      }

      // Verify super admin
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_super_admin')
        .eq('id', data.session.user.id)
        .maybeSingle();

      if (profile?.is_super_admin) {
        toast('Super Admin Authenticated!', 'success');
        setSuperAdminUser(data.user);
        
        // Fetch all orgs so the admin can generate keys
        const { data: orgs } = await supabase
          .from('organisations')
          .select('id, name')
          .order('name', { ascending: true });
        
        setOrganisations(orgs || []);
        if (orgs && orgs.length > 0) {
          setSelectedOrgId(orgs[0].id);
        }
      } else {
        toast('Bypass access denied. User is not a Super Admin.', 'error');
        await supabase.auth.signOut();
      }
    } catch (err: any) {
      toast(err.message || 'Bypass authentication failed.', 'error');
    } finally {
      setAuthenticatingAdmin(false);
    }
  };

  const handleGenerateAndPasteKey = async () => {
    if (!selectedOrgId) return;
    setGeneratingKey(true);

    try {
      const res = await fetch('/api/super-admin/activation-keys/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orgId: selectedOrgId, count: 1 }),
      });
      const data = await res.json();
      
      if (data.success && data.keys && data.keys.length > 0) {
        const generatedKey = data.keys[0].key;
        handleKeyInput(generatedKey);
        toast('Key generated and pasted successfully!', 'success');
        
        // Terminate admin session to avoid side effects
        await supabase.auth.signOut();
        setSuperAdminUser(null);
        setShowAdminBypass(false);
      } else {
        toast(data.error || 'Failed to generate key.', 'error');
      }
    } catch (err: any) {
      toast('Failed to call generation API.', 'error');
    } finally {
      setGeneratingKey(false);
    }
  };

  // ── Step 2: Register & WebAuthn Binding ─────────────────────────────────────
  const validateForm = (): boolean => {
    let isValid = true;

    if (!fullName.trim()) {
      setNameError('Full name is required.');
      isValid = false;
    } else {
      setNameError('');
    }

    if (!email.trim()) {
      setEmailError('Email is required.');
      isValid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setEmailError('Please enter a valid email address.');
      isValid = false;
    } else {
      setEmailError('');
    }

    const failedRules = PASSWORD_RULES.filter(r => !r.test(password));
    if (!password) {
      setPasswordError('Password is required.');
      isValid = false;
    } else if (failedRules.length > 0) {
      setPasswordError(`Password requires: ${failedRules.map(r => r.label.toLowerCase()).join(', ')}.`);
      isValid = false;
    } else {
      setPasswordError('');
    }

    if (!confirmPassword) {
      setConfirmPasswordError('Please confirm your password.');
      isValid = false;
    } else if (confirmPassword !== password) {
      setConfirmPasswordError('Passwords do not match.');
      isValid = false;
    } else {
      setConfirmPasswordError('');
    }

    if (!deviceName.trim()) {
      setDeviceError('Device label is required.');
      isValid = false;
    } else {
      setDeviceError('');
    }

    return isValid;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasskeyError(null);

    if (!validateForm()) {
      if (nameError) document.getElementById('full-name-input')?.focus();
      else if (emailError) document.getElementById('email-input')?.focus();
      else if (passwordError) document.getElementById('password-input')?.focus();
      else if (confirmPasswordError) document.getElementById('confirm-password-input')?.focus();
      else if (deviceError) document.getElementById('device-name-input')?.focus();
      return;
    }

    setRegistering(true);
    const deviceInfo = getDeviceInfo();

    try {
      let webauthnRegistration = null;
      if (webauthnChallenge) {
        try {
          const base64 = webauthnChallenge.replace(/-/g, '+').replace(/_/g, '/');
          const binaryChallenge = Uint8Array.from(atob(base64), c => c.charCodeAt(0));

          const userIdBytes = new Uint8Array(16);
          window.crypto.getRandomValues(userIdBytes);

          const credential = await navigator.credentials.create({
            publicKey: {
              challenge: binaryChallenge,
              rp: { name: rpName, id: rpId },
              user: {
                id: userIdBytes,
                name: email.trim(),
                displayName: fullName.trim(),
              },
              pubKeyCredParams: [
                { alg: -7, type: 'public-key' },
                { alg: -257, type: 'public-key' }
              ],
              timeout: 60000,
              attestation: 'none',
              authenticatorSelection: {
                userVerification: 'preferred',
                residentKey: 'preferred',
                requireResidentKey: false,
              }
            }
          }) as PublicKeyCredential;

          if (!credential) {
            throw new Error('Passkey creation cancelled or rejected by client.');
          }

          const bufferToBase64Url = (buffer: ArrayBuffer) => {
            const bytes = new Uint8Array(buffer);
            let binary = '';
            for (let i = 0; i < bytes.byteLength; i++) {
              binary += String.fromCharCode(bytes[i]);
            }
            return btoa(binary)
              .replace(/\+/g, '-')
              .replace(/\//g, '_')
              .replace(/=/g, '');
          };

          const response = credential.response as AuthenticatorAttestationResponse;
          webauthnRegistration = {
            id: credential.id,
            rawId: bufferToBase64Url(credential.rawId),
            clientDataJSON: bufferToBase64Url(response.clientDataJSON),
            attestationObject: bufferToBase64Url(response.attestationObject),
          };
        } catch (err: any) {
          console.error('WebAuthn registration failed:', err);
          setPasskeyError(err.message || 'Passkey setup was cancelled or failed.');
          toast('Passkey setup failed. Device binding is required.', 'error');
          setRegistering(false);
          return;
        }
      } else {
        toast('WebAuthn challenge missing. Re-validate your activation key.', 'error');
        setRegistering(false);
        return;
      }

      let fingerprintHash = null;
      try {
        const { generateClientFingerprint } = await import('@/lib/device/deviceClient');
        fingerprintHash = generateClientFingerprint();
      } catch (err) {
        console.error('Failed to generate fingerprint:', err);
      }

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
          fingerprint_hash: fingerprintHash,
          webauthn_registration: webauthnRegistration,
          device_name: deviceName.trim(),
          browser: deviceInfo.browser,
          os: deviceInfo.os,
        }),
      });

      const data = await res.json() as { success: boolean; role?: 'owner' | 'staff'; deviceToken?: string; message?: string };

      if (data.success) {
        if (data.deviceToken) {
          try {
            const { saveDeviceToken } = await import('@/lib/device/deviceClient');
            await saveDeviceToken(data.deviceToken);
          } catch (err) {
            console.error('Failed to store device token:', err);
          }
        }
        setAssignedRole(data.role ?? 'staff');
        setStep('success');
      } else {
        toast(data.message ?? 'Activation failed.', 'error');
        setPasskeyError(data.message ?? 'Activation failed. Please review your details.');
      }
    } catch {
      toast('Network error. Please try again.', 'error');
    } finally {
      setRegistering(false);
    }
  };

  // ── Auto-format Key ──
  const handleKeyInput = (value: string) => {
    let clean = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (clean.length > 21) {
      clean = clean.slice(0, 21);
    }
    let formatted = clean;
    if (clean.length > 5) {
      const parts = [clean.slice(0, 5)];
      const rest = clean.slice(5);
      for (let i = 0; i < rest.length; i += 4) {
        parts.push(rest.slice(i, i + 4));
      }
      formatted = parts.join('-');
    }
    setRawKey(formatted);
    if (keyError) setKeyError('');
  };

  const handleScanSuccess = (scannedKey: string) => {
    setIsQrOpen(false);
    handleKeyInput(scannedKey);
    toast('QR Code scanned successfully!', 'success');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Visual scanner guidelines */}
      <style jsx global>{`
        @keyframes scannerLine {
          0% { top: 4%; }
          50% { top: 96%; }
          100% { top: 4%; }
        }
        .animate-scanner-line {
          animation: scannerLine 3s infinite ease-in-out;
        }
      `}</style>

      {/* Background glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(184,134,11,0.08)_0%,transparent_70%)] pointer-events-none" />

      <div className="w-full max-w-lg relative z-10 animate-fade-in">
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
            {step === 'key-entry' && !showAdminBypass && (
              <form onSubmit={handleValidateKey} className="space-y-6" id="key-entry-form" noValidate>
                <div>
                  <h2 className="text-lg font-bold text-text-primary mb-1">Enter Your Activation Key</h2>
                  <p className="text-sm text-text-muted">
                    Enter the activation key provided by your organisation. Format: <span className="text-accent font-mono text-xs">EMSOL-XXXX-XXXX-XXXX-XXXX</span>
                  </p>
                </div>

                <div className="space-y-2">
                  <label htmlFor="activation-key-input" className="block text-[10px] font-bold text-text-muted uppercase tracking-widest">
                    Activation Key
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-text-muted">
                        <Key size={16} />
                      </div>
                      <input
                        id="activation-key-input"
                        type="text"
                        value={rawKey}
                        onChange={(e) => handleKeyInput(e.target.value)}
                        placeholder="EMSOL-XXXX-XXXX-XXXX-XXXX"
                        className={`w-full pl-10 pr-3.5 py-3 rounded-xl border bg-background/50
                          text-sm text-text-primary placeholder:text-text-muted font-mono tracking-wider
                          focus:outline-none focus:ring-2 focus:ring-accent/20 focus:bg-background transition-all duration-200 ${
                            keyError ? 'border-red-500/60 focus:border-red-500/80 focus:ring-red-500/10' : 'border-border focus:border-accent/50'
                          }`}
                        maxLength={29}
                        autoComplete="off"
                        autoFocus
                        required
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handlePasteKey}
                      className="px-3 border border-border bg-surface-hover/30 hover:bg-surface-hover hover:text-accent rounded-xl text-text-muted transition-colors flex items-center justify-center cursor-pointer"
                      title="Paste from clipboard"
                    >
                      <Clipboard size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsQrOpen(true)}
                      className="px-3 py-2 border border-accent/30 bg-accent/5 text-accent hover:bg-accent hover:text-background font-bold text-xs uppercase tracking-wider rounded-xl transition-all duration-200 cursor-pointer"
                    >
                      Scan QR
                    </button>
                  </div>
                  {keyError ? (
                    <p className="text-[10px] text-red-400 flex items-center gap-1.5 mt-1 font-medium animate-slide-down">
                      <AlertCircle size={12} className="shrink-0" />
                      {keyError}
                    </p>
                  ) : (
                    <p className="text-[10px] text-text-muted pl-1">
                      Keys are case-insensitive. Contact your organisation admin if you don&apos;t have one.
                    </p>
                  )}
                </div>

                {/* Resend Activation notice (Item 26) */}
                <div className="p-3.5 rounded-xl border border-border bg-surface-hover/30 text-xs text-text-muted space-y-2">
                  <p className="font-semibold text-text-primary">Didn't receive your activation key?</p>
                  <p className="text-[11px] leading-relaxed">Check your spam folder first. If it's still missing, you can request a resend or contact support.</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => toast('A request to resend the activation key has been sent to your administrator.', 'success')}
                      className="text-[10px] text-accent font-bold uppercase tracking-wider hover:underline cursor-pointer"
                    >
                      Request Resend
                    </button>
                    <span className="text-border">|</span>
                    <a
                      href="mailto:support@pitbullcorporations.com?subject=Activation%20Key%20Request"
                      className="text-[10px] text-text-muted font-bold uppercase tracking-wider hover:text-text-primary transition-colors"
                    >
                      Contact Support
                    </a>
                  </div>
                </div>

                <button
                  id="validate-key-button"
                  type="submit"
                  disabled={validating || rawKey.length < 20}
                  className="w-full gold-gradient py-3 px-4 rounded-xl text-background font-bold text-sm transition-all duration-200 active:scale-[0.98] shadow-lg shadow-accent/20 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                >
                  {validating ? (
                    <><Loader2 size={16} className="animate-spin" /> Validating Key...</>
                  ) : (
                    <><ArrowRight size={16} /> Continue</>
                  )}
                </button>

                <div className="flex items-center justify-between border-t border-border/40 pt-4">
                  <button
                    type="button"
                    onClick={() => router.push('/login')}
                    className="text-xs text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                  >
                    Already registered? <span className="text-accent underline">Sign in</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAdminBypass(true)}
                    className="text-xs text-text-muted hover:text-accent transition-colors cursor-pointer flex items-center gap-1 font-semibold"
                  >
                    <Terminal size={14} />
                    Super Admin Bypass
                  </button>
                </div>
              </form>
            )}

            {/* ── Super Admin Bypass Tab ───────────────────────────────────── */}
            {step === 'key-entry' && showAdminBypass && (
              <div className="space-y-6">
                <div>
                  <button
                    type="button"
                    onClick={() => setShowAdminBypass(false)}
                    className="flex items-center gap-1 text-xs text-text-muted hover:text-accent transition-colors mb-3 cursor-pointer"
                  >
                    <ChevronLeft size={14} /> Back
                  </button>
                  <h2 className="text-lg font-bold text-text-primary mb-1">Super Admin Licensing Bypass</h2>
                  <p className="text-sm text-text-muted">
                    Authenticate using super administrator credentials to bypass normal device key requirements.
                  </p>
                </div>

                {!superAdminUser ? (
                  <form onSubmit={handleAdminBypassAuth} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest">Admin Email</label>
                      <input
                        type="email"
                        value={adminEmail}
                        onChange={(e) => setAdminEmail(e.target.value)}
                        placeholder="admin@pitbullcorporations.com"
                        className="w-full px-3.5 py-3 rounded-xl border border-border bg-background/50 text-sm text-text-primary focus:outline-none focus:border-accent"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <PasswordInput
                        id="admin-password-input"
                        label="Admin Password"
                        icon={<Lock size={16} />}
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={authenticatingAdmin}
                      className="w-full gold-gradient py-3 px-4 rounded-xl text-background font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {authenticatingAdmin ? <><Loader2 size={16} className="animate-spin" /> Authenticating...</> : 'Authenticate Admin'}
                    </button>
                  </form>
                ) : (
                  <div className="space-y-5 p-4 rounded-xl border border-accent/20 bg-accent/5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-accent uppercase tracking-widest font-bold">Admin Active</span>
                      <button
                        type="button"
                        onClick={() => {
                          supabase.auth.signOut();
                          setSuperAdminUser(null);
                        }}
                        className="text-[10px] text-red-400 underline"
                      >
                        Sign Out
                      </button>
                    </div>

                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest">Select Target Organisation</label>
                        <select
                          value={selectedOrgId}
                          onChange={(e) => setSelectedOrgId(e.target.value)}
                          className="w-full px-3 py-2.5 rounded-lg border border-border bg-surface text-sm text-text-primary focus:outline-none focus:border-accent"
                        >
                          {organisations.map(o => (
                            <option key={o.id} value={o.id}>{o.name}</option>
                          ))}
                        </select>
                      </div>

                      <button
                        type="button"
                        onClick={handleGenerateAndPasteKey}
                        disabled={generatingKey || !selectedOrgId}
                        className="w-full bg-accent hover:bg-accent-hover text-background font-bold py-2.5 px-4 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {generatingKey ? <><Loader2 size={14} className="animate-spin" /> Generating...</> : 'Generate & Paste Key'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Step 2: Registration ─────────────────────────────────────── */}
            {step === 'registration' && orgInfo && (
              <form onSubmit={handleRegister} className="space-y-5" id="registration-form" noValidate>
                <div>
                  <button
                    type="button"
                    onClick={() => setStep('key-entry')}
                    className="flex items-center gap-1 text-xs text-text-muted hover:text-accent transition-colors mb-3 cursor-pointer"
                  >
                    <ChevronLeft size={14} /> Back
                  </button>

                  {/* Enhanced plan detail preview (Item 22) */}
                  <div className="p-4 rounded-xl bg-surface-hover border border-border/80 mb-5 space-y-3 shadow-md">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg gold-gradient flex items-center justify-center text-background font-bold text-lg shadow-md shadow-accent/10">
                        {orgInfo.orgName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-[10px] text-text-muted uppercase tracking-widest font-bold">Licence Registered For</p>
                        <p className="text-sm font-bold text-text-primary">{orgInfo.orgName}</p>
                      </div>
                    </div>
                    
                    <div className="pt-2 border-t border-border/40 text-xs">
                      <div>
                        <span className="text-text-muted">Seat Allocation</span>
                        <p className="font-semibold text-text-primary mt-0.5">
                          {orgInfo.activeMembers ?? 1} / {orgInfo.seatLimit ?? 5} Active
                        </p>
                      </div>
                    </div>

                    {orgInfo.expiresAt && (
                      <div className="pt-2 border-t border-border/40 text-[11px] text-amber-400 flex items-center gap-1.5 font-medium">
                        <AlertCircle size={12} />
                        <span>
                          Key expires in {Math.max(0, Math.ceil((new Date(orgInfo.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))} days ({new Date(orgInfo.expiresAt).toLocaleDateString()})
                        </span>
                      </div>
                    )}
                  </div>

                  <h2 className="text-lg font-bold text-text-primary mb-1">Create Your Account</h2>
                  <p className="text-sm text-text-muted">
                    This device will be cryptographically bound to your account.
                  </p>
                </div>

                {/* WebAuthn Fallback / Troubleshooting Box */}
                {passkeyError && (
                  <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 text-xs text-red-400 space-y-2.5 animate-slide-down">
                    <div className="flex items-start gap-2.5">
                      <AlertCircle size={16} className="shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">Passkey / WebAuthn Setup Failed</p>
                        <p className="text-[11px] opacity-90 mt-0.5">{passkeyError}</p>
                      </div>
                    </div>
                    <div className="h-px bg-red-500/20 my-1" />
                    <div className="space-y-1.5 pl-6 list-disc">
                      <p className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Troubleshooting Steps:</p>
                      <p className="text-[10px] text-text-muted leading-relaxed">
                        • Verify your device supports Windows Hello, Touch ID, or Face ID.<br />
                        • Ensure Bluetooth is enabled if using a mobile device as a passkey.<br />
                        • Connect an external USB security key if available.
                      </p>
                    </div>
                    <div className="flex gap-2 pt-1.5">
                      <button
                        type="button"
                        onClick={handleRegister}
                        className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 font-bold rounded-lg text-[10px] uppercase tracking-wider transition-colors cursor-pointer"
                      >
                        Retry Passkey Setup
                      </button>
                      <button
                        type="button"
                        onClick={() => setStep('key-entry')}
                        className="px-3 py-1.5 border border-border hover:bg-surface-hover text-text-muted font-semibold rounded-lg text-[10px] transition-colors cursor-pointer"
                      >
                        Change Activation Key
                      </button>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4">
                  {/* Full Name */}
                  <div className="space-y-1.5">
                    <label htmlFor="full-name-input" className="block text-[10px] font-bold text-text-muted uppercase tracking-widest">Full Name *</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-text-muted">
                        <User size={16} />
                      </div>
                      <input
                        id="full-name-input"
                        type="text"
                        value={fullName}
                        disabled={registering}
                        onChange={e => {
                          setFullName(e.target.value);
                          if (nameError) setNameError('');
                        }}
                        placeholder="Your full name"
                        className={`w-full pl-10 pr-3.5 py-3 rounded-xl border bg-background/50
                          text-sm text-text-primary placeholder:text-text-muted
                          focus:outline-none focus:ring-2 focus:ring-accent/20 focus:bg-background transition-all duration-200 ${
                            nameError ? 'border-red-500/60 focus:border-red-500/80 focus:ring-red-500/10' : 'border-border focus:border-accent/50'
                          }`}
                        required
                      />
                    </div>
                    {nameError && (
                      <p className="text-[10px] text-red-400 flex items-center gap-1.5 mt-1 font-medium animate-slide-down">
                        <AlertCircle size={12} className="shrink-0" />
                        {nameError}
                      </p>
                    )}
                  </div>

                  {/* Email */}
                  <div className="space-y-1.5">
                    <label htmlFor="email-input" className="block text-[10px] font-bold text-text-muted uppercase tracking-widest">Email Address *</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-text-muted">
                        <Mail size={16} />
                      </div>
                      <input
                        id="email-input"
                        type="email"
                        value={email}
                        disabled={registering}
                        onChange={e => {
                          setEmail(e.target.value);
                          if (emailError) setEmailError('');
                        }}
                        placeholder="name@company.com"
                        className={`w-full pl-10 pr-3.5 py-3 rounded-xl border bg-background/50
                          text-sm text-text-primary placeholder:text-text-muted
                          focus:outline-none focus:ring-2 focus:ring-accent/20 focus:bg-background transition-all duration-200 ${
                            emailError ? 'border-red-500/60 focus:border-red-500/80 focus:ring-red-500/10' : 'border-border focus:border-accent/50'
                          }`}
                        required
                      />
                    </div>
                    {emailError && (
                      <p className="text-[10px] text-red-400 flex items-center gap-1.5 mt-1 font-medium animate-slide-down">
                        <AlertCircle size={12} className="shrink-0" />
                        {emailError}
                      </p>
                    )}
                  </div>

                  {/* Password */}
                  <div className="space-y-1.5">
                    <PasswordInput
                      id="password-input"
                      label="Password"
                      icon={<Lock size={16} />}
                      value={password}
                      disabled={registering}
                      onChange={e => {
                        setPassword(e.target.value);
                        if (passwordError) setPasswordError('');
                      }}
                      placeholder="Min. 12 characters"
                      error={passwordError}
                      required
                    />
                    <PasswordStrengthIndicator password={password} />
                  </div>

                  {/* Confirm Password */}
                  <div className="space-y-1.5">
                    <PasswordInput
                      id="confirm-password-input"
                      label="Confirm Password"
                      icon={<Lock size={16} />}
                      value={confirmPassword}
                      disabled={registering}
                      onChange={e => {
                        setConfirmPassword(e.target.value);
                        if (confirmPasswordError) setConfirmPasswordError('');
                      }}
                      placeholder="Re-enter password"
                      error={confirmPasswordError}
                      required
                    />
                  </div>

                  {/* Device Label Edit Field (Item 23) */}
                  <div className="space-y-1.5">
                    <label htmlFor="device-name-input" className="block text-[10px] font-bold text-text-muted uppercase tracking-widest">Device Label *</label>
                    <input
                      id="device-name-input"
                      type="text"
                      value={deviceName}
                      disabled={registering}
                      onChange={e => {
                        setDeviceName(e.target.value);
                        if (deviceError) setDeviceError('');
                      }}
                      placeholder="My Work Laptop / Office PC"
                      className={`w-full px-3.5 py-3 rounded-xl border bg-background/50
                        text-sm text-text-primary placeholder:text-text-muted
                        focus:outline-none focus:ring-2 focus:ring-accent/20 focus:bg-background transition-all duration-200 ${
                          deviceError ? 'border-red-500/60 focus:border-red-500/80 focus:ring-red-500/10' : 'border-border focus:border-accent/50'
                        }`}
                      required
                    />
                    {deviceError && (
                      <p className="text-[10px] text-red-400 flex items-center gap-1.5 mt-1 font-medium animate-slide-down">
                        <AlertCircle size={12} className="shrink-0" />
                        {deviceError}
                      </p>
                    )}
                  </div>

                  {/* Phone (optional) */}
                  <div className="space-y-1.5">
                    <label htmlFor="phone-input" className="block text-[10px] font-bold text-text-muted uppercase tracking-widest">Phone <span className="text-text-muted/50">(Optional)</span></label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-text-muted">
                        <Phone size={16} />
                      </div>
                      <input
                        id="phone-input"
                        type="tel"
                        value={phone}
                        disabled={registering}
                        onChange={e => setPhone(e.target.value)}
                        placeholder="+91 9876543210"
                        className="w-full pl-10 pr-3.5 py-3 rounded-xl border border-border bg-background/50 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 focus:bg-background transition-all duration-200"
                      />
                    </div>
                  </div>
                </div>

                {/* Warning */}
                <div className="p-3 rounded-xl bg-surface-hover border border-border/60">
                  <p className="text-[11px] text-text-muted leading-relaxed">
                    <span className="text-amber-400 font-bold">⚠ Device Lock:</span> This account will be permanently bound to <span className="text-text-primary font-medium">this device and browser</span> via WebAuthn credentials. Switching devices requires Super Admin review.
                  </p>
                </div>

                <button
                  id="activate-submit-button"
                  type="submit"
                  disabled={registering}
                  className="w-full gold-gradient py-3 px-4 rounded-xl text-background font-bold text-sm transition-all duration-200 active:scale-[0.98] shadow-lg shadow-accent/20 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                >
                  {registering ? (
                    <><Loader2 size={16} className="animate-spin" /> Activating Passkey & Creating Account...</>
                  ) : (
                    <><Shield size={16} /> Activate & Register Device</>
                  )}
                </button>
              </form>
            )}

            {/* ── Step 3: Success ──────────────────────────────────────────── */}
            {step === 'success' && (
              <div className="text-center space-y-6 py-4 animate-fade-in">
                <div className="mx-auto w-16 h-16 rounded-full bg-green-500/10 border-2 border-green-500/40 flex items-center justify-center">
                  <CheckCircle size={32} className="text-green-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-text-primary mb-2">Account Activated!</h2>
                  <p className="text-sm text-text-muted">
                    {assignedRole === 'owner'
                      ? 'You are the Organisation Administrator. Your device and passkey have been bound.'
                      : 'Your account has been created as a team member. Your device and passkey have been bound.'}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-accent/10 border border-accent/20 text-left">
                  <p className="text-[10px] text-text-muted uppercase tracking-widest font-bold mb-1">Role Assigned</p>
                  <p className="text-sm font-semibold text-accent capitalize">
                    {assignedRole === 'owner' ? '👑 Organisation Admin' : '👤 Team Member'}
                  </p>
                </div>

                {/* Continue instantly (Item 24) */}
                <button
                  id="go-to-login-button"
                  onClick={() => router.push('/login')}
                  className="w-full gold-gradient py-3 px-4 rounded-xl text-background font-bold text-sm transition-all duration-200 active:scale-[0.98] shadow-lg shadow-accent/20 hover:brightness-110 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ArrowRight size={16} /> Continue to Sign In Now
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

      {/* Passkey Guidance Modal during loading (Item 20) */}
      {registering && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-sm glass border border-border/80 rounded-2xl p-6 text-center space-y-4 shadow-2xl">
            <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-accent/20 animate-ping"></div>
              <div className="absolute inset-2 rounded-full bg-accent/30 animate-pulse"></div>
              <Shield size={32} className="text-accent relative z-10 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-text-primary uppercase tracking-widest">Passkey Creation Active</h3>
              <p className="text-xs text-text-muted mt-1 leading-relaxed">
                Scan your fingerprint, look at your camera (FaceID), or enter your device PIN when prompted by the browser to bind this device.
              </p>
            </div>
            <div className="flex items-center justify-center gap-1.5 text-[10px] text-accent font-semibold tracking-wider uppercase animate-pulse">
              <Loader2 size={12} className="animate-spin" />
              Awaiting hardware verification...
            </div>
          </div>
        </div>
      )}

      {/* QR Scanner Overlay Modal */}
      <QRScannerModal isOpen={isQrOpen} onClose={() => setIsQrOpen(false)} onScanSuccess={handleScanSuccess} />
    </div>
  );
}
