'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useSettings, type CategoryMargins } from '@/lib/hooks/useSettings';
import { useTheme } from '@/lib/hooks/useTheme';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/Confirm';
import { revalidateMasterCache } from '@/app/actions/revalidateMasters';
import {
  Settings as SettingsIcon, Percent, Zap, Building2,
  Download, Upload, RotateCcw, Check, ChevronDown, Sun, Moon,
  CloudUpload, CloudDownload, Loader2, Cloud, RefreshCcw
} from 'lucide-react';

// ─── Section Wrapper ────────────────────────────────────────────────────────────

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-surface rounded-xl border border-border p-6">
      <h2 className="text-sm font-bold text-text-primary flex items-center gap-2.5 mb-5">
        <span className="text-accent">{icon}</span>
        {title}
      </h2>
      {children}
    </div>
  );
}

function FieldLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-text-muted uppercase tracking-wider">{label}</label>
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

// ─── Main Page ──────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const {
    settings, loaded, setSettings, resetSettings, exportData, importData,
    commitToDb, loadFromDb, isSyncing, lastSynced,
  } = useSettings();
  const { theme, setTheme } = useTheme();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saveFlash, setSaveFlash] = useState(false);
  const [isRefreshingCache, setIsRefreshingCache] = useState(false);
  const { toast } = useToast();
  const confirm = useConfirm();



  if (!loaded) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
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
    setSettings({
      categoryMargins: {
        ...settings.categoryMargins,
        [key]: num / 100,
      },
    });
    flash();
  };

  return (
    <div className="p-4 md:p-6 space-y-6 animate-fade-in max-w-4xl">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-3">
            <SettingsIcon size={24} className="text-accent" />
            Settings
          </h1>
          <p className="text-sm text-text-muted mt-1">Configure defaults and company information</p>
        </div>
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
            <FieldLabel key={key} label={label}>
              <div className="relative">
                <input
                  type="number"
                  value={(settings.categoryMargins[key] * 100).toFixed(0)}
                  onChange={(e) => updateMargin(key, e.target.value)}
                  min={0}
                  max={100}
                  step={1}
                  className="w-full px-4 py-2.5 pr-10 rounded-lg bg-background border border-border text-sm text-text-primary font-mono outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">%</span>
              </div>
            </FieldLabel>
          ))}
        </div>
      </Section>

      {/* Grid Tariff */}
      <Section title="Grid Tariff" icon={<Zap size={18} />}>
        <FieldLabel label="Default Grid Tariff (₹/kWh)">
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
              className="w-full pl-8 pr-16 py-2.5 rounded-lg bg-background border border-border text-sm text-text-primary font-mono outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted text-xs">/kWh</span>
          </div>
        </FieldLabel>
      </Section>



      {/* Company Info */}
      <Section title="Company Information" icon={<Building2 size={18} />}>
        <div className="flex flex-col gap-5">
          <div className="w-full">
            <FieldLabel label="Company Name">
              <input
                type="text"
                value={settings.company.name}
                onChange={(e) => {
                  setSettings({ company: { ...settings.company, name: e.target.value } });
                  flash();
                }}
                className="w-full px-4 py-3 rounded-lg bg-background border border-border text-sm text-text-primary outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all shadow-sm"
                placeholder="Your company name"
              />
            </FieldLabel>
          </div>

          <div className="w-full">
            <FieldLabel label="Address">
              <textarea
                value={settings.company.address}
                onChange={(e) => {
                  setSettings({ company: { ...settings.company, address: e.target.value } });
                  flash();
                }}
                rows={4}
                className="w-full px-4 py-3 rounded-lg bg-background border border-border text-sm text-text-primary outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all shadow-sm resize-none"
                placeholder="Full business address"
              />
            </FieldLabel>
          </div>
        </div>
      </Section>

      {/* Custom Systems */}
      <Section title="Custom Solar Systems" icon={<SettingsIcon size={18} />}>
        <div className="p-4 rounded-xl border border-dashed border-accent/30 bg-accent/5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-accent mb-1">Manage Your Presets</h3>
            <p className="text-xs text-text-muted">
              Custom solar systems and equipment presets have moved to their own dedicated page.
            </p>
          </div>
          <Link href="/presets" className="shrink-0 px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-background text-sm font-semibold transition-colors">
            Go to Presets
          </Link>
        </div>
      </Section>

      {/* Data Management */}
      <Section title="Data Management" icon={<Download size={18} />}>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => {
              exportData();
              toast('Data exported successfully', 'success');
            }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent/10 text-accent text-sm font-semibold hover:bg-accent/20 transition-all cursor-pointer"
          >
            <Download size={16} /> Export All Data
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-surface border border-border text-sm font-medium text-text-secondary hover:text-text-primary hover:border-border-light transition-all cursor-pointer"
          >
            <Upload size={16} /> Import Data
          </button>
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" />

          <button
            onClick={async () => {
              const confirmed = await confirm({
                title: 'Reset Settings to Default?',
                message: 'Are you sure you want to reset all global application configurations and company information to baseline system defaults? This action cannot be undone.',
                confirmLabel: 'Reset Settings',
                cancelLabel: 'Keep Current Settings',
                type: 'danger',
              });
              if (confirmed) {
                resetSettings();
                toast('Settings reset to defaults', 'success');
                flash();
              }
            }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-surface border border-border text-sm font-medium text-text-secondary hover:text-error hover:border-error/30 transition-all cursor-pointer"
          >
            <RotateCcw size={16} /> Reset Defaults
          </button>
        </div>

        {/* DB Sync */}
        <div className="mt-5 p-4 rounded-xl border border-accent/20 bg-gradient-to-r from-accent/5 to-transparent">
          <div className="flex items-center gap-2 mb-3">
            <Cloud size={15} className="text-accent" />
            <span className="text-xs font-bold text-accent uppercase tracking-wider">Database Sync</span>
            {lastSynced && (
              <span className="ml-auto text-xs text-text-muted">
                Last synced: {lastSynced.toLocaleTimeString()}
              </span>
            )}
          </div>
          <p className="text-xs text-text-muted mb-4">
            Commit pushes your local changes (company info, grid tariff) to the centralised database.
            Load pulls the latest database values and merges them into your local settings.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              id="btn-commit-to-db"
              disabled={isSyncing}
              onClick={async () => {
                const err = await commitToDb();
                if (err) {
                  toast(`Commit failed: ${err}`, 'error');
                } else {
                  toast('Settings committed to database ✓', 'success');
                  flash();
                }
              }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent text-background text-sm font-semibold hover:bg-accent-hover transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
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
              disabled={isSyncing}
              onClick={async () => {
                const err = await loadFromDb();
                if (err) {
                  toast(`Load failed: ${err}`, 'error');
                } else {
                  toast('Settings loaded from database ✓', 'success');
                  flash();
                }
              }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-surface border border-accent/30 text-accent text-sm font-semibold hover:bg-accent/10 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSyncing ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <CloudDownload size={16} />
              )}
              Load from DB
            </button>

            <button
              id="btn-refresh-master-cache"
              disabled={isRefreshingCache}
              onClick={async () => {
                setIsRefreshingCache(true);
                try {
                  await revalidateMasterCache();
                  // Re-fetch master data into the store immediately
                  const { useCalculatorStore } = await import('@/lib/store/calculatorStore');
                  await useCalculatorStore.getState().fetchMasterData();
                  toast('Master data cache refreshed ✓', 'success');
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
    </div>
  );
}
