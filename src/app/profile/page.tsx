'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { ProfileORM } from '@/backend/orm/profile';
import { useToast } from '@/components/ui/Toast';
import {
  User, Phone, Mail, Lock, Eye, EyeOff,
  Save, Loader2, ShieldCheck, Building2, LogOut,
  CheckCircle2, AlertCircle, Camera,
} from 'lucide-react';

// ─── Avatar Initials Generator ────────────────────────────────────────────────

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

// ─── Section Wrapper ──────────────────────────────────────────────────────────

function Section({ title, icon, children }: {
  title: string; icon: React.ReactNode; children: React.ReactNode
}) {
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

// ─── Field ────────────────────────────────────────────────────────────────────

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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isRecovery = searchParams.get('recovery') === 'true';
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // Auth state
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState('');

  // Profile fields
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('');
  const [orgId, setOrgId] = useState('');

  // Password change
  const [showPwSection, setShowPwSection] = useState(isRecovery);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  const [pwStrength, setPwStrength] = useState(0);
  const [pwMsg, setPwMsg] = useState('');

  // Load user on mount
  useEffect(() => {
    async function load() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { router.replace('/login'); return; }

        setUserId(session.user.id);
        setEmail(session.user.email ?? '');

        try {
          const profile = await ProfileORM.getById(session.user.id);
          if (profile) {
            setFullName(profile.full_name ?? '');
            setPhone(profile.phone ?? '');
            setRole(profile.role ?? '');
            setOrgId(profile.org_id ?? '');
          }
        } catch {
          // Profile may not exist yet — will be created on save
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

  // Password strength meter
  useEffect(() => {
    if (!newPw) { setPwStrength(0); setPwMsg(''); return; }
    let score = 0;
    if (newPw.length >= 12) score++;
    if (/[a-z]/.test(newPw)) score++;
    if (/[A-Z]/.test(newPw)) score++;
    if (/[0-9]/.test(newPw)) score++;
    if (/[^A-Za-z0-9]/.test(newPw)) score++;
    setPwStrength(score);
    setPwMsg(['Very Weak', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong'][score]);
  }, [newPw]);

  const pwStrengthColor = [
    '',
    'bg-error',        // 1: Weak
    'bg-error',        // 2: Fair (still weak / below standard)
    'bg-warning',      // 3: Good
    'bg-yellow-400',   // 4: Strong
    'bg-success',      // 5: Very Strong
  ];

  // Save profile
  async function handleSaveProfile() {
    if (!userId) return;
    if (!fullName.trim()) { toast('Full name is required', 'error'); return; }

    setSaving(true);
    try {
      await ProfileORM.update(userId, {
        full_name: fullName.trim(),
        phone: phone.trim() || null,
      });
      toast('Profile saved ✓', 'success');
    } catch (err: any) {
      toast(`Save failed: ${err.message}`, 'error');
    } finally {
      setSaving(false);
    }
  }

  // Change password
  async function handleChangePassword() {
    if (!newPw) { toast('Enter a new password', 'error'); return; }
    if (newPw !== confirmPw) { toast('Passwords do not match', 'error'); return; }
    if (newPw.length < 12) { toast('Password must be at least 12 characters long', 'error'); return; }

    setChangingPassword(true);
    try {
      if (!isRecovery) {
        // Re-authenticate first
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email, password: currentPw
        });
        if (signInErr) { toast('Current password is incorrect', 'error'); return; }
      }

      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) throw error;

      toast('Password changed successfully ✓', 'success');
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

        {/* Hero card */}
        <div className="rounded-2xl border border-border bg-surface overflow-hidden">
          {/* Gold bar */}
          <div className="h-1.5 gold-gradient" />

          <div className="px-6 py-8 flex flex-col sm:flex-row items-center sm:items-start gap-6">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${avatarGradient}
                flex items-center justify-center shadow-lg`}>
                <span className="text-2xl font-black text-white tracking-tight">{initials}</span>
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-success border-2 border-surface
                flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-white" />
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 text-center sm:text-left space-y-1">
              <h1 className="text-xl font-bold text-text-primary">
                {fullName || 'Set your name'}
              </h1>
              <p className="text-sm text-text-muted">{email}</p>
              <div className="flex flex-wrap justify-center sm:justify-start gap-2 mt-3">
                {role && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full
                    bg-accent-dim text-accent text-xs font-semibold">
                    <ShieldCheck size={11} />
                    {role.charAt(0).toUpperCase() + role.slice(1)}
                  </span>
                )}
                {orgId && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full
                    bg-surface-hover border border-border text-text-secondary text-xs">
                    <Building2 size={11} />
                    Organisation linked
                  </span>
                )}
              </div>
            </div>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg
                border border-error/30 text-error text-sm font-medium
                hover:bg-error/10 transition-all cursor-pointer"
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

          <Field label="Email Address">
            <div className="relative">
              <input
                id="profile-email"
                type="email"
                value={email}
                disabled
                className={`${inputCls} opacity-50 cursor-not-allowed`}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2">
                <Mail size={14} className="text-text-muted" />
              </span>
            </div>
            <p className="text-xs text-text-muted mt-1">
              Email address cannot be changed here. Contact your administrator.
            </p>
          </Field>

          <Field label="Phone Number">
            <div className="relative">
              <input
                id="profile-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className={inputCls}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2">
                <Phone size={14} className="text-text-muted" />
              </span>
            </div>
          </Field>

          <button
            id="btn-save-profile"
            onClick={handleSaveProfile}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg
              bg-accent text-background text-sm font-semibold
              hover:bg-accent-hover transition-all cursor-pointer
              disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </Section>

        {/* Password */}
        <Section title="Password & Security" icon={<Lock size={16} />}>
          {!showPwSection ? (
            <button
              id="btn-change-password"
              onClick={() => setShowPwSection(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg
                bg-surface-hover border border-border text-sm font-medium text-text-secondary
                hover:text-text-primary hover:border-border-light transition-all cursor-pointer"
            >
              <Lock size={15} />
              Change Password
            </button>
          ) : (
            <div className="space-y-4 animate-fade-in">
              {!isRecovery && (
                <Field label="Current Password">
                  <input
                    id="profile-current-password"
                    type="password"
                    value={currentPw}
                    onChange={(e) => setCurrentPw(e.target.value)}
                    placeholder="Your current password"
                    className={inputCls}
                    autoComplete="current-password"
                  />
                </Field>
              )}

              <Field label="New Password">
                <div className="relative">
                  <input
                    id="profile-new-password"
                    type={showNewPw ? 'text' : 'password'}
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    placeholder="Min 12 characters"
                    className={`${inputCls} pr-10`}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPw(!showNewPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary cursor-pointer"
                  >
                    {showNewPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {/* Strength bar */}
                {newPw && (
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
                <div className="relative">
                  <input
                    id="profile-confirm-password"
                    type={showConfirmPw ? 'text' : 'password'}
                    value={confirmPw}
                    onChange={(e) => setConfirmPw(e.target.value)}
                    placeholder="Repeat new password"
                    className={`${inputCls} pr-10`}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPw(!showConfirmPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary cursor-pointer"
                  >
                    {showConfirmPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
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
                  disabled={changingPassword || (!isRecovery && !currentPw) || !newPw || newPw !== confirmPw}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg
                    bg-accent text-background text-sm font-semibold
                    hover:bg-accent-hover transition-all cursor-pointer
                    disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {changingPassword ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
                  {changingPassword ? 'Changing...' : 'Update Password'}
                </button>
                <button
                  onClick={() => { setShowPwSection(false); setCurrentPw(''); setNewPw(''); setConfirmPw(''); }}
                  className="px-4 py-2.5 rounded-lg border border-border text-sm text-text-secondary
                    hover:text-text-primary hover:border-border-light transition-all cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </Section>

        {/* Account info */}
        <Section title="Account Details" icon={<Building2 size={16} />}>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-background border border-border space-y-1">
              <p className="text-xs text-text-muted uppercase tracking-wider">User ID</p>
              <p className="text-xs font-mono text-text-secondary truncate">{userId}</p>
            </div>
            <div className="p-4 rounded-lg bg-background border border-border space-y-1">
              <p className="text-xs text-text-muted uppercase tracking-wider">Role</p>
              <p className="text-sm font-semibold text-text-primary capitalize">{role || '—'}</p>
            </div>
          </div>
        </Section>

      </div>
    </div>
  );
}
