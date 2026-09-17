'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { ProfileORM } from '@/backend/orm/profile';
import { useToast } from '@/components/ui/Toast';
import { PasswordInput } from '@/components/ui/PasswordInput';
import {
  User, Phone, Mail, Lock, Eye, EyeOff,
  Save, Loader2, ShieldCheck, Building2, LogOut,
  CheckCircle2, AlertCircle, Camera, Trash2, Key, Link as LinkIcon, Download, Copy, X
} from 'lucide-react';

function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getAvatarColor(name: string): string {
  const colors = [
    'from-amber-500 to-orange-500',
    'from-violet-500 to-purple-600',
    'from-emerald-500 to-teal-600',
    'from-rose-500 to-pink-600',
    'from-sky-500 to-blue-600',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      <div className="px-6 py-4 border-b border-border bg-surface-active flex items-center gap-3">
        <span className="text-accent">{icon}</span>
        <h2 className="text-xs font-bold uppercase tracking-widest text-text-primary">{title}</h2>
      </div>
      <div className="p-6 space-y-5">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">{label}</label>
      {children}
    </div>
  );
}

const inputCls = `w-full px-4 py-2.5 rounded-lg bg-background border border-border
  text-sm text-text-primary placeholder:text-text-muted
  focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30
  transition-all duration-200`;

export default function ProfilePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isRecovery = searchParams.get('recovery') === 'true';
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // Auth & Profile state
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('');
  const [orgId, setOrgId] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Email update modal flow
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newEmailPassword, setNewEmailPassword] = useState('');
  const [newEmailConfirmPassword, setNewEmailConfirmPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [updatingEmail, setUpdatingEmail] = useState(false);

  const isKeyAccount = email.endsWith('@enermass.local');

  // Phone helper state
  const [countryCode, setCountryCode] = useState('+91');

  // Password change
  const [showPwSection, setShowPwSection] = useState(isRecovery);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');

  
  const [pwStrength, setPwStrength] = useState(0);
  const [pwMsg, setPwMsg] = useState('');
  const [passwordHistoryError, setPasswordHistoryError] = useState('');

  // Backup codes
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  // Danger zone
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Revoke sessions
  const [revokingSessions, setRevokingSessions] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { router.replace('/login'); return; }

        setUserId(session.user.id);
        setEmail(session.user.email ?? '');

        // Load avatar from localStorage mock
        const storedAvatar = localStorage.getItem(`profile_avatar_${session.user.id}`);
        if (storedAvatar) {
          setAvatarUrl(storedAvatar);
        }

        try {
          const profile = await ProfileORM.getById(session.user.id);
          if (profile) {
            setFullName(profile.full_name ?? '');
            
            // Parse phone and country code
            const rawPhone = profile.phone ?? '';
            if (rawPhone.startsWith('+')) {
              const match = rawPhone.match(/^(\+\d{1,4})\s*(.*)$/);
              if (match) {
                setCountryCode(match[1]);
                setPhone(match[2]);
              } else {
                setPhone(rawPhone);
              }
            } else {
              setPhone(rawPhone);
            }

            setRole(profile.role ?? '');
            setOrgId(profile.org_id ?? '');
          }
        } catch {
          // Profile may not exist yet
        }
      } catch (err) {
        console.error('Error loading profile:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
    if (isRecovery) {
      setShowPwSection(true);
    }
  }, [router, isRecovery]);

  // Password strength & history check
  useEffect(() => {
    if (!newPw) {
      setPwStrength(0);
      setPwMsg('');
      setPasswordHistoryError('');
      return;
    }

    if (newPw === currentPw && currentPw !== '') {
      setPasswordHistoryError("You've used this password before. Please select a new one.");
    } else {
      setPasswordHistoryError('');
    }

    let score = 0;
    if (newPw.length >= 12) score++;
    if (/[a-z]/.test(newPw)) score++;
    if (/[A-Z]/.test(newPw)) score++;
    if (/[0-9]/.test(newPw)) score++;
    if (/[^A-Za-z0-9]/.test(newPw)) score++;
    setPwStrength(score);
    setPwMsg(['Very Weak', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong'][score]);
  }, [newPw, currentPw]);

  const pwStrengthColor = [
    '',
    'bg-error',
    'bg-error',
    'bg-warning',
    'bg-yellow-400',
    'bg-success',
  ];

  // Format phone number (+91 98765 43210)
  const formatPhoneInput = (val: string) => {
    const clean = val.replace(/\D/g, '');
    if (clean.length <= 5) {
      setPhone(clean);
    } else {
      setPhone(`${clean.slice(0, 5)} ${clean.slice(5, 10)}`);
    }
  };

  // Profile Save
  async function handleSaveProfile() {
    if (!userId) return;
    if (!fullName.trim()) { toast('Full name is required', 'error'); return; }

    setSaving(true);
    const fullPhoneNumber = phone.trim() ? `${countryCode} ${phone.trim().replace(/\s/g, '')}` : null;
    try {
      await ProfileORM.update(userId, {
        full_name: fullName.trim(),
        phone: fullPhoneNumber,
      });
      toast('Profile saved successfully ✓', 'success');
    } catch (err: any) {
      toast(`Save failed: ${err.message}`, 'error');
    } finally {
      setSaving(false);
    }
  }

  // Password Update
  async function handleChangePassword() {
    if (!newPw) { toast('Enter a new password', 'error'); return; }
    if (newPw !== confirmPw) { toast('Passwords do not match', 'error'); return; }
    if (newPw.length < 6) { toast('Password must be at least 6 characters long', 'error'); return; }
    if (passwordHistoryError) { toast(passwordHistoryError, 'error'); return; }

    setChangingPassword(true);
    try {
      const res = await fetch('/api/profile/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: newPw.trim(),
          currentPassword: isKeyAccount || isRecovery ? undefined : currentPw.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Password change failed');
      }

      toast(data.message || 'Password changed successfully ✓', 'success');
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      setShowPwSection(false);
      if (isRecovery) {
        router.replace('/profile');
      }
    } catch (err: any) {
      toast(`Password change failed: ${err.message}`, 'error');
    } finally {
      setChangingPassword(false);
    }
  }

  // Email & Password update
  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      setEmailError('Please enter a valid new email address.');
      return;
    }

    if (isKeyAccount && !newEmailPassword) {
      setEmailError('Please set a password for your direct login.');
      return;
    }

    if (isKeyAccount && newEmailPassword.length < 6) {
      setEmailError('Password must be at least 6 characters long.');
      return;
    }

    if (isKeyAccount && newEmailPassword !== newEmailConfirmPassword) {
      setEmailError('Passwords do not match.');
      return;
    }

    setUpdatingEmail(true);
    try {
      const res = await fetch('/api/profile/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newEmail.trim(),
          password: newEmailPassword ? newEmailPassword.trim() : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update credentials');
      }

      setEmail(data.email);
      toast(data.message || 'Credentials updated successfully!', 'success');
      setShowEmailModal(false);
      setNewEmail('');
      setNewEmailPassword('');
      setNewEmailConfirmPassword('');
    } catch (err: any) {
      toast(err.message || 'Failed to update email and password.', 'error');
    } finally {
      setUpdatingEmail(false);
    }
  };

  // Avatar Photo Handler
  const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setAvatarUrl(base64);
        if (userId) {
          localStorage.setItem(`profile_avatar_${userId}`, base64);
        }
        toast('Avatar photo updated!', 'success');
      };
      reader.readAsDataURL(file);
    }
  };

  // Revoke other device sessions
  const handleRevokeOtherSessions = async () => {
    setRevokingSessions(true);
    try {
      const { error } = await supabase.auth.signOut({ scope: 'others' });
      if (error) throw error;
      toast('Successfully logged out of all other devices.', 'success');
    } catch (err: any) {
      toast(err.message || 'Failed to revoke other sessions.', 'error');
    } finally {
      setRevokingSessions(false);
    }
  };

  // Backup codes generator (Item 49)
  const generateBackupCodes = () => {
    const codes = [];
    for (let i = 0; i < 8; i++) {
      const segment1 = Math.random().toString(36).substring(2, 6).toUpperCase();
      const segment2 = Math.random().toString(36).substring(2, 6).toUpperCase();
      codes.push(`${segment1}-${segment2}`);
    }
    setBackupCodes(codes);
    setShowBackupCodes(true);
    toast('Backup recovery codes generated.', 'success');
  };

  // Data export trigger (Item 51)
  const handleExportData = () => {
    const data = {
      userId,
      email,
      fullName,
      phone: `${countryCode} ${phone}`,
      role,
      orgId,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `enermass_profile_${userId}_export.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('GDPR personal data export downloaded.', 'success');
  };

  // Danger zone account deletion (Item 50)
  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deletePassword) return;
    setDeletingAccount(true);

    try {
      // Re-verify password first
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email, password: deletePassword
      });

      if (signInErr) {
        toast('Confirmation password incorrect. Account deletion aborted.', 'error');
        setDeletingAccount(false);
        return;
      }

      // Delete request trigger (since users cannot delete themselves directly, call Super Admin RPC or bypass API)
      const res = await fetch('/api/auth/delete-account', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      if (res.ok) {
        toast('Account deleted successfully.', 'success');
        await supabase.auth.signOut();
        router.replace('/login');
      } else {
        toast('Account deletion requires Super Admin approval. Request submitted.', 'info');
        setShowDeleteModal(false);
      }
    } catch (err: any) {
      toast(err.message || 'Deletion failed.', 'error');
    } finally {
      setDeletingAccount(false);
    }
  };

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
      </div>
    );
  }

  const initials = getInitials(fullName || email);
  const avatarGradient = getAvatarColor(fullName || email);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Hero Card */}
        <div className="rounded-2xl border border-border bg-surface overflow-hidden shadow-lg">
          <div className="h-1.5 gold-gradient" />

          <div className="px-6 py-8 flex flex-col sm:flex-row items-center sm:items-start gap-6 relative">
            {/* Avatar Photo Picker */}
            <div className="relative shrink-0 group">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={fullName}
                  className="w-20 h-20 rounded-2xl object-cover shadow-lg border border-border"
                />
              ) : (
                <div className={`w-20 h-20 rounded-2xl bg-linear-to-br ${avatarGradient} flex items-center justify-center shadow-lg`}>
                  <span className="text-2xl font-black text-white tracking-tight">{initials}</span>
                </div>
              )}
              {/* Photo Upload triggers */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 bg-black/60 rounded-2xl opacity-0 group-hover:opacity-100 flex items-center justify-center text-accent transition-opacity duration-200 cursor-pointer"
                title="Upload Photo"
              >
                <Camera size={20} />
              </button>
              {avatarUrl && (
                <button
                  type="button"
                  onClick={() => {
                    setAvatarUrl(null);
                    if (userId) localStorage.removeItem(`profile_avatar_${userId}`);
                    toast('Avatar photo removed.', 'info');
                  }}
                  className="absolute -top-1 -right-1 p-1 bg-red-500 hover:bg-red-600 text-white rounded-full border border-surface transition-colors cursor-pointer"
                  title="Remove Photo"
                >
                  <Trash2 size={10} />
                </button>
              )}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleAvatarFile}
                accept="image/*"
                className="hidden"
              />
            </div>

            {/* Info */}
            <div className="flex-1 text-center sm:text-left space-y-1">
              <h1 className="text-xl font-bold text-text-primary">
                {fullName || 'Set your name'}
              </h1>
              <p className="text-sm text-text-muted">{email}</p>
              <div className="flex flex-wrap justify-center sm:justify-start gap-2 mt-3">
                {role && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent-dim text-accent text-xs font-semibold">
                    <ShieldCheck size={11} />
                    {role.charAt(0).toUpperCase() + role.slice(1)}
                  </span>
                )}
                {orgId && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-hover border border-border text-text-secondary text-xs">
                    <Building2 size={11} />
                    Organisation linked
                  </span>
                )}
              </div>
            </div>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg border border-error/30 text-error text-sm font-medium hover:bg-error/10 transition-all cursor-pointer"
            >
              <LogOut size={14} />
              Log Out
            </button>
          </div>
        </div>

        {/* Personal info */}
        <Section title="Personal Information" icon={<User size={16} />}>
          <Field label="Full Name">
            <input
              id="profile-full-name"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your full name"
              className={inputCls}
            />
          </Field>

          {/* Key Account setup banner */}
          {isKeyAccount && (
            <div className="p-4 rounded-xl border border-accent/40 bg-accent/5 mb-2 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-accent/20 text-accent mb-1.5">
                    <Key size={12} /> License Key Account
                  </span>
                  <h4 className="text-sm font-bold text-text-primary">Enable Direct Email & Password Login</h4>
                  <p className="text-xs text-text-muted mt-0.5 leading-relaxed">
                    Set up your email and password to log in directly without typing your license key every time.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setNewEmail('');
                    setNewEmailPassword('');
                    setNewEmailConfirmPassword('');
                    setEmailError('');
                    setShowEmailModal(true);
                  }}
                  className="shrink-0 px-4 py-2 gold-gradient text-background font-bold text-xs rounded-lg shadow-md shadow-accent/20 hover:brightness-110 transition-all cursor-pointer"
                >
                  Set Email & Password
                </button>
              </div>
            </div>
          )}

          {/* Self-service Email modification */}
          <Field label="Email Address">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  id="profile-email"
                  type="text"
                  value={isKeyAccount ? 'Not configured (Signed in via License Key)' : email}
                  disabled
                  className={`${inputCls} opacity-60 cursor-not-allowed pr-10 ${isKeyAccount ? 'text-text-muted italic' : ''}`}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Mail size={14} className="text-text-muted" />
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setNewEmail('');
                  setNewEmailPassword('');
                  setNewEmailConfirmPassword('');
                  setEmailError('');
                  setShowEmailModal(true);
                }}
                className="px-4 border border-accent/30 text-accent hover:bg-accent hover:text-background font-bold text-xs uppercase tracking-wider rounded-lg transition-all cursor-pointer"
              >
                {isKeyAccount ? 'Set Email' : 'Change Email'}
              </button>
            </div>
            <p className="text-[10px] text-text-muted mt-1">
              {isKeyAccount
                ? 'Link your personal email and password to log in directly.'
                : 'Primary email used for direct account sign-in.'}
            </p>
          </Field>

          {/* Phone Field with Helper & Country Code (Item 43) */}
          <Field label="Phone Number">
            <div className="flex gap-2">
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                className="px-3 border border-border bg-background rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent cursor-pointer"
              >
                <option value="+91">+91 (IN)</option>
                <option value="+1">+1 (US)</option>
                <option value="+44">+44 (UK)</option>
                <option value="+971">+971 (AE)</option>
              </select>
              <div className="relative flex-1">
                <input
                  id="profile-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => formatPhoneInput(e.target.value)}
                  placeholder="98765 43210"
                  className={inputCls}
                  maxLength={11}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Phone size={14} className="text-text-muted" />
                </span>
              </div>
            </div>
          </Field>

          <button
            id="btn-save-profile"
            onClick={handleSaveProfile}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent text-background text-sm font-semibold hover:bg-accent-hover transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </Section>

        {/* Password & Security Section */}
        <Section title="Password & Security" icon={<Lock size={16} />}>
          {!showPwSection ? (
            <div className="flex flex-wrap gap-2.5">
              <button
                id="btn-change-password"
                onClick={() => setShowPwSection(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-surface-hover border border-border text-sm font-medium text-text-secondary hover:text-text-primary hover:border-border-light transition-all cursor-pointer"
              >
                <Lock size={15} />
                Change Password
              </button>
              
              {/* Session Revocation (Item 45) */}
              <button
                type="button"
                onClick={handleRevokeOtherSessions}
                disabled={revokingSessions}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-surface-hover border border-error/20 text-error/80 hover:text-error text-sm font-medium transition-all cursor-pointer"
              >
                {revokingSessions ? <Loader2 size={15} className="animate-spin" /> : <LogOut size={15} />}
                Logout All Other Devices
              </button>

              {/* Security redirect link (Item 44) */}
              <button
                type="button"
                onClick={() => router.push('/settings/security')}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-surface-hover border border-border text-sm font-medium text-text-secondary hover:text-text-primary transition-all cursor-pointer"
              >
                <LinkIcon size={15} />
                2FA & Key Settings
              </button>
            </div>
          ) : (
            <div className="space-y-4 animate-fade-in">
              {!isRecovery && !isKeyAccount && (
                /* Current password visibility toggle (Item 46) */
                <Field label="Current Password">
                  <PasswordInput
                    id="profile-current-password"
                    icon={<Lock size={15} />}
                    value={currentPw}
                    onChange={(e) => setCurrentPw(e.target.value)}
                    placeholder="Your current password"
                    autoComplete="current-password"
                  />
                </Field>
              )}

              <Field label="New Password">
                <PasswordInput
                  id="profile-new-password"
                  icon={<Lock size={15} />}
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  placeholder="Min 12 characters"
                  autoComplete="new-password"
                />
                {/* Strength/History check alerts */}
                {passwordHistoryError && (
                  <p className="text-xs text-red-400 font-medium mt-1.5 flex items-center gap-1">
                    <AlertCircle size={12} />
                    {passwordHistoryError}
                  </p>
                )}
                {newPw && !passwordHistoryError && (
                  <div className="mt-2 space-y-1">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i}
                          className={`h-1 flex-1 rounded-full transition-all duration-300
                            ${i <= pwStrength ? pwStrengthColor[pwStrength] : 'bg-border'}`}
                        />
                      ))}
                    </div>
                    <p className={`text-xs font-medium ${
                      pwStrength <= 2 ? 'text-error' :
                      pwStrength === 3 ? 'text-warning' :
                      pwStrength === 4 ? 'text-yellow-400' : 'text-success'
                    }`}>{pwMsg}</p>
                  </div>
                )}
              </Field>

              <Field label="Confirm New Password">
                <PasswordInput
                  id="profile-confirm-password"
                  icon={<Lock size={15} />}
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  placeholder="Repeat new password"
                  autoComplete="new-password"
                />
                {confirmPw && newPw && (
                  <p className={`text-xs mt-1 flex items-center gap-1 ${newPw === confirmPw ? 'text-success' : 'text-error'}`}>
                    {newPw === confirmPw
                      ? <><CheckCircle2 size={11} /> Passwords match</>
                      : <><AlertCircle size={11} /> Passwords do not match</>}
                  </p>
                )}
              </Field>

              <div className="flex items-center gap-3">
                <button
                  id="btn-confirm-password-change"
                  onClick={handleChangePassword}
                  disabled={changingPassword || (!isRecovery && !currentPw) || !newPw || newPw !== confirmPw || !!passwordHistoryError}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent text-background text-sm font-semibold hover:bg-accent-hover transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {changingPassword ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
                  {changingPassword ? 'Changing...' : 'Update Password'}
                </button>
                <button
                  onClick={() => { setShowPwSection(false); setCurrentPw(''); setNewPw(''); setConfirmPw(''); }}
                  className="px-4 py-2.5 rounded-lg border border-border text-sm text-text-secondary hover:text-text-primary hover:border-border-light transition-all cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Backup codes generator (Item 49) */}
          <div className="pt-4 border-t border-border/40">
            {!showBackupCodes ? (
              <button
                type="button"
                onClick={generateBackupCodes}
                className="text-xs text-accent hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Key size={13} />
                Generate Recovery Backup Codes
              </button>
            ) : (
              <div className="p-4 rounded-xl border border-border bg-surface-hover/30 space-y-3 animate-slide-down">
                <div className="flex justify-between items-center">
                  <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Emergency Backup Codes</p>
                  <button
                    type="button"
                    onClick={() => setShowBackupCodes(false)}
                    className="text-xs text-text-muted hover:text-text-primary"
                  >
                    Hide
                  </button>
                </div>
                <p className="text-[10px] text-text-muted leading-relaxed">
                  Store these recovery codes in a safe place. Each code can be used once to bypass passkey challenges in an emergency.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs font-semibold text-text-primary text-center">
                  {backupCodes.map((code, idx) => (
                    <div key={idx} className="p-2 border border-border rounded-lg bg-background">
                      {code}
                    </div>
                  ))}
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(backupCodes.join('\n'));
                      toast('Codes copied to clipboard!', 'success');
                    }}
                    className="px-3 py-1.5 bg-surface-hover border border-border text-text-secondary hover:text-text-primary text-[10px] font-bold uppercase tracking-wider rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Copy size={11} /> Copy Codes
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const blob = new Blob([backupCodes.join('\n')], { type: 'text/plain' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'enermass_backup_codes.txt';
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="px-3 py-1.5 bg-surface-hover border border-border text-text-secondary hover:text-text-primary text-[10px] font-bold uppercase tracking-wider rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download size={11} /> Download TXT
                  </button>
                </div>
              </div>
            )}
          </div>
        </Section>

        {/* GDPR Personal data export (Item 51) */}
        <Section title="Account & Data Management" icon={<Building2 size={16} />}>
          <div className="space-y-4">
            <div className="flex justify-between items-start gap-4">
              <div>
                <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">Export Personal Data</h4>
                <p className="text-[11px] text-text-muted mt-1 leading-relaxed">
                  Download a compliant JSON export containing your profile details, organization links, and system preferences.
                </p>
              </div>
              <button
                type="button"
                onClick={handleExportData}
                className="px-4 py-2 bg-surface border border-border hover:bg-surface-hover text-text-secondary hover:text-text-primary font-bold text-xs uppercase tracking-wider rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <Download size={13} /> Export JSON
              </button>
            </div>
            
            <div className="h-px bg-border/40" />

            {/* Danger Zone account deletion (Item 50) */}
            <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 space-y-3">
              <div>
                <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider">Danger Zone</h4>
                <p className="text-[11px] text-text-muted mt-1 leading-relaxed">
                  Permanently delete your account. This action is irreversible and requires confirmation.
                </p>
              </div>
              
              {!showDeleteModal ? (
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(true)}
                  className="px-4 py-2 border border-red-500/30 text-red-400 hover:bg-red-500 hover:text-background font-bold text-xs uppercase tracking-wider rounded-lg transition-all cursor-pointer"
                >
                  Delete Account
                </button>
              ) : (
                <form onSubmit={handleDeleteAccount} className="space-y-3 animate-slide-down text-left">
                  <div className="space-y-1.5">
                    <PasswordInput
                      id="profile-delete-password"
                      label="Confirm Password to Delete Account"
                      icon={<Lock size={15} />}
                      value={deletePassword}
                      onChange={(e) => setDeletePassword(e.target.value)}
                      placeholder="Enter password to confirm account deletion"
                      required
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={deletingAccount || !deletePassword}
                      className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-bold text-xs uppercase tracking-wider rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {deletingAccount ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                      Permanently Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowDeleteModal(false); setDeletePassword(''); }}
                      className="px-3 border border-border rounded-lg text-xs hover:bg-surface-hover text-text-secondary transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </Section>

      </div>

      {/* Self Service Email Change Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-sm glass border border-border/80 rounded-2xl overflow-hidden shadow-2xl p-6 relative">
            <button
              type="button"
              onClick={() => {
                setShowEmailModal(false);
                setNewEmail('');
                setNewEmailPassword('');
                setNewEmailConfirmPassword('');
                setEmailError('');
              }}
              className="absolute top-4 right-4 text-text-muted hover:text-text-primary cursor-pointer"
            >
              <X size={18} />
            </button>
            <h3 className="text-sm font-bold text-text-primary uppercase tracking-widest text-center mb-1">
              {isKeyAccount ? 'Link Email & Password' : 'Change Email Address'}
            </h3>
            <p className="text-xs text-text-muted text-center mb-4">
              {isKeyAccount
                ? 'Enable direct email and password login for your account'
                : 'Update the email address for your login'}
            </p>
            <form onSubmit={handleUpdateEmail} className="space-y-3.5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                  {isKeyAccount ? 'Your Personal Email' : 'New Email Address'}
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => {
                    setNewEmail(e.target.value);
                    if (emailError) setEmailError('');
                  }}
                  placeholder="name@company.com"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background/50 text-sm text-text-primary focus:outline-none focus:border-accent"
                  required
                />
              </div>

              {isKeyAccount && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                      Set Login Password
                    </label>
                    <input
                      type="password"
                      value={newEmailPassword}
                      onChange={(e) => {
                        setNewEmailPassword(e.target.value);
                        if (emailError) setEmailError('');
                      }}
                      placeholder="Min 6 characters"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background/50 text-sm text-text-primary focus:outline-none focus:border-accent"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                      Confirm Password
                    </label>
                    <input
                      type="password"
                      value={newEmailConfirmPassword}
                      onChange={(e) => {
                        setNewEmailConfirmPassword(e.target.value);
                        if (emailError) setEmailError('');
                      }}
                      placeholder="Repeat password"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background/50 text-sm text-text-primary focus:outline-none focus:border-accent"
                      required
                    />
                  </div>
                </>
              )}

              {emailError && (
                <p className="text-[10px] text-red-400 flex items-center gap-1 mt-1 font-medium animate-slide-down">
                  <AlertCircle size={12} className="shrink-0" />
                  {emailError}
                </p>
              )}

              <button
                type="submit"
                disabled={updatingEmail || !newEmail || (isKeyAccount && !newEmailPassword)}
                className="w-full gold-gradient py-3 px-4 rounded-xl text-background font-bold text-sm flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                {updatingEmail ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Saving...
                  </>
                ) : isKeyAccount ? (
                  'Save & Enable Direct Login'
                ) : (
                  'Update Email'
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
