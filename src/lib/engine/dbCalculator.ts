import { Client } from 'pg';
import * as crypto from 'crypto';
import { calculateSystem, type CalcInput, type CalcResult } from './calculator';
import { TAX_CONSTANTS } from '@/lib/tax-constants';
import { getCachedMasterData } from '@/lib/cache/masterCache';
import { resolveEffectiveRate, resolveEffectiveMargin } from './overrideResolver';

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
  orgId?: string | null;
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

  // Fetch Cached Master Data scoped by orgId
  const masterData = await getCachedMasterData(input.orgId ?? null);

  // 1. Fetch system template from database
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

  // 2. Fetch state rules from database
  const stateRes = await client.query(
    'SELECT * FROM state_rules WHERE state_name = $1 OR state_code = $1 LIMIT 1',
    [input.state]
  );
  if (stateRes.rows.length === 0) {
    throw new Error(`State rules not found: "${input.state}"`);
  }
  const stateRule = stateRes.rows[0];

  // 3. Fetch system items junction rows from database
  const itemsRes = await client.query(
    `SELECT * FROM system_items WHERE system_id = $1 ORDER BY sort_order ASC`,
    [system.id]
  );

  // 4. Fetch minor tables not stored in master cache (comm devices and structure component master)
  const [commRes, scmRes] = await Promise.all([
    client.query('SELECT * FROM eq_communication_devices WHERE is_active = true'),
    client.query('SELECT * FROM structure_component_master WHERE is_active = true')
  ]);
  const dbCommDevices = commRes.rows;
  const dbStructureComponentMasters = scmRes.rows;

  // Build rate overrides maps
  const rateMasterMap: Record<string, { rate: number; active: boolean }> = {};
  if (masterData.rateMaster) {
    masterData.rateMaster.forEach(r => {
      rateMasterMap[r.item_name] = { rate: r.override_rate, active: r.is_active };
    });
  }

  const orgCategoryMargins: Record<string, number> = {};
  if (masterData.categoryMargins) {
    masterData.categoryMargins.forEach(m => {
      orgCategoryMargins[m.category] = m.default_margin_pct;
    });
  }

  const stateRateOverrides: Record<string, number> = {};

  // Build cached equipment arrays
  const dbPanels = masterData.panels.map(p => ({
    id: p.id,
    brand: p.brand,
    model: p.model,
    wattage: Number(p.wattage_w),
    ratePerWatt: Number(p.rate_per_watt),
    gst_pct: Number(p.gst_pct)
  }));

  const dbInverters = masterData.inverters.map(inv => ({
    id: inv.id,
    brand: inv.brand,
    model: inv.model,
    rate: Number(inv.rate),
    capacityKW: Number(inv.capacity_kw),
    gst_pct: Number(inv.gst_pct)
  }));

  const dbBatteries = masterData.batteries.map(bat => ({
    id: bat.id,
    brand: bat.brand,
    model: bat.model,
    rate: Number(bat.rate),
    gst_pct: Number(bat.gst_pct)
  }));

  const dbMeters = masterData.meters.map(m => ({
    id: m.id,
    brand: m.brand,
    model: m.model,
    rate: Number(m.selling_price),
    gst_pct: Number(m.gst_pct),
    description: m.description || `${m.brand || ''} ${m.model || ''}`.trim(),
    meter_type: m.meter_type
  }));

  const dbLAs = masterData.lightningArresters.map(la => ({
    id: la.id,
    brand: la.brand,
    model: la.model,
    rate: Number(la.selling_price),
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

  const dbStructures = masterData.structures.map(s => ({
    id: s.id,
    name: s.name,
    material: s.material,
    roof_mount_type: s.roof_mount_type,
    // DB column is selling_price; expose as both flat_rate (for calculator compat) and selling_price
    flat_rate: s.selling_price !== null && s.selling_price !== undefined ? s.selling_price : null,
    selling_price: s.selling_price,
    per_watt_rate: s.per_watt_rate,
    gst_pct: s.gst_pct,
    raw_material_rate: s.raw_material_rate,
    fabrication_rate: s.fabrication_rate,
    galvanizing_rate: s.galvanizing_rate,
    base_weight_kg: s.base_weight_kg,
    wastage_pct: s.wastage_pct,
    fastener_weight_pct: s.fastener_weight_pct,
    rate_per_kg: s.rate_per_kg
  }));

  const dbWeightLookups = masterData.weightLookups.map(w => ({
    id: w.id,
    structure_id: w.structure_id,
    capacity_kw_min: Number(w.capacity_kw_min),
    capacity_kw_max: Number(w.capacity_kw_max),
    total_weight_kg: Number(w.total_weight_kg)
  }));

  const dbOrientationMultipliers: Record<string, number> = {};
  masterData.orientationMultipliers.forEach(r => {
    dbOrientationMultipliers[r.orientation] = Number(r.multiplier);
  });

  const projectType = input.pricingContext?.projectType || 'residential';
  
  // Resolve Target Margin using precedence: Org Override (via resolveEffectiveMargin) -> Global Default
  const inputMargin = input.pricingContext?.targetMarginPct !== undefined
    ? Number(input.pricingContext.targetMarginPct)
    : Number(system.target_margin_pct);

  const resolvedMargin = resolveEffectiveMargin(
    system.category,
    inputMargin,
    orgCategoryMargins
  );
  const targetMarginPct = resolvedMargin.marginPct;

  const gstOnOutput = Number(stateRule.gst_on_output);

  // Load schemes and slabs from cached masterData
  let slabs: any[] = [];
  let maxCapacity = undefined;
  let schemeName = undefined;

  if (projectType === 'residential') {
    const scheme = masterData.schemes.find(s => s.applies_to === 'residential');
    if (scheme) {
      schemeName = scheme.name;

      const override = masterData.schemeOverrides.find(o => o.scheme_id === scheme.id && o.state_id === stateRule.id);
      maxCapacity = override && override.max_absolute_override !== null
        ? Number(override.max_absolute_override)
        : Number(scheme.max_capacity_kw);

      slabs = masterData.slabs
        .filter(s => s.scheme_id === scheme.id)
        .sort((a, b) => a.slab_index - b.slab_index);
    }
  }

  // Construct generic system items for matching and fallback
  const systemItems = itemsRes.rows.map(item => {
    let rate = 0;
    let gstPct: any = TAX_CONSTANTS.COMMERCIAL_GST_RATE;
    
    if (item.bom_item_id) {
      const bom = masterData.bomTemplateItems.find(x => x.id === item.bom_item_id);
      if (bom) {
        // Apply strict precedence: Org Override -> State Override -> Category Override -> Global Default
        const resolved = resolveEffectiveRate(
          item.description,
          bom.default_rate ?? 0,
          undefined,
          rateMasterMap,
          stateRateOverrides
        );
        rate = resolved.rate;
        gstPct = 0.18; // default GST for template items
      }
    } else if (item.comm_device_id) {
      const comm = dbCommDevices.find(c => c.id === item.comm_device_id);
      rate = comm ? Number(comm.selling_price) : 0;
      gstPct = comm ? Number(comm.gst_pct) : 0.12;
    } else if (item.structure_component_id) {
      const scm = dbStructureComponentMasters.find(s => s.id === item.structure_component_id);
      rate = scm ? Number(scm.selling_price) : 0;
      gstPct = scm ? Number(scm.gst_pct) : TAX_CONSTANTS.COMMERCIAL_GST_RATE;
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

  // Resolve grid tariff and inflation rate overrides from app settings
  const resolvedGridTariff = masterData.appSettings?.default_grid_tariff_inr ?? Number(stateRule.grid_tariff_inr);
  const resolvedInflation = masterData.appSettings?.electricity_inflation_pct 
    ? (masterData.appSettings.electricity_inflation_pct / 100) 
    : 0.05;

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

    dbStructureVendors: masterData.structureVendors,
    dbStructureAccessoryRates: masterData.structureAccessoryRates,
    dbStructureMaterialRates: masterData.structureMaterialRates,
    dbStructureTemplates: masterData.structureTemplates,
    dbStructureTemplateItems: masterData.structureTemplateItems,
    dbWalkwayTemplates: masterData.walkwayTemplates,
    dbLadderTemplates: masterData.ladderTemplates,

    gridTariffPerKWh: resolvedGridTariff,
    electricityInflationRate: resolvedInflation,
    rateMaster: rateMasterMap
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
    const vendor = masterData.structureVendors.find(v => v.id === sel.structureVendorId);
    const vendorName = vendor ? vendor.name : 'Unknown';
    const rateRow = masterData.structureMaterialRates.find(r => r.vendor_id === sel.structureVendorId && r.material_type === sel.structureMaterialType);
    const ratePerKg = rateRow ? Number(rateRow.rate_per_kg) : 0;
    
    // Find closest template
    const templates = masterData.structureTemplates.filter(t => t.structure_type === sel.structureMaterialType);
    let templateName = 'Unknown Template';
    let totalWeight = 0;
    let rafterWeight = 0;
    let purlinWeight = 0;
    if (templates.length > 0) {
      const template = templates.reduce((prev, curr) => 
        Math.abs(Number(curr.capacity_kw) - capacity) < Math.abs(Number(prev.capacity_kw) - capacity) ? curr : prev
      );
      templateName = `${template.capacity_kw}kW ${template.structure_type}`;
      
      const templateItems = masterData.structureTemplateItems.filter(item => 
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
