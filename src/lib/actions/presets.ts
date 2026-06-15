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
    supabase.from('eq_panels').select('id, brand, model, selling_price'),
    supabase.from('eq_inverters').select('id, brand, model, selling_price'),
    supabase.from('eq_batteries').select('id, brand, model, selling_price'),
    supabase.from('eq_meters').select('id, brand, model, selling_price'),
    supabase.from('eq_lightning_arresters').select('id, brand, model, selling_price'),
    supabase.from('eq_mounting_structures').select('id, name, selling_price'),
    supabase.from('eq_bom_items').select('id, description, selling_price'),
    supabase.from('eq_communication_devices').select('id, brand, model, selling_price'),
    supabase.from('structure_component_master').select('id, name, selling_price'),
  ]);

  const panels = panelsRes.data || [];
  const inverters = invertersRes.data || [];
  const batteries = batteriesRes.data || [];
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
      catalogType = 'bom_template';
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
        unitRate = Number(bom.selling_price || 0);
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
      catalogType = 'bom_template';
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
    lineItems: mappedItems.sort((a, b) => a.sortOrder - b.sortOrder)
  };
}

export async function savePresetWithComponents(
  presetId: string,
  updates: {
    name: string;
    systemType: string;
    notes?: string;
    lineItems: LineItem[];
  }
) {
  const supabase = await createClient();

  // 1. Update preset metadata in systems table
  const { error: presetErr } = await supabase
    .from('systems' as any)
    .update({
      name: updates.name,
      category: updates.systemType,
      updated_at: new Date().toISOString(),
    })
    .eq('id', presetId);

  if (presetErr) throw new Error('Failed to update system metadata: ' + presetErr.message);

  // 2. Delete old system items
  const { error: delErr } = await supabase
    .from('system_items' as any)
    .delete()
    .eq('system_id', presetId);

  if (delErr) throw new Error('Failed to delete old system items: ' + delErr.message);

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
      system_id: presetId,
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
      structure_id: item.category === 'structure' && item.catalogType === 'bom_template' && !item.description.includes('GP') ? item.catalogItemId : null,
      solar_meter_id: isSolarMeter ? item.catalogItemId : null,
      net_meter_id: isNetMeter ? item.catalogItemId : null,
      la_id: isLA ? item.catalogItemId : null,
      bom_item_id: item.catalogType === 'bom_template' && item.category !== 'structure' ? item.catalogItemId : null,
      comm_device_id: isCommDevice ? item.catalogItemId : null,
      structure_component_id: item.category === 'structure' && (item.catalogType === 'bom_template' || item.catalogType === 'equipment') && (item.description.includes('GP') || !item.catalogItemId) ? item.catalogItemId : null,
    };
  });

  const { error: insErr } = await supabase
    .from('system_items' as any)
    .insert(itemsToInsert);

  if (insErr) throw new Error('Failed to insert new system items: ' + insErr.message);

  revalidatePath('/');
  revalidatePath('/systems');
}

export async function getCatalogItems(category: string, search?: string) {
  const supabase = await createClient();

  // Panels, Inverters, Batteries are from their respective tables
  if (['panel', 'inverter', 'battery'].includes(category)) {
    let tableName = `eq_${category}s`;
    if (category === 'battery') tableName = 'eq_batteries';
    
    let query = supabase.from(tableName as any).select('*');
    if (search) {
      query = query.ilike('model', `%${search}%`); // assuming search by model
    }
    const { data } = await query.limit(50);
    return (data || []).map((item: any) => ({
      id: item.id,
      type: category,
      description: item.model ? `${item.brand} ${item.model}` : item.name || 'Unknown',
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

    let query = supabase.from('eq_bom_items').select('*').eq('section' as any, section);
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
      defaultRate: Number(item.selling_price || 0),
      isSurveyDependent: false,
    }));
  }
}
