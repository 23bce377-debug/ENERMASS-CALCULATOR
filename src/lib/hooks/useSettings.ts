/**
 * ENERMASS Solar Calculator — Settings Hook
 * ==========================================
 * Manages app-wide settings persisted in localStorage.
 * Provides typed access to company info, defaults, and data import/export.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface CompanyInfo {
  name: string;
  address: string;
  logoUrl: string; // placeholder or data-url
}

import type { PanelBrand, InverterBrand, BatteryBrand } from '../data/masters';
import type { SolarSystem } from '../data/bom';

export interface CategoryMargins {
  'on-grid': number;
  '3-phase': number;
  'micro-inverter': number;
  hybrid: number;
  upgrade: number;
  commercial: number;
}

export interface AppSettings {
  defaultState: string;
  defaultGridTariff: number;
  categoryMargins: CategoryMargins;
  company: CompanyInfo;
  customSystems: SolarSystem[];
  customPanels: PanelBrand[];
  customInverters: InverterBrand[];
  customBatteries: BatteryBrand[];
}

const STORAGE_KEY = 'enermass-settings';

const DEFAULT_SETTINGS: AppSettings = {
  defaultState: 'Gujarat',
  defaultGridTariff: 8,
  categoryMargins: {
    'on-grid': 0.20,
    '3-phase': 0.22,
    'micro-inverter': 0.22,
    hybrid: 0.20,
    upgrade: 0.15,
    commercial: 0.18,
  },
  company: {
    name: 'ENERMASS Solar',
    address: '',
    logoUrl: '',
  },
  customSystems: [],
  customPanels: [],
  customInverters: [],
  customBatteries: [],
};

// ─── Hook ───────────────────────────────────────────────────────────────────────

export function useSettings() {
  const [settings, setSettingsState] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<AppSettings>;
        setSettingsState({ ...DEFAULT_SETTINGS, ...parsed });
      }
    } catch {
      // Corrupted data — reset
      localStorage.removeItem(STORAGE_KEY);
    }
    setLoaded(true);
  }, []);

  // Persist on change
  const setSettings = useCallback((update: Partial<AppSettings>) => {
    setSettingsState((prev) => {
      const next = { ...prev, ...update };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch (err) {
        // Quota exceeded — warn but don't crash
        console.warn('[useSettings] Failed to persist settings — localStorage may be full:', err);
      }
      return next;
    });
  }, []);

  const resetSettings = useCallback(() => {
    setSettingsState(DEFAULT_SETTINGS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_SETTINGS));
  }, []);

  // Export all app data as JSON
  const exportData = useCallback(() => {
    const data: Record<string, unknown> = {};

    // Gather all enermass keys
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('enermass')) {
        try {
          data[key] = JSON.parse(localStorage.getItem(key) || '{}');
        } catch {
          data[key] = localStorage.getItem(key);
        }
      }
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `enermass-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  // Import data from JSON
  const importData = useCallback((file: File) => {
    return new Promise<void>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result as string) as Record<string, unknown>;
          for (const [key, value] of Object.entries(data)) {
            localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
          }
          // Reload settings
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw) {
            setSettingsState({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) });
          }
          resolve();
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }, []);

  return {
    settings,
    loaded,
    setSettings,
    resetSettings,
    exportData,
    importData,
    DEFAULT_SETTINGS,
  };
}
