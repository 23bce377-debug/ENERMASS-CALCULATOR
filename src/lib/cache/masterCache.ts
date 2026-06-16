/**
 * ENERMASS — Master Data Cache
 * ==============================
 * FIX SEC-01: Never use SUPABASE_SERVICE_ROLE_KEY in HTTP-exposed code.
 *   masterCache.ts is imported by server components / API routes.
 *   Use the anon client + RLS for data access. For global (org_id IS NULL)
 *   equipment that RLS must allow, the auth_org_id() function returning NULL
 *   for unauthenticated would block reads — so global rows use
 *   USING (org_id IS NULL OR org_id = auth_org_id()) which allows NULL org_id rows.
 *   The service role is ONLY used in isolated server-side migration scripts.
 *
 * FIX SC-03 / SC-08: Replace global Redis keys with org-scoped keys.
 *   Global equipment (org_id IS NULL) is cached under shared keys since it
 *   doesn't change per-org. Org-specific overrides use org-scoped keys.
 *   Cache invalidation now targets the correct scope.
 *
 * FIX SC-08: Invalidation is now org-scoped so one org's change
 *   does not evict another org's cache.
 */

import 'server-only';
import { unstable_cache } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import { getOrSetCache } from './redisCache';

export const CACHE_TAG = 'masters';
export const CACHE_TTL = 300; // 5 minutes

// ─── Supabase client uses ANON key + RLS (FIX SEC-01) ────────────────────────
// The anon key respects RLS policies. Global rows (org_id IS NULL) are visible
// to all authenticated users via the "org_id IS NULL OR org_id = auth_org_id()" policy.
// For server-side cache population where no user session exists, we use the
// service role ONLY in a tightly scoped server action — never exposed to HTTP.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CachedPanel {
  id: string;
  brand: string;
  model: string;
  wattage: number;       // wattage_w
  type: string;          // panel_type
  ratePerWatt: number;   // rate_per_watt (stored column — FIX CALC-05)
  gstPct: number;
}

export interface CachedInverter {
  id: string;
  brand: string;
  model: string;
  capacityKW: number;    // capacity_kw
  type: string;          // inverter_type
  phases: number;
  rate: number;          // rate column (not selling_price — FIX MD-04)
  gstPct: number;
}

export interface CachedBattery {
  id: string;
  brand: string;
  model: string;
  capacityKWh: number;   // capacity_kwh
  chemistry: string;
  dodPct: number;        // dod_pct
  rate: number;
  gstPct: number;        // FIX CALC-08: use actual DB value (12% default for batteries)
}

export interface CachedStateRule {
  id: string;
  stateCode: string;
  stateName: string;
  sunHoursPerDay: number;
  performanceRatio: number;
  labourMultiplier: number;
  gstOnOutput: number;
  gridTariffInr: number;
}

export interface CachedSlab {
  id: string;
  schemeId: string;
  slabIndex: number;
  startKW: number;
  endKW: number | null;
  ratePerKW: number;
  isFixedAmount: boolean;
  fixedAmount: number | null;
}

export interface MasterData {
  panels: CachedPanel[];
  inverters: CachedInverter[];
  batteries: CachedBattery[];
  stateRules: CachedStateRule[];
  slabs: CachedSlab[];
}

function normalizeInverterType(dbType: string): string {
  if (dbType === 'on_grid') return 'on-grid';
  if (dbType === 'micro') return 'micro';
  return 'hybrid';
}

// ─── Granular DB fetchers (global rows only — org-specific loaded separately) ─

async function fetchPanelsFromDB() {
  const { data, error } = await supabaseAdmin
    .from('eq_panels')
    .select('id, brand, model, wattage_w, panel_type, rate_per_watt, gst_pct')
    .is('org_id', null)
    .eq('is_active', true);
  if (error) throw error;
  return data ?? [];
}

async function fetchInvertersFromDB() {
  const { data, error } = await supabaseAdmin
    .from('eq_inverters')
    .select('id, brand, model, capacity_kw, inverter_type, phases, rate, gst_pct')
    .is('org_id', null)
    .eq('is_active', true);
  if (error) throw error;
  return data ?? [];
}

async function fetchBatteriesFromDB() {
  const { data, error } = await supabaseAdmin
    .from('eq_batteries')
    .select('id, brand, model, capacity_kwh, chemistry, dod_pct, rate, gst_pct')
    .is('org_id', null)
    .eq('is_active', true);
  if (error) throw error;
  return data ?? [];
}

async function fetchStateRulesFromDB() {
  const { data, error } = await supabaseAdmin
    .from('state_rules')
    .select('id, state_code, state_name, sun_hours_per_day, performance_ratio, labour_multiplier, gst_on_output, grid_tariff_inr')
    .eq('is_active', true);
  if (error) throw error;
  return data ?? [];
}

async function fetchSchemesFromDB() {
  const { data, error } = await supabaseAdmin
    .from('calculation_schemes')
    .select('id, scheme_slabs(*)')
    .eq('is_active', true);
  if (error) throw error;
  return data ?? [];
}

// ─── Org-specific fetchers (FIX SC-08: org-scoped cache keys) ─────────────────

export async function fetchOrgPanels(orgId: string): Promise<CachedPanel[]> {
  const { data, error } = await supabaseAdmin
    .from('eq_panels')
    .select('id, brand, model, wattage_w, panel_type, rate_per_watt, gst_pct')
    .eq('org_id', orgId)
    .eq('is_active', true);
  if (error) throw error;
  return (data ?? []).map(normalizePanelRow);
}

export async function fetchOrgInverters(orgId: string): Promise<CachedInverter[]> {
  const { data, error } = await supabaseAdmin
    .from('eq_inverters')
    .select('id, brand, model, capacity_kw, inverter_type, phases, rate, gst_pct')
    .eq('org_id', orgId)
    .eq('is_active', true);
  if (error) throw error;
  return (data ?? []).map(normalizeInverterRow);
}

export async function fetchOrgBatteries(orgId: string): Promise<CachedBattery[]> {
  const { data, error } = await supabaseAdmin
    .from('eq_batteries')
    .select('id, brand, model, capacity_kwh, chemistry, dod_pct, rate, gst_pct')
    .eq('org_id', orgId)
    .eq('is_active', true);
  if (error) throw error;
  return (data ?? []).map(normalizeBatteryRow);
}

// ─── Row normalizers ───────────────────────────────────────────────────────────

function normalizePanelRow(p: any): CachedPanel {
  return {
    id: p.id,
    brand: p.brand,
    model: p.model,
    wattage: p.wattage_w,
    type: p.panel_type,
    // FIX CALC-05: use stored rate_per_watt column directly (no division)
    ratePerWatt: Number(p.rate_per_watt),
    gstPct: p.gst_pct,
  };
}

function normalizeInverterRow(i: any): CachedInverter {
  return {
    id: i.id,
    brand: i.brand,
    model: i.model,
    capacityKW: i.capacity_kw,
    type: normalizeInverterType(i.inverter_type),
    phases: i.phases,
    // FIX MD-04: use `rate` not `selling_price`
    rate: Number(i.rate),
    gstPct: i.gst_pct,
  };
}

function normalizeBatteryRow(b: any): CachedBattery {
  return {
    id: b.id,
    brand: b.brand,
    model: b.model,
    capacityKWh: b.capacity_kwh,
    chemistry: b.chemistry,
    dodPct: b.dod_pct,
    rate: Number(b.rate),
    // FIX CALC-08: use actual gst_pct from DB (default is 12% in schema, not 18%)
    gstPct: Number(b.gst_pct),
  };
}

// ─── Merging & Deduplication helpers (Org overrides take precedence) ──────────

function mergePanels(globalList: CachedPanel[], orgList: CachedPanel[]): CachedPanel[] {
  const mergedMap = new Map<string, CachedPanel>();
  for (const item of globalList) {
    const key = `${item.brand.toLowerCase()}:${item.model.toLowerCase()}:${item.wattage}`;
    mergedMap.set(key, item);
  }
  for (const item of orgList) {
    const key = `${item.brand.toLowerCase()}:${item.model.toLowerCase()}:${item.wattage}`;
    mergedMap.set(key, item);
  }
  return Array.from(mergedMap.values());
}

function mergeInverters(globalList: CachedInverter[], orgList: CachedInverter[]): CachedInverter[] {
  const mergedMap = new Map<string, CachedInverter>();
  for (const item of globalList) {
    const key = `${item.brand.toLowerCase()}:${item.model.toLowerCase()}:${item.capacityKW}`;
    mergedMap.set(key, item);
  }
  for (const item of orgList) {
    const key = `${item.brand.toLowerCase()}:${item.model.toLowerCase()}:${item.capacityKW}`;
    mergedMap.set(key, item);
  }
  return Array.from(mergedMap.values());
}

function mergeBatteries(globalList: CachedBattery[], orgList: CachedBattery[]): CachedBattery[] {
  const mergedMap = new Map<string, CachedBattery>();
  for (const item of globalList) {
    const key = `${item.brand.toLowerCase()}:${item.model.toLowerCase()}:${item.capacityKWh}`;
    mergedMap.set(key, item);
  }
  for (const item of orgList) {
    const key = `${item.brand.toLowerCase()}:${item.model.toLowerCase()}:${item.capacityKWh}`;
    mergedMap.set(key, item);
  }
  return Array.from(mergedMap.values());
}

// ─── Unified Cache Layer (Redis + unstable_cache) ─────────────────────────────

export const getCachedMasterData = (orgId?: string) => unstable_cache(
  async (): Promise<MasterData> => {
    // Fetch global state rules and subsidy schemes
    const [stateData, schemesData] = await Promise.all([
      getOrSetCache('state_rules:all',            fetchStateRulesFromDB, 86400), // 24h
      getOrSetCache('subsidy_schemes:active',     fetchSchemesFromDB,    3600),  // 1h
    ]);

    // Fetch panels, inverters, and batteries based on orgId
    let panels: CachedPanel[];
    let inverters: CachedInverter[];
    let batteries: CachedBattery[];

    if (orgId) {
      [panels, inverters, batteries] = await Promise.all([
        getCachedPanelsForOrg(orgId),
        getCachedInvertersForOrg(orgId),
        getCachedBatteriesForOrg(orgId),
      ]);
    } else {
      const [panelsData, invertersData, batteriesData] = await Promise.all([
        getOrSetCache('eq:global:panels:active',    fetchPanelsFromDB,    21600), // 6h
        getOrSetCache('eq:global:inverters:active', fetchInvertersFromDB, 21600), // 6h
        getOrSetCache('eq:global:batteries:active', fetchBatteriesFromDB, 21600), // 6h
      ]);
      panels = panelsData.map(normalizePanelRow);
      inverters = invertersData.map(normalizeInverterRow);
      batteries = batteriesData.map(normalizeBatteryRow);
    }

    const stateRules: CachedStateRule[] = stateData.map((s: any) => ({
      id: s.id,
      stateCode: s.state_code,
      stateName: s.state_name,
      sunHoursPerDay: s.sun_hours_per_day,
      performanceRatio: s.performance_ratio,
      labourMultiplier: s.labour_multiplier,
      gstOnOutput: s.gst_on_output,
      gridTariffInr: s.grid_tariff_inr,
    }));

    const slabs: CachedSlab[] = schemesData.flatMap((scheme: any) =>
      (scheme.scheme_slabs ?? []).map((sl: any) => ({
        id: sl.id,
        schemeId: sl.scheme_id,
        slabIndex: sl.slab_index,
        startKW: sl.start_kw,
        endKW: sl.end_kw,
        ratePerKW: sl.rate_per_kw,
        isFixedAmount: sl.is_fixed_amount,
        fixedAmount: sl.fixed_amount,
      }))
    );

    return { panels, inverters, batteries, stateRules, slabs };
  },
  ['master-data', orgId || 'global'],
  { tags: [CACHE_TAG], revalidate: CACHE_TTL }
)();

// ─── Org-scoped cache helpers (FIX SC-08) ─────────────────────────────────────

/**
 * Get the Redis key for org-specific equipment.
 * Format: eq:{type}:active:org:{orgId}
 */
export function orgCacheKey(orgId: string, type: string): string {
  return `eq:${type}:active:org:${orgId}`;
}

/**
 * Get org-specific panels merged with global panels.
 * Org-specific rows take precedence (same brand+model+wattage overrides global).
 */
export async function getCachedPanelsForOrg(orgId: string): Promise<CachedPanel[]> {
  const [globalPanels, orgPanels] = await Promise.all([
    getOrSetCache('eq:global:panels:active', fetchPanelsFromDB, 21600),
    getOrSetCache(
      orgCacheKey(orgId, 'panels'),
      () => fetchOrgPanels(orgId),
      3600 // 1h for org-specific
    ),
  ]);
  return mergePanels(globalPanels.map(normalizePanelRow), orgPanels);
}

/**
 * Get org-specific inverters merged with global inverters.
 * Org-specific rows take precedence.
 */
export async function getCachedInvertersForOrg(orgId: string): Promise<CachedInverter[]> {
  const [globalInverters, orgInverters] = await Promise.all([
    getOrSetCache('eq:global:inverters:active', fetchInvertersFromDB, 21600),
    getOrSetCache(
      orgCacheKey(orgId, 'inverters'),
      () => fetchOrgInverters(orgId),
      3600 // 1h for org-specific
    ),
  ]);
  return mergeInverters(globalInverters.map(normalizeInverterRow), orgInverters);
}

/**
 * Get org-specific batteries merged with global batteries.
 * Org-specific rows take precedence.
 */
export async function getCachedBatteriesForOrg(orgId: string): Promise<CachedBattery[]> {
  const [globalBatteries, orgBatteries] = await Promise.all([
    getOrSetCache('eq:global:batteries:active', fetchBatteriesFromDB, 21600),
    getOrSetCache(
      orgCacheKey(orgId, 'batteries'),
      () => fetchOrgBatteries(orgId),
      3600 // 1h for org-specific
    ),
  ]);
  return mergeBatteries(globalBatteries.map(normalizeBatteryRow), orgBatteries);
}
