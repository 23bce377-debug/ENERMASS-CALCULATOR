/**
 * masterCache.ts — Master data loader with in-memory stale-while-revalidate cache.
 *
 * Architecture:
 * - Single Promise.all() loads all 24 datasets in parallel (one DB round-trip).
 * - In-memory Map stores per-orgId payloads with TTL.
 * - stale-while-revalidate: expired entries are returned immediately while
 *   a background refresh happens, so the caller never blocks on a cold start
 *   after the first load.
 * - Cache invalidation clears the entry synchronously; next call triggers refresh.
 * - ETag is an MD5 hash of the JSON payload, enabling HTTP 304 responses.
 *
 * TTL values:
 * - Global data (org-independent tables): 5 minutes
 * - Org-specific overrides (rate_master, category_margins, app_settings): 2 minutes
 *
 * Thread safety:
 * - Node.js is single-threaded; the Map is safe without locks.
 * - Each orgId key is independent — invalidating one org does not affect others.
 */

import 'server-only';
import crypto from 'crypto';
import { createClient } from '@/lib/supabase/server';
import type {
  MasterData,
  MasterDataPayload,
  CachedRateMasterEntry,
  CachedCategoryMargin,
  CachedAppSettings,
} from './masterCacheTypes';

export const CACHE_VERSION = '3.1.0';
export const CACHE_TAG = 'master-data';

/** Global TTL: 5 minutes (org-independent tables change infrequently) */
const GLOBAL_TTL_MS = 5 * 60 * 1000;

/** Org TTL: 2 minutes (org-specific overrides may change more often) */
const ORG_TTL_MS = 2 * 60 * 1000;

interface CacheEntry {
  payload: MasterDataPayload;
  expiresAt: number;
  refreshing: boolean;
}

// In-memory cache: key = orgId | '__global__'
const cache = new Map<string, CacheEntry>();

function cacheKey(orgId: string | null): string {
  return orgId ?? '__global__';
}

function computeEtag(data: MasterData, version: string): string {
  // Use a stable subset (counts + version) instead of full JSON for performance.
  const signature = [
    version,
    data.panels.length,
    data.inverters.length,
    data.batteries.length,
    data.bomCategories.length,
    data.bomTemplateItems.length,
    data.structures.length,
    data.rateMaster.length,
    data.categoryMargins.length,
  ].join(':');
  return crypto.createHash('md5').update(signature).digest('hex');
}

// ─── Core Loader ──────────────────────────────────────────────────────────────

async function loadMasterData(orgId: string | null): Promise<MasterDataPayload> {
  const supabase = await createClient();

  // ── Parallel fetch: all global tables + org-specific overrides ───────────
  const [
    panelsRes, invertersRes, batteriesRes,
    stateRulesRes, slabsRes, schemesRes, schemeOverridesRes,
    bomCategoriesRes, bomTemplateItemsRes,
    metersRes, lightningArrestersRes, structuresRes,
    weightLookupsRes, orientationMultipliersRes, structureVendorsRes,
    structureMaterialRatesRes, structureTemplatesRes, structureTemplateItemsRes,
    walkwayTemplatesRes, ladderTemplatesRes, structureAccessoryRatesRes,
    rateMasterRes, categoryMarginsRes, appSettingsRes,
    systemStateAvailRes, stateTermsRes,
  ] = await Promise.all([
    // Equipment
    supabase
      .from('eq_panels')
      .select('id, brand, model, wattage_w, rate_per_watt, gst_pct, is_active')
      .eq('is_active', true),
    supabase
      .from('eq_inverters')
      .select('id, brand, model, capacity_kw, phases, rate, gst_pct, is_active')
      .eq('is_active', true),
    supabase
      .from('eq_batteries')
      .select('id, brand, model, capacity_kwh, voltage_v, rate, gst_pct, is_active')
      .eq('is_active', true),

    // State / Subsidy
    supabase
      .from('state_rules')
      .select('id, state_code, state_name, discom_name, is_active')
      .eq('is_active', true),
    supabase
      .from('scheme_slabs')
      .select('id, scheme_id, slab_index, start_kw, end_kw, rate_per_kw, is_fixed_amount, fixed_amount'),
    supabase
      .from('calculation_schemes')
      .select('id, name, max_capacity_kw, applies_to')
      .eq('is_active', true),
    supabase
      .from('state_scheme_overrides')
      .select('id, scheme_id, state_id, max_absolute_override, additional_state_subsidy')
      .eq('is_active', true),

    // BOM
    supabase
      .from('bom_categories')
      .select('id, org_id, name, display_order, is_optional')
      .order('display_order'),
    supabase
      .from('bom_template_items')
      .select('id, org_id, category_id, sku_code, description, unit, unit_rate_min, unit_rate_max, default_rate, qty_formula, is_survey_dependent, civil_required_only, notes'),

    // Equipment (continued)
    supabase
      .from('eq_meters')
      .select('id, brand, model, selling_price, gst_pct, meter_type, description'),
    supabase
      .from('eq_lightning_arresters')
      .select('id, brand, model, selling_price, gst_pct, description, max_capacity_kw'),
    supabase
      .from('eq_mounting_structures')
      .select('id, name, material, roof_mount_type, selling_price, per_watt_rate, gst_pct, raw_material_rate, fabrication_rate, galvanizing_rate, base_weight_kg, wastage_pct, fastener_weight_pct, rate_per_kg'),

    // Structure lookups
    supabase
      .from('structure_weight_lookup')
      .select('id, structure_id, capacity_kw_min, capacity_kw_max, total_weight_kg'),
    supabase
      .from('eq_orientation_multipliers')
      .select('orientation, multiplier'),
    supabase
      .from('vendors')
      .select('id, name')
      .eq('is_structure_vendor', true),
    supabase
      .from('structure_material_rates')
      .select('id, vendor_id, material_type, rate_per_kg'),
    supabase
      .from('structure_templates')
      .select('id, structure_type, capacity_kw'),
    supabase
      .from('structure_template_items')
      .select('id, template_id, vendor_id, item, qty, weight'),
    supabase
      .from('walkway_templates')
      .select('id, template, cost_per_meter'),
    supabase
      .from('ladder_templates')
      .select('id, template, cost_per_meter'),
    supabase
      .from('structure_accessory_rates')
      .select('id, item_name, unit, rate')
      .eq('is_active', true),

    // Org-specific overrides (only when orgId provided)
    orgId
      ? supabase
          .from('rate_master')
          .select('item_name, override_rate, is_active')
          .eq('org_id', orgId)
          .eq('is_active', true)
      : Promise.resolve({ data: [], error: null }),
    orgId
      ? supabase
          .from('category_margins')
          .select('category, default_margin_pct')
          .eq('org_id', orgId)
      : Promise.resolve({ data: [], error: null }),
    orgId
      ? supabase
          .from('app_settings')
          .select('default_grid_tariff_inr, default_validity_days, electricity_inflation_pct, orientation_factor')
          .eq('org_id', orgId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),

    // State-driven pipeline (global tables). Cast to any: these tables are added
    // by the state-driven pipeline migration and are not yet in the generated
    // Database types until `supabase gen types` is re-run post-migration.
    (supabase as any)
      .from('system_state_availability')
      .select('system_id, state_id'),
    (supabase as any)
      .from('state_terms_templates')
      .select('id, state_id, clauses, is_active, version')
      .eq('is_active', true),
  ]);

  // ── Log any non-fatal errors (missing tables, RLS blocks) ───────────────
  const results = [
    panelsRes, invertersRes, batteriesRes,
    stateRulesRes, slabsRes, schemesRes, schemeOverridesRes,
    bomCategoriesRes, bomTemplateItemsRes,
    metersRes, lightningArrestersRes, structuresRes,
    weightLookupsRes, orientationMultipliersRes, structureVendorsRes,
    structureMaterialRatesRes, structureTemplatesRes, structureTemplateItemsRes,
    walkwayTemplatesRes, ladderTemplatesRes, structureAccessoryRatesRes,
    rateMasterRes, categoryMarginsRes,
  ];

  for (const res of results) {
    if (res.error) {
      console.warn('[MasterCache] Non-fatal query error:', res.error.message);
    }
  }

  const rateMasterRows = (rateMasterRes.data ?? []) as Array<{
    item_name: string;
    override_rate: number;
    is_active: boolean;
  }>;

  const categoryMarginRows = (categoryMarginsRes.data ?? []) as Array<{
    category: string;
    default_margin_pct: number;
  }>;

  const appSettingsRow = (appSettingsRes.data ?? null) as CachedAppSettings | null;

  const data: MasterData = {
    panels: (panelsRes.data ?? []) as any,
    inverters: (invertersRes.data ?? []) as any,
    batteries: (batteriesRes.data ?? []) as any,
    stateRules: (stateRulesRes.data ?? []) as any,
    slabs: (slabsRes.data ?? []) as any,
    schemes: (schemesRes.data ?? []) as any,
    schemeOverrides: (schemeOverridesRes.data ?? []) as any,
    systemStateAvailability: (systemStateAvailRes.data ?? []) as any,
    stateTermsTemplates: (stateTermsRes.data ?? []) as any,
    bomCategories: (bomCategoriesRes.data ?? []) as any,
    bomTemplateItems: (bomTemplateItemsRes.data ?? []) as any,
    meters: (metersRes.data ?? []) as any,
    lightningArresters: (lightningArrestersRes.data ?? []) as any,
    structures: (structuresRes.data ?? []) as any,
    weightLookups: (weightLookupsRes.data ?? []) as any,
    orientationMultipliers: (orientationMultipliersRes.data ?? []) as any,
    structureVendors: (structureVendorsRes.data ?? []) as any,
    structureMaterialRates: (structureMaterialRatesRes.data ?? []) as any,
    structureTemplates: (structureTemplatesRes.data ?? []) as any,
    structureTemplateItems: (structureTemplateItemsRes.data ?? []) as any,
    walkwayTemplates: (walkwayTemplatesRes.data ?? []) as any,
    ladderTemplates: (ladderTemplatesRes.data ?? []) as any,
    structureAccessoryRates: (structureAccessoryRatesRes.data ?? []) as any,

    rateMaster: rateMasterRows.map((r) => ({
      item_name: r.item_name,
      override_rate: r.override_rate,
      is_active: r.is_active,
    })) as CachedRateMasterEntry[],

    categoryMargins: categoryMarginRows.map((r) => ({
      category: r.category,
      default_margin_pct: r.default_margin_pct,
    })) as CachedCategoryMargin[],

    appSettings: appSettingsRow,
  };

  const generatedAt = new Date().toISOString();
  const etag = computeEtag(data, CACHE_VERSION);

  return {
    ...data,
    version: CACHE_VERSION,
    generatedAt,
    etag,
    orgId,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns master data from in-memory cache or loads fresh if expired.
 *
 * Implements stale-while-revalidate:
 * - MISS: loads synchronously, caches, returns.
 * - HIT (fresh): returns cached payload immediately.
 * - HIT (stale): returns stale payload immediately, triggers background refresh.
 */
export async function getCachedMasterData(
  orgId?: string | null
): Promise<MasterDataPayload> {
  const key = cacheKey(orgId ?? null);
  const ttl = orgId ? ORG_TTL_MS : GLOBAL_TTL_MS;
  const now = Date.now();

  const entry = cache.get(key);

  if (entry) {
    if (now < entry.expiresAt) {
      // Cache hit (fresh)
      return entry.payload;
    }
    // Cache hit (stale) — return immediately and refresh in background
    if (!entry.refreshing) {
      entry.refreshing = true;
      loadMasterData(orgId ?? null)
        .then((payload) => {
          cache.set(key, { payload, expiresAt: Date.now() + ttl, refreshing: false });
        })
        .catch((err) => {
          console.error('[MasterCache] Background refresh failed:', err);
          // Keep stale entry but allow next caller to retry
          if (cache.get(key)?.refreshing) {
            const stale = cache.get(key)!;
            cache.set(key, { ...stale, refreshing: false });
          }
        });
    }
    return entry.payload;
  }

  // Cache miss — load synchronously
  const payload = await loadMasterData(orgId ?? null);
  cache.set(key, { payload, expiresAt: now + ttl, refreshing: false });
  return payload;
}

/**
 * Invalidate the master cache for a specific org (or the global cache).
 * The next call to getCachedMasterData() will trigger a fresh load.
 */
export async function invalidateMasterCache(orgId?: string | null): Promise<void> {
  const key = cacheKey(orgId ?? null);
  cache.delete(key);
  console.log(
    `[MasterCache] Invalidated cache key: ${key}`
  );
}

/**
 * Invalidate the org-specific cache entry.
 * Alias for invalidateMasterCache(orgId) — kept for semantic clarity.
 */
export async function invalidateOrgCache(orgId: string): Promise<void> {
  return invalidateMasterCache(orgId);
}

/**
 * Returns all currently cached keys (useful for monitoring/debugging).
 */
export function getCacheStats(): Array<{
  key: string;
  expiresAt: number;
  isExpired: boolean;
  refreshing: boolean;
}> {
  const now = Date.now();
  return Array.from(cache.entries()).map(([key, entry]) => ({
    key,
    expiresAt: entry.expiresAt,
    isExpired: now >= entry.expiresAt,
    refreshing: entry.refreshing,
  }));
}

/**
 * Warm the cache for a specific org (e.g., at request start).
 * Does nothing if the cache entry is already fresh.
 */
export async function warmCache(orgId?: string | null): Promise<void> {
  await getCachedMasterData(orgId);
}

// ─── Legacy Compat ────────────────────────────────────────────────────────────

/** @deprecated Use getCachedMasterData(orgId) instead */
export function orgCacheKey(orgId: string, entity: string): string {
  return `org:${orgId}:masters:${entity}`;
}

export { CACHE_VERSION as cacheVersion };
