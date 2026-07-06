'use server';
import { revalidatePath } from 'next/cache';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { normalizeGstRate } from '@/lib/utils/gst';
import { getBatteryGstRate, TAX_CONSTANTS } from '@/lib/tax-constants';
import {
  defaultSubcategoryForItem,
  normalizeFunctionalCategory,
  topCategoryFromFunctional,
} from '@/lib/presetTaxonomy';

export interface LineItem {
  id?: string;
  category: string;
  topCategory?: string;
  subcategory?: string;
  catalogItemId?: string;
  catalogType?: string;
  skuCode?: string;
  description: string;
  brand?: string;
  model?: string;
  specificationDetails?: string;
  unit: string;
  quantity: number;
  unitRate: number;
  gstPct?: number;
  isIncluded: boolean;
  isSurveyDependent: boolean;
  sortOrder: number;
}

export interface PresetStateOption {
  id: string;
  state_name: string;
  state_code: string;
}

export interface BomPresetSummary {
  id: string;
  name: string;
  description?: string | null;
  itemCount: number;
  updatedAt: string;
}

const CORE_PRESET_CATEGORIES = new Set(['panel', 'inverter', 'battery', 'structure']);
const BOM_PRESET_CATEGORIES = new Set([
  'dc_protection',
  'ac_protection',
  'cable',
  'earthing',
  'civil',
  'logistics',
  'accessory',
  'miscellaneous',
]);

function isPlaceholderEquipment(item: { brand?: string | null; model?: string | null; name?: string | null }) {
  const brand = String(item.brand ?? '').trim().toLowerCase();
  const model = String(item.model ?? '').trim().toLowerCase();
  const name = String(item.name ?? '').trim().toLowerCase();
  return (
    brand === 'unknown' ||
    model === 'unknown' ||
    name === 'unknown' ||
    (brand === 'unknown brand') ||
    (model === 'unknown model') ||
    (brand === '' && (model === '' || model === 'inverter')) ||
    model === 'inverter'
  );
}

const CATALOG_CATEGORY_ALIASES: Record<string, string[]> = {
  structure: ['Structure', 'Structures'],
  dc_protection: ['DC Protection', 'DC Side Protection', 'Electrical Protection'],
  ac_protection: ['AC Protection', 'AC Side Protection', 'Electrical Protection'],
  cable: ['Cables', 'Cables & Conduit', 'Cabling', 'Cable', 'Wiring'],
  earthing: ['Earthing', 'Earthings'],
  civil: ['Civil Works', 'Civil', 'Services'],
  logistics: ['Logistics', 'Logistics & Handling', 'Handling', 'Services'],
  accessory: ['Accessories', 'Accessory', 'Monitoring & Safety', 'Wiring', 'Mounting Structure'],
  miscellaneous: ['Miscellaneous', 'Miscellenous', 'Misc', 'Other'],
};

function normalizeCatalogName(value: string) {
  return value.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim();
}

function compactCatalogName(value: string) {
  return normalizeCatalogName(value).replace(/\s+/g, '');
}

function catalogSearchScore(searchTerm: string | undefined, parts: Array<string | number | null | undefined>) {
  const normalizedSearch = normalizeCatalogName(searchTerm || '');
  if (!normalizedSearch) return 1;

  const haystack = normalizeCatalogName(parts.filter((part) => part !== null && part !== undefined).join(' '));
  const compactHaystack = compactCatalogName(haystack);
  const compactSearch = compactCatalogName(normalizedSearch);
  const tokens = normalizedSearch.split(/\s+/).filter(Boolean);

  if (!haystack) return 0;
  if (haystack === normalizedSearch || compactHaystack === compactSearch) return 100;
  if (haystack.startsWith(normalizedSearch) || compactHaystack.startsWith(compactSearch)) return 80;
  if (haystack.includes(normalizedSearch) || compactHaystack.includes(compactSearch)) return 60;

  const matchedTokens = tokens.filter((token) => haystack.includes(token) || compactHaystack.includes(token));
  if (matchedTokens.length === tokens.length) return 40 + matchedTokens.length;
  if (tokens.length > 1 && matchedTokens.length >= Math.ceil(tokens.length * 0.65)) return 20 + matchedTokens.length;
  if (tokens.length === 1 && matchedTokens.length === 1) return 20;

  return 0;
}

function canonicalPresetCategory(category: string | null | undefined) {
  if (String(category ?? '').trim().toLowerCase() === 'all') return 'all';
  return normalizeFunctionalCategory(category);
}

function inferCatalogCategoryFromText(...parts: Array<string | null | undefined>) {
  const value = normalizeCatalogName(parts.filter(Boolean).join(' '));

  if (/\b(panel|module|pv module)\b/.test(value)) return 'panel';
  if (/\b(inverter|mppt)\b/.test(value)) return 'inverter';
  if (/\b(battery|bms|lfp|lithium)\b/.test(value)) return 'battery';
  if (/\b(walkway|walk way|ladder|u clamp|end clamp|clamp|block|chemical|wiring pipe|pvc elbow|pvc tee|pipe accessories|cable tie|flexible pipe|flexible hose|green sleeve|pvc channel|fisher|screw)\b/.test(value)) return 'accessory';
  if (/\b(earthing|earth|electrode|rod|strip|chemical earth|earth compound|chamber box|earth bench|lug|holder nylon|l a|lightning arrester|lightning protection)\b/.test(value)) return 'earthing';
  if (/\b(dcdb|dc protection|dc side|dc spd|dc mcb|dc isolator|combiner|string box)\b/.test(value)) return 'dc_protection';
  if (/\b(acdb|ac protection|ac side|ac spd|ac mcb|ac isolator)\b/.test(value)) return 'ac_protection';
  if (/\b(cable|cabling|wire|wiring|conduit|tray|alum cable|dc cable|ac cable)\b/.test(value)) return 'cable';
  if (/\b(civil|cement|sand|aggregate|brick|anchor|rmc|concrete|installation|commission|site visit)\b/.test(value)) return 'civil';
  if (/\b(logistic|transport|handling|packing|loading|unloading)\b/.test(value)) return 'logistics';
  if (/\b(accessory|meter|meter box|connector|mc4|communication|monitoring|dtu|dongle|logger)\b/.test(value)) return 'accessory';

  return 'miscellaneous';
}

function categoryNameMatches(category: string, name: string | null | undefined) {
  const aliases = CATALOG_CATEGORY_ALIASES[category] ?? [];
  const normalizedName = normalizeCatalogName(name ?? '');
  return aliases.map(normalizeCatalogName).includes(normalizedName);
}

function hasKnownCategoryName(name: string | null | undefined) {
  const normalizedName = normalizeCatalogName(name ?? '');
  return Object.entries(CATALOG_CATEGORY_ALIASES)
    .filter(([category]) => category !== 'miscellaneous')
    .some(([, aliases]) => aliases.map(normalizeCatalogName).includes(normalizedName));
}

function categoryFromBomItem(item: {
  sku_code?: string | null;
  description?: string | null;
  notes?: string | null;
  specification_details?: string | null;
  bom_categories?: { name?: string | null; top_category?: string | null; subcategory_name?: string | null } | null;
}, fallback: string) {
  if (item.bom_categories?.top_category === 'structure') return 'structure';
  if (item.bom_categories?.top_category === 'miscellaneous') return 'miscellaneous';
  const inferred = inferCatalogCategoryFromText(
    item.sku_code,
    item.description,
    item.notes,
    item.specification_details,
  );
  if (inferred !== 'miscellaneous') return inferred;
  return categoryFromCatalogName(item.bom_categories?.name, fallback);
}

function defaultQtyFromFormula(qtyFormula: string | null | undefined) {
  const value = String(qtyFormula ?? '').trim();
  if (!value || !/^\d+(\.\d+)?$/.test(value)) return 1;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 1;
}

function normalizeMarginPct(value: unknown, fallback = 0.2): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return fallback;
  return num > 1 ? num / 100 : num;
}

function normalizeSystemType(value: string | null | undefined) {
  const normalized = String(value ?? 'on_grid').replace(/-/g, '_');
  const valid = new Set(['on_grid', '3_phase', 'micro_inverter', 'hybrid', 'upgrade', 'commercial']);
  return valid.has(normalized) ? normalized : 'on_grid';
}

function categoryFromCatalogName(name: string | null | undefined, fallback: string) {
  const normalizedName = normalizeCatalogName(name ?? '');
  const normalizedFallback = canonicalPresetCategory(fallback);
  const fallbackAliases = CATALOG_CATEGORY_ALIASES[normalizedFallback] ?? [];
  if (fallbackAliases.map(normalizeCatalogName).includes(normalizedName)) {
    return normalizedFallback;
  }

  for (const [category, aliases] of Object.entries(CATALOG_CATEGORY_ALIASES)) {
    if (aliases.map(normalizeCatalogName).includes(normalizedName)) {
      return category;
    }
  }
  return normalizedFallback;
}

async function getAuthenticatedOrgContext() {
  const authClient = await createClient();
  const supabase = createAdminClient();
  const { data: { user } } = await authClient.auth.getUser();

  if (!user?.id) throw new Error('Unauthorized. Please sign in again.');

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('org_id')
    .eq('id', user.id)
    .maybeSingle();

  if (error) throw mapDatabaseError(error, 'Failed to resolve organisation context');
  const orgId = profile?.org_id ?? null;
  if (!orgId) throw new Error('Organisation context not found. Please reload and try again.');

  return { supabase, userId: user.id, orgId };
}

export async function getPresetStates(): Promise<PresetStateOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('state_rules')
    .select('id, state_name, state_code')
    .eq('is_active', true)
    .order('state_name', { ascending: true });

  if (error) throw new Error('Failed to fetch states: ' + error.message);
  return (data || []) as PresetStateOption[];
}

export async function getPresetWithComponents(presetId: string) {
  if (presetId.startsWith('custom_')) {
    throw new Error('Cannot fetch local custom presets from the database.');
  }

  const supabase = await createClient();

  // 1. Fetch system details from systems table
  const { data: preset, error: presetError } = await supabase
    .from('systems' as any)
    .select('*')
    .eq('id', presetId)
    .maybeSingle();

  if (presetError) {
    console.error('Supabase Error fetching system:', presetError);
    return null;
  }
  const presetData = preset as any;
  if (!presetData) {
    console.warn('System not found in systems table:', presetId);
    return null;
  }

  // 2. Fetch all system items for this system
  const { data: lineItemsData, error: itemsError } = await supabase
    .from('system_items' as any)
    .select('*')
    .eq('system_id', presetId);

  if (itemsError) {
    console.error('Supabase Error fetching system items:', itemsError);
    return null;
  }

  // 3. Fetch pricing masters for rate lookups
  const [
    panelsRes, invertersRes, batteriesRes, metersRes, laRes,
    structuresRes, bomItemsRes, commDevicesRes, componentMasterRes
  ] = await Promise.all([
    supabase.from('eq_panels').select('id, brand, model, selling_price, gst_pct, description, specification_details').eq('is_active', true),
    supabase.from('eq_inverters').select('id, brand, model, selling_price, gst_pct, description, specification_details').eq('is_active', true),
    supabase.from('eq_batteries').select('id, brand, model, selling_price, gst_pct, description, specification_details').eq('is_active', true),
    supabase.from('eq_meters').select('id, brand, model, selling_price, gst_pct, description, specification_details'),
    supabase.from('eq_lightning_arresters').select('id, brand, model, selling_price, gst_pct, description, specification_details'),
    supabase.from('eq_mounting_structures').select('id, name, material, roof_mount_type, selling_price, gst_pct, description, specification_details'),
    supabase.from('bom_template_items' as any).select('id, description, specification_details, notes, default_rate, gst_pct, category_id, bom_categories(name, top_category, subcategory_name)'),
    supabase.from('eq_communication_devices').select('id, brand, model, selling_price, gst_pct, description, specification_details'),
    supabase.from('structure_component_master').select('id, name, selling_price, gst_pct, specification_details'),
  ]);

  const panels = (panelsRes.data || []).filter((item: any) => !isPlaceholderEquipment(item));
  const inverters = (invertersRes.data || []).filter((item: any) => !isPlaceholderEquipment(item));
  const batteries = (batteriesRes.data || []).filter((item: any) => !isPlaceholderEquipment(item));
  const meters = metersRes.data || [];
  const las = laRes.data || [];
  const structures = structuresRes.data || [];
  const bomItems = ((bomItemsRes as any).data || []) as any[];
  const commDevices = commDevicesRes.data || [];
  const structureComponents = componentMasterRes.data || [];

  // Helper function to resolve rate and category details
  const mappedItems = (lineItemsData || []).map((item: any) => {
    let category = 'miscellaneous';
    let catalogItemId: string | null = null;
    let catalogType = 'custom';
    let unitRate = 0;
    let brand = '';
    let model = '';
    let sourceSpecification = '';
    let gstPct: number = TAX_CONSTANTS.BOS_GST_RATE;

    // Map based on section
    if (item.section === 'solar_panels') category = 'panel';
    else if (item.section === 'power_electronics') category = item.battery_id ? 'battery' : 'inverter';
    else if (item.section === 'mounting_structure') category = 'structure';
    else if (item.section === 'electrical_protection') category = 'dc_protection';
    else if (item.section === 'cabling') category = 'cable';
    else if (item.section === 'earthing') category = 'earthing';
    else if (item.section === 'services') category = 'civil';
    else if (item.section === 'wiring') category = 'accessory';

    if (item.panel_id) {
      category = 'panel';
      catalogItemId = item.panel_id;
      catalogType = 'equipment';
      const p = panels.find((x: any) => x.id === item.panel_id);
      if (p) {
        brand = p.brand || '';
        model = p.model || '';
        unitRate = Number(p.selling_price || 0);
        sourceSpecification = p.specification_details || p.description || '';
        gstPct = normalizeGstRate(p.gst_pct, TAX_CONSTANTS.PANEL_GST_RATE);
      }
    } else if (item.inverter_id) {
      category = 'inverter';
      catalogItemId = item.inverter_id;
      catalogType = 'equipment';
      const inv = inverters.find((x: any) => x.id === item.inverter_id);
      if (inv) {
        brand = inv.brand || '';

        model = inv.model || '';
        unitRate = Number(inv.selling_price || 0);
        sourceSpecification = inv.specification_details || inv.description || '';
        gstPct = normalizeGstRate(inv.gst_pct, TAX_CONSTANTS.INVERTER_GST_RATE);
      }
    } else if (item.battery_id) {
      category = 'battery';
      catalogItemId = item.battery_id;
      catalogType = 'equipment';
      const bat = batteries.find((x: any) => x.id === item.battery_id);
      if (bat) {
        brand = bat.brand || '';
        model = bat.model || '';
        unitRate = Number(bat.selling_price || 0);
        sourceSpecification = bat.specification_details || bat.description || '';
        gstPct = normalizeGstRate(bat.gst_pct, getBatteryGstRate(bat));
      }
    } else if (item.structure_id) {
      category = 'structure';
      catalogItemId = item.structure_id;
      catalogType = 'eq_structure';
      const str = structures.find((x: any) => x.id === item.structure_id);
      if (str) {
        brand = str.material || '';
        model = str.roof_mount_type || '';
        unitRate = Number(str.selling_price || 0);
        sourceSpecification = str.specification_details || str.description || '';
        gstPct = normalizeGstRate(str.gst_pct, 0.18);
      }
    } else if (item.solar_meter_id || item.net_meter_id) {
      category = 'accessory';
      catalogItemId = item.solar_meter_id || item.net_meter_id;
      catalogType = 'equipment';
      const met = meters.find((x: any) => x.id === catalogItemId);
      if (met) {
        brand = met.brand || '';
        model = met.model || '';
        unitRate = Number(met.selling_price || 0);
        sourceSpecification = met.specification_details || met.description || '';
        gstPct = normalizeGstRate(met.gst_pct, 0.18);
      }
    } else if (item.la_id) {
      category = 'dc_protection';
      catalogItemId = item.la_id;
      catalogType = 'equipment';
      const la = las.find((x: any) => x.id === item.la_id);
      if (la) {
        brand = la.brand || '';
        model = la.model || '';
        unitRate = Number(la.selling_price || 0);
        sourceSpecification = la.specification_details || la.description || '';
        gstPct = normalizeGstRate(la.gst_pct, 0.18);
      }
    } else if (item.bom_item_id) {
      catalogItemId = item.bom_item_id;
      catalogType = 'bom_template';
      const bom = bomItems.find((x: any) => x.id === item.bom_item_id);
      if (bom) {
        unitRate = Number(bom.default_rate || 0);
        category = categoryFromBomItem(bom, category);
        sourceSpecification = bom.specification_details || bom.notes || '';
        gstPct = normalizeGstRate(bom.gst_pct, 0.18);
      }
    } else if (item.comm_device_id) {
      category = 'accessory';
      catalogItemId = item.comm_device_id;
      catalogType = 'equipment';
      const comm = commDevices.find((x: any) => x.id === item.comm_device_id);
      if (comm) {
        brand = comm.brand || '';
        model = comm.model || '';
        unitRate = Number(comm.selling_price || 0);
        sourceSpecification = comm.specification_details || comm.description || '';
        gstPct = normalizeGstRate(comm.gst_pct, 0.18);
      }
    } else if (item.structure_component_id) {
      category = 'structure';
      catalogItemId = item.structure_component_id;
      catalogType = 'structure_component';
      const comp = structureComponents.find((x: any) => x.id === item.structure_component_id);
      if (comp) {
        brand = comp.name || '';
        unitRate = Number(comp.selling_price || 0);
        sourceSpecification = comp.specification_details || '';
        gstPct = normalizeGstRate(comp.gst_pct, 0.18);
      }
    }

    return {
      id: item.id,
      category,
      topCategory: topCategoryFromFunctional(category),
      subcategory: defaultSubcategoryForItem({
        category,
        brand,
        model,
        categoryName: (item.bom_item_id ? bomItems.find((x: any) => x.id === item.bom_item_id)?.bom_categories?.subcategory_name : null)
          || (item.bom_item_id ? bomItems.find((x: any) => x.id === item.bom_item_id)?.bom_categories?.name : null)
          || undefined,
      }),
      catalogItemId,
      catalogType,
      skuCode: item.sku_code || '',
      description: item.description,
      brand,
      model,
      specificationDetails: item.remarks || sourceSpecification,
      unit: item.unit || 'Nos',
      quantity: Number(item.default_qty || 0),
      unitRate,
      gstPct,
      isIncluded: item.is_included_by_default ?? true,
      isSurveyDependent: false,
      sortOrder: item.sort_order || 0,
    };
  });

  return {
    id: presetData.id,
    name: presetData.name,
    system_type: presetData.category ?? 'on_grid',
    capacity_kw: Number(presetData.capacity_kw || 0),
    state_id: presetData.state_id ?? null,
    lineItems: mappedItems.sort((a, b) => a.sortOrder - b.sortOrder)
  };
}

function mapDatabaseError(error: any, fallbackMessage: string, duplicateEntity: 'preset' | 'category' | 'item' = 'preset'): Error {
  if (!error) return new Error(fallbackMessage);
  const msg = (error.message || '').toLowerCase();
  const code = error.code || '';
  if (code === '23505' || msg.includes('duplicate key value')) {
    const duplicateMessages = {
      preset: 'a preset with this name already exists.',
      category: 'a category with this name already exists.',
      item: 'an item with this identifier already exists.',
    };
    return new Error(`${fallbackMessage}: ${duplicateMessages[duplicateEntity]}`);
  }
  if (msg.includes('row-level security') || msg.includes('violates row-level security policy') || code === '42501') {
    if (msg.includes('system_state_availability')) {
      return new Error('You do not have permission to assign this preset to the selected state. Please contact your administrator.');
    }
    if (msg.includes('systems') || msg.includes('system_items')) {
      return new Error('You do not have permission to modify system presets. Please contact your administrator.');
    }
    return new Error('Access Denied: You do not have the required permissions to perform this action.');
  }
  return new Error(`${fallbackMessage}: ${error.message}`);
}

function toBomPresetCategory(category: string) {
  const normalized = canonicalPresetCategory(category);
  if (normalized === 'other') return 'miscellaneous';
  return BOM_PRESET_CATEGORIES.has(normalized) ? normalized : null;
}

function prepareBomPresetLineItems(lineItems: LineItem[]) {
  return lineItems.map((item, index) => {
    const category = toBomPresetCategory(item.category);
    if (!category || CORE_PRESET_CATEGORIES.has(canonicalPresetCategory(item.category))) {
      throw new Error(`"${item.description || 'Item'}" is a core component. BOM presets can only contain non-core BOM items.`);
    }
    if (!item.description?.trim()) {
      throw new Error(`BOM preset item ${index + 1} needs a description.`);
    }
    const quantity = Number(item.quantity ?? 0);
    const unitRate = Number(item.unitRate ?? 0);
    if (!Number.isFinite(quantity) || quantity < 0) {
      throw new Error(`BOM preset item "${item.description}" has an invalid quantity.`);
    }
    if (!Number.isFinite(unitRate) || unitRate < 0) {
      throw new Error(`BOM preset item "${item.description}" has an invalid rate.`);
    }

    return {
      category,
      top_category: item.topCategory || topCategoryFromFunctional(category),
      subcategory: item.subcategory || defaultSubcategoryForItem({
        topCategory: item.topCategory,
        category,
        brand: item.brand,
        model: item.model,
      }),
      catalog_item_id: item.catalogItemId || null,
      catalog_type: item.catalogType || 'custom',
      sku_code: item.skuCode || null,
      description: item.description.trim(),
      brand: item.brand || null,
      model: item.model || null,
      specification_details: item.specificationDetails || null,
      unit: item.unit || 'Nos',
      quantity,
      unit_rate: unitRate,
      gst_pct: item.gstPct == null ? null : normalizeGstRate(item.gstPct, 0.18),
      is_included: item.isIncluded,
      is_survey_dependent: item.isSurveyDependent,
      sort_order: index + 1,
    };
  });
}

async function validateBomPresetCatalogReferences(supabase: ReturnType<typeof createAdminClient>, lineItems: LineItem[]) {
  const seenCatalogItems = new Map<string, string>();
  for (const item of lineItems) {
    if (!item.catalogItemId || item.catalogType === 'custom') continue;
    const itemCategory = canonicalPresetCategory(item.category);
    const description = item.description || item.skuCode || item.catalogItemId;
    const duplicateKey = `${itemCategory}:${item.catalogType}:${item.catalogItemId}`;
    const firstDescription = seenCatalogItems.get(duplicateKey);
    if (firstDescription) {
      throw new Error(`BOM preset contains duplicate catalog item "${description}" already added as "${firstDescription}". Remove one entry or adjust its quantity.`);
    }
    seenCatalogItems.set(duplicateKey, description);
  }

  const bomIds = new Set<string>();
  const equipmentIds = new Map<string, string>();

  for (const item of lineItems) {
    if (!item.catalogItemId || item.catalogType === 'custom') continue;
    const category = canonicalPresetCategory(item.category);
    if (CORE_PRESET_CATEGORIES.has(category)) {
      throw new Error(`"${item.description || 'Item'}" is a core component. Use the core component section instead.`);
    }
    if (item.catalogType === 'bom_template') {
      bomIds.add(item.catalogItemId);
      continue;
    }
    if (item.catalogType === 'equipment') {
      equipmentIds.set(item.catalogItemId, `${category}:${item.description || item.catalogItemId}`);
      continue;
    }
    throw new Error(`Unsupported BOM preset catalog source for "${item.description || item.catalogItemId}".`);
  }

  if (bomIds.size > 0) {
    const ids = Array.from(bomIds);
    const { data, error } = await (supabase as any)
      .from('bom_template_items')
      .select('id, is_active')
      .in('id', ids);
    if (error) throw mapDatabaseError(error, 'Failed to validate BOM item references');
    const activeIds = new Set(((data || []) as any[]).filter((row) => row.is_active !== false).map((row) => row.id));
    const missing = ids.filter((id) => !activeIds.has(id));
    if (missing.length > 0) {
      throw new Error('BOM preset contains inactive or missing BOM item references. Please reselect those items.');
    }
  }

  if (equipmentIds.size > 0) {
    const ids = Array.from(equipmentIds.keys());
    const [metersRes, commRes, laRes] = await Promise.all([
      (supabase as any).from('eq_meters').select('id, is_active').in('id', ids),
      (supabase as any).from('eq_communication_devices').select('id, is_active').in('id', ids),
      (supabase as any).from('eq_lightning_arresters').select('id, is_active').in('id', ids),
    ]);
    for (const result of [metersRes, commRes, laRes]) {
      if (result.error) throw mapDatabaseError(result.error, 'Failed to validate equipment references');
    }
    const activeIds = new Set(
      [...(metersRes.data || []), ...(commRes.data || []), ...(laRes.data || [])]
        .filter((row: any) => row.is_active !== false)
        .map((row: any) => row.id),
    );
    const missing = ids.filter((id) => !activeIds.has(id));
    if (missing.length > 0) {
      throw new Error('BOM preset contains inactive or missing equipment references. Please reselect those items.');
    }
  }
}

export async function listBomPresets(): Promise<BomPresetSummary[]> {
  const { supabase, orgId } = await getAuthenticatedOrgContext();
  const { data: presets, error } = await (supabase as any)
    .from('bom_presets')
    .select('id, name, description, updated_at')
    .eq('org_id', orgId)
    .eq('is_active', true)
    .order('updated_at', { ascending: false });

  if (error) throw mapDatabaseError(error, 'Failed to load BOM presets');
  const rows = (presets || []) as any[];
  if (rows.length === 0) return [];

  const ids = rows.map((row) => row.id);
  const { data: items, error: itemsError } = await (supabase as any)
    .from('bom_preset_items')
    .select('bom_preset_id')
    .in('bom_preset_id', ids);
  if (itemsError) throw mapDatabaseError(itemsError, 'Failed to load BOM preset item counts');

  const counts = new Map<string, number>();
  for (const item of (items || []) as any[]) {
    counts.set(item.bom_preset_id, (counts.get(item.bom_preset_id) ?? 0) + 1);
  }

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    itemCount: counts.get(row.id) ?? 0,
    updatedAt: row.updated_at,
  }));
}

export async function getBomPresetWithItems(bomPresetId: string): Promise<{ id: string; name: string; description?: string | null; lineItems: LineItem[] }> {
  const { supabase, orgId } = await getAuthenticatedOrgContext();
  const { data: preset, error: presetError } = await (supabase as any)
    .from('bom_presets')
    .select('id, name, description, org_id')
    .eq('id', bomPresetId)
    .eq('org_id', orgId)
    .eq('is_active', true)
    .maybeSingle();
  if (presetError) throw mapDatabaseError(presetError, 'Failed to load BOM preset');
  if (!preset) throw new Error('BOM preset not found.');

  const { data: items, error: itemsError } = await (supabase as any)
    .from('bom_preset_items')
    .select('*')
    .eq('bom_preset_id', bomPresetId)
    .order('sort_order', { ascending: true });
  if (itemsError) throw mapDatabaseError(itemsError, 'Failed to load BOM preset items');

  return {
    id: preset.id,
    name: preset.name,
    description: preset.description,
    lineItems: ((items || []) as any[]).map((item, index) => ({
      id: `bom_preset_${bomPresetId}_${item.id ?? index}`,
      category: item.category,
      topCategory: item.top_category ?? topCategoryFromFunctional(item.category),
      subcategory: item.subcategory || defaultSubcategoryForItem({
        topCategory: item.top_category,
        category: item.category,
        brand: item.brand,
        model: item.model,
      }),
      catalogItemId: item.catalog_item_id ?? undefined,
      catalogType: item.catalog_type ?? 'custom',
      skuCode: item.sku_code ?? '',
      description: item.description,
      brand: item.brand ?? '',
      model: item.model ?? '',
      specificationDetails: item.specification_details ?? '',
      unit: item.unit || 'Nos',
      quantity: Number(item.quantity ?? 0),
      unitRate: Number(item.unit_rate ?? 0),
      gstPct: item.gst_pct == null ? undefined : normalizeGstRate(item.gst_pct, 0.18),
      isIncluded: item.is_included ?? true,
      isSurveyDependent: item.is_survey_dependent ?? false,
      sortOrder: index,
    })),
  };
}

export async function saveBomPresetWithItems(updates: {
  presetId?: string | null;
  name: string;
  description?: string;
  lineItems: LineItem[];
}): Promise<string> {
  const { supabase, userId, orgId } = await getAuthenticatedOrgContext();
  const name = updates.name.trim();
  if (!name) throw new Error('Enter a BOM preset name before saving.');
  if (!updates.lineItems.length) throw new Error('Add at least one BOM item before saving a BOM preset.');

  await validateBomPresetCatalogReferences(supabase, updates.lineItems);
  const preparedItems = prepareBomPresetLineItems(updates.lineItems);

  const { data, error } = await (supabase as any).rpc('save_bom_preset_atomic', {
    p_bom_preset_id: updates.presetId || null,
    p_org_id: orgId,
    p_name: name,
    p_description: updates.description || null,
    p_items: preparedItems,
    p_user_id: userId,
  });

  if (error) throw mapDatabaseError(error, 'Failed to save BOM preset');

  revalidatePath('/systems');
  revalidatePath('/settings/presets');
  return String(data);
}

export async function deleteBomPreset(bomPresetId: string): Promise<void> {
  const { supabase, orgId } = await getAuthenticatedOrgContext();
  if (!bomPresetId) throw new Error('Select a BOM preset before deleting.');

  const { data: preset, error: presetError } = await (supabase as any)
    .from('bom_presets')
    .select('id, org_id')
    .eq('id', bomPresetId)
    .eq('org_id', orgId)
    .eq('is_active', true)
    .maybeSingle();
  if (presetError) throw mapDatabaseError(presetError, 'Failed to load BOM preset');
  if (!preset) throw new Error('BOM preset not found.');

  const { error } = await (supabase as any)
    .from('bom_presets')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', bomPresetId)
    .eq('org_id', orgId);
  if (error) throw mapDatabaseError(error, 'Failed to delete BOM preset');

  revalidatePath('/systems');
  revalidatePath('/settings/presets');
}

export async function savePresetWithComponents(
  presetId: string,
  updates: {
    name: string;
    systemType: string;
    capacityKw: number;
    stateId?: string | null;
    notes?: string;
    lineItems: LineItem[];
  }
) {
  const authClient = await createClient();
  const supabase = createAdminClient();
  let targetPresetId = presetId;
  const { data: { user } } = await authClient.auth.getUser();
  let orgId: string | null = null;
  if (user?.id) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('org_id')
      .eq('id', user.id)
      .maybeSingle();
    orgId = profile?.org_id ?? null;
  }

  if (!user?.id) throw new Error('Unauthorized. Please sign in again before saving presets.');
  if (!orgId) throw new Error('Organisation context not found. Please reload and try again.');

  const systemType = normalizeSystemType(updates.systemType);
  if (!updates.stateId) {
    throw new Error('Please select a state before saving this preset.');
  }

  async function validateCatalogReferences(lineItems: LineItem[]) {
    const checks = new Map<string, Map<string, string[]>>();
    const seenCatalogItems = new Map<string, string>();
    const addCheck = (table: string, id: string, description: string) => {
      if (!checks.has(table)) checks.set(table, new Map());
      const entries = checks.get(table)!;
      entries.set(id, [...(entries.get(id) ?? []), description]);
    };

    for (const item of lineItems) {
      if (!item.catalogItemId || item.catalogType === 'custom') continue;
      const itemCategory = canonicalPresetCategory(item.category);
      const description = item.description || item.skuCode || item.catalogItemId;
      const text = `${item.description ?? ''} ${item.brand ?? ''} ${item.model ?? ''}`.toLowerCase();
      const duplicateKey = `${itemCategory}:${item.catalogType}:${item.catalogItemId}`;
      const firstDescription = seenCatalogItems.get(duplicateKey);
      if (firstDescription) {
        throw new Error(`Preset contains duplicate catalog item "${description}" already added as "${firstDescription}". Remove one entry or adjust its quantity.`);
      }
      seenCatalogItems.set(duplicateKey, description);

      if (itemCategory === 'panel') addCheck('eq_panels', item.catalogItemId, description);
      else if (itemCategory === 'inverter') addCheck('eq_inverters', item.catalogItemId, description);
      else if (itemCategory === 'battery') addCheck('eq_batteries', item.catalogItemId, description);
      else if (itemCategory === 'structure' && item.catalogType === 'eq_structure') addCheck('eq_mounting_structures', item.catalogItemId, description);
      else if (itemCategory === 'structure' && item.catalogType === 'structure_component') addCheck('structure_component_master', item.catalogItemId, description);
      else if (item.catalogType === 'bom_template') addCheck('bom_template_items', item.catalogItemId, description);
      else if (
        (itemCategory === 'dc_protection' || itemCategory === 'ac_protection' || itemCategory === 'earthing') &&
        item.catalogType === 'equipment' &&
        (text.includes('lightning') || text.includes('l/a') || text.includes('l-a'))
      ) addCheck('eq_lightning_arresters', item.catalogItemId, description);
      else if (itemCategory === 'accessory' && item.catalogType === 'equipment' && (text.includes('solar') || text.includes('net'))) addCheck('eq_meters', item.catalogItemId, description);
      else if (itemCategory === 'accessory' && item.catalogType === 'equipment' && (text.includes('comm') || text.includes('dtu') || text.includes('dongle') || text.includes('logger'))) addCheck('eq_communication_devices', item.catalogItemId, description);
    }

    const selectByTable: Record<string, string> = {
      eq_panels: 'id, brand, model, is_active',
      eq_inverters: 'id, brand, model, is_active',
      eq_batteries: 'id, brand, model, is_active',
      eq_mounting_structures: 'id, name, is_active',
      eq_lightning_arresters: 'id, brand, model, is_active',
      eq_meters: 'id, brand, model, is_active',
      eq_communication_devices: 'id, brand, model, is_active',
      structure_component_master: 'id, name',
      bom_template_items: 'id, sku_code, description, is_active',
    };
    const labelByTable: Record<string, string> = {
      eq_panels: 'panel',
      eq_inverters: 'inverter',
      eq_batteries: 'battery',
      eq_mounting_structures: 'mounting structure',
      eq_lightning_arresters: 'lightning arrester',
      eq_meters: 'meter',
      eq_communication_devices: 'communication device',
      structure_component_master: 'structure component',
      bom_template_items: 'BOM item',
    };

    for (const [table, entries] of checks.entries()) {
      const ids = Array.from(entries.keys());
      if (ids.length === 0) continue;
      const { data, error } = await supabase
        .from(table as any)
        .select(selectByTable[table] ?? 'id')
        .in('id', ids);
      if (error) throw mapDatabaseError(error, `Failed to validate ${labelByTable[table] ?? table} references`);

      const rows = (data || []) as any[];
      const foundIds = new Set(rows.map((row: any) => row.id));
      const missing = ids.filter((id) => !foundIds.has(id));
      if (missing.length > 0) {
        const names = missing.flatMap((id) => entries.get(id) ?? []).slice(0, 3).join(', ');
        throw new Error(`Preset contains missing ${labelByTable[table] ?? table} reference(s): ${names}. Please reselect from the catalog.`);
      }

      if (table === 'eq_inverters') {
        const invalidInverters = rows.filter((row: any) => row.is_active === false || isPlaceholderEquipment(row));
        if (invalidInverters.length > 0) {
          throw new Error('Preset contains an inactive or placeholder inverter. Please select a real inverter from masters.');
        }
      }
    }
  }

  await validateCatalogReferences(updates.lineItems);

  if (targetPresetId) {
    const { data: existingPreset, error: existingErr } = await supabase
      .from('systems' as any)
      .select('id, org_id, target_margin_pct')
      .eq('id', targetPresetId)
      .maybeSingle();

    if (existingErr) throw mapDatabaseError(existingErr, 'Failed to check existing preset');
    if (!existingPreset) throw new Error('Preset not found in system presets.');
    if ((existingPreset as any).org_id && (existingPreset as any).org_id !== orgId) {
      throw new Error('You can only modify presets that belong to your organisation.');
    }

    const shouldForkGlobalPreset = (existingPreset as any).org_id === null && orgId !== null;

    if (shouldForkGlobalPreset) {
      const { data: newPreset, error: presetErr } = await supabase
        .from('systems' as any)
        .insert({
          org_id: orgId,
          name: updates.name,
          category: systemType,
          capacity_kw: Number(updates.capacityKw) || 0,
          state_id: updates.stateId,
          target_margin_pct: normalizeMarginPct((existingPreset as any).target_margin_pct),
          is_active: true,
          is_custom: true,
        })
        .select('id')
        .maybeSingle();

      if (presetErr) throw mapDatabaseError(presetErr, 'Failed to create organisation preset');
      targetPresetId = (newPreset as any)?.id;
    } else {
      const { error: presetErr } = await supabase
        .from('systems' as any)
        .update({
          name: updates.name,
          category: systemType,
          capacity_kw: Number(updates.capacityKw) || 0,
          state_id: updates.stateId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', targetPresetId);

      if (presetErr) throw mapDatabaseError(presetErr, 'Failed to update system metadata');

    }
  } else {
    const { data: newPreset, error: presetErr } = await supabase
      .from('systems' as any)
      .insert({
        org_id: orgId,
        name: updates.name,
        category: systemType,
        capacity_kw: Number(updates.capacityKw) || 0,
        state_id: updates.stateId,
        target_margin_pct: 0.2,
        is_active: true,
        is_custom: true,
      })
      .select('id')
      .maybeSingle();

    if (presetErr) throw mapDatabaseError(presetErr, 'Failed to create system preset');
    targetPresetId = (newPreset as any)?.id;
  }

  if (!targetPresetId) throw new Error('Failed to determine preset ID.');

  // Helper function to map category to section
  function mapCategoryToSection(category: string): string {
    switch (category) {
      case 'panel': return 'solar_panels';
      case 'inverter': return 'power_electronics';
      case 'battery': return 'power_electronics';
      case 'structure': return 'mounting_structure';
      case 'dc_protection':
      case 'ac_protection': return 'electrical_protection';
      case 'cable': return 'cabling';
      case 'earthing': return 'earthing';
      case 'civil':
      case 'logistics': return 'services';
      case 'accessory': return 'wiring';
      case 'miscellaneous':
      case 'other': return 'services';
      default: return 'services';
    }
  }

  const resolvedCategoryIds = new Map<string, string>();
  async function ensureBomCategoryId(category: string, subcategory?: string, topCategory?: string) {
    const normalizedCategory = canonicalPresetCategory(category);
    const resolvedTopCategory = topCategory || topCategoryFromFunctional(normalizedCategory);
    const resolvedSubcategory = subcategory || defaultSubcategoryForItem({ topCategory: resolvedTopCategory, category: normalizedCategory });
    const cacheKey = `${resolvedTopCategory}:${resolvedSubcategory}:${normalizedCategory}`;
    if (resolvedCategoryIds.has(cacheKey)) {
      return resolvedCategoryIds.get(cacheKey)!;
    }
    const aliases = CATALOG_CATEGORY_ALIASES[normalizedCategory] ?? [normalizedCategory];
    const aliasSet = new Set(aliases.map(normalizeCatalogName));

    const { data: categories, error: categoryLoadErr } = await supabase
      .from('bom_categories' as any)
      .select('id, name, display_order, top_category, subcategory_name')
      .order('display_order', { ascending: true });

    if (categoryLoadErr) throw mapDatabaseError(categoryLoadErr, 'Failed to load BOM categories');

    const existing = ((categories || []) as any[]).find((item: any) => {
      const itemTop = String(item.top_category || topCategoryFromFunctional(normalizedCategory));
      const itemSubcategory = String(item.subcategory_name || item.name || '');
      return (
        normalizeCatalogName(itemTop) === normalizeCatalogName(resolvedTopCategory) &&
        normalizeCatalogName(itemSubcategory) === normalizeCatalogName(resolvedSubcategory)
      ) || aliasSet.has(normalizeCatalogName(item.name || ''));
    });
    if (existing?.id) {
      resolvedCategoryIds.set(cacheKey, existing.id as string);
      return existing.id as string;
    }

    const displayOrder = Object.keys(CATALOG_CATEGORY_ALIASES).indexOf(normalizedCategory) + 1 || 99;
    const { data: newCategory, error: categoryCreateErr } = await supabase
      .from('bom_categories' as any)
      .insert({
        org_id: orgId,
        name: resolvedSubcategory,
        top_category: resolvedTopCategory,
        subcategory_name: resolvedSubcategory,
        display_order: displayOrder,
        is_optional: ['civil', 'logistics', 'accessory', 'miscellaneous'].includes(normalizedCategory),
      })
      .select('id')
      .maybeSingle();

    if (categoryCreateErr) throw mapDatabaseError(categoryCreateErr, 'Failed to create BOM category', 'category');
    const id = (newCategory as any)?.id;
    if (!id) throw new Error('Failed to create BOM category.');
    resolvedCategoryIds.set(cacheKey, id as string);
    return id as string;
  }

  const preparedLineItems: LineItem[] = [];
  for (const [index, item] of updates.lineItems.entries()) {
    if (item.catalogType !== 'custom' || item.catalogItemId) {
      preparedLineItems.push(item);
      continue;
    }

    const normalizedCategory = canonicalPresetCategory(item.category);
    const categoryId = await ensureBomCategoryId(normalizedCategory, item.subcategory, item.topCategory);
    const skuCode = `CUSTOM-${normalizedCategory.toUpperCase().replace(/[^A-Z0-9]+/g, '-')}-${Date.now()}-${index + 1}`;
    const unitRate = Number(item.unitRate || 0);
    const { data: customCatalogItem, error: customItemErr } = await supabase
      .from('bom_template_items' as any)
      .insert({
        org_id: orgId,
        category_id: categoryId,
        sku_code: skuCode,
        description: item.description,
        unit: item.unit || 'Nos',
        unit_rate_min: unitRate,
        unit_rate_max: unitRate,
        default_rate: unitRate,
        gst_pct: normalizeGstRate(item.gstPct, 0.18),
        notes: item.specificationDetails || null,
        specification_details: item.specificationDetails || null,
        is_survey_dependent: item.isSurveyDependent,
        civil_required_only: normalizedCategory === 'civil',
      })
      .select('id')
      .maybeSingle();

    if (customItemErr) throw mapDatabaseError(customItemErr, 'Failed to create custom catalog item');
    const catalogItemId = (customCatalogItem as any)?.id;
    if (!catalogItemId) throw new Error('Failed to create custom catalog item.');

    preparedLineItems.push({
      ...item,
      category: normalizedCategory,
      catalogItemId,
      catalogType: 'bom_template',
      skuCode,
    });
  }

  // 3. Replace system items atomically in the database.
  const itemsToInsert = preparedLineItems.map((item, idx) => {
    const itemCategory = canonicalPresetCategory(item.category);
    const isSolarMeter = itemCategory === 'accessory' && item.description.toLowerCase().includes('solar');
    const isNetMeter = itemCategory === 'accessory' && item.description.toLowerCase().includes('net');
    const isCommDevice = itemCategory === 'accessory' && item.description.toLowerCase().includes('comm');
    const lowerDescription = item.description.toLowerCase();
    const isLA = (
      itemCategory === 'dc_protection' ||
      itemCategory === 'ac_protection' ||
      itemCategory === 'earthing'
    ) && (
      lowerDescription.includes('lightning') ||
      lowerDescription.includes('l/a') ||
      lowerDescription.includes('l-a')
    );

    return {
      system_id: targetPresetId,
      section: mapCategoryToSection(itemCategory),
      description: item.description,
      unit: item.unit || 'Nos',
      default_qty: item.quantity,
      sort_order: idx + 1,
      is_included_by_default: item.isIncluded,
      is_mandatory: true,
      remarks: item.specificationDetails || null,

      // Foreign keys mapping
      panel_id: itemCategory === 'panel' ? item.catalogItemId : null,
      inverter_id: itemCategory === 'inverter' ? item.catalogItemId : null,
      battery_id: itemCategory === 'battery' ? item.catalogItemId : null,
      structure_id: itemCategory === 'structure' && item.catalogType === 'eq_structure' ? item.catalogItemId : null,
      solar_meter_id: isSolarMeter && item.catalogType === 'equipment' ? item.catalogItemId : null,
      net_meter_id: isNetMeter && item.catalogType === 'equipment' ? item.catalogItemId : null,
      la_id: isLA && item.catalogType === 'equipment' ? item.catalogItemId : null,
      bom_item_id: item.catalogType === 'bom_template' ? item.catalogItemId : null,
      comm_device_id: isCommDevice && item.catalogType === 'equipment' ? item.catalogItemId : null,
      structure_component_id: itemCategory === 'structure' && item.catalogType === 'structure_component' ? item.catalogItemId : null,
    };
  });

  const { error: replaceErr } = await (supabase as any).rpc('replace_system_items_atomic', {
    p_system_id: targetPresetId,
    p_items: itemsToInsert,
    p_state_id: updates.stateId,
  });
  if (replaceErr) throw mapDatabaseError(replaceErr, 'Failed to save preset BOM items');

  revalidatePath('/');
  revalidatePath('/systems');
  revalidatePath('/settings/presets');
  return targetPresetId;
}

export async function deleteSystemPreset(presetId: string) {
  const authClient = await createClient();
  const supabase = createAdminClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user?.id) throw new Error('Unauthorized');

  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id')
    .eq('id', user.id)
    .maybeSingle();
  const orgId = profile?.org_id ?? null;
  if (!orgId) throw new Error('Organisation context not found.');

  const { data: preset, error: presetError } = await supabase
    .from('systems' as any)
    .select('id, org_id')
    .eq('id', presetId)
    .maybeSingle();
  if (presetError) throw mapDatabaseError(presetError, 'Failed to load preset');
  if (!preset) throw new Error('Preset not found.');
  if ((preset as any).org_id === null) {
    const { error } = await (supabase as any)
      .from('system_hidden_presets')
      .upsert({
        org_id: orgId,
        system_id: presetId,
        hidden_by: user.id,
        created_at: new Date().toISOString(),
      }, { onConflict: 'org_id,system_id' });
    if (error) throw mapDatabaseError(error, 'Failed to hide built-in preset');

    revalidatePath('/settings/presets');
    revalidatePath('/systems');
    revalidatePath('/calculator');
    return;
  }

  if ((preset as any).org_id !== orgId) {
    throw new Error('You can only delete presets that belong to your organisation.');
  }

  const { count, error: refError } = await (supabase
    .from('quotes' as any)
    .select('id', { count: 'exact', head: true })
    .eq('system_id', presetId) as any);
  if (refError) throw mapDatabaseError(refError, 'Failed to check preset usage');

  if ((count ?? 0) > 0) {
    const { error } = await supabase
      .from('systems' as any)
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', presetId);
    if (error) throw mapDatabaseError(error, 'Failed to deactivate preset');
  } else {
    const { error } = await supabase
      .from('systems' as any)
      .delete()
      .eq('id', presetId)
      .eq('org_id', orgId);
    if (error) throw mapDatabaseError(error, 'Failed to delete preset');
  }

  revalidatePath('/settings/presets');
  revalidatePath('/systems');
  revalidatePath('/calculator');
}

function buildDuplicateName(baseName: string, existingNames: Set<string>) {
  const cleanBase = baseName.trim() || 'Preset';
  let index = 1;
  let candidate = `${cleanBase} (${index})`;
  while (existingNames.has(candidate.toLowerCase())) {
    index += 1;
    candidate = `${cleanBase} (${index})`;
  }
  return candidate;
}

export async function duplicateSystemPreset(presetId: string): Promise<{ id: string; name: string }> {
  const authClient = await createClient();
  const supabase = createAdminClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user?.id) throw new Error('Unauthorized. Please sign in again before duplicating presets.');

  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id')
    .eq('id', user.id)
    .maybeSingle();
  const orgId = profile?.org_id ?? null;
  if (!orgId) throw new Error('Organisation context not found. Please reload and try again.');

  const { data: sourcePreset, error: sourceErr } = await supabase
    .from('systems' as any)
    .select(`
      id,
      org_id,
      name,
      category,
      capacity_kw,
      state_id,
      target_margin_pct,
      panel_qty,
      panel_wattage_w,
      row_number,
      sheet_name,
      source_file,
      version
    `)
    .eq('id', presetId)
    .maybeSingle();

  if (sourceErr) throw mapDatabaseError(sourceErr, 'Failed to load source preset');
  if (!sourcePreset) throw new Error('Source preset not found.');
  if ((sourcePreset as any).org_id && (sourcePreset as any).org_id !== orgId) {
    throw new Error('You can only duplicate presets visible to your organisation.');
  }

  const { data: sourceItems, error: itemsErr } = await supabase
    .from('system_items' as any)
    .select(`
      battery_id,
      bom_item_id,
      comm_device_id,
      default_qty,
      description,
      inverter_id,
      is_included_by_default,
      is_mandatory,
      la_id,
      net_meter_id,
      panel_id,
      remarks,
      section,
      solar_meter_id,
      sort_order,
      structure_component_id,
      structure_id,
      unit
    `)
    .eq('system_id', presetId)
    .order('sort_order', { ascending: true });
  if (itemsErr) throw mapDatabaseError(itemsErr, 'Failed to load source preset items');
  if (!sourceItems?.length) {
    throw new Error('Source preset has no BOM items to duplicate.');
  }

  const { data: existingSystems, error: namesErr } = await (supabase as any)
    .from('systems')
    .select('name')
    .or(`org_id.eq.${orgId},org_id.is.null`);
  if (namesErr) throw mapDatabaseError(namesErr, 'Failed to check existing preset names');

  const { data: existingLegacyPresets } = await supabase
    .from('custom_presets')
    .select('name')
    .eq('org_id', orgId)
    .eq('is_active', true);

  const existingNames = new Set([
    ...((existingSystems || []) as any[]).map((row) => String(row.name || '').toLowerCase()),
    ...((existingLegacyPresets || []) as any[]).map((row) => String(row.name || '').toLowerCase()),
  ]);
  const duplicateName = buildDuplicateName((sourcePreset as any).name, existingNames);

  const { data: newPreset, error: createErr } = await supabase
    .from('systems' as any)
    .insert({
      org_id: orgId,
      name: duplicateName,
      category: (sourcePreset as any).category,
      capacity_kw: Number((sourcePreset as any).capacity_kw || 0),
      state_id: (sourcePreset as any).state_id ?? null,
      target_margin_pct: normalizeMarginPct((sourcePreset as any).target_margin_pct),
      panel_qty: (sourcePreset as any).panel_qty ?? null,
      panel_wattage_w: (sourcePreset as any).panel_wattage_w ?? null,
      row_number: (sourcePreset as any).row_number ?? null,
      sheet_name: (sourcePreset as any).sheet_name ?? null,
      source_file: (sourcePreset as any).source_file ?? null,
      version: (sourcePreset as any).version ?? 1,
      is_active: true,
      is_custom: true,
    })
    .select('id, name')
    .maybeSingle();

  if (createErr) throw mapDatabaseError(createErr, 'Failed to create duplicate preset');
  const newPresetId = (newPreset as any)?.id as string | undefined;
  if (!newPresetId) throw new Error('Failed to create duplicate preset.');

  const { data: availabilityRows, error: availabilityErr } = await (supabase as any)
    .from('system_state_availability')
    .select('state_id')
    .eq('system_id', presetId);
  if (availabilityErr) throw mapDatabaseError(availabilityErr, 'Failed to load source preset state');

  const stateIds = Array.from(new Set(
    ((availabilityRows || []) as any[])
      .map((row) => row.state_id)
      .filter(Boolean)
      .concat((sourcePreset as any).state_id ? [(sourcePreset as any).state_id] : []),
  ));

  const copiedItems = ((sourceItems || []) as any[]).map((item, idx) => ({
    section: item.section,
    description: item.description,
    unit: item.unit ?? 'Nos',
    default_qty: item.default_qty ?? 0,
    sort_order: item.sort_order ?? idx + 1,
    is_included_by_default: item.is_included_by_default ?? true,
    is_mandatory: item.is_mandatory ?? true,
    remarks: item.remarks ?? null,
    panel_id: item.panel_id ?? null,
    inverter_id: item.inverter_id ?? null,
    battery_id: item.battery_id ?? null,
    structure_id: item.structure_id ?? null,
    solar_meter_id: item.solar_meter_id ?? null,
    net_meter_id: item.net_meter_id ?? null,
    la_id: item.la_id ?? null,
    bom_item_id: item.bom_item_id ?? null,
    comm_device_id: item.comm_device_id ?? null,
    structure_component_id: item.structure_component_id ?? null,
  }));

  const primaryStateId = (sourcePreset as any).state_id ?? stateIds[0] ?? null;
  const { error: copyItemsErr } = await (supabase as any).rpc('replace_system_items_atomic', {
    p_system_id: newPresetId,
    p_items: copiedItems,
    p_state_id: primaryStateId,
  });
  if (copyItemsErr) throw mapDatabaseError(copyItemsErr, 'Failed to copy preset items');

  if (stateIds.length > 0) {
    const { error: stateErr } = await (supabase as any)
      .from('system_state_availability')
      .upsert(
        stateIds.map((stateId) => ({ system_id: newPresetId, state_id: stateId })),
        { onConflict: 'system_id,state_id' },
      );
    if (stateErr) throw mapDatabaseError(stateErr, 'Failed to copy preset state');
  }

  revalidatePath('/');
  revalidatePath('/systems');
  revalidatePath('/settings/presets');
  revalidatePath('/calculator');

  return { id: newPresetId, name: duplicateName };
}

export async function getCatalogItems(category: string, search?: string): Promise<any[]> {
  const supabase = await createClient();
  const searchTerm = search?.trim();
  const normalizedCategory = canonicalPresetCategory(category);

  if (normalizedCategory === 'all') {
    const categories = [
      'panel',
      'inverter',
      'battery',
      'structure',
      'bom_item',
      'dc_protection',
      'ac_protection',
      'cable',
      'earthing',
      'civil',
      'logistics',
      'accessory',
      'miscellaneous',
    ];
    const groups: any[][] = await Promise.all(categories.map(async (itemCategory): Promise<any[]> => {
      const items: any[] = await getCatalogItems(itemCategory, searchTerm);
      return items.map((item: any) => ({ ...item, category: item.category ?? itemCategory }));
    }));
    const seen = new Set<string>();
    return groups.flat().filter((item: any) => {
      const key = `${item.catalogType ?? item.type}:${item.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  // Panels, Inverters, Batteries are from their respective tables
  if (['panel', 'inverter', 'battery'].includes(normalizedCategory)) {
    let tableName = `eq_${normalizedCategory}s`;
    if (normalizedCategory === 'battery') tableName = 'eq_batteries';
    
    let query = supabase.from(tableName as any).select('*').eq('is_active', true);
    const { data } = await query.limit(100);
    return (data || [])
      .filter((item: any) => !isPlaceholderEquipment(item))
      .map((item: any) => ({
      id: item.id,
      type: normalizedCategory,
      topCategory: normalizedCategory,
      subcategory: item.brand || 'Unbranded',
      category: normalizedCategory,
      description: [item.brand, item.model].filter(Boolean).join(' ') || item.name || 'Unnamed item',
      brand: item.brand,
      model: item.model,
      wattageW: normalizedCategory === 'panel' ? Number(item.wattage_w || 0) : null,
      unit: 'Nos',
      defaultQty: 1,
      defaultRate: Number(item.selling_price || 0),
      specificationDetails: item.specification_details || item.description || '',
      gstPct: normalizeGstRate(
        item.gst_pct,
        normalizedCategory === 'panel'
          ? TAX_CONSTANTS.PANEL_GST_RATE
          : normalizedCategory === 'inverter'
            ? TAX_CONSTANTS.INVERTER_GST_RATE
            : getBatteryGstRate(item)
      ),
      isSurveyDependent: false,
    }))
      .map((item: any) => ({
        ...item,
        _searchScore: catalogSearchScore(searchTerm, [
          item.description,
          item.brand,
          item.model,
          item.wattageW,
          item.defaultRate,
          normalizedCategory,
        ]),
      }))
      .filter((item: any) => !searchTerm || item._searchScore > 0)
      .sort((a: any, b: any) => b._searchScore - a._searchScore || String(a.description).localeCompare(String(b.description)))
      .slice(0, 50)
      .map(({ _searchScore, ...item }: any) => item);
  }

  const catalogItems: any[] = [];

  if (normalizedCategory === 'structure') {
    let structureQuery = supabase
      .from('eq_mounting_structures' as any)
      .select('id, name, description, specification_details, material, roof_mount_type, selling_price, gst_pct, is_active')
      .eq('is_active', true);

    if (searchTerm) {
      structureQuery = structureQuery.or(`name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
    }

    const { data: structures, error: structureError } = await structureQuery.limit(25);
    if (structureError) throw new Error('Failed to fetch mounting structures: ' + structureError.message);

    catalogItems.push(...(structures || []).map((item: any) => ({
      id: item.id,
      type: 'structure',
      catalogType: 'eq_structure',
      topCategory: 'structure',
      subcategory: item.material || 'Structure & Accessories',
      category: 'structure',
      description: item.name || item.description || 'Mounting structure',
      brand: item.material ?? '',
      model: item.roof_mount_type ?? '',
      unit: 'set',
      defaultQty: 1,
      defaultRate: Number(item.selling_price || 0),
      specificationDetails: item.specification_details || item.description || '',
      gstPct: Number(item.gst_pct ?? 0.18),
      isSurveyDependent: false,
    })));
  }

  if (normalizedCategory === 'dc_protection' || normalizedCategory === 'ac_protection' || normalizedCategory === 'earthing') {
    let laQuery = supabase
      .from('eq_lightning_arresters' as any)
      .select('id, brand, model, description, specification_details, selling_price, gst_pct, is_active')
      .eq('is_active', true);

    if (searchTerm) {
      laQuery = laQuery.or(`brand.ilike.%${searchTerm}%,model.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
    }

    const { data: lightningArresters, error: laError } = await laQuery.limit(25);
    if (laError) throw new Error('Failed to fetch lightning arresters: ' + laError.message);

    catalogItems.push(...(lightningArresters || []).map((item: any) => ({
      id: item.id,
      type: 'lightning_arrester',
      catalogType: 'equipment',
      topCategory: 'bom_item',
      subcategory: 'LA & Earthings',
      category: 'earthing',
      description: item.description || [item.brand, item.model].filter(Boolean).join(' ') || 'Lightning arrester',
      brand: item.brand ?? '',
      model: item.model ?? '',
      unit: 'Nos',
      defaultQty: 1,
      defaultRate: Number(item.selling_price || 0),
      specificationDetails: item.specification_details || item.description || '',
      gstPct: Number(item.gst_pct ?? 0.18),
      isSurveyDependent: false,
    })));
  }

  if (normalizedCategory === 'accessory') {
    let meterQuery = supabase
      .from('eq_meters' as any)
      .select('id, brand, model, description, specification_details, selling_price, gst_pct, is_active')
      .eq('is_active', true);
    let commQuery = supabase
      .from('eq_communication_devices' as any)
      .select('id, brand, model, description, specification_details, selling_price, gst_pct, is_active')
      .eq('is_active', true);

    if (searchTerm) {
      meterQuery = meterQuery.or(`brand.ilike.%${searchTerm}%,model.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
      commQuery = commQuery.or(`brand.ilike.%${searchTerm}%,model.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
    }

    const [metersRes, commRes] = await Promise.all([meterQuery.limit(20), commQuery.limit(20)]);
    if (metersRes.error) throw new Error('Failed to fetch meters: ' + metersRes.error.message);
    if (commRes.error) throw new Error('Failed to fetch communication devices: ' + commRes.error.message);

    catalogItems.push(...(metersRes.data || []).map((item: any) => ({
      id: item.id,
      type: 'meter',
      catalogType: 'equipment',
      topCategory: 'bom_item',
      subcategory: 'Meters',
      category: 'accessory',
      description: item.description || [item.brand, item.model].filter(Boolean).join(' ') || 'Meter',
      brand: item.brand ?? '',
      model: item.model ?? '',
      unit: 'Nos',
      defaultQty: 1,
      defaultRate: Number(item.selling_price || 0),
      specificationDetails: item.specification_details || item.description || '',
      gstPct: Number(item.gst_pct ?? 0.18),
      isSurveyDependent: false,
    })));
    catalogItems.push(...(commRes.data || []).map((item: any) => ({
      id: item.id,
      type: 'communication_device',
      catalogType: 'equipment',
      topCategory: 'bom_item',
      subcategory: 'Meters',
      category: 'accessory',
      description: item.description || [item.brand, item.model].filter(Boolean).join(' ') || 'Communication device',
      brand: item.brand ?? '',
      model: item.model ?? '',
      unit: 'Nos',
      defaultQty: 1,
      defaultRate: Number(item.selling_price || 0),
      specificationDetails: item.specification_details || item.description || '',
      gstPct: Number(item.gst_pct ?? 0.18),
      isSurveyDependent: false,
    })));
  }

  const { data: categories, error: categoryError } = await supabase
    .from('bom_categories' as any)
    .select('id, name, top_category, subcategory_name')
    .order('display_order', { ascending: true });

  if (categoryError) throw new Error('Failed to fetch BOM categories: ' + categoryError.message);

  let bomQuery = supabase
    .from('bom_template_items' as any)
    .select('id, sku_code, description, specification_details, notes, unit, default_rate, gst_pct, qty_formula, is_survey_dependent, category_id, bom_categories(name, top_category, subcategory_name)');

  const { data: bomItems, error: bomError } = await bomQuery.limit(500);
  if (bomError) throw new Error('Failed to fetch BOM catalog items: ' + bomError.message);

  const categoryById = new Map(((categories || []) as any[]).map((item: any) => [item.id, item]));
  const matchingBomItems = (bomItems || []).map((item: any) => {
    const categoryMeta = item.bom_categories ?? categoryById.get(item.category_id);
    const categoryName = categoryMeta?.subcategory_name ?? categoryMeta?.name;
    const inferred = inferCatalogCategoryFromText(item.sku_code, item.description, item.notes, item.specification_details);
    const score = catalogSearchScore(searchTerm, [
      item.sku_code,
      item.description,
      item.notes,
      item.specification_details,
      item.unit,
      item.default_rate,
      categoryName,
      inferred,
    ]);

    return { item, categoryMeta, categoryName, inferred, score };
  }).filter(({ categoryMeta, categoryName, inferred, score }: any) => {
    if (searchTerm && score <= 0) return false;
    if (normalizedCategory === 'bom_item') {
      return (categoryMeta?.top_category ?? topCategoryFromFunctional(inferred)) === 'bom_item';
    }
    if (normalizedCategory === 'miscellaneous') {
      return categoryNameMatches('miscellaneous', categoryName) || (inferred === 'miscellaneous' && !hasKnownCategoryName(categoryName));
    }
    if (inferred !== 'miscellaneous') return inferred === normalizedCategory;
    return categoryNameMatches(normalizedCategory, categoryName);
  }).sort((a: any, b: any) => b.score - a.score || String(a.item.description).localeCompare(String(b.item.description)));

  catalogItems.push(...matchingBomItems.map(({ item, categoryMeta, categoryName, inferred }: any) => {
    const functionalCategory = categoryFromBomItem({ ...item, bom_categories: categoryMeta }, inferred);
    const topCategory = categoryMeta?.top_category ?? topCategoryFromFunctional(functionalCategory);
    return ({
    id: item.id,
    type: 'bom_template',
    catalogType: 'bom_template',
    category: functionalCategory,
    topCategory,
    subcategory: categoryName || defaultSubcategoryForItem({ category: functionalCategory }),
    categoryName: categoryName || '',
    skuCode: item.sku_code ?? '',
    description: item.description,
    brand: '',
    model: '',
    unit: item.unit || 'units',
    defaultQty: defaultQtyFromFormula(item.qty_formula),
    defaultRate: Number(item.default_rate || 0),
    specificationDetails: item.specification_details || item.notes || '',
    gstPct: normalizeGstRate(item.gst_pct, 0.18),
    isSurveyDependent: Boolean(item.is_survey_dependent ?? false),
  });
  }));

  const seen = new Set<string>();
  return catalogItems.filter((item) => {
    const key = `${item.catalogType}:${item.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
