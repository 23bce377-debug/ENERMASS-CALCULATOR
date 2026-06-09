import { Client } from 'pg';
import * as crypto from 'crypto';

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
      p.rate_per_watt as panel_rate_per_watt, p.gst_pct as panel_gst_pct, p.wattage_w as panel_wattage_w,
      inv.rate as inverter_rate, inv.gst_pct as inverter_gst_pct,
      bat.rate as battery_rate, bat.gst_pct as battery_gst_pct,
      sm.rate as solar_meter_rate, sm.gst_pct as solar_meter_gst_pct,
      nm.rate as net_meter_rate, nm.gst_pct as net_meter_gst_pct,
      la.rate as la_rate, la.gst_pct as la_gst_pct,
      struct.name as struct_name, struct.material as struct_material, struct.roof_mount_type as struct_roof_mount_type,
      struct.flat_rate as struct_flat_rate, struct.per_watt_rate as struct_per_watt_rate, struct.gst_pct as struct_gst_pct,
      struct.raw_material_rate as struct_raw_material_rate, struct.fabrication_rate as struct_fabrication_rate, struct.galvanizing_rate as struct_galvanizing_rate,
      struct.base_weight_kg as struct_base_weight_kg, struct.wastage_pct as struct_wastage_pct, struct.fastener_weight_pct as struct_fastener_weight_pct,
      bom.rate as bom_rate, bom.gst_pct as bom_gst_pct,
      comm.rate as comm_rate, comm.gst_pct as comm_gst_pct
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
    WHERE si.system_id = $1
    ORDER BY si.sort_order ASC`,
    [system.id]
  );

  const lines = [];
  let structureRequirements: DbCalculatorOutput['structureRequirements'] = undefined;

  for (const item of itemsRes.rows) {
    const descUpper = item.description.toUpperCase();
    let rate = 0;
    let qty = Number(item.default_qty || 0);
    let gstPct = 0.18;
    let remarks = item.remarks || '';
    let unit = item.unit || 'Nos';

    // Apply equipment selection overrides if matching description
    if (descUpper === 'PANEL') {
      const panelId = input.equipmentSelection?.panelId;
      let pRatePerWatt = Number(item.panel_rate_per_watt || 0);
      let pGstPct = Number(item.panel_gst_pct || 0.05);
      let pWattage = Number(item.panel_wattage_w || 550);
      if (panelId) {
        const pRes = await client.query('SELECT * FROM eq_panels WHERE id = $1', [panelId]);
        if (pRes.rows.length > 0) {
          pRatePerWatt = Number(pRes.rows[0].rate_per_watt || 0);
          pGstPct = Number(pRes.rows[0].gst_pct || 0.05);
          pWattage = Number(pRes.rows[0].wattage_w || 550);
        }
      }
      rate = pRatePerWatt * pWattage;
      gstPct = pGstPct;
    } 
    else if (descUpper === 'INVERTER') {
      const inverterId = input.equipmentSelection?.inverterId;
      let invRate = Number(item.inverter_rate || 0);
      let invGst = Number(item.inverter_gst_pct || 0.12);
      if (inverterId) {
        const invRes = await client.query('SELECT * FROM eq_inverters WHERE id = $1', [inverterId]);
        if (invRes.rows.length > 0) {
          invRate = Number(invRes.rows[0].rate || 0);
          invGst = Number(invRes.rows[0].gst_pct || 0.12);
        }
      }
      rate = invRate;
      gstPct = invGst;
    } 
    else if (descUpper === 'BATTERY') {
      const batteryId = input.equipmentSelection?.batteryId;
      let batRate = Number(item.battery_rate || 0);
      let batGst = Number(item.battery_gst_pct || 0.12);
      if (batteryId) {
        const batRes = await client.query('SELECT * FROM eq_batteries WHERE id = $1', [batteryId]);
        if (batRes.rows.length > 0) {
          batRate = Number(batRes.rows[0].rate || 0);
          batGst = Number(batRes.rows[0].gst_pct || 0.12);
        }
      }
      rate = batRate;
      gstPct = batGst;
    }
    else if (descUpper.includes('SOLAR METER')) {
      const meterId = input.equipmentSelection?.solarMeterId;
      let mRate = Number(item.solar_meter_rate || 0);
      let mGst = Number(item.solar_meter_gst_pct || 0.18);
      if (meterId) {
        const mRes = await client.query('SELECT * FROM eq_meters WHERE id = $1', [meterId]);
        if (mRes.rows.length > 0) {
          mRate = Number(mRes.rows[0].rate || 0);
          mGst = Number(mRes.rows[0].gst_pct || 0.18);
        }
      }
      rate = mRate;
      gstPct = mGst;
    }
    else if (descUpper.includes('NET METER')) {
      const meterId = input.equipmentSelection?.netMeterId;
      let mRate = Number(item.net_meter_rate || 0);
      let mGst = Number(item.net_meter_gst_pct || 0.18);
      if (meterId) {
        const mRes = await client.query('SELECT * FROM eq_meters WHERE id = $1', [meterId]);
        if (mRes.rows.length > 0) {
          mRate = Number(mRes.rows[0].rate || 0);
          mGst = Number(mRes.rows[0].gst_pct || 0.18);
        }
      }
      rate = mRate;
      gstPct = mGst;
    }
    else if (descUpper.includes('LIGHTNING') || descUpper === 'L/A' || descUpper === 'LIGHTNING ARRESTER') {
      const laId = input.equipmentSelection?.lightningArresterId;
      let laRate = Number(item.la_rate || 0);
      let laGst = Number(item.la_gst_pct || 0.18);
      if (laId) {
        const laRes = await client.query('SELECT * FROM eq_lightning_arresters WHERE id = $1', [laId]);
        if (laRes.rows.length > 0) {
          laRate = Number(laRes.rows[0].rate || 0);
          laGst = Number(laRes.rows[0].gst_pct || 0.18);
        }
      }
      rate = laRate;
      gstPct = laGst;
    }
    else if (descUpper === 'STRUCTURE') {
      const structId = input.equipmentSelection?.structureId || item.structure_id;
      let structRow = item;
      if (input.equipmentSelection?.structureId) {
        const sRes = await client.query('SELECT * FROM eq_mounting_structures WHERE id = $1', [structId]);
        if (sRes.rows.length > 0) {
          const r = sRes.rows[0];
          structRow = {
            ...item,
            struct_name: r.name,
            struct_material: r.material,
            struct_roof_mount_type: r.roof_mount_type,
            struct_flat_rate: r.flat_rate,
            struct_per_watt_rate: r.per_watt_rate,
            struct_gst_pct: r.gst_pct,
            struct_raw_material_rate: r.raw_material_rate,
            struct_fabrication_rate: r.fabrication_rate,
            struct_galvanizing_rate: r.galvanizing_rate,
            struct_base_weight_kg: r.base_weight_kg,
            struct_wastage_pct: r.wastage_pct,
            struct_fastener_weight_pct: r.fastener_weight_pct
          };
        }
      }

      if (structRow.struct_name) {
        gstPct = Number(structRow.struct_gst_pct || 0.18);
        if (structRow.struct_flat_rate !== null && Number(structRow.struct_flat_rate) > 0) {
          rate = Number(structRow.struct_flat_rate);
          qty = Number(item.default_qty || 1);
          unit = 'Set';
          structureRequirements = {
            structureName: structRow.struct_name,
            material: structRow.struct_material,
            roofMountType: structRow.struct_roof_mount_type,
            baseWeightKg: 0,
            wastagePct: 0,
            fastenerWeightPct: 0,
            pricingMode: 'flat'
          };
        } 
        else if (structRow.struct_per_watt_rate !== null && Number(structRow.struct_per_watt_rate) > 0) {
          rate = Number(structRow.struct_per_watt_rate) * capacity * 1000;
          qty = 1;
          unit = 'Set';
          structureRequirements = {
            structureName: structRow.struct_name,
            material: structRow.struct_material,
            roofMountType: structRow.struct_roof_mount_type,
            baseWeightKg: 0,
            wastagePct: 0,
            fastenerWeightPct: 0,
            pricingMode: 'per_watt'
          };
        } 
        else {
          // Weight-based calculation
          const lookupRes = await client.query(
            `SELECT * FROM structure_weight_lookup 
             WHERE structure_id = $1 AND $2 >= capacity_kw_min AND $2 <= capacity_kw_max LIMIT 1`,
            [structId, capacity]
          );

          let lookupWeight = 0;
          if (lookupRes.rows.length > 0) {
            lookupWeight = Number(lookupRes.rows[0].total_weight_kg);
          }

          const baseWeight = Number(structRow.struct_base_weight_kg || 0);
          const wastage = Number(structRow.struct_wastage_pct || 0.05);
          const fasteners = Number(structRow.struct_fastener_weight_pct || 0.02);

          const finalWeight = (lookupWeight + baseWeight) * (1 + wastage) * (1 + fasteners);
          const ratePerKg = Number(structRow.struct_raw_material_rate || 0) + 
                            Number(structRow.struct_fabrication_rate || 0) + 
                            Number(structRow.struct_galvanizing_rate || 0);

          qty = finalWeight;
          rate = ratePerKg;
          unit = 'kg';
          remarks = `${structRow.struct_name} (${lookupWeight.toFixed(1)}kg lookup)`;

          structureRequirements = {
            structureName: structRow.struct_name,
            material: structRow.struct_material,
            roofMountType: structRow.struct_roof_mount_type,
            baseWeightKg: baseWeight,
            wastagePct: wastage,
            fastenerWeightPct: fasteners,
            lookupWeightKg: lookupWeight,
            totalWeightKg: finalWeight,
            ratePerKg: ratePerKg,
            pricingMode: 'weight'
          };
        }
      }
    } 
    else if (item.bom_item_id) {
      rate = Number(item.bom_rate || 0);
      gstPct = Number(item.bom_gst_pct || 0.18);
    } 
    else if (item.comm_device_id) {
      rate = Number(item.comm_rate || 0);
      gstPct = Number(item.comm_gst_pct || 0.18);
    }

    const lineTotal = qty * rate;
    const lineGST = lineTotal * gstPct;
    const lineSubTotal = lineTotal + lineGST;

    lines.push({
      description: item.description,
      section: item.section,
      qty,
      rate,
      gstPct,
      lineTotal,
      lineGST,
      lineSubTotal,
      remarks,
      unit
    });
  }

  // 4. Calculate aggregates
  const costBeforeGST = lines.reduce((sum, l) => sum + l.lineTotal, 0);
  const totalInputGST = lines.reduce((sum, l) => sum + l.lineGST, 0);
  const totalIncGST = costBeforeGST + totalInputGST;

  // 5. Margin & Pricing
  const projectType = input.pricingContext?.projectType || 'residential';
  const targetMarginPct = input.pricingContext?.targetMarginPct !== undefined
    ? Number(input.pricingContext.targetMarginPct)
    : Number(system.targetMarginPct);

  const gstOnOutput = Number(stateRule.gst_on_output);

  const mrpExclGST = costBeforeGST * (1 + targetMarginPct);
  const outputGstAmount = mrpExclGST * gstOnOutput;
  const mrpInclGST = mrpExclGST + outputGstAmount;
  const marginAmount = mrpExclGST - costBeforeGST;

  const finalCustomerPrice = mrpInclGST;

  // 6. Subsidy Slabs
  let subsidyAmount = 0;
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

      const maxCapacity = override && override.max_absolute_override !== null
        ? Number(override.max_absolute_override)
        : Number(scheme.max_capacity_kw);

      const capacityForSubsidy = Math.min(capacity, maxCapacity);

      const slabsRes = await client.query(
        `SELECT * FROM scheme_slabs WHERE scheme_id = $1 ORDER BY slab_index ASC`,
        [scheme.id]
      );
      const slabs = slabsRes.rows;

      let subsidy = 0;
      for (const slab of slabs) {
        const start = Number(slab.start_kw);
        if (capacityForSubsidy <= start) {
          break;
        }
        if (slab.is_fixed_amount) {
          subsidy += Number(slab.fixed_amount ?? 0);
        } else {
          const end = slab.end_kw === null ? capacityForSubsidy : Math.min(capacityForSubsidy, Number(slab.end_kw));
          subsidy += (end - start) * Number(slab.rate_per_kw);
        }
      }

      let finalSubsidy = subsidy;
      if (scheme.max_absolute_subsidy) {
        finalSubsidy = Math.min(finalSubsidy, Number(scheme.max_absolute_subsidy));
      }
      if (override && override.max_absolute_override) {
        finalSubsidy = Math.min(finalSubsidy, Number(override.max_absolute_override));
      }
      if (override && override.additional_state_subsidy) {
        finalSubsidy += Number(override.additional_state_subsidy);
      }
      subsidyAmount = finalSubsidy;
    }
  }

  const beneficiaryContribution = Math.max(0, finalCustomerPrice - subsidyAmount);

  // 7. Energy projections (database state rule driven)
  const sunHours = Number(stateRule.sun_hours_per_day);
  const perfRatio = Number(stateRule.performance_ratio);
  const dailyGen = capacity * sunHours * perfRatio;
  const annualGen = dailyGen * 365;
  
  const tariff = Number(stateRule.grid_tariff_inr);
  const annualSavings = annualGen * tariff;
  const payback = annualSavings > 0 ? beneficiaryContribution / annualSavings : 0;

  return {
    lines,
    structureRequirements,
    pricing: {
      costBeforeGST,
      totalInputGST,
      totalIncGST,
      mrpExclGST,
      mrpInclGST,
      discountAmount: 0
    },
    gst: {
      gstOnOutput,
      outputGstAmount
    },
    subsidy: {
      schemeName,
      subsidyAmount
    },
    margin: {
      targetMarginPct,
      marginAmount
    },
    customerPrice: {
      finalCustomerPrice,
      beneficiaryContribution
    },
    energy: {
      dailyGenerationKWh: dailyGen,
      annualGenerationKWh: annualGen,
      annualSavingsINR: annualSavings,
      paybackYears: payback
    }
  };
}
