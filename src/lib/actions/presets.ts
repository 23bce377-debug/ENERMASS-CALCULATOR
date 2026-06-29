'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export interface LineItem {
  id?: string;
  category: string;
  catalogItemId?: string;
  catalogType?: string;
  skuCode?: string;
  description: string;
  brand?: string;
  model?: string;
  unit: string;
  quantity: number;
  unitRate: number;
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
    supabase.from('eq_panels').select('id, brand, model, selling_price').eq('is_active', true),
    supabase.from('eq_inverters').select('id, brand, model, selling_price').eq('is_active', true),
    supabase.from('eq_batteries').select('id, brand, model, selling_price').eq('is_active', true),
    supabase.from('eq_meters').select('id, brand, model, selling_price'),
    supabase.from('eq_lightning_arresters').select('id, brand, model, selling_price'),
    supabase.from('eq_mounting_structures').select('id, name, selling_price'),
    supabase.from('bom_template_items').select('id, description, default_rate'),
    supabase.from('eq_communication_devices').select('id, brand, model, selling_price'),
    supabase.from('structure_component_master').select('id, name, selling_price'),
  ]);

  const panels = (panelsRes.data || []).filter((item: any) => !isPlaceholderEquipment(item));
  const inverters = (invertersRes.data || []).filter((item: any) => !isPlaceholderEquipment(item));
  const batteries = (batteriesRes.data || []).filter((item: any) => !isPlaceholderEquipment(item));
  const meters = metersRes.data || [];
  const las = laRes.data || [];
  const structures = structuresRes.data || [];
  const bomItems = bomItemsRes.data || [];
  const commDevices = commDevicesRes.data || [];
  const structureComponents = componentMasterRes.data || [];

  // Helper function to resolve rate and category details
  const mappedItems = (lineItemsData || []).map((item: any) => {
    let category = 'other';
    let catalogItemId: string | null = null;
    let catalogType = 'custom';
    let unitRate = 0;
    let brand = '';
    let model = '';

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
      }
    } else if (item.structure_id) {
      category = 'structure';
      catalogItemId = item.structure_id;
      catalogType = 'eq_structure';
      const str = structures.find((x: any) => x.id === item.structure_id);
      if (str) {
        unitRate = Number(str.selling_price || 0);
      }
    } else if (item.solar_meter_id || item.net_meter_id) {
      category = 'accessory';
      catalogItemId = item.solar_meter_id || item.net_meter_id;
      catalogType = 'equipment';
      const met = meters.find((x: any) => x.id === catalogItemId);
      if (met) {
        unitRate = Number(met.selling_price || 0);
      }
    } else if (item.la_id) {
      category = 'dc_protection';
      catalogItemId = item.la_id;
      catalogType = 'equipment';
      const la = las.find((x: any) => x.id === item.la_id);
      if (la) {
        unitRate = Number(la.selling_price || 0);
      }
    } else if (item.bom_item_id) {
      catalogItemId = item.bom_item_id;
      catalogType = 'bom_template';
      const bom = bomItems.find((x: any) => x.id === item.bom_item_id);
      if (bom) {
        unitRate = Number(bom.default_rate || 0);
      }
    } else if (item.comm_device_id) {
      category = 'accessory';
      catalogItemId = item.comm_device_id;
      catalogType = 'equipment';
      const comm = commDevices.find((x: any) => x.id === item.comm_device_id);
      if (comm) {
        unitRate = Number(comm.selling_price || 0);
      }
    } else if (item.structure_component_id) {
      category = 'structure';
      catalogItemId = item.structure_component_id;
      catalogType = 'structure_component';
      const comp = structureComponents.find((x: any) => x.id === item.structure_component_id);
      if (comp) {
        unitRate = Number(comp.selling_price || 0);
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
      unit: item.unit || 'Nos',
      quantity: Number(item.default_qty || 0),
      unitRate,
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
          target_margin_pct: Number((existingPreset as any).target_margin_pct ?? 20),
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
        target_margin_pct: 20,
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
      default: return 'services';
    }
  }

  // 3. Insert new system items
  const itemsToInsert = updates.lineItems.map((item, idx) => {
    const isSolarMeter = item.category === 'accessory' && item.description.toLowerCase().includes('solar');
    const isNetMeter = item.category === 'accessory' && item.description.toLowerCase().includes('net');
    const isCommDevice = item.category === 'accessory' && item.description.toLowerCase().includes('comm');
    const isLA = (item.category === 'dc_protection' || item.category === 'ac_protection') && item.description.toLowerCase().includes('lightning');

    return {
      system_id: targetPresetId,
      section: mapCategoryToSection(item.category),
      description: item.description,
      unit: item.unit || 'Nos',
      default_qty: item.quantity,
      sort_order: idx + 1,
      is_included_by_default: item.isIncluded,
      is_mandatory: true,

      // Foreign keys mapping
      panel_id: item.category === 'panel' ? item.catalogItemId : null,
      inverter_id: item.category === 'inverter' ? item.catalogItemId : null,
      battery_id: item.category === 'battery' ? item.catalogItemId : null,
      structure_id: item.category === 'structure' && item.catalogType === 'eq_structure' ? item.catalogItemId : null,
      solar_meter_id: isSolarMeter && item.catalogType === 'equipment' ? item.catalogItemId : null,
      net_meter_id: isNetMeter && item.catalogType === 'equipment' ? item.catalogItemId : null,
      la_id: isLA && item.catalogType === 'equipment' ? item.catalogItemId : null,
      bom_item_id: item.catalogType === 'bom_template' ? item.catalogItemId : null,
      comm_device_id: isCommDevice && item.catalogType === 'equipment' ? item.catalogItemId : null,
      structure_component_id: item.category === 'structure' && item.catalogType === 'structure_component' ? item.catalogItemId : null,
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
  if ((preset as any).org_id !== orgId) {
    throw new Error('Built-in presets cannot be deleted. Save edits first to create an organisation copy.');
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
}

export async function getCatalogItems(category: string, search?: string) {
  const supabase = await createClient();

  // Panels, Inverters, Batteries are from their respective tables
  if (['panel', 'inverter', 'battery'].includes(category)) {
    let tableName = `eq_${category}s`;
    if (category === 'battery') tableName = 'eq_batteries';
    
    let query = supabase.from(tableName as any).select('*').eq('is_active', true);
    if (search) {
      query = query.or(`brand.ilike.%${search}%,model.ilike.%${search}%`);
    }
    const { data } = await query.limit(50);
    return (data || []).filter((item: any) => !isPlaceholderEquipment(item)).map((item: any) => ({
      id: item.id,
      type: category,
      description: [item.brand, item.model].filter(Boolean).join(' ') || item.name || 'Unnamed item',
      brand: item.brand,
      model: item.model,
      unit: 'Nos',
      defaultQty: 1,
      defaultRate: Number(item.selling_price || 0),
      isSurveyDependent: false,
    }));
  } else {
    let section: string | null = null;
    switch(category) {
      case 'structure': section = 'mounting_structure'; break;
      case 'dc_protection':
      case 'ac_protection': section = 'electrical_protection'; break;
      case 'cable': section = 'cabling'; break;
      case 'earthing': section = 'earthing'; break;
      case 'civil':
      case 'logistics': section = 'services'; break;
      case 'accessory': section = 'wiring'; break;
    }

    if (!section) return [];

    let query = supabase.from('bom_template_items').select('*').eq('category_id' as any, section);
    if (search) {
      query = query.ilike('description', `%${search}%`);
    }

    const { data } = await query.limit(50);
    return (data || []).map((item: any) => ({
      id: item.id,
      type: 'equipment',
      description: item.description,
      brand: '',
      model: '',
      unit: item.unit || 'units',
      defaultQty: 1,
      defaultRate: Number(item.default_rate || 0),
      isSurveyDependent: false,
    }));
  }
}
