/**
 * ENERMASS Solar Calculator — Settings Hook
 * ==========================================
 * Manages app-wide settings persisted in localStorage.
 * Provides typed access to company info, defaults, and data import/export.
 */

'use client';

import '../mockStorage';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase/client';
import localforage from 'localforage';
import { TAX_CONSTANTS } from '@/lib/tax-constants';

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface CompanyInfo {
  name: string;
  address: string;
  logoUrl: string; // placeholder or data-url
}

import type { PanelBrand, InverterBrand, BatteryBrand, EquipmentRateOverrides } from '../data/masters';
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
  defaultGridTariff: number;
  categoryMargins: CategoryMargins;
  company: CompanyInfo;
  customSystems: SolarSystem[];
  customPanels: PanelBrand[];
  customInverters: InverterBrand[];
  customBatteries: BatteryBrand[];
  currentEquipmentRates: EquipmentRateOverrides;
}

const STORAGE_KEY = 'enermass-settings';

const DEFAULT_SETTINGS: AppSettings = {
  defaultGridTariff: 8,
  categoryMargins: {
    'on-grid': 0.20,
    '3-phase': 0.22,
    'micro-inverter': 0.22,
    hybrid: 0.20,
    upgrade: 0.15,
    commercial: TAX_CONSTANTS.COMPOSITE_GST_RATE,
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
  currentEquipmentRates: {
    panels: {},
    inverters: {},
    batteries: {},
  },
};

// ─── Hook ───────────────────────────────────────────────────────────────────────

export function useSettings() {
  const [settings, setSettingsState] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);

  // Load from partitioned storage on mount
  useEffect(() => {
    async function loadSettings() {
      let lsSettings: Partial<AppSettings> = {};
      try {
        if (typeof window !== 'undefined') {
          const raw = window.localStorage.getItem(STORAGE_KEY);
          if (raw) {
            lsSettings = JSON.parse(raw) as Partial<AppSettings>;
          }
        }
      } catch {
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem(STORAGE_KEY);
        }
      }

      let dbSettings: Partial<AppSettings> = {};
      try {
        const keys = ['customSystems', 'customPanels', 'customInverters', 'customBatteries', 'currentEquipmentRates'];
        const values = await Promise.all(keys.map(k => localforage.getItem<any>(k)));
        keys.forEach((k, idx) => {
          if (values[idx] !== null) {
            dbSettings[k as keyof AppSettings] = values[idx];
          }
        });
      } catch (err) {
        console.warn('[useSettings] Failed to load from IndexedDB:', err);
      }

      setSettingsState({
        ...DEFAULT_SETTINGS,
        ...lsSettings,
        ...dbSettings,
        currentEquipmentRates: {
          panels: {
            ...DEFAULT_SETTINGS.currentEquipmentRates.panels,
            ...(lsSettings.currentEquipmentRates?.panels ?? {}),
            ...(dbSettings.currentEquipmentRates?.panels ?? {}),
          },
          inverters: {
            ...DEFAULT_SETTINGS.currentEquipmentRates.inverters,
            ...(lsSettings.currentEquipmentRates?.inverters ?? {}),
            ...(dbSettings.currentEquipmentRates?.inverters ?? {}),
          },
          batteries: {
            ...DEFAULT_SETTINGS.currentEquipmentRates.batteries,
            ...(lsSettings.currentEquipmentRates?.batteries ?? {}),
            ...(dbSettings.currentEquipmentRates?.batteries ?? {}),
          },
        },
      });
      setLoaded(true);
    }
    loadSettings();
  }, []);

  // Persist on change
  const setSettings = useCallback((update: Partial<AppSettings>) => {
    setSettingsState((prev) => {
      const next = { ...prev, ...update };
      
      // Separate LocalStorage and localforage fields
      const lsKeys = ['defaultGridTariff', 'categoryMargins', 'company'];
      const dbKeys = ['customSystems', 'customPanels', 'customInverters', 'customBatteries', 'currentEquipmentRates'];
      
      const lsUpdate: any = {};
      lsKeys.forEach(k => {
        if (next[k as keyof AppSettings] !== undefined) {
          lsUpdate[k] = next[k as keyof AppSettings];
        }
      });
      
      try {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lsUpdate));
        }
      } catch (err) {
        console.warn('[useSettings] Failed to persist settings to localStorage:', err);
      }

      dbKeys.forEach(async (k) => {
        if (next[k as keyof AppSettings] !== undefined) {
          try {
            await localforage.setItem(k, next[k as keyof AppSettings]);
          } catch (err) {
            console.warn(`[useSettings] Failed to persist ${k} to IndexedDB:`, err);
          }
        }
      });

      return next;
    });
  }, []);

  const resetSettings = useCallback(async () => {
    setSettingsState(DEFAULT_SETTINGS);
    try {
      const lsUpdate = {
        defaultGridTariff: DEFAULT_SETTINGS.defaultGridTariff,
        categoryMargins: DEFAULT_SETTINGS.categoryMargins,
        company: DEFAULT_SETTINGS.company
      };
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lsUpdate));
      }
    } catch (err) {
      console.warn('[useSettings] Failed to reset localStorage:', err);
    }
    
    const dbKeys = ['customSystems', 'customPanels', 'customInverters', 'customBatteries', 'currentEquipmentRates'];
    await Promise.all(dbKeys.map(async (k) => {
      try {
        await localforage.setItem(k, DEFAULT_SETTINGS[k as keyof AppSettings]);
      } catch (err) {
        console.warn(`[useSettings] Failed to reset ${k} in IndexedDB:`, err);
      }
    }));
  }, []);

  /**
   * commitToDb — pushes the current settings to Supabase.
   * Writes company info → organisations table
   * Writes numeric defaults + margins blob → app_settings table
   * Returns an error string if something went wrong, or null on success.
   */
  const commitToDb = useCallback(async (): Promise<string | null> => {
    setIsSyncing(true);
    try {
      // 1. Get the current authenticated session
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        return 'Not authenticated. Please log in and try again.';
      }

      const userId = sessionData.session.user.id;

      // 2. Get the user's org_id from the profiles table
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('id', userId)
        .single();

      if (profileError || !profile?.org_id) {
        return 'Could not resolve your organisation. Contact support.';
      }

      const orgId = profile.org_id;
      const currentSettings = settings;

      // 3. Update company info in organisations table
      if (currentSettings.company) {
        const { error: orgError } = await (supabase.from('organisations') as any)
          .update({
            name: currentSettings.company.name || undefined,
            address: currentSettings.company.address || null,
            logo_url: currentSettings.company.logoUrl || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', orgId);

        if (orgError) {
          console.error('[commitToDb] organisations update error:', orgError);
          return `Failed to save company info: ${orgError.message}`;
        }
      }

      // 4. Upsert app_settings (numeric defaults + margins blob)
      const { error: settingsError } = await (supabase
        .from('app_settings') as any)
        .upsert(
          {
            org_id: orgId,
            default_grid_tariff_inr: currentSettings.defaultGridTariff ?? DEFAULT_SETTINGS.defaultGridTariff,
            updated_by: userId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'org_id' }
        );

      if (settingsError) {
        console.error('[commitToDb] app_settings upsert error:', settingsError);
        return `Failed to save app settings: ${settingsError.message}`;
      }

      // 5. Upsert custom presets — delete removed ones, upsert active ones
      const customPresets = currentSettings.customSystems ?? [];
      if (customPresets.length > 0) {
        // Delete any existing presets for this org that are no longer in local list
        const localIds = customPresets.map((p) => p.id);
        await (supabase as any).from('custom_presets')
          .delete()
          .eq('org_id', orgId)
          .not('preset_id', 'in', `(${localIds.map((id) => `"${id}"`).join(',')})`);

        // Upsert each preset
        const rows = customPresets.map((preset) => ({
          org_id: orgId,
          preset_id: preset.id,
          name: preset.name,
          category: preset.category,
          capacity_kw: preset.capacityKW,
          panel_wattage: preset.panelWattage,
          panel_qty: preset.panelQty,
          target_margin_pct: preset.targetMarginPct,
          items: preset.items,
          default_equipment: preset.defaultEquipment ?? null,
          updated_at: new Date().toISOString(),
          created_by: userId,
        }));

        const { error: presetsError } = await (supabase as any).from('custom_presets')
          .upsert(rows, { onConflict: 'org_id,preset_id' });

        if (presetsError) {
          console.warn('[commitToDb] custom_presets upsert warning:', presetsError.message);
          // Non-fatal — table may not exist yet; local state is still valid
        }
      } else {
        // Clear all presets for this org if local list is empty
        await (supabase as any).from('custom_presets')
          .delete()
          .eq('org_id', orgId);
      }

      setLastSynced(new Date());
      return null; // success
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error during sync';
      console.error('[commitToDb] Unexpected error:', err);
      return message;
    } finally {
      setIsSyncing(false);
    }
  }, [settings]);


  /**
   * loadFromDb — pulls the latest settings from Supabase and merges into partitioned storage.
   * Company info ← organisations, numeric defaults ← app_settings.
   */
  const loadFromDb = useCallback(async (): Promise<string | null> => {
    setIsSyncing(true);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        return 'Not authenticated. Please log in and try again.';
      }

      const userId = sessionData.session.user.id;

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('id', userId)
        .single();

      if (profileError || !profile?.org_id) {
        return 'Could not resolve your organisation.';
      }

      const orgId = profile.org_id;

      // Fetch org info
      const { data: org, error: orgError } = await supabase
        .from('organisations')
        .select('name, address, logo_url')
        .eq('id', orgId)
        .single();

      if (orgError) {
        return `Failed to load company info: ${orgError.message}`;
      }

      // Fetch app settings
      const { data: appSettingsRow, error: appSettingsError } = await (supabase
        .from('app_settings') as any)
        .select('default_grid_tariff_inr')
        .eq('org_id', orgId)
        .single();

      // Fetch custom presets
      const { data: dbPresets, error: dbPresetsError } = await (supabase as any)
        .from('custom_presets')
        .select('*')
        .eq('org_id', orgId);

      const current = settings;

      let fetchedPresets: SolarSystem[] = [];
      if (!dbPresetsError && dbPresets) {
        fetchedPresets = dbPresets.map((row: any) => ({
          id: row.preset_id,
          name: row.name,
          category: row.category || 'custom',
          capacityKW: Number(row.capacity_kw),
          panelWattage: Number(row.panel_wattage),
          panelQty: Number(row.panel_qty),
          targetMarginPct: Number(row.target_margin_pct),
          items: row.items || [],
          defaultEquipment: row.default_equipment || undefined,
        }));
      }

      const merged: AppSettings = {
        ...DEFAULT_SETTINGS,
        ...current,
        company: {
          name: (org as any)?.name ?? current.company?.name ?? DEFAULT_SETTINGS.company.name,
          address: (org as any)?.address ?? current.company?.address ?? DEFAULT_SETTINGS.company.address,
          logoUrl: (org as any)?.logo_url ?? current.company?.logoUrl ?? DEFAULT_SETTINGS.company.logoUrl,
        },
        defaultGridTariff: !appSettingsError && appSettingsRow
          ? (appSettingsRow as any).default_grid_tariff_inr
          : (current.defaultGridTariff ?? DEFAULT_SETTINGS.defaultGridTariff),
        customSystems: !dbPresetsError && dbPresets
          ? fetchedPresets
          : (current.customSystems ?? []),
      };

      setSettings(merged);
      setLastSynced(new Date());
      return null;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error during load';
      console.error('[loadFromDb] Unexpected error:', err);
      return message;
    } finally {
      setIsSyncing(false);
    }
  }, [settings, setSettings]);

  // Export all app data (LocalStorage & IndexedDB) as JSON
  const exportData = useCallback(async () => {
    const data: Record<string, unknown> = {};

    // Gather all enermass keys from localStorage
    if (typeof window !== 'undefined') {
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key && key.startsWith('enermass')) {
          try {
            data[key] = JSON.parse(window.localStorage.getItem(key) || '{}');
          } catch {
            data[key] = window.localStorage.getItem(key);
          }
        }
      }
    }

    // Gather enermass keys from IndexedDB (localforage)
    const dbKeys = ['customSystems', 'customPanels', 'customInverters', 'customBatteries', 'currentEquipmentRates'];
    await Promise.all(dbKeys.map(async (k) => {
      try {
        const val = await localforage.getItem(k);
        if (val !== null) {
          data[`indexeddb-${k}`] = val;
        }
      } catch (err) {
        console.warn(`[exportData] Failed to export ${k} from IndexedDB:`, err);
      }
    }));

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
      reader.onload = async () => {
        try {
          const data = JSON.parse(reader.result as string) as Record<string, unknown>;
          
          // We will update both localStorage and IndexedDB
          const lsKeys = ['defaultGridTariff', 'categoryMargins', 'company'];
          const dbKeys = ['customSystems', 'customPanels', 'customInverters', 'customBatteries', 'currentEquipmentRates'];
          
          let lsUpdate: any = {};
          
          for (const [key, value] of Object.entries(data)) {
            if (key.startsWith('indexeddb-')) {
              const realKey = key.replace('indexeddb-', '');
              if (dbKeys.includes(realKey)) {
                await localforage.setItem(realKey, value);
              }
            } else if (key === STORAGE_KEY) {
              const parsed = typeof value === 'string' ? JSON.parse(value) : value;
              lsKeys.forEach(k => {
                if (parsed[k] !== undefined) {
                  lsUpdate[k] = parsed[k];
                }
              });
              dbKeys.forEach(async (k) => {
                if (parsed[k] !== undefined) {
                  await localforage.setItem(k, parsed[k]);
                }
              });
            } else if (key.startsWith('enermass')) {
              if (typeof window !== 'undefined') {
                window.localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
              }
            }
          }
          
          if (Object.keys(lsUpdate).length > 0) {
            if (typeof window !== 'undefined') {
              window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lsUpdate));
            }
          }
          
          // Reload settings state
          const lsSettingsRaw = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
          let lsSettings = {};
          if (lsSettingsRaw) {
            lsSettings = JSON.parse(lsSettingsRaw);
          }
          
          let dbSettings: any = {};
          const dbValues = await Promise.all(dbKeys.map(k => localforage.getItem<any>(k)));
          dbKeys.forEach((k, idx) => {
            if (dbValues[idx] !== null) {
              dbSettings[k] = dbValues[idx];
            }
          });
          
          setSettingsState({
            ...DEFAULT_SETTINGS,
            ...lsSettings,
            ...dbSettings,
          });
          
          resolve();
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }, []);

  /**
   * commitRateMasterToDb — pushes both BOM category overrides (rateMaster)
   * and equipment-specific brand rates to the database.
   */
  const commitRateMasterToDb = useCallback(async (): Promise<string | null> => {
    setIsSyncing(true);
    try {
      const { supabase } = await import('../supabase/client');
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) return 'Not authenticated.';

      const userId = sessionData.session.user.id;
      const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', userId).single();
      if (!profile?.org_id) return 'Could not resolve organisation.';
      const orgId = profile.org_id;

      // 1. Get data from stores
      const { useCalculatorStore } = await import('../store/calculatorStore');
      const rateMaster = useCalculatorStore.getState().rateMaster;
      const equipmentRates = settings.currentEquipmentRates;

      const { data: bomItems } = await supabase
        .from('bom_template_items')
        .select('id, description')
        .or(`org_id.eq.${orgId},org_id.is.null`);

      if (bomItems) {
        const descToId = new Map(bomItems.map(b => [b.description, b.id]));
        const updatePromises = Object.entries(rateMaster)
          .filter(([_, val]) => val.active)
          .map(async ([desc, val]) => {
            const bomItemId = descToId.get(desc);
            if (!bomItemId) return;
            const { error: eqError } = await supabase
              .from('bom_template_items')
              .update({ default_rate: val.rate })
              .eq('id', bomItemId);
            if (eqError) console.warn(`[commitRateMaster] bom_template_items update error for ${bomItemId}:`, eqError.message);
          });
        await Promise.all(updatePromises);
      }

      // 3. Persist Equipment Rates (Panels, Inverters, Batteries)
      const updateEquipment = async (table: string, rates: Record<string, number>, rateColumn: string) => {
        const entries = Object.entries(rates);
        for (const [id, newRate] of entries) {
          const { error: eqError } = await (supabase.from(table as any) as any)
            .update({ [rateColumn]: newRate, updated_at: new Date().toISOString() })
            .eq('id', id);
          if (eqError) console.warn(`[commitRateMaster] ${table} update error for ${id}:`, eqError.message);
        }
      };

      if (equipmentRates.panels) await updateEquipment('eq_panels', equipmentRates.panels, 'selling_price');
      if (equipmentRates.inverters) await updateEquipment('eq_inverters', equipmentRates.inverters, 'selling_price');
      if (equipmentRates.batteries) await updateEquipment('eq_batteries', equipmentRates.batteries, 'selling_price');

      setLastSynced(new Date());
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : 'Unknown error during rate commit';
    } finally {
      setIsSyncing(false);
    }
  }, [settings.currentEquipmentRates]);

  return {
    settings,
    loaded,
    isSyncing,
    lastSynced,
    setSettings,
    resetSettings,
    exportData,
    importData,
    commitToDb,
    commitRateMasterToDb,
    loadFromDb,
    DEFAULT_SETTINGS,
  };
}
