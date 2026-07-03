'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { normalizeGstRate } from '@/lib/utils/gst';
import { getBatteryGstRate, TAX_CONSTANTS } from '@/lib/tax-constants';

export interface LineItem {
  id?: string;
  category: string;
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
  structure: ['Mounting Structure', 'Structure', 'Structures'],
  dc_protection: ['DC Protection', 'DC Side Protection', 'Electrical Protection', 'Monitoring & Safety'],
  ac_protection: ['AC Protection', 'AC Side Protection', 'Electrical Protection'],
  cable: ['Cables', 'Cables & Conduit', 'Cabling', 'Cable', 'Wiring'],
  earthing: ['Earthing', 'Earthings', 'Monitoring & Safety'],
  civil: ['Civil Works', 'Civil', 'Services'],
  logistics: ['Logistics', 'Logistics & Handling', 'Handling', 'Services'],
  accessory: ['Accessories', 'Accessory', 'Monitoring & Safety', 'Wiring'],
  miscellaneous: ['Miscellaneous', 'Miscellenous', 'Misc', 'Other'],
};

function normalizeCatalogName(value: string) {
  return value.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim();
}

function canonicalPresetCategory(category: string | null | undefined) {
  const normalized = normalizeCatalogName(category ?? '');
  if (!normalized || normalized === 'other' || normalized === 'misc') return 'miscellaneous';
  return category as string;
}

function inferCatalogCategoryFromText(...parts: Array<string | null | undefined>) {
  const value = normalizeCatalogName(parts.filter(Boolean).join(' '));

  if (/\b(panel|module|pv module)\b/.test(value)) return 'panel';
  if (/\b(inverter|mppt)\b/.test(value)) return 'inverter';
  if (/\b(battery|bms|lfp|lithium)\b/.test(value)) return 'battery';
  if (/\b(structure|mounting|rail|clamp|walkway|ladder)\b/.test(value)) return 'structure';
  if (/\b(dcdb|dc protection|dc side|dc spd|dc mcb|dc isolator|combiner|string box|mc4|la|l a|lightning arrester|lightning protection)\b/.test(value)) return 'dc_protection';
  if (/\b(acdb|ac protection|ac side|ac spd|ac mcb|ac isolator|meter box)\b/.test(value)) return 'ac_protection';
  if (/\b(cable|cabling|wire|wiring|conduit|tray)\b/.test(value)) return 'cable';
  if (/\b(earthing|earth|electrode|rod|strip|chemical earth)\b/.test(value)) return 'earthing';
  if (/\b(civil|cement|sand|aggregate|brick|anchor|rmc|concrete)\b/.test(value)) return 'civil';
  if (/\b(logistic|transport|handling|packing|loading|unloading)\b/.test(value)) return 'logistics';
  if (/\b(accessory|meter|communication|monitoring|dtu|dongle|logger)\b/.test(value)) return 'accessory';

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
  bom_categories?: { name?: string | null } | null;
}, fallback: string) {
  const inferred = inferCatalogCategoryFromText(
    item.sku_code,
    item.description,
    item.notes,
    item.specification_details,
  );
  if (inferred !== 'miscellaneous') return inferred;
  return categoryFromCatalogName(item.bom_categories?.name, fallback);
}

function normalizeMarginPct(value: unknown, fallback = 0.2): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return fallback;
  return num > 1 ? num / 100 : num;
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
    supabase.from('bom_template_items' as any).select('id, description, specification_details, notes, default_rate, gst_pct, category_id, bom_categories(name)'),
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
  const supabase = await createClient();
  let targetPresetId = presetId;
  const { data: { user } } = await supabase.auth.getUser();
  let orgId: string | null = null;
  if (user?.id) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('org_id')
      .eq('id', user.id)
      .maybeSingle();
    orgId = profile?.org_id ?? null;
  }

  const inverterIds = updates.lineItems
    .filter((item) => item.category === 'inverter' && item.catalogItemId)
    .map((item) => item.catalogItemId as string);

  if (inverterIds.length > 0) {
    const { data: selectedInverters, error: inverterError } = await supabase
      .from('eq_inverters' as any)
      .select('id, brand, model, is_active')
      .in('id', inverterIds);

    if (inverterError) throw new Error('Failed to validate preset inverters: ' + inverterError.message);

    const realActiveIds = new Set(
      (selectedInverters || [])
        .filter((item: any) => item.is_active !== false && !isPlaceholderEquipment(item))
        .map((item: any) => item.id),
    );
    const invalidCount = inverterIds.filter((id) => !realActiveIds.has(id)).length;
    if (invalidCount > 0) {
      throw new Error('Preset contains an inactive or placeholder inverter. Please select a real inverter from masters.');
    }
  }

  if (targetPresetId) {
    const { data: existingPreset, error: existingErr } = await supabase
      .from('systems' as any)
      .select('id, org_id, target_margin_pct')
      .eq('id', targetPresetId)
      .maybeSingle();

    if (existingErr) throw new Error('Failed to check existing preset: ' + existingErr.message);
    if (!existingPreset) throw new Error('Preset not found in system presets.');

    const shouldForkGlobalPreset = (existingPreset as any).org_id === null && orgId !== null;

    if (shouldForkGlobalPreset) {
      const { data: newPreset, error: presetErr } = await supabase
        .from('systems' as any)
        .insert({
          org_id: orgId,
          name: updates.name,
          category: updates.systemType,
          capacity_kw: Number(updates.capacityKw) || 0,
          state_id: updates.stateId || null,
          target_margin_pct: normalizeMarginPct((existingPreset as any).target_margin_pct),
          is_active: true,
          is_custom: true,
        })
        .select('id')
        .maybeSingle();

      if (presetErr) throw new Error('Failed to create organisation preset: ' + presetErr.message);
      targetPresetId = (newPreset as any)?.id;
    } else {
      const { error: presetErr } = await supabase
        .from('systems' as any)
        .update({
          name: updates.name,
          category: updates.systemType,
          capacity_kw: Number(updates.capacityKw) || 0,
          state_id: updates.stateId || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', targetPresetId);

      if (presetErr) throw new Error('Failed to update system metadata: ' + presetErr.message);

      const { error: delErr } = await supabase
        .from('system_items' as any)
        .delete()
        .eq('system_id', targetPresetId);

      if (delErr) throw new Error('Failed to delete old system items: ' + delErr.message);
    }
  } else {
    const { data: newPreset, error: presetErr } = await supabase
      .from('systems' as any)
      .insert({
        org_id: orgId,
        name: updates.name,
        category: updates.systemType,
        capacity_kw: Number(updates.capacityKw) || 0,
        state_id: updates.stateId || null,
        target_margin_pct: 0.2,
        is_active: true,
        is_custom: true,
      })
      .select('id')
      .maybeSingle();

    if (presetErr) throw new Error('Failed to create system preset: ' + presetErr.message);
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

  async function ensureBomCategoryId(category: string) {
    const normalizedCategory = canonicalPresetCategory(category);
    const aliases = CATALOG_CATEGORY_ALIASES[normalizedCategory] ?? [normalizedCategory];
    const aliasSet = new Set(aliases.map(normalizeCatalogName));

    const { data: categories, error: categoryLoadErr } = await supabase
      .from('bom_categories' as any)
      .select('id, name, display_order')
      .order('display_order', { ascending: true });

    if (categoryLoadErr) throw new Error('Failed to load BOM categories: ' + categoryLoadErr.message);

    const existing = ((categories || []) as any[]).find((item: any) => aliasSet.has(normalizeCatalogName(item.name || '')));
    if (existing?.id) return existing.id as string;

    const displayOrder = Object.keys(CATALOG_CATEGORY_ALIASES).indexOf(normalizedCategory) + 1 || 99;
    const { data: newCategory, error: categoryCreateErr } = await supabase
      .from('bom_categories' as any)
      .insert({
        org_id: orgId,
        name: aliases[0] ?? normalizedCategory,
        display_order: displayOrder,
        is_optional: ['civil', 'logistics', 'accessory', 'miscellaneous'].includes(normalizedCategory),
      })
      .select('id')
      .maybeSingle();

    if (categoryCreateErr) throw new Error('Failed to create BOM category: ' + categoryCreateErr.message);
    const id = (newCategory as any)?.id;
    if (!id) throw new Error('Failed to create BOM category.');
    return id as string;
  }

  const preparedLineItems: LineItem[] = [];
  for (const [index, item] of updates.lineItems.entries()) {
    if (item.catalogType !== 'custom' || item.catalogItemId) {
      preparedLineItems.push(item);
      continue;
    }

    const normalizedCategory = canonicalPresetCategory(item.category);
    const categoryId = await ensureBomCategoryId(normalizedCategory);
    const skuCode = item.skuCode || `CUSTOM-${normalizedCategory.toUpperCase().replace(/[^A-Z0-9]+/g, '-')}-${Date.now()}-${index + 1}`;
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

    if (customItemErr) throw new Error('Failed to create custom catalog item: ' + customItemErr.message);
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

  // 3. Insert new system items
  const itemsToInsert = preparedLineItems.map((item, idx) => {
    const itemCategory = canonicalPresetCategory(item.category);
    const isSolarMeter = itemCategory === 'accessory' && item.description.toLowerCase().includes('solar');
    const isNetMeter = itemCategory === 'accessory' && item.description.toLowerCase().includes('net');
    const isCommDevice = itemCategory === 'accessory' && item.description.toLowerCase().includes('comm');
    const isLA = (itemCategory === 'dc_protection' || itemCategory === 'ac_protection') && item.description.toLowerCase().includes('lightning');

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

  if (itemsToInsert.length > 0) {
    const { error: insErr } = await supabase
      .from('system_items' as any)
      .insert(itemsToInsert);

    if (insErr) throw new Error('Failed to insert new system items: ' + insErr.message);
  }

  await supabase
    .from('system_state_availability' as any)
    .delete()
    .eq('system_id', targetPresetId);

  if (updates.stateId) {
    const { error: stateErr } = await supabase
      .from('system_state_availability' as any)
      .insert({ system_id: targetPresetId, state_id: updates.stateId });
    if (stateErr) throw new Error('Failed to update preset state: ' + stateErr.message);
  }

  revalidatePath('/');
  revalidatePath('/systems');
  revalidatePath('/settings/presets');
  return targetPresetId;
}

export async function deleteSystemPreset(presetId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
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
  if (presetError) throw new Error('Failed to load preset: ' + presetError.message);
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
    if (error) throw new Error('Failed to hide built-in preset: ' + error.message);

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
  if (refError) throw new Error('Failed to check preset usage: ' + refError.message);

  if ((count ?? 0) > 0) {
    const { error } = await supabase
      .from('systems' as any)
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', presetId);
    if (error) throw new Error('Failed to deactivate preset: ' + error.message);
  } else {
    const { error } = await supabase
      .from('systems' as any)
      .delete()
      .eq('id', presetId)
      .eq('org_id', orgId);
    if (error) throw new Error('Failed to delete preset: ' + error.message);
  }

  revalidatePath('/settings/presets');
  revalidatePath('/systems');
  revalidatePath('/calculator');
}

export async function getCatalogItems(category: string, search?: string) {
  const supabase = await createClient();
  const searchTerm = search?.trim();
  const normalizedCategory = canonicalPresetCategory(category);

  // Panels, Inverters, Batteries are from their respective tables
  if (['panel', 'inverter', 'battery'].includes(normalizedCategory)) {
    let tableName = `eq_${normalizedCategory}s`;
    if (normalizedCategory === 'battery') tableName = 'eq_batteries';
    
    let query = supabase.from(tableName as any).select('*').eq('is_active', true);
    if (searchTerm) {
      query = query.or(`brand.ilike.%${searchTerm}%,model.ilike.%${searchTerm}%`);
    }
    const { data } = await query.limit(50);
    return (data || []).filter((item: any) => !isPlaceholderEquipment(item)).map((item: any) => ({
      id: item.id,
      type: normalizedCategory,
      description: [item.brand, item.model].filter(Boolean).join(' ') || item.name || 'Unnamed item',
      brand: item.brand,
      model: item.model,
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
    }));
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
    .select('id, name')
    .order('display_order', { ascending: true });

  if (categoryError) throw new Error('Failed to fetch BOM categories: ' + categoryError.message);

  let bomQuery = supabase
    .from('bom_template_items' as any)
    .select('id, sku_code, description, specification_details, notes, unit, default_rate, gst_pct, is_survey_dependent, category_id, bom_categories(name)');

  const { data: bomItems, error: bomError } = await bomQuery.limit(500);
  if (bomError) throw new Error('Failed to fetch BOM catalog items: ' + bomError.message);

  const categoryById = new Map(((categories || []) as any[]).map((item: any) => [item.id, item.name]));
  const searchText = normalizeCatalogName(searchTerm || '');

  const matchingBomItems = (bomItems || []).filter((item: any) => {
    const categoryName = item.bom_categories?.name ?? categoryById.get(item.category_id);
    const inferred = inferCatalogCategoryFromText(item.sku_code, item.description, item.notes, item.specification_details);
    const matchesSearch = !searchText || normalizeCatalogName([
      item.sku_code,
      item.description,
      item.notes,
      item.specification_details,
      categoryName,
    ].filter(Boolean).join(' ')).includes(searchText);

    if (!matchesSearch) return false;
    if (normalizedCategory === 'miscellaneous') {
      return categoryNameMatches('miscellaneous', categoryName) || (inferred === 'miscellaneous' && !hasKnownCategoryName(categoryName));
    }
    if (inferred !== 'miscellaneous') return inferred === normalizedCategory;
    return categoryNameMatches(normalizedCategory, categoryName);
  });

  catalogItems.push(...matchingBomItems.map((item: any) => ({
    id: item.id,
    type: 'bom_template',
    catalogType: 'bom_template',
    skuCode: item.sku_code ?? '',
    description: item.description,
    brand: '',
    model: '',
    unit: item.unit || 'units',
    defaultQty: 1,
    defaultRate: Number(item.default_rate || 0),
    specificationDetails: item.specification_details || item.notes || '',
    gstPct: normalizeGstRate(item.gst_pct, 0.18),
    isSurveyDependent: Boolean(item.is_survey_dependent ?? false),
  })));

  const seen = new Set<string>();
  return catalogItems.filter((item) => {
    const key = `${item.catalogType}:${item.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
