'use client';

import { useRef, useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useSettings, type CategoryMargins, type AppSettings } from '@/lib/hooks/useSettings';
import { useTheme } from '@/lib/hooks/useTheme';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/Confirm';
import { revalidateMasterCache } from '@/app/actions/revalidateMasters';
import { supabase } from '@/lib/supabase/client';
import {
  PWA_INSTALL_READY_EVENT,
  hasPwaInstallPrompt,
  isPwaStandalone,
  requestPwaInstallShortcut,
} from '@/components/layout/PwaPrompt';
import {
  Settings as SettingsIcon, Percent, Zap, Building2,
  Download, Upload, RotateCcw, Check, ChevronDown, Sun, Moon,
  CloudUpload, CloudDownload, Loader2, Cloud, RefreshCcw, Lock,
  Users, CreditCard, ShieldAlert, History, Key, Eye, HelpCircle, Laptop
} from 'lucide-react';

// ─── Section Wrapper ────────────────────────────────────────────────────────────

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-surface rounded-xl border border-border p-6 relative">
      <h2 className="text-sm font-bold text-text-primary flex items-center gap-2.5 mb-5">
        <span className="text-accent">{icon}</span>
        {title}
      </h2>
      {children}
    </div>
  );
}

function FieldLabel({ label, children, tooltip }: { label: string; children: React.ReactNode; tooltip?: string }) {
  return (
    <div className="space-y-1.5 relative group">
      <label className="text-xs font-medium text-text-muted uppercase tracking-wider flex items-center gap-1.5">
        {label}
        {tooltip && (
          <span className="cursor-help text-text-muted hover:text-text-primary transition-colors">
            <HelpCircle size={12} />
          </span>
        )}
      </label>
      {tooltip && (
        <div className="absolute z-30 bottom-full left-0 mb-1 bg-surface-2 border border-border text-text-primary text-[10px] p-2 rounded-lg shadow-xl opacity-0 scale-95 pointer-events-none group-hover:opacity-100 group-hover:scale-100 transition-all max-w-[200px] leading-normal font-normal">
          {tooltip}
        </div>
      )}
      {children}
    </div>
  );
}

// ─── Category Margin Map ────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<keyof CategoryMargins, string> = {
  'on-grid': 'On-Grid',
  '3-phase': '3-Phase',
  'micro-inverter': 'Micro-Inverter',
  hybrid: 'Hybrid',
  upgrade: 'Upgrade',
  commercial: 'Commercial',
};

const CATEGORY_TO_DB: Record<keyof CategoryMargins, string> = {
  'on-grid': 'on_grid',
  '3-phase': '3_phase',
  'micro-inverter': 'micro_inverter',
  hybrid: 'hybrid',
  upgrade: 'upgrade',
  commercial: 'commercial',
};

function cloneSettings(settings: AppSettings): AppSettings {
  return JSON.parse(JSON.stringify(settings));
}

function formatMarginInput(value: number) {
  return (value * 100).toFixed(2).replace(/\.?0+$/, '');
}

// ─── Main Page ──────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const {
    settings, loaded, setSettings, resetSettings, exportData, importData,
    commitToDb, loadFromDb, isSyncing, lastSynced,
  } = useSettings();
  const { theme, setTheme } = useTheme();
  
  const [profile, setProfile] = useState<{ role: string | null; org_id: string | null; is_super_admin?: boolean | null } | null>(null);
  const [dbSettingsVal, setDbSettingsVal] = useState<any>(null);
  
  // Track original settings to determine dirtiness (Item 61)
  const [originalSettings, setOriginalSettings] = useState<AppSettings | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [showDiffModal, setShowDiffModal] = useState(false);
  const [diffMode, setDiffMode] = useState<'commit' | 'load'>('commit');

  // Load user profile
  useEffect(() => {
    async function loadUserProfile() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data, error } = await supabase
          .from('profiles')
          .select('role, org_id, is_super_admin')
          .eq('id', session.user.id)
          .maybeSingle();

        if (!error && data) {
          setProfile(data);
        }
      } catch (err) {
        console.error('Failed to load profile for role check:', err);
      }
    }
    loadUserProfile();
  }, []);

  // Save base copy once loaded to detect dirtiness
  useEffect(() => {
    if (loaded && !originalSettings) {
      setOriginalSettings(cloneSettings(settings));
    }
  }, [loaded, settings, originalSettings]);

  // Dirty detection logic (Item 61)
  useEffect(() => {
    if (loaded && originalSettings) {
      const isMarginsChanged = Object.keys(settings.categoryMargins).some(
        (k) => settings.categoryMargins[k as keyof CategoryMargins] !== originalSettings.categoryMargins[k as keyof CategoryMargins]
      );
      const isGridTariffChanged = settings.defaultGridTariff !== originalSettings.defaultGridTariff;
      const isCompanyNameChanged = settings.company.name !== originalSettings.company.name;
      const isCompanyAddressChanged = settings.company.address !== originalSettings.company.address;
      const isCustomSystemsChanged = JSON.stringify(settings.customSystems ?? []) !== JSON.stringify(originalSettings.customSystems ?? []);

      const dirty = isMarginsChanged || isGridTariffChanged || isCompanyNameChanged || isCompanyAddressChanged || isCustomSystemsChanged;
      setIsDirty(dirty);
    }
  }, [settings, originalSettings, loaded]);

  // Alert beforeunload when settings are dirty (Item 61)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = 'You have unsaved settings modifications. If you leave, these local changes will be lost.';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const hasOrgAccess = Boolean(profile?.org_id);
  const disableInputs = false;
  const tooltipText = undefined;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saveFlash, setSaveFlash] = useState(false);
  const [isRefreshingCache, setIsRefreshingCache] = useState(false);
  const [shortcutAvailable, setShortcutAvailable] = useState(false);
  const { toast } = useToast();
  const confirm = useConfirm();

  // Load actual subscription tier & seats (Item 67)
  const [billingInfo, setBillingInfo] = useState<{ planName: string; usedSeats: number; seatLimit: number } | null>(null);
  useEffect(() => {
    async function fetchBilling() {
      try {
        const res = await fetch('/api/saas/subscription');
        if (res.ok) {
          const data = await res.json();
          setBillingInfo({
            planName: data.plan?.name ?? 'Standard Trial',
            usedSeats: data.seatUsage?.usedSeats ?? 1,
            seatLimit: data.seatUsage?.seatLimit ?? 5,
          });
        }
      } catch (err) {
        console.warn('[settings] Failed to fetch billing overview:', err);
        setBillingInfo(null);
      }
    }
    fetchBilling();
  }, []);

  useEffect(() => {
    const syncShortcutState = () => {
      setShortcutAvailable(hasPwaInstallPrompt() || isPwaStandalone());
    };

    syncShortcutState();
    window.addEventListener(PWA_INSTALL_READY_EVENT, syncShortcutState);
    return () => window.removeEventListener(PWA_INSTALL_READY_EVENT, syncShortcutState);
  }, []);

  if (!loaded) {
    return (
      <div className="mx-auto flex h-64 w-full max-w-4xl items-center justify-center p-6">
        <div className="text-text-muted text-sm">Loading settings...</div>
      </div>
    );
  }

  const flash = () => {
    setSaveFlash(true);
    setTimeout(() => setSaveFlash(false), 1500);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await importData(file);
      toast('Data imported successfully. Reload the page to apply.', 'success');
    } catch {
      toast('Import failed. Check file format.', 'error');
    }
    e.target.value = '';
  };

  const updateMargin = (key: keyof CategoryMargins, value: string) => {
    const num = parseFloat(value);
    if (isNaN(num)) return;
    const clampedPercent = Math.min(100, Math.max(0, num));
    setSettings({
      categoryMargins: {
        ...settings.categoryMargins,
        [key]: clampedPercent / 100,
      },
    });
    flash();
  };

  // Conflict Resolution Diff Preview (Item 64)
  const handleOpenDiff = async (mode: 'commit' | 'load') => {
    setDiffMode(mode);

    try {
      // Retrieve live DB values to build side-by-side comparison
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) throw new Error('Not authenticated');

      const { data: profileRow } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('id', sessionData.session.user.id)
        .single();
      const orgId = profileRow?.org_id;

      if (!orgId) throw new Error('No org resolved');

      // Fetch org details & settings
      const [orgResult, settingsResult, marginsResult] = await Promise.all([
        supabase.from('organisations').select('name, address').eq('id', orgId).maybeSingle(),
        supabase.from('app_settings' as any).select('default_grid_tariff_inr').eq('org_id', orgId).maybeSingle(),
        supabase.from('category_margins' as any).select('category, default_margin_pct').eq('org_id', orgId),
      ]);

      const dbMargins = { ...settings.categoryMargins };
      for (const row of (marginsResult.data ?? []) as any[]) {
        const entry = (Object.entries(CATEGORY_TO_DB) as [keyof CategoryMargins, string][])
          .find(([, dbCategory]) => dbCategory === row.category);
        if (entry) dbMargins[entry[0]] = Number(row.default_margin_pct ?? dbMargins[entry[0]]);
      }

      const dbVals = {
        company: {
          name: orgResult.data?.name ?? 'None',
          address: orgResult.data?.address ?? 'None',
        },
        defaultGridTariff: settingsResult.data?.default_grid_tariff_inr ?? 8,
        categoryMargins: dbMargins,
      };

      setDbSettingsVal(dbVals);
      setShowDiffModal(true);
    } catch (err: any) {
      toast(`Failed to build conflict preview: ${err.message}`, 'error');
    }
  };

  const executeCommit = async () => {
    setShowDiffModal(false);
    const err = await commitToDb();
    if (err) {
      toast(`Commit failed: ${err}`, 'error');
    } else {
      setOriginalSettings(cloneSettings(settings));
      setIsDirty(false);
      toast('Settings committed to database successfully ✓', 'success');
      flash();
    }
  };

  const executeLoad = async () => {
    setShowDiffModal(false);
    const err = await loadFromDb();
    if (err) {
      toast(`Load failed: ${err}`, 'error');
    } else {
      setOriginalSettings(null); // triggers reload of original settings on next effect
      setIsDirty(false);
      toast('Latest settings pulled from database ✓', 'success');
      flash();
    }
  };

  const handleAddShortcut = async () => {
    const result = await requestPwaInstallShortcut();
    if (result.status === 'accepted') {
      toast('Shortcut added successfully', 'success');
      setShortcutAvailable(false);
      return;
    }
    if (result.status === 'installed') {
      toast('Shortcut is already installed for this device', 'info');
      setShortcutAvailable(true);
      return;
    }
    if (result.status === 'dismissed') {
      toast('Shortcut installation was dismissed', 'info');
      return;
    }
    toast('Shortcut install is not available here. Use your browser menu to add this app as a shortcut.', 'info');
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-4 pb-24 animate-fade-in md:p-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-3">
            <SettingsIcon size={24} className="text-accent" />
            Settings
          </h1>
          <p className="text-sm text-text-muted mt-1">Configure defaults and company information</p>
        </div>
        
        {/* Plan Details CTA Badge (Item 67) */}
        {billingInfo && (
          <div className="flex items-center gap-3 bg-surface border border-accent/25 rounded-xl p-3 shadow-md">
            <div>
              <div className="text-[10px] font-bold text-accent uppercase tracking-wider">Licensing Tier</div>
              <div className="text-xs font-bold text-text-primary">{billingInfo.planName}</div>
              <div className="text-[9px] text-text-muted">{billingInfo.usedSeats}/{billingInfo.seatLimit} seats occupied</div>
            </div>
            <Link
              href="/settings/subscription"
              className="px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-background text-[11px] font-extrabold tracking-wide uppercase whitespace-nowrap transition-colors"
            >
              View Details
            </Link>
          </div>
        )}

        {saveFlash && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-success/10 border border-success/20 text-success text-xs font-medium animate-fade-in">
            <Check size={14} /> Saved
          </div>
        )}
      </div>

      {/* Appearance */}
      <Section title="Appearance" icon={<Sun size={18} />}>
        <FieldLabel label="Theme">
          <div className="flex p-1 rounded-xl bg-background border border-border w-fit">
            <button
              onClick={() => setTheme('light')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                theme === 'light'
                  ? 'bg-surface shadow-md shadow-black/5 text-text-primary border border-border/50'
                  : 'text-text-muted hover:text-text-primary hover:bg-surface-hover border border-transparent'
              }`}
            >
              <Sun size={16} /> Light Mode
            </button>
            <button
              onClick={() => setTheme('dark')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                theme === 'dark'
                  ? 'bg-surface shadow-md shadow-black/20 text-text-primary border border-border/50'
                  : 'text-text-muted hover:text-text-primary hover:bg-surface-hover border border-transparent'
              }`}
            >
              <Moon size={16} /> Dark Mode
            </button>
          </div>
        </FieldLabel>
      </Section>

      {/* Category Margins */}
      <Section title="Default Margins by Category" icon={<Percent size={18} />}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(Object.entries(CATEGORY_LABELS) as [keyof CategoryMargins, string][]).map(([key, label]) => (
            <FieldLabel key={key} label={label} tooltip={tooltipText}>
              <div className="relative">
                <input
                  type="number"
                  value={formatMarginInput(settings.categoryMargins[key])}
                  onChange={(e) => updateMargin(key, e.target.value)}
                  min={0}
                  max={100}
                  step={0.1}
                  disabled={disableInputs}
                  className="w-full px-4 py-2.5 pr-10 rounded-lg bg-background border border-border text-sm text-text-primary font-mono outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">%</span>
              </div>
            </FieldLabel>
          ))}
        </div>
      </Section>

      {/* Grid Tariff */}
      <Section title="Grid Tariff" icon={<Zap size={18} />}>
        <FieldLabel label="Default Grid Tariff (₹/kWh)" tooltip={tooltipText}>
          <div className="relative max-w-xs">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">₹</span>
            <input
              type="number"
              value={settings.defaultGridTariff}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (!isNaN(v)) { setSettings({ defaultGridTariff: v }); flash(); }
              }}
              min={0}
              step={0.5}
              disabled={disableInputs}
              className="w-full pl-8 pr-16 py-2.5 rounded-lg bg-background border border-border text-sm text-text-primary font-mono outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted text-xs">/kWh</span>
          </div>
        </FieldLabel>
      </Section>

      {/* Company Info */}
      <Section title="Company Information" icon={<Building2 size={18} />}>
        <div className="flex flex-col gap-5">
          <div className="w-full">
            <FieldLabel label="Company Name" tooltip={tooltipText}>
              <input
                type="text"
                value={settings.company.name}
                onChange={(e) => {
                  setSettings({ company: { ...settings.company, name: e.target.value } });
                  flash();
                }}
                disabled={disableInputs}
                className="w-full px-4 py-3 rounded-lg bg-background border border-border text-sm text-text-primary outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                placeholder="Your company name"
              />
            </FieldLabel>
          </div>

          <div className="w-full">
            <FieldLabel label="Address" tooltip={tooltipText}>
              <textarea
                value={settings.company.address}
                onChange={(e) => {
                  setSettings({ company: { ...settings.company, address: e.target.value } });
                  flash();
                }}
                rows={4}
                disabled={disableInputs}
                className="w-full px-4 py-3 rounded-lg bg-background border border-border text-sm text-text-primary outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all shadow-sm resize-none disabled:opacity-60 disabled:cursor-not-allowed"
                placeholder="Full business address"
              />
            </FieldLabel>
          </div>
        </div>
      </Section>

      {/* Organization Administration */}
      {hasOrgAccess && (
        <Section title="Organization Administration" icon={<Building2 size={18} />}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link
              href="/settings/team"
              className="p-4 rounded-xl border border-border bg-background hover:border-accent/40 hover:bg-surface-hover transition-all flex flex-col gap-1.5 cursor-pointer"
            >
              <div className="flex items-center gap-2 font-bold text-sm text-text-primary">
                <Users size={16} className="text-accent" />
                Team & Devices
              </div>
              <span className="text-xs text-text-muted">Manage member roles and revoke bound device hardware keys.</span>
            </Link>
            <Link
              href="/settings/subscription"
              className="p-4 rounded-xl border border-border bg-background hover:border-accent/40 hover:bg-surface-hover transition-all flex flex-col gap-1.5 cursor-pointer"
            >
              <div className="flex items-center gap-2 font-bold text-sm text-text-primary font-semibold">
                <Zap size={16} className="text-accent" />
                Subscription Plan
              </div>
              <span className="text-xs text-text-muted font-normal">View active SaaS licensing tier, status, and active user seat counts.</span>
            </Link>
            <Link
              href="/settings/billing"
              className="p-4 rounded-xl border border-border bg-background hover:border-accent/40 hover:bg-surface-hover transition-all flex flex-col gap-1.5 cursor-pointer"
            >
              <div className="flex items-center gap-2 font-bold text-sm text-text-primary">
                <CreditCard size={16} className="text-accent" />
                Billing & Payments
              </div>
              <span className="text-xs text-text-muted font-normal">Record offline manual transactions and download PDF tax invoices.</span>
            </Link>
            <Link
              href="/settings/activation-keys"
              className="p-4 rounded-xl border border-border bg-background hover:border-accent/40 hover:bg-surface-hover transition-all flex flex-col gap-1.5 cursor-pointer"
            >
              <div className="flex items-center gap-2 font-bold text-sm text-text-primary font-semibold">
                <Key size={16} className="text-accent" />
                Activation Keys
              </div>
              <span className="text-xs text-text-muted font-normal">Generate new one-time activation keys to onboard/license staff.</span>
            </Link>
            <Link
              href="/settings/password-resets"
              className="p-4 rounded-xl border border-border bg-background hover:border-accent/40 hover:bg-surface-hover transition-all flex flex-col gap-1.5 cursor-pointer"
            >
              <div className="flex items-center gap-2 font-bold text-sm text-text-primary">
                <Lock size={16} className="text-accent" />
                Password Resets
              </div>
              <span className="text-xs text-text-muted">Approve forgot password recovery requests for your organization.</span>
            </Link>
            <Link
              href="/settings/roles"
              className="p-4 rounded-xl border border-border bg-background hover:border-accent/40 hover:bg-surface-hover transition-all flex flex-col gap-1.5 cursor-pointer"
            >
              <div className="flex items-center gap-2 font-bold text-sm text-text-primary font-semibold">
                <ShieldAlert size={16} className="text-accent" />
                Access Control
              </div>
              <span className="text-xs text-text-muted font-normal">View feature matrix and capabilities map for linked roles.</span>
            </Link>
            <Link
              href="/settings/audit-log"
              className="p-4 rounded-xl border border-border bg-background hover:border-accent/40 hover:bg-surface-hover transition-all flex flex-col gap-1.5 cursor-pointer"
            >
              <div className="flex items-center gap-2 font-bold text-sm text-text-primary">
                <History size={16} className="text-accent" />
                Security Audit Log
              </div>
              <span className="text-xs text-text-muted">Monitor and search administrative audit trail of company changes.</span>
            </Link>
          </div>
        </Section>
      )}

      {/* Custom Systems */}
      <Section title="Custom Solar Systems" icon={<SettingsIcon size={18} />}>
        <div className="p-4 rounded-xl border border-dashed border-accent/30 bg-accent/5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-accent mb-1">Manage Your Presets</h3>
            <p className="text-xs text-text-muted font-normal">
              Custom solar systems and equipment presets have moved to their own dedicated page.
            </p>
          </div>
          <Link href="/settings/presets" className="shrink-0 px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-background text-sm font-semibold transition-colors">
            Go to Presets
          </Link>
        </div>
      </Section>

      {/* Security */}
      <Section title="Security & Session Management" icon={<Lock size={18} />}>
        <div className="p-4 rounded-xl border border-dashed border-accent/30 bg-accent/5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-accent mb-1">Active Devices & Passkeys</h3>
            <p className="text-xs text-text-muted">
              Manage your active devices, view registered cryptographic passkeys, or revoke device access.
            </p>
          </div>
          <Link href="/settings/security" className="shrink-0 px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-background text-sm font-semibold transition-colors">
            Manage Security
          </Link>
        </div>
      </Section>

      {/* Data Management */}
      <Section title="Data Management" icon={<Download size={18} />}>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleAddShortcut}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-surface border border-accent/30 text-accent text-sm font-semibold hover:bg-accent/10 transition-all cursor-pointer"
          >
            <Laptop size={16} /> {shortcutAvailable ? 'Add Shortcut' : 'Shortcut Help'}
          </button>

          <button
            onClick={() => {
              exportData();
              toast('Data exported successfully', 'success');
            }}
            disabled={disableInputs}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent/10 text-accent text-sm font-semibold hover:bg-accent/20 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Download size={16} /> Export All Data
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={disableInputs}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-surface border border-border text-sm font-medium text-text-secondary hover:text-text-primary hover:border-border-light transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Upload size={16} /> Import Data
          </button>
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" />

          {/* Reset Confirmation Details (Item 63) */}
          <button
            onClick={async () => {
              const confirmed = await confirm({
                title: 'Reset Settings to Default?',
                message: 'Are you sure you want to reset all configurations to defaults? This will revert margins (e.g. On-grid to 20%), reset default grid tariff to ₹8/kWh, and revert company info. Local inventory tables and custom systems presets will remain untouched.',
                confirmLabel: 'Reset Settings',
                cancelLabel: 'Keep Current Settings',
                type: 'danger',
              });
              if (confirmed) {
                await resetSettings();
                toast('Settings reset to defaults', 'success');
                flash();
              }
            }}
            disabled={disableInputs}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-surface border border-border text-sm font-medium text-text-secondary hover:text-error hover:border-error/30 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <RotateCcw size={16} /> Reset Defaults
          </button>
        </div>

        {/* DB Sync */}
        <div className="mt-5 p-4 rounded-xl border border-accent/20 bg-gradient-to-r from-accent/5 to-transparent">
          <div className="flex items-center gap-2 mb-3">
            <Cloud size={15} className="text-accent" />
            <span className="text-xs font-bold text-accent uppercase tracking-wider font-semibold">Database Sync</span>
            {lastSynced && (
              <span className="ml-auto text-xs text-text-muted">
                Last synced: {lastSynced.toLocaleTimeString()}
              </span>
            )}
          </div>
          <p className="text-xs text-text-muted mb-4 font-normal">
            Commit pushes your local changes (company info, grid tariff) to the centralised database.
            Load pulls the latest database values and merges them into your local settings.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              id="btn-commit-to-db"
              disabled={isSyncing || disableInputs}
              onClick={() => handleOpenDiff('commit')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent text-background text-sm font-semibold hover:bg-accent-hover transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed font-semibold"
            >
              {isSyncing ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <CloudUpload size={16} />
              )}
              Commit to DB
            </button>

            <button
              id="btn-load-from-db"
              disabled={isSyncing || disableInputs}
              onClick={() => handleOpenDiff('load')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-surface border border-accent/30 text-accent text-sm font-semibold hover:bg-accent/10 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSyncing ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <CloudDownload size={16} />
              )}
              Load from DB
            </button>

            {/* Refresh Master Data (Item 65) */}
            <button
              id="btn-refresh-master-cache"
              disabled={isRefreshingCache || disableInputs}
              onClick={async () => {
                setIsRefreshingCache(true);
                try {
                  await revalidateMasterCache();
                  
                  // Query master counts to provide detailed visual feedback (Item 65)
                  const [panelsRes, invertersRes, batteriesRes, structuresRes] = await Promise.all([
                    supabase.from('eq_panels').select('id', { count: 'exact', head: true }),
                    supabase.from('eq_inverters').select('id', { count: 'exact', head: true }),
                    supabase.from('eq_batteries').select('id', { count: 'exact', head: true }),
                    supabase.from('eq_mounting_structures').select('id', { count: 'exact', head: true }),
                  ]);

                  const panels = panelsRes.count || 0;
                  const inverters = invertersRes.count || 0;
                  const batteries = batteriesRes.count || 0;
                  const structures = structuresRes.count || 0;

                  // Re-fetch master data into local store
                  const { useCalculatorStore } = await import('@/lib/store/calculatorStore');
                  await useCalculatorStore.getState().fetchMasterData();

                  toast(`Master data refreshed: Fetched ${panels} panels, ${inverters} inverters, ${batteries} batteries, and ${structures} structures ✓`, 'success');
                } catch (err) {
                  toast('Cache refresh failed', 'error');
                } finally {
                  setIsRefreshingCache(false);
                }
              }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-surface border border-border text-sm font-medium text-text-secondary hover:text-text-primary hover:border-border-light transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isRefreshingCache ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <RefreshCcw size={16} />
              )}
              Refresh Master Data
            </button>
          </div>
        </div>
      </Section>

      {/* Sticky Bottom Actions Bar (Item 62) */}
      {isDirty && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-2xl bg-surface border border-accent/40 rounded-2xl p-4 shadow-2xl flex flex-row items-center justify-between gap-4 animate-scale-in">
          <div>
            <h4 className="text-xs font-bold text-accent">Unsaved Settings Modifiers</h4>
            <p className="text-[10px] text-text-muted">You have modifications not yet saved to the database.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleOpenDiff('commit')}
              className="px-3.5 py-2 rounded-lg bg-accent text-background text-xs font-bold hover:bg-accent-hover transition-colors cursor-pointer"
            >
              Save All (Commit)
            </button>
            <button
              onClick={async () => {
                const confirmed = await confirm({
                  title: 'Discard Changes?',
                  message: 'Revert all local unsaved configuration modifications back to database values?',
                  confirmLabel: 'Discard',
                  cancelLabel: 'Keep Editing',
                  type: 'warning',
                });
                if (confirmed) {
                  if (originalSettings) {
                    const reverted = cloneSettings(originalSettings);
                    setSettings(reverted);
                    setOriginalSettings(reverted);
                  }
                  setIsDirty(false);
                  toast('Changes discarded', 'info');
                }
              }}
              className="px-3.5 py-2 rounded-lg border border-border text-text-secondary text-xs hover:text-text-primary hover:bg-surface-hover transition-all cursor-pointer"
            >
              Discard All
            </button>
          </div>
        </div>
      )}

      {/* DB Sync Conflict Difference Modal (Item 64) */}
      {showDiffModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowDiffModal(false)} />
          <div className="relative w-full max-w-2xl bg-surface-2 border border-border rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
            <div className="p-5 border-b border-border bg-surface flex justify-between items-center">
              <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                <Cloud size={16} className="text-accent" />
                {diffMode === 'commit' ? 'Database Commit Review' : 'Database Load Review'}
              </h3>
              <button onClick={() => setShowDiffModal(false)} className="text-text-muted hover:text-text-primary">
                <ChevronDown size={18} />
              </button>
            </div>
            
            <div className="p-6 space-y-4 max-h-[400px] overflow-y-auto">
              <p className="text-xs text-text-secondary">
                {diffMode === 'commit'
                  ? 'Confirm database overrides. The following local edits will overwrite the centralized organization database records:'
                  : 'Review conflicts. The following database values will overwrite your browser local settings:'}
              </p>

              {dbSettingsVal && (
                <div className="border border-border rounded-xl overflow-hidden text-xs">
                  <div className="grid grid-cols-3 bg-surface text-text-muted font-bold p-2.5 border-b border-border">
                    <div>Settings Parameter</div>
                    <div>Local Client Settings</div>
                    <div>Central Organization DB</div>
                  </div>
                  <div className="divide-y divide-border/60 bg-background font-mono">
                    <div className="grid grid-cols-3 p-2.5">
                      <span className="font-sans font-bold text-text-secondary">Company Name</span>
                      <span className={settings.company.name !== dbSettingsVal.company.name ? 'text-accent font-bold' : 'text-text-primary'}>
                        {settings.company.name}
                      </span>
                      <span>{dbSettingsVal.company.name}</span>
                    </div>
                    <div className="grid grid-cols-3 p-2.5">
                      <span className="font-sans font-bold text-text-secondary">Address</span>
                      <span className={settings.company.address !== dbSettingsVal.company.address ? 'text-accent font-bold' : 'text-text-primary'}>
                        {settings.company.address || '—'}
                      </span>
                      <span>{dbSettingsVal.company.address || '—'}</span>
                    </div>
                    <div className="grid grid-cols-3 p-2.5">
                      <span className="font-sans font-bold text-text-secondary">Grid Tariff</span>
                      <span className={settings.defaultGridTariff !== dbSettingsVal.defaultGridTariff ? 'text-accent font-bold' : 'text-text-primary'}>
                        ₹{settings.defaultGridTariff}/kWh
                      </span>
                      <span>₹{dbSettingsVal.defaultGridTariff}/kWh</span>
                    </div>
                    {(Object.entries(CATEGORY_LABELS) as [keyof CategoryMargins, string][]).map(([key, label]) => (
                      <div key={key} className="grid grid-cols-3 p-2.5">
                        <span className="font-sans font-bold text-text-secondary">{label} Margin</span>
                        <span className={settings.categoryMargins[key] !== dbSettingsVal.categoryMargins?.[key] ? 'text-accent font-bold' : 'text-text-primary'}>
                          {formatMarginInput(settings.categoryMargins[key])}%
                        </span>
                        <span>{formatMarginInput(dbSettingsVal.categoryMargins?.[key] ?? settings.categoryMargins[key])}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-5 border-t border-border bg-surface flex items-center justify-end gap-3">
              <button
                onClick={() => setShowDiffModal(false)}
                className="px-4 py-2 rounded-lg border border-border text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-all"
              >
                Cancel
              </button>
              {diffMode === 'commit' ? (
                <button
                  onClick={executeCommit}
                  className="px-5 py-2 rounded-lg bg-accent text-background text-xs font-bold hover:bg-accent-hover transition-colors"
                >
                  Overwrite DB with Local
                </button>
              ) : (
                <button
                  onClick={executeLoad}
                  className="px-5 py-2 rounded-lg bg-accent text-background text-xs font-bold hover:bg-accent-hover transition-colors"
                >
                  Overwrite Local with DB
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
