/**
 * ENERMASS — Master Data Cache
 * ==============================
 * Server-side only. Integrates both unstable_cache and Upstash Redis.
 * TTLs aligned with schema.sql specifications.
 * Invalidated from settings page.
 */

import { unstable_cache } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import { getOrSetCache } from './redisCache';

export const CACHE_TAG = 'masters';
export const CACHE_TTL = 300; // 5 minutes

// Server-only admin client — bypasses RLS for master data reads.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CachedPanel {
  id: string;
  brand: string;
  model: string;
  wattage: number;       // wattage_w
  type: string;          // panel_type
  ratePerWatt: number;   // rate_per_watt
  gstPct: number;
}

export interface CachedInverter {
  id: string;
  brand: string;
  model: string;
  capacityKW: number;    // capacity_kw
  type: string;          // inverter_type → 'on-grid' | 'hybrid' | 'micro'
  phases: number;
  rate: number;
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
  gstPct: number;
}

export interface CachedStateRule {
  id: string;
  stateCode: string;     // state_code
  stateName: string;     // state_name
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

// ─── Granular DB fetchers ─────────────────────────────────────────────────────

async function fetchPanelsFromDB() {
  const { data, error } = await supabaseAdmin.from('eq_panels').select('*').is('org_id', null).eq('is_active', true);
  if (error) throw error;
  return data ?? [];
}

async function fetchInvertersFromDB() {
  const { data, error } = await supabaseAdmin.from('eq_inverters').select('*').is('org_id', null).eq('is_active', true);
  if (error) throw error;
  return data ?? [];
}

async function fetchBatteriesFromDB() {
  const { data, error } = await supabaseAdmin.from('eq_batteries').select('*').is('org_id', null).eq('is_active', true);
  if (error) throw error;
  return data ?? [];
}

async function fetchStateRulesFromDB() {
  const { data, error } = await supabaseAdmin.from('state_rules').select('*').eq('is_active', true);
  if (error) throw error;
  return data ?? [];
}

async function fetchSchemesFromDB() {
  const { data, error } = await supabaseAdmin.from('calculation_schemes').select('id, scheme_slabs(*)').eq('is_active', true);
  if (error) throw error;
  return data ?? [];
}

// ─── Unified Cache Layer (Redis + unstable_cache) ─────────────────────────────

export const getCachedMasterData = unstable_cache(
  async (): Promise<MasterData> => {
    // 1. Fetch each master collection using Redis getOrSet cache with individual TTLs
    const [panelsData, invertersData, batteriesData, stateData, schemesData] = await Promise.all([
      getOrSetCache('eq:panels:active', fetchPanelsFromDB, 21600), // 6 hours
      getOrSetCache('eq:inverters:active', fetchInvertersFromDB, 21600), // 6 hours
      getOrSetCache('eq:batteries:active', fetchBatteriesFromDB, 21600), // 6 hours
      getOrSetCache('state_rules:all', fetchStateRulesFromDB, 86400), // 24 hours
      getOrSetCache('subsidy_schemes:active', fetchSchemesFromDB, 3600), // 1 hour
    ]);

    const panels: CachedPanel[] = panelsData.map((p: any) => ({
      id: p.id,
      brand: p.brand,
      model: p.model,
      wattage: p.wattage_w,
      type: p.panel_type,
      ratePerWatt: p.rate_per_watt,
      gstPct: p.gst_pct,
    }));

    const inverters: CachedInverter[] = invertersData.map((i: any) => ({
      id: i.id,
      brand: i.brand,
      model: i.model,
      capacityKW: i.capacity_kw,
      type: normalizeInverterType(i.inverter_type),
      phases: i.phases,
      rate: i.rate,
      gstPct: i.gst_pct,
    }));

    const batteries: CachedBattery[] = batteriesData.map((b: any) => ({
      id: b.id,
      brand: b.brand,
      model: b.model,
      capacityKWh: b.capacity_kwh,
      chemistry: b.chemistry,
      dodPct: b.dod_pct,
      rate: b.rate,
      gstPct: b.gst_pct,
    }));

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
  ['master-data'],
  { tags: [CACHE_TAG], revalidate: CACHE_TTL }
);
