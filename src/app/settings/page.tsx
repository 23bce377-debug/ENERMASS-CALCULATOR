'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useSettings, type CategoryMargins } from '@/lib/hooks/useSettings';
import { useTheme } from '@/lib/hooks/useTheme';
import { useToast } from '@/components/ui/Toast';
import {
  STATE_DATA,
  getActivePanelBrands,
  getActiveInverterBrands,
  getActiveBatteryBrands,
  EMPTY_EQUIPMENT_RATE_OVERRIDES,
} from '@/lib/data/masters';
import { SYSTEMS, type SolarSystem } from '@/lib/data/bom';
import {
  Settings as SettingsIcon, MapPin, Percent, Zap, Building2,
  Download, Upload, RotateCcw, Check, AlertCircle, ChevronDown, Image, Sun, Moon
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

function EquipmentRateTable({
  title,
  rows,
  onChange,
}: {
  title: string;
  rows: Array<{ id: string; label: string; defaultRate: number; currentRate: number; suffix: string }>;
  onChange: (id: string, value: string) => void;
}) {
  return (
    <div className="rounded-xl border border-border overflow-hidden bg-background/30">
      <div className="px-4 py-3 border-b border-border bg-surface-hover/40">
        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wider text-text-muted">
              <th className="px-4 py-3 text-left font-semibold">Component</th>
              <th className="px-4 py-3 text-right font-semibold">Default</th>
              <th className="px-4 py-3 text-right font-semibold">Current</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-border/60 last:border-0">
                <td className="px-4 py-3 text-text-primary">
                  <div className="font-medium">{row.label}</div>
                  <div className="text-[11px] text-text-muted">{row.suffix === '₹/W' ? 'Rate per watt' : 'Item price'}</div>
                </td>
                <td className="px-4 py-3 text-right text-text-secondary font-mono">
                  {row.suffix === '₹/W' ? `₹${row.defaultRate.toFixed(2)}` : `₹${row.defaultRate.toFixed(0)}`}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <input
                      type="number"
                      value={row.currentRate}
                      min={0}
                      step={row.suffix === '₹/W' ? 0.1 : 1}
                      onChange={(e) => onChange(row.id, e.target.value)}
                      className="w-32 px-3 py-2 rounded-lg bg-background border border-border text-sm text-right font-mono text-text-primary outline-none focus:border-accent/50"
                    />
                    <span className="text-xs text-text-muted w-10 text-left">{row.suffix}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
    settings, loaded, setSettings, resetSettings, exportData, importData, DEFAULT_SETTINGS,
  } = useSettings();
  const { theme, setTheme } = useTheme();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [saveFlash, setSaveFlash] = useState(false);
  const [customSystemError, setCustomSystemError] = useState<string | null>(null);
  const [customSystemDraft, setCustomSystemDraft] = useState({
    name: '',
    baseSystemId: SYSTEMS[0]?.id ?? '',
    category: 'on-grid' as SolarSystem['category'],
    capacityKW: '',
    panelWattage: '',
    panelQty: '',
    targetMarginPct: '20',
  });
  const { toast } = useToast();

  if (!loaded) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="text-text-muted text-sm">Loading settings...</div>
      </div>
    );
  }

  const states = Object.keys(STATE_DATA);

  const flash = () => {
    setSaveFlash(true);
    setTimeout(() => setSaveFlash(false), 1500);
  };

  const customSystems = settings.customSystems ?? [];
  const panelCatalog = getActivePanelBrands(settings);
  const inverterCatalog = getActiveInverterBrands(settings);
  const batteryCatalog = getActiveBatteryBrands(settings);

  const updateEquipmentRate = (
    category: 'panels' | 'inverters' | 'batteries',
    id: string,
    value: string,
  ) => {
    const nextRate = parseFloat(value);
    if (!Number.isFinite(nextRate) || nextRate < 0) return;

    setSettings({
      currentEquipmentRates: {
        ...settings.currentEquipmentRates,
        [category]: {
          ...settings.currentEquipmentRates[category],
          [id]: nextRate,
        },
      },
    });
    flash();
  };

  const resetEquipmentRates = () => {
    setSettings({ currentEquipmentRates: EMPTY_EQUIPMENT_RATE_OVERRIDES });
    flash();
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

  const handleAddCustomSystem = () => {
    const name = customSystemDraft.name.trim();
    const capacityKW = parseFloat(customSystemDraft.capacityKW);
    const panelWattage = parseInt(customSystemDraft.panelWattage, 10);
    const panelQty = parseInt(customSystemDraft.panelQty, 10);
    const targetMarginPct = parseFloat(customSystemDraft.targetMarginPct);
    const template = SYSTEMS.find((s) => s.id === customSystemDraft.baseSystemId);

    if (!name) return setCustomSystemError('System name is required.');
    if (!template) return setCustomSystemError('Please choose a valid base template.');
    if (!Number.isFinite(capacityKW) || capacityKW <= 0) return setCustomSystemError('Capacity must be greater than 0.');
    if (!Number.isFinite(panelWattage) || panelWattage <= 0) return setCustomSystemError('Panel wattage must be greater than 0.');
    if (!Number.isFinite(panelQty) || panelQty <= 0) return setCustomSystemError('Panel quantity must be greater than 0.');
    if (!Number.isFinite(targetMarginPct) || targetMarginPct < 0) return setCustomSystemError('Target margin must be 0 or higher.');

    const items = template.items.map((item) =>
      item.description.toUpperCase() === 'PANEL'
        ? { ...item, qty: panelQty }
        : { ...item },
    );

    const customSystem: SolarSystem = {
      id: `custom_sys_${Date.now()}`,
      name,
      category: customSystemDraft.category,
      capacityKW,
      panelWattage,
      panelQty,
      targetMarginPct: targetMarginPct / 100,
      items,
    };

    setSettings({ customSystems: [...customSystems, customSystem] });
    setCustomSystemError(null);
    setCustomSystemDraft({
      name: '',
      baseSystemId: SYSTEMS[0]?.id ?? '',
      category: 'on-grid',
      capacityKW: '',
      panelWattage: '',
      panelQty: '',
      targetMarginPct: '20',
    });
    flash();
  };

  const removeCustomSystem = (id: string) => {
    setSettings({ customSystems: customSystems.filter((sys) => sys.id !== id) });
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

      {/* Default State */}
      <Section title="Default Location" icon={<MapPin size={18} />}>
        <FieldLabel label="Default State">
          <div className="relative">
            <select
              value={settings.defaultState}
              onChange={(e) => { setSettings({ defaultState: e.target.value }); flash(); }}
              className="appearance-none w-full max-w-xs px-4 py-2.5 rounded-lg bg-background border border-border text-sm text-text-primary outline-none focus:border-accent/50 transition-all cursor-pointer"
            >
              {states.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
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

      {/* Equipment Rates */}
      <Section title="Equipment Rates" icon={<Image size={18} />}>
        <div className="flex items-center justify-between gap-3 mb-4">
          <p className="text-sm text-text-muted">
            Edit the current selling rate for each component. The default rate stays visible for comparison.
          </p>
          <button
            onClick={resetEquipmentRates}
            className="shrink-0 px-3 py-2 rounded-lg border border-border text-xs font-semibold text-text-secondary hover:text-error hover:border-error/30 transition-colors"
          >
            Reset Current Rates
          </button>
        </div>

        <EquipmentRateTable
          title="Panels"
          rows={panelCatalog.map((panel) => ({
            id: panel.id,
            label: `${panel.brand} ${panel.model}`,
            defaultRate: panel.ratePerWatt,
            currentRate: settings.currentEquipmentRates.panels[panel.id] ?? panel.ratePerWatt,
            suffix: '₹/W',
          }))}
          onChange={(id, value) => updateEquipmentRate('panels', id, value)}
        />

        <div className="h-4" />

        <EquipmentRateTable
          title="Inverters"
          rows={inverterCatalog.map((inverter) => ({
            id: inverter.id,
            label: `${inverter.brand} ${inverter.model}`,
            defaultRate: inverter.rate,
            currentRate: settings.currentEquipmentRates.inverters[inverter.id] ?? inverter.rate,
            suffix: '₹',
          }))}
          onChange={(id, value) => updateEquipmentRate('inverters', id, value)}
        />

        <div className="h-4" />

        <EquipmentRateTable
          title="Batteries"
          rows={batteryCatalog.map((battery) => ({
            id: battery.id,
            label: `${battery.brand} ${battery.model}`,
            defaultRate: battery.rate,
            currentRate: settings.currentEquipmentRates.batteries[battery.id] ?? battery.rate,
            suffix: '₹',
          }))}
          onChange={(id, value) => updateEquipmentRate('batteries', id, value)}
        />
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
            onClick={() => {
              if (window.confirm('Are you sure you want to reset all settings to defaults? This action cannot be undone.')) {
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
      </Section>
    </div>
  );
}
