import { Client } from 'pg';
import * as crypto from 'crypto';
import { calculateSystem, type CalcInput, type CalcResult } from './calculator';
import { TAX_CONSTANTS } from '@/lib/tax-constants';

function getUuid(namespace: string, key: string): string {
  const hash = crypto.createHash('sha1').update(`${namespace}:${key}`).digest('hex');
  return [
    hash.substring(0, 8),
    hash.substring(8, 12),
    '5' + hash.substring(13, 16), // v5 UUID
    ((parseInt(hash.substring(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, '0') + hash.substring(18, 20),
    hash.substring(20, 32)
  ].join('-');
}

export interface EquipmentSelection {
  panelId?: string;
  inverterId?: string;
  batteryId?: string;
  solarMeterId?: string;
  netMeterId?: string;
  lightningArresterId?: string;
  structureId?: string;
  structureVendorId?: string;
  structureMaterialType?: string;
  walkwayLengthM?: number;
  ladderLengthM?: number;
}

export interface PricingContext {
  projectType?: 'residential' | 'commercial';
  priceType?: 'standard' | 'premium';
  targetMarginPct?: number;
}

export interface DbCalculatorInput {
  systemId: string; // can be uuid or template name (like '3kwp_ongrid_3.1')
  equipmentSelection?: EquipmentSelection;
  state: string; // state name like 'Gujarat' or state code GJ
  capacity?: number; // capacity override in kW
  pricingContext?: PricingContext;
}

export interface DbCalculatorOutput {
  lines: Array<{
    description: string;
    section: string;
    qty: number;
    rate: number;
    gstPct: number;
    lineTotal: number;
    lineGST: number;
    lineSubTotal: number;
    remarks: string;
    unit: string;
  }>;
  structureRequirements?: {
    structureName: string;
    material: string;
    roofMountType: string;
    baseWeightKg: number;
    wastagePct: number;
    fastenerWeightPct: number;
    lookupWeightKg?: number;
    totalWeightKg?: number;
    rafterWeightKg?: number;
    purlinWeightKg?: number;
    ratePerKg?: number;
    pricingMode: string;
  };
  pricing: {
    costBeforeGST: number;
    totalInputGST: number;
    totalIncGST: number;
    mrpExclGST: number;
    mrpInclGST: number;
    discountAmount: number;
  };
  gst: {
    gstOnOutput: number;
    outputGstAmount: number;
  };
  subsidy: {
    schemeName?: string;
    subsidyAmount: number;
  };
  margin: {
    targetMarginPct: number;
    marginAmount: number;
  };
  customerPrice: {
    finalCustomerPrice: number;
    beneficiaryContribution: number;
  };
  energy: {
    dailyGenerationKWh: number;
    annualGenerationKWh: number;
    annualSavingsINR: number;
    paybackYears: number;
  };
}

export async function calculateSystemFromDb(
  client: Client,
  input: DbCalculatorInput
): Promise<DbCalculatorOutput> {
  // Determine if systemId is a UUID or a logical template ID
  let systemId = input.systemId;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(systemId);
  if (!isUuid) {
    systemId = getUuid('systems', systemId);
  }

  // 1. Fetch system template
  const sysRes = await client.query(
    'SELECT * FROM systems WHERE id = $1 LIMIT 1',
    [systemId]
  );
  if (sysRes.rows.length === 0) {
    throw new Error(`System template not found: "${input.systemId}" (resolved UUID: "${systemId}")`);
  }
  const system = sysRes.rows[0];

  // Resolve capacity
  const capacity = input.capacity !== undefined ? Number(input.capacity) : Number(system.capacity_kw);

  // 2. Fetch state rules
  const stateRes = await client.query(
    'SELECT * FROM state_rules WHERE state_name = $1 OR state_code = $1 LIMIT 1',
    [input.state]
  );
  if (stateRes.rows.length === 0) {
    throw new Error(`State rules not found: "${input.state}"`);
  }
  const stateRule = stateRes.rows[0];

  // 3. Fetch system items junction rows
  const itemsRes = await client.query(
    `SELECT
      si.*,
      (p.selling_price / p.wattage_w) as panel_rate_per_watt, p.gst_pct as panel_gst_pct, p.wattage_w as panel_wattage_w,
      inv.selling_price as inverter_rate, inv.gst_pct as inverter_gst_pct,
      bat.selling_price as battery_rate, bat.gst_pct as battery_gst_pct,
      sm.selling_price as solar_meter_rate, sm.gst_pct as solar_meter_gst_pct,
      nm.selling_price as net_meter_rate, nm.gst_pct as net_meter_gst_pct,
      la.selling_price as la_rate, la.gst_pct as la_gst_pct,
      struct.name as struct_name, struct.material as struct_material, struct.roof_mount_type as struct_roof_mount_type,
      struct.selling_price as struct_flat_rate, struct.per_watt_rate as struct_per_watt_rate, struct.gst_pct as struct_gst_pct,
      struct.raw_material_rate as struct_raw_material_rate, struct.fabrication_rate as struct_fabrication_rate, struct.galvanizing_rate as struct_galvanizing_rate,
      struct.base_weight_kg as struct_base_weight_kg, struct.wastage_pct as struct_wastage_pct, struct.fastener_weight_pct as struct_fastener_weight_pct,
      bom.selling_price as bom_rate, bom.gst_pct as bom_gst_pct,
      comm.selling_price as comm_rate, comm.gst_pct as comm_gst_pct,
      scm.selling_price as structure_component_rate, scm.gst_pct as structure_component_gst_pct
    FROM system_items si
    LEFT JOIN eq_panels p ON si.panel_id = p.id
    LEFT JOIN eq_inverters inv ON si.inverter_id = inv.id
    LEFT JOIN eq_batteries bat ON si.battery_id = bat.id
    LEFT JOIN eq_meters sm ON si.solar_meter_id = sm.id
    LEFT JOIN eq_meters nm ON si.net_meter_id = nm.id
    LEFT JOIN eq_lightning_arresters la ON si.la_id = la.id
    LEFT JOIN eq_mounting_structures struct ON si.structure_id = struct.id
    LEFT JOIN eq_bom_items bom ON si.bom_item_id = bom.id
    LEFT JOIN eq_communication_devices comm ON si.comm_device_id = comm.id
    LEFT JOIN structure_component_master scm ON si.structure_component_id = scm.id
    WHERE si.system_id = $1
    ORDER BY si.sort_order ASC`,
    [system.id]
  );

  // Fetch all active master equipment records (exactly like the frontend store has them cached)
  const [
    pRes, invRes, batRes, mRes, laRes, sRes, wlRes, multRes,
    svRes, smrRes, stRes, stiRes, wtRes, ltRes, sarRes
  ] = await Promise.all([
    client.query('SELECT * FROM eq_panels WHERE is_active = true'),
    client.query('SELECT * FROM eq_inverters WHERE is_active = true'),
    client.query('SELECT * FROM eq_batteries WHERE is_active = true'),
    client.query('SELECT * FROM eq_meters WHERE is_active = true'),
    client.query('SELECT * FROM eq_lightning_arresters WHERE is_active = true'),
    client.query('SELECT * FROM eq_mounting_structures WHERE is_active = true'),
    client.query('SELECT * FROM structure_weight_lookup'),
    client.query('SELECT orientation, multiplier FROM eq_orientation_multipliers'),
    client.query('SELECT * FROM vendors WHERE is_structure_vendor = true'),
    client.query('SELECT * FROM structure_material_rates'),
    client.query('SELECT * FROM structure_templates'),
    client.query('SELECT * FROM structure_template_items'),
    client.query('SELECT * FROM walkway_templates'),
    client.query('SELECT * FROM ladder_templates'),
    client.query('SELECT * FROM structure_accessory_rates WHERE is_active = true')
  ]);

  const dbPanels = pRes.rows.map(p => ({
    id: p.id,
    brand: p.brand,
    model: p.model,
    wattage: Number(p.wattage_w),
    ratePerWatt: Number(p.rate_per_watt || (Number(p.selling_price) / Number(p.wattage_w))),
    gst_pct: Number(p.gst_pct)
  }));

  const dbInverters = invRes.rows.map(inv => ({
    id: inv.id,
    brand: inv.brand,
    model: inv.model,
    rate: Number(inv.selling_price || inv.rate),
    capacityKW: Number(inv.capacity_kw),
    gst_pct: Number(inv.gst_pct)
  }));

  const dbBatteries = batRes.rows.map(bat => ({
    id: bat.id,
    brand: bat.brand,
    model: bat.model,
    rate: Number(bat.selling_price || bat.rate),
    gst_pct: Number(bat.gst_pct)
  }));

  const dbMeters = mRes.rows.map(m => ({
    id: m.id,
    brand: m.brand,
    model: m.model,
    rate: Number(m.selling_price || m.rate),
    gst_pct: Number(m.gst_pct),
    description: m.description || `${m.brand || ''} ${m.model || ''}`.trim(),
    meter_type: m.meter_type
  }));

  const dbLAs = laRes.rows.map(la => ({
    id: la.id,
    brand: la.brand,
    model: la.model,
    rate: Number(la.selling_price || la.rate),
    gst_pct: Number(la.gst_pct),
    description: la.description || `${la.brand || ''} ${la.model || ''}`.trim()
  }));

  const sel = input.equipmentSelection || {};

  // Resolve default selections from junction rows if not overridden
  const selectedPanelId = sel.panelId || itemsRes.rows.find(i => i.description.toUpperCase() === 'PANEL')?.panel_id;
  const selectedInverterId = sel.inverterId || itemsRes.rows.find(i => i.description.toUpperCase() === 'INVERTER')?.inverter_id;
  const selectedBatteryId = sel.batteryId || itemsRes.rows.find(i => i.description.toUpperCase() === 'BATTERY')?.battery_id;
  const selectedSolarMeterId = sel.solarMeterId || itemsRes.rows.find(i => i.description.toUpperCase().includes('SOLAR METER'))?.solar_meter_id;
  const selectedNetMeterId = sel.netMeterId || itemsRes.rows.find(i => i.description.toUpperCase().includes('NET METER'))?.net_meter_id;
  const selectedLAId = sel.lightningArresterId || itemsRes.rows.find(i => i.description.toUpperCase().includes('LIGHTNING') || i.description.toUpperCase() === 'L/A' || i.description.toUpperCase() === 'LIGHTNING ARRESTER')?.la_id;
  const selectedStructureId = sel.structureId || itemsRes.rows.find(i => i.description.toUpperCase() === 'STRUCTURE')?.structure_id;

  // Derive fallbacks from loaded active arrays for optional fields
  const dbDefaultSolarMeterId = dbMeters.find(m => m.meter_type === 'solar_meter')?.id;
  const dbDefaultNetMeterId = dbMeters.find(m => m.meter_type === 'net_meter')?.id;
  const dbDefaultLAId = dbLAs[0]?.id;

  const finalSolarMeterId = selectedSolarMeterId || dbDefaultSolarMeterId;
  const finalNetMeterId = selectedNetMeterId || dbDefaultNetMeterId;
  const finalLAId = selectedLAId || dbDefaultLAId;

  const dbStructures = sRes.rows.map(s => ({
    id: s.id,
    name: s.name,
    material: s.material,
    roof_mount_type: s.roof_mount_type,
    flat_rate: s.flat_rate !== undefined ? s.flat_rate : s.selling_price,
    selling_price: s.selling_price || s.flat_rate,
    per_watt_rate: s.per_watt_rate,
    gst_pct: s.gst_pct,
    raw_material_rate: s.raw_material_rate,
    fabrication_rate: s.fabrication_rate,
    galvanizing_rate: s.galvanizing_rate,
    base_weight_kg: s.base_weight_kg,
    wastage_pct: s.wastage_pct,
    fastener_weight_pct: s.fastener_weight_pct
  }));

  const dbWeightLookups = wlRes.rows.map(w => ({
    id: w.id,
    structure_id: w.structure_id,
    capacity_kw_min: Number(w.capacity_kw_min),
    capacity_kw_max: Number(w.capacity_kw_max),
    panel_qty: w.panel_qty,
    weight_per_panel_kg: Number(w.weight_per_panel_kg),
    bracket_fixed_weight: Number(w.bracket_fixed_weight),
    total_weight_kg: Number(w.total_weight_kg)
  }));

  const dbOrientationMultipliers: Record<string, number> = {};
  multRes.rows.forEach(r => {
    dbOrientationMultipliers[r.orientation] = Number(r.multiplier);
  });

  const projectType = input.pricingContext?.projectType || 'residential';
  const targetMarginPct = input.pricingContext?.targetMarginPct !== undefined
    ? Number(input.pricingContext.targetMarginPct)
    : Number(system.target_margin_pct);

  const gstOnOutput = Number(stateRule.gst_on_output);

  // Load schemes and slabs
  let slabs: any[] = [];
  let maxCapacity = undefined;
  let schemeName = undefined;

  if (projectType === 'residential') {
    const schemeRes = await client.query(
      `SELECT * FROM calculation_schemes 
       WHERE is_active = true AND applies_to = 'residential' LIMIT 1`
    );

    if (schemeRes.rows.length > 0) {
      const scheme = schemeRes.rows[0];
      schemeName = scheme.name;

      const overrideRes = await client.query(
        `SELECT * FROM state_scheme_overrides 
         WHERE state_id = $1 AND scheme_id = $2 AND is_active = true LIMIT 1`,
        [stateRule.id, scheme.id]
      );
      const override = overrideRes.rows[0];

      maxCapacity = override && override.max_absolute_override !== null
        ? Number(override.max_absolute_override)
        : Number(scheme.max_capacity_kw);

      const slabsRes = await client.query(
        `SELECT * FROM scheme_slabs WHERE scheme_id = $1 ORDER BY slab_index ASC`,
        [scheme.id]
      );
      slabs = slabsRes.rows;
    }
  }

  // Construct generic system items for matching and fallback
  const systemItems = itemsRes.rows.map(item => {
    const descUpper = item.description.toUpperCase();
    let rate = 0;
    let gstPct: any = TAX_CONSTANTS.COMMERCIAL_GST_RATE;
    
    if (item.bom_item_id) {
      rate = Number(item.bom_rate || 0);
      gstPct = Number(item.bom_gst_pct || TAX_CONSTANTS.COMMERCIAL_GST_RATE);
    } else if (item.comm_device_id) {
      rate = Number(item.comm_rate || 0);
      gstPct = Number(item.comm_gst_pct || 0.12);
    } else if (item.structure_component_id) {
      rate = Number(item.structure_component_rate || 0);
      gstPct = Number(item.structure_component_gst_pct || TAX_CONSTANTS.COMMERCIAL_GST_RATE);
    }
    
    return {
      description: item.description,
      qty: Number(item.default_qty || 0),
      ratePerUnit: rate,
      gstPct: gstPct,
      unit: item.unit || 'Nos',
      remarks: item.remarks || '',
    };
  });

  const mockSystem: any = {
    id: system.id,
    name: system.name,
    category: system.category,
    capacityKW: capacity,
    panelWattage: system.panel_wattage_w,
    panelQty: system.panel_qty,
    targetMarginPct: Number(system.target_margin_pct),
    items: systemItems
  };

  const stateData = {
    [stateRule.state_name]: {
      name: stateRule.state_name,
      sunHoursPerDay: Number(stateRule.sun_hours_per_day),
      performanceRatio: Number(stateRule.performance_ratio),
      labourMultiplier: Number(stateRule.labour_multiplier),
      gstOnOutput: Number(stateRule.gst_on_output),
      gridTariffInr: Number(stateRule.grid_tariff_inr),
      subsidyRules: []
    }
  };

  const selectedInverterMix = selectedInverterId ? { [selectedInverterId]: Number(system.inverter_qty || 1) } : {};
  const selectedBatteryMix = selectedBatteryId ? { [selectedBatteryId]: Number(system.battery_qty || 1) } : {};
  const panelMix = selectedPanelId ? { [selectedPanelId]: Number(system.panel_qty || system.panel_qty || 0) } : {};

  // Invoke the single source of truth pure function calculateSystem
  const calcResult: CalcResult = calculateSystem({
    systemId: system.id,
    systems: [mockSystem],
    state: stateRule.state_name,
    projectType: projectType,
    targetMarginPct: targetMarginPct,
    gstOnOutput: gstOnOutput,
    stateData,
    slabs,
    maxSubsidyCapacityKW: maxCapacity,
    
    selectedPanelId,
    panelMix,
    selectedInverterMix,
    selectedBatteryMix,
    
    structureId: selectedStructureId,
    structurePricingMode: input.pricingContext?.priceType === 'premium' ? 'flat' : undefined,
    
    solarMeterId: finalSolarMeterId,
    solarMeterQty: 1,
    netMeterId: finalNetMeterId,
    netMeterQty: 1,
    
    lightningArresterId: finalLAId,
    lightningArresterQty: 1,
    
    dbPanels,
    dbInverters,
    dbBatteries,
    dbMeters,
    dbLAs,
    dbStructures,
    dbWeightLookups,
    dbOrientationMultipliers,

    // new fields
    structureVendorId: sel.structureVendorId,
    structureMaterialType: sel.structureMaterialType,
    walkwayLengthM: sel.walkwayLengthM,
    ladderLengthM: sel.ladderLengthM,

    dbStructureVendors: svRes.rows,
    dbStructureAccessoryRates: sarRes.rows,
    dbStructureMaterialRates: smrRes.rows,
    dbStructureTemplates: stRes.rows,
    dbStructureTemplateItems: stiRes.rows,
    dbWalkwayTemplates: wtRes.rows,
    dbLadderTemplates: ltRes.rows
  });

  // Map BOM line results and assign parent section names
  const lines = calcResult.lines.map(line => {
    const desc = line.description.toUpperCase();
    let section = 'services';
    
    if (desc.startsWith('PANEL')) section = 'solar_panels';
    else if (desc.startsWith('INVERTER')) section = 'power_electronics';
    else if (desc.startsWith('BATTERY')) section = 'power_electronics';
    else if (desc.includes('SOLAR METER')) section = 'metering';
    else if (desc.includes('NET METER')) section = 'metering';
    else if (desc.includes('STRUCTURE')) section = 'mounting_structure';
    else if (desc.includes('LIGHTNING') || desc === 'L/A' || desc === 'LIGHTNING ARRESTER') section = 'earthing';
    else {
      const matched = itemsRes.rows.find(i => 
        i.description.toUpperCase() === desc || 
        desc.includes(i.description.toUpperCase())
      );
      if (matched) {
        section = matched.section;
      }
    }

    return {
      description: line.description,
      section,
      qty: line.effectiveQty,
      rate: line.effectiveRate,
      gstPct: line.effectiveGstPct,
      lineTotal: line.lineTotal,
      lineGST: line.lineGST,
      lineSubTotal: line.lineSubTotal,
      remarks: line.remarks || '',
      unit: line.unit || 'Nos'
    };
  });

  // Re-generate structure requirements object
  let structureRequirements = undefined;
  if (sel.structureVendorId && sel.structureMaterialType) {
    const vendor = svRes.rows.find(v => v.id === sel.structureVendorId);
    const vendorName = vendor ? vendor.name : 'Unknown';
    const rateRow = smrRes.rows.find(r => r.vendor_id === sel.structureVendorId && r.material_type === sel.structureMaterialType);
    const ratePerKg = rateRow ? Number(rateRow.rate_per_kg) : 0;
    
    // Find closest template
    const templates = stRes.rows.filter(t => t.structure_type === sel.structureMaterialType);
    let templateName = 'Unknown Template';
    let totalWeight = 0;
    let rafterWeight = 0;
    let purlinWeight = 0;
    if (templates.length > 0) {
      const template = templates.reduce((prev, curr) => 
        Math.abs(Number(curr.capacity_kw) - capacity) < Math.abs(Number(prev.capacity_kw) - capacity) ? curr : prev
      );
      templateName = `${template.capacity_kw}kW ${template.structure_type}`;
      
      const templateItems = stiRes.rows.filter(item => 
        item.template_id === template.id &&
        (item.vendor_id === null || item.vendor_id === sel.structureVendorId)
      );
      templateItems.forEach(item => {
        const itemLower = item.item.toLowerCase().trim();
        const isPrimaryMember = itemLower.includes('rafter') || itemLower.includes('purlin');
        const isRafter = itemLower.includes('rafter');
        const isPurlin = itemLower.includes('purlin');
        if (isPrimaryMember) {
          const w = Number(item.weight || 0) * Number(item.qty || 0);
          totalWeight += w;
          if (isRafter) rafterWeight += w;
          if (isPurlin) purlinWeight += w;
        }
      });
    }

    structureRequirements = {
      structureName: `${vendorName} ${templateName}`,
      material: sel.structureMaterialType,
      roofMountType: 'Ground/Roof',
      baseWeightKg: 0,
      wastagePct: 0,
      fastenerWeightPct: 0,
      totalWeightKg: totalWeight,
      rafterWeightKg: rafterWeight,
      purlinWeightKg: purlinWeight,
      ratePerKg: ratePerKg,
      pricingMode: 'erp'
    };
  } else if (selectedStructureId) {
    const struct = dbStructures.find(s => s.id === selectedStructureId);
    if (struct) {
      const mode = input.pricingContext?.priceType === 'premium' ? 'flat' : (struct.per_watt_rate ? 'per_watt' : 'weight');
      if (mode === 'weight') {
        const wl = dbWeightLookups.find(w => w.structure_id === struct.id);
        const lookupWeight = wl ? wl.total_weight_kg : 0;
        const baseWeight = struct.base_weight_kg;
        const wastage = struct.wastage_pct;
        const fasteners = struct.fastener_weight_pct;
        const finalWeight = (lookupWeight + baseWeight) * (1 + wastage) * (1 + fasteners);
        const ratePerKg = Number(struct.raw_material_rate || 0) + Number(struct.fabrication_rate || 0) + Number(struct.galvanizing_rate || 0);
        
        structureRequirements = {
          structureName: struct.name,
          material: struct.material,
          roofMountType: struct.roof_mount_type,
          baseWeightKg: baseWeight,
          wastagePct: wastage,
          fastenerWeightPct: fasteners,
          lookupWeightKg: lookupWeight,
          totalWeightKg: finalWeight,
          ratePerKg,
          pricingMode: 'weight'
        };
      } else {
        structureRequirements = {
          structureName: struct.name,
          material: struct.material,
          roofMountType: struct.roof_mount_type,
          baseWeightKg: 0,
          wastagePct: 0,
          fastenerWeightPct: 0,
          pricingMode: mode
        };
      }
    }
  }

  return {
    lines,
    structureRequirements,
    pricing: {
      costBeforeGST: calcResult.costBeforeGST,
      totalInputGST: calcResult.totalInputGST,
      totalIncGST: calcResult.totalIncGST,
      mrpExclGST: calcResult.mrpExclGST,
      mrpInclGST: calcResult.mrpInclGST,
      discountAmount: calcResult.discountAmount
    },
    gst: {
      gstOnOutput,
      outputGstAmount: calcResult.mrpExclGST * gstOnOutput
    },
    subsidy: {
      schemeName,
      subsidyAmount: calcResult.subsidyAmount
    },
    margin: {
      targetMarginPct: calcResult.effectiveMarginPct,
      marginAmount: calcResult.marginAmount
    },
    customerPrice: {
      finalCustomerPrice: calcResult.finalCustomerPrice,
      beneficiaryContribution: calcResult.beneficiaryContribution
    },
    energy: {
      dailyGenerationKWh: calcResult.dailyGenerationKWh,
      annualGenerationKWh: calcResult.annualGenerationKWh,
      annualSavingsINR: calcResult.annualSavingsINR,
      paybackYears: calcResult.paybackYears
    }
  };
}
