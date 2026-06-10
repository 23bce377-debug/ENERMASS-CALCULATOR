import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import * as XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import { Client } from 'pg';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Error: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing from .env.local');
  process.exit(1);
}

// Initialize Supabase Admin client
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

interface ImportBatchSummary {
  rows_processed: number;
  rows_imported: number;
  rows_updated: number;
  rows_rejected: number;
  new_equipment_added: number;
  rate_changes_detected: number;
  gst_changes_detected: number;
}

interface ValidationFailure {
  file: string;
  sheet: string;
  row: number;
  item: string;
  reason: string;
}

interface ChangeLogEntry {
  entity_type: string;
  brand?: string;
  model?: string;
  name?: string;
  change_type: 'inserted' | 'updated' | 'deleted';
  old_values: any;
  new_values: any;
}

const validationFailures: ValidationFailure[] = [];
const changeLogs: ChangeLogEntry[] = [];
const summary: ImportBatchSummary = {
  rows_processed: 0,
  rows_imported: 0,
  rows_updated: 0,
  rows_rejected: 0,
  new_equipment_added: 0,
  rate_changes_detected: 0,
  gst_changes_detected: 0
};

// Normalize GST
function normalizeGst(gstVal: any, lineTotal?: number): number {
  if (gstVal === undefined || gstVal === null) return 0.18;
  
  let val = Number(gstVal);
  if (isNaN(val)) return 0.18;

  if (val > 1.0 && lineTotal && lineTotal > 0) {
    const calculatedGst = val / lineTotal;
    const standardSlabs = [0, 0.05, 0.089, 0.12, 0.138, 0.18, 0.28];
    const closest = standardSlabs.reduce((prev, curr) => 
      Math.abs(curr - calculatedGst) < Math.abs(prev - calculatedGst) ? curr : prev
    );
    return closest;
  }

  if (val > 1.0) {
    val = val / 100;
  }

  const standardSlabs = [0, 0.05, 0.089, 0.12, 0.138, 0.18, 0.28];
  const closest = standardSlabs.reduce((prev, curr) => 
    Math.abs(prev - val) < Math.abs(curr - val) ? curr : prev
  );
  return closest;
}

function cleanString(str: any): string {
  if (str === undefined || str === null) return '';
  return String(str).trim().replace(/\s+/g, ' ');
}

function isPositiveNumber(val: any): boolean {
  const num = Number(val);
  return !isNaN(num) && num >= 0;
}

// Map structure material/brand to UUIDs
function resolveStructureId(material: string, textDesc: string): string {
  const isGP = material.toUpperCase() === 'GP';
  const desc = textDesc.toUpperCase();
  if (isGP) {
    if (desc.includes('APPOLO')) return 'e1000000-0000-0000-0000-000000000001';
    return 'e1000000-0000-0000-0000-000000000002'; // Deemac GP
  } else {
    if (desc.includes('APPOLO')) return 'e1000000-0000-0000-0000-000000000003';
    return 'e1000000-0000-0000-0000-000000000004'; // Tata GI
  }
}

function resolveBomItemSectionAndSubType(desc: string): { section: string; subType: string } {
  const u = desc.toUpperCase().trim().replace(/\s+/g, ' ');
  
  // Cables & Wires
  if (u.includes('ALUM CABLE 50 SQMM')) return { section: 'cabling', subType: 'ALUM_CABLE_50_SQMM' };
  if (u.includes('ALUM CABLE 10 SQMM')) return { section: 'cabling', subType: 'ALUM_CABLE_10_SQMM' };
  if (u.includes('ALUM CABLE 16 SQMM')) return { section: 'cabling', subType: 'ALUM_CABLE_16_SQMM' };
  if (u.includes('DC CABLE')) return { section: 'cabling', subType: 'DC_CABLE' };
  if (u.includes('AC CABLE')) return { section: 'cabling', subType: 'AC_CABLE' };
  if (u.includes('CU CABLE') || u === 'CU' || u === 'COPPER') return { section: 'cabling', subType: 'CU_CABLE' };
  if (u.includes('AI CABLE')) return { section: 'cabling', subType: 'AI_CABLE' };
  
  // Earthing items
  if (u.includes('EARTH ROD')) return { section: 'earthing', subType: 'EARTH_ROD' };
  if (u.includes('GI STRIP')) return { section: 'earthing', subType: 'GI_STRIP' };
  if (u.includes('EARTH COMPOUND') || u.includes('CHEMICAL')) return { section: 'earthing', subType: 'EARTH_COMPOUND' };
  if (u.includes('CHAMBER BOX')) return { section: 'earthing', subType: 'CHAMBER_BOX' };
  if (u.includes('EARTH BENCH')) return { section: 'earthing', subType: 'EARTH_BENCH' };
  if (u.includes('EARTHMARKING')) return { section: 'wiring', subType: 'EARTHMARKING' };
  if (u === 'COPPER' || u === 'COPPER ROD') return { section: 'earthing', subType: 'COPPER' };
  
  // Electrical Protection
  if (u.includes('MAIN ACDB')) return { section: 'electrical_protection', subType: 'MAIN_ACDB' };
  if (u.includes('ACDB DCDB')) return { section: 'electrical_protection', subType: 'ACDB_DCDB' };
  if (u.includes('ACDB')) return { section: 'electrical_protection', subType: 'ACDB' };
  if (u.includes('DCDB')) return { section: 'electrical_protection', subType: 'DCDB' };
  if (u.includes('ISOLATOR')) return { section: 'electrical_protection', subType: 'ISOLATOR' };
  if (u.includes('METER BOX')) return { section: 'electrical_protection', subType: 'METER_BOX' };
  if (u === 'AC WIRE') return { section: 'electrical_protection', subType: 'AC_WIRE' };
  
  // Services
  if (u.includes('LIAISONING') || u.includes('KSEB') || u.includes('FEASIBILITY')) {
    if (u.includes('FEASIBILITY')) return { section: 'wiring', subType: 'KSEB_FEASIBILITY' };
    if (u.includes('INSPECTORTATE') || u.includes('INSPECTORATE')) return { section: 'wiring', subType: 'KSEB_INSPECTORTATE' };
    return { section: 'services', subType: 'COMMISSIONING' };
  }
  if (u.includes('SITE VISIT')) return { section: 'services', subType: 'SITE_VISIT' };
  if (u.includes('TRANSPORTATION')) return { section: 'services', subType: 'TRANSPORTATION' };
  if (u.includes('INSTALLATION')) return { section: 'services', subType: 'INSTALLATION' };
  if (u.includes('COMMISSION')) return { section: 'services', subType: 'COMMISSION' };
  
  // Wiring & Accessories
  if (u.includes('WIRING PIPE') || u.includes('CONDUIT')) return { section: 'wiring', subType: 'WIRING_PIPE' };
  if (u.includes('WIRING ACCESSORIES') || u.includes('WIRING ACCCESSORIES')) return { section: 'wiring', subType: 'WIRING_ACCESSORIES' };
  if (u.includes('MC4')) return { section: 'wiring', subType: 'MC4ADDITIONAL' };
  if (u.includes('COMMUNICATION DEVICE')) return { section: 'wiring', subType: 'COMMUNICATION_DEVICE' };
  if (u.includes('CONNECTORS')) return { section: 'wiring', subType: 'CONNECTORS' };
  if (u.includes('BIDIRECTIOANL HYBRID METER') || u.includes('BIDIRECTIOANL METER') || u.includes('HYBRID METER')) return { section: 'wiring', subType: 'BIDIRECTIOANL_HYBRID_METER' };
  if (u.includes('HT BIDIRECTIOANL METER') || u.includes('HT BIDIRECTIONAL METER')) return { section: 'wiring', subType: 'HT_BIDIRECTIONAL_METER' };
  if (u.includes('WIRING TRAY')) return { section: 'wiring', subType: 'WIRING_TRAY' };
  if (u.includes('PIPE ACCESSORIES')) return { section: 'wiring', subType: 'PIPE_ACCESSORIES' };
  if (u.includes('OTHER ACCESSORIES')) return { section: 'wiring', subType: 'OTHER_ACCESSORIES' };
  if (u.includes('WALK WAY') || u.includes('WALKWAY')) return { section: 'wiring', subType: 'WALK_WAY' };
  if (u.includes('VERTICAL LADDER/HAND RAIL')) return { section: 'wiring', subType: 'VERTICAL_LADDER_HAND_RAIL' };
  if (u.includes('VERTICAL LADDER')) return { section: 'wiring', subType: 'VERTICAL_LADDER' };
  if (u.includes('CTPT')) return { section: 'wiring', subType: 'CTPT' };
  if (u.includes('RPR')) return { section: 'wiring', subType: 'RPR' };
  if (u.includes('DOWN CUNDUCTOR LA') || u.includes('DOWN CONDUCTOR')) return { section: 'wiring', subType: 'DOWN_CUNDUCTOR_LA' };
  if (u === 'ACCESSORIES') return { section: 'wiring', subType: 'ACCESSORIES' };
  if (u === 'STRUCTURE') return { section: 'mounting_structure', subType: 'STRUCTURE' };
  if (u === 'PURLIN') return { section: 'wiring', subType: 'PURLIN' };
  if (u === 'RAFTER') return { section: 'wiring', subType: 'RAFTER' };
  if (u === 'STRUCTURE LEG BIG') return { section: 'wiring', subType: 'STRUCTURE_LEG_BIG' };
  if (u === 'STRUCTURE LEG SMALL') return { section: 'wiring', subType: 'STRUCTURE_LEG_SMALL' };
  if (u === 'NUT BOLTS(STRUCTURE)' || u === 'NUT BOLTS (STRUCTURE)' || u.includes('NUT BOLTS(STRUCTURE)')) return { section: 'wiring', subType: 'NUT_BOLTS_STRUCTURE' };
  if (u === 'NUT BOLTS(PANEL)' || u === 'NUT BOLTS (PANEL)' || u.includes('NUT BOLTS(PANEL)')) return { section: 'wiring', subType: 'NUT_BOLTS_PANEL' };
  
  // Defaults
  return { section: 'services', subType: 'ACCESSORIES' };
}

async function run() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run') || args.length === 0;
  const isImport = args.includes('--import');
  const isValidateOnly = args.includes('--validate-only');

  console.log('═══ ENERMASS SOLAR MASTER DATA INGESTION ENGINE ═══');
  console.log(`Execution Mode: ${isDryRun ? 'DRY-RUN' : isValidateOnly ? 'VALIDATION-ONLY' : 'IMPORT'}\n`);

  const excelDir = process.cwd();
  const pricingPath = path.join(excelDir, 'PRICING_8.9%GST.xlsx');
  const structPath = path.join(excelDir, 'structure rate_formulae.xlsx');

  if (!fs.existsSync(pricingPath)) {
    console.error(`❌ Pricing file not found at: ${pricingPath}`);
    process.exit(1);
  }
  if (!fs.existsSync(structPath)) {
    console.error(`❌ Structure file not found at: ${structPath}`);
    process.exit(1);
  }

  // Fetch current database state
  console.log('Fetching existing master data from database...');
  const [
    { data: dbPanels },
    { data: dbInverters },
    { data: dbBatteries },
    { data: dbMeters },
    { data: dbLAs },
    { data: dbBOMItems },
    { data: dbStructures },
    { data: dbWeightLookups },
    { data: dbPricingRefs }
  ] = await Promise.all([
    supabaseAdmin.from('eq_panels').select('*'),
    supabaseAdmin.from('eq_inverters').select('*'),
    supabaseAdmin.from('eq_batteries').select('*'),
    supabaseAdmin.from('eq_meters').select('*'),
    supabaseAdmin.from('eq_lightning_arresters').select('*'),
    supabaseAdmin.from('eq_bom_items').select('*'),
    supabaseAdmin.from('eq_mounting_structures').select('*'),
    supabaseAdmin.from('structure_weight_lookup').select('*'),
    supabaseAdmin.from('pricing_reference').select('*').is('import_batch_id', null) // fetch seeded references
  ]);

  console.log(`Loaded from DB: ${dbPanels?.length ?? 0} panels, ${dbInverters?.length ?? 0} inverters, ${dbBatteries?.length ?? 0} batteries.`);

  // 1. Parse pricing reference
  console.log('\nParsing pricing reference matrix...');
  const pricingWorkbook = XLSX.readFile(pricingPath);
  const pricingSheet = pricingWorkbook.Sheets['pricing'];
  
  const pricingRows: any[] = [];
  if (pricingSheet) {
    const data: any[][] = XLSX.utils.sheet_to_json(pricingSheet, { header: 1 });
    
    let lastCapacity: any = null;
    let lastPanels: any = null;
    let lastInverter: any = null;

    for (let r = 2; r < data.length; r++) {
      const row = data[r];
      if (!row || row.length < 4) continue;

      let capacity = row[0];
      let panels = row[1];
      let inverter = row[2];
      const type = cleanString(row[3]).toLowerCase();
      const beneficiary = row[4];
      const subsidyRaw = row[5];
      const systemPrice = row[6];

      if (type !== 'premium' && type !== 'standard') continue;

      // Fill forward
      if (capacity !== undefined && capacity !== null && capacity !== '') lastCapacity = capacity;
      if (panels !== undefined && panels !== null && panels !== '') lastPanels = panels;
      if (inverter !== undefined && inverter !== null && inverter !== '') lastInverter = inverter;

      const normCapacity = Number(lastCapacity);
      const normPanels = Number(lastPanels);
      const normInverter = lastInverter ? Number(lastInverter) : null;
      const normBeneficiary = Number(beneficiary);
      const normSystemPrice = Number(systemPrice);
      
      let normSubsidy = 0;
      if (subsidyRaw !== undefined && subsidyRaw !== null && String(subsidyRaw).toLowerCase() !== 'no subsidy') {
        normSubsidy = Number(subsidyRaw);
      }

      summary.rows_processed++;

      // Validations
      if (!isPositiveNumber(normCapacity) || isNaN(normCapacity)) {
        validationFailures.push({ file: 'PRICING_8.9%GST.xlsx', sheet: 'pricing', row: r + 1, item: `Capacity`, reason: 'Capacity must be positive number' });
        summary.rows_rejected++;
        continue;
      }
      if (!isPositiveNumber(normPanels) || isNaN(normPanels)) {
        validationFailures.push({ file: 'PRICING_8.9%GST.xlsx', sheet: 'pricing', row: r + 1, item: `Panels`, reason: 'Panels must be positive number' });
        summary.rows_rejected++;
        continue;
      }
      if (!isPositiveNumber(normBeneficiary) || isNaN(normBeneficiary)) {
        validationFailures.push({ file: 'PRICING_8.9%GST.xlsx', sheet: 'pricing', row: r + 1, item: `Beneficiary Contribution`, reason: 'Beneficiary Contribution must be positive number' });
        summary.rows_rejected++;
        continue;
      }
      if (!isPositiveNumber(normSystemPrice) || isNaN(normSystemPrice)) {
        validationFailures.push({ file: 'PRICING_8.9%GST.xlsx', sheet: 'pricing', row: r + 1, item: `System Price`, reason: 'System Price must be positive number' });
        summary.rows_rejected++;
        continue;
      }

      pricingRows.push({
        capacity_kw: normCapacity,
        panels: normPanels,
        inverter_kw: normInverter,
        type: type,
        beneficiary_contribution: normBeneficiary,
        subsidy: normSubsidy,
        system_price: normSystemPrice,
        source_file: 'PRICING_8.9%GST.xlsx',
        sheet_name: 'pricing',
        row_number: r + 1
      });
    }
  }
  console.log(`Parsed pricing references: ${pricingRows.length} valid entries.`);

  // 2. Parse and process capacity-specific systems and equipment
  console.log('\nProcessing equipment specifications and capacity templates...');
  const panelUpserts: any[] = [];
  const inverterUpserts: any[] = [];
  const batteryUpserts: any[] = [];
  const meterUpserts: any[] = [];
  const laUpserts: any[] = [];
  const bomItemUpserts: any[] = [];

  const templateSheets = pricingWorkbook.SheetNames.filter(s => s !== 'pricing');

  for (const sheetName of templateSheets) {
    const sheet = pricingWorkbook.Sheets[sheetName];
    const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    if (data.length === 0) continue;

    // Find header row for items table
    let headerRowIdx = -1;
    for (let r = 0; r < data.length; r++) {
      const row = data[r];
      if (!row) continue;
      const rowStr = row.map(x => String(x).toUpperCase().trim());
      if (rowStr.includes('DESCRIPTION') || rowStr.includes('PANEL') || rowStr.includes('INVERTER')) {
        headerRowIdx = r;
        break;
      }
    }
    if (headerRowIdx === -1) headerRowIdx = 0;

    // Map column indices of items table
    const colHeaders = data[headerRowIdx].map(x => String(x).toUpperCase().trim());
    const descCol = colHeaders.indexOf('DESCRIPTION') !== -1 ? colHeaders.indexOf('DESCRIPTION') : 0;
    const qtyCol = colHeaders.indexOf('QTY') !== -1 ? colHeaders.indexOf('QTY') : 2;
    const rateCol = colHeaders.indexOf('RATE PER UNIT') !== -1 ? colHeaders.indexOf('RATE PER UNIT') : 3;
    const totalCol = colHeaders.indexOf('TOTAL PRICE') !== -1 ? colHeaders.indexOf('TOTAL PRICE') : 4;
    const gstCol = colHeaders.indexOf('GST') !== -1 ? colHeaders.indexOf('GST') : 5;

    // Resolve metadata from columns starting at index 7
    let panelWattage = 550; // default fallback
    let panelRatePerWatt = 25.0; // default fallback
    
    let metadataRowIdx = -1;
    let wattageColIdx = -1;
    let priceColIdx = -1;

    for (let r = 0; r < data.length; r++) {
      const row = data[r];
      if (!row) continue;
      row.forEach((cell, cIdx) => {
        const strCell = String(cell).toUpperCase().trim();
        if (strCell === 'PANEL WATTAGE') {
          metadataRowIdx = r;
          wattageColIdx = cIdx;
        }
        if (strCell === 'PRICE' && metadataRowIdx === r) {
          priceColIdx = cIdx;
        }
      });
      if (metadataRowIdx !== -1) break;
    }

    if (metadataRowIdx !== -1 && metadataRowIdx + 1 < data.length) {
      const valRow = data[metadataRowIdx + 1];
      if (valRow) {
        if (wattageColIdx !== -1 && valRow[wattageColIdx] !== undefined) {
          panelWattage = Number(valRow[wattageColIdx]) || panelWattage;
        }
        if (priceColIdx !== -1 && valRow[priceColIdx] !== undefined) {
          panelRatePerWatt = Number(valRow[priceColIdx]) || panelRatePerWatt;
        }
      }
    }

    // Process item rows
    for (let r = headerRowIdx + 1; r < data.length; r++) {
      const row = data[r];
      if (!row || row.length <= descCol) continue;

      const desc = cleanString(row[descCol]);
      const descUpper = desc.toUpperCase();
      if (!desc || descUpper === 'TOTAL' || descUpper === 'GRAND TOTAL' || descUpper === 'DESCRIPTION' || descUpper === 'NAN' || descUpper.includes('TOTAL') || descUpper.includes('SUM') || descUpper.includes('GST')) continue;

      const qty = row[qtyCol];
      const rate = row[rateCol];
      const gstRaw = row[gstCol];
      const totalRaw = row[totalCol];

      const normQty = Number(qty) || 0;
      const normRate = Number(rate) || 0;
      const normTotal = Number(totalRaw) || (normQty * normRate);
      const normGstPct = normalizeGst(gstRaw, normTotal);

      summary.rows_processed++;

      // Validations
      if (normQty < 0) {
        validationFailures.push({ file: 'PRICING_8.9%GST.xlsx', sheet: sheetName, row: r + 1, item: desc, reason: 'Negative quantity' });
        summary.rows_rejected++;
        continue;
      }
      if (normRate < 0) {
        validationFailures.push({ file: 'PRICING_8.9%GST.xlsx', sheet: sheetName, row: r + 1, item: desc, reason: 'Negative rate' });
        summary.rows_rejected++;
        continue;
      }
      // Entity router
      if (descUpper === 'PANEL') {
        const brand = 'Adani';
        const model = `Adani ${panelWattage}W Mono PERC`;
        const panelType = 'Mono PERC';

        panelUpserts.push({
          brand,
          model,
          wattage_w: panelWattage,
          panel_type: panelType,
          rate_per_watt: panelRatePerWatt,
          rate_per_panel: normRate,
          gst_pct: normGstPct,
          description: desc,
          is_active: true,
          is_custom: false,
          source_file: 'PRICING_8.9%GST.xlsx',
          sheet_name: sheetName,
          row_number: r + 1
        });
      } else if (descUpper === 'INVERTER' || descUpper.includes('MICRO INVERTER') || descUpper.includes('HYBRID INVERTER')) {
        const brand = 'Growatt';
        let inverterType = 'on_grid';
        if (descUpper.includes('HYBRID')) inverterType = 'hybrid';
        else if (descUpper.includes('MICRO')) inverterType = 'micro';

        const capacityMatch = sheetName.match(/(\d+(\.\d+)?)/);
        const capacityKw = capacityMatch ? parseFloat(capacityMatch[1]) : 5.0;
        const phases = sheetName.includes('3 PH') || sheetName.includes('3P') ? 3 : 1;
        const model = `Growatt ${capacityKw}kW ${phases}Phase ${inverterType}`;

        inverterUpserts.push({
          brand,
          model,
          capacity_kw: capacityKw,
          inverter_type: inverterType,
          phases,
          rate: normRate,
          gst_pct: normGstPct,
          is_active: true,
          is_custom: false,
          source_file: 'PRICING_8.9%GST.xlsx',
          sheet_name: sheetName,
          row_number: r + 1
        });
      } else if (descUpper === 'BATTERY') {
        const brand = 'Deye';
        const model = 'Deye 5kWh LFP';
        const chemistry = 'LFP';

        batteryUpserts.push({
          brand,
          model,
          capacity_kwh: 5.0,
          chemistry,
          dod_pct: 0.90,
          rate: normRate,
          gst_pct: normGstPct,
          is_active: true,
          is_custom: false,
          source_file: 'PRICING_8.9%GST.xlsx',
          sheet_name: sheetName,
          row_number: r + 1
        });
      } else if (descUpper.includes('SOLAR METER') || descUpper.includes('NET METER') || descUpper.includes('METER PROTECTION')) {
        const meterType = descUpper.includes('SOLAR') ? 'solar_meter' : 'net_meter';
        const brand = 'Enermass';
        const model = desc;
        const phases = descUpper.includes('3 PHASE') || descUpper.includes('3PH') || sheetName.includes('3 PH') || sheetName.includes('3P') ? 3 : 1;

        meterUpserts.push({
          meter_type: meterType,
          brand,
          model,
          phases,
          rate: normRate,
          gst_pct: normGstPct,
          description: desc,
          is_active: true,
          source_file: 'PRICING_8.9%GST.xlsx',
          sheet_name: sheetName,
          row_number: r + 1
        });
      } else if (descUpper.includes('L/A') || descUpper.includes('LIGHTNING ARRESTER') || descUpper.includes('LA')) {
        const laType = descUpper.includes('MULTI') ? 'multi' : 'single';
        const brand = 'Generic';
        const model = desc;

        laUpserts.push({
          la_type: laType,
          brand,
          model,
          rate: normRate,
          gst_pct: normGstPct,
          description: desc,
          is_active: true,
          source_file: 'PRICING_8.9%GST.xlsx',
          sheet_name: sheetName,
          row_number: r + 1
        });
      } else {
        // Map to Generic BOM Item
        const resolved = resolveBomItemSectionAndSubType(desc);

        bomItemUpserts.push({
          section: resolved.section,
          sub_type: resolved.subType,
          item_description: desc,
          unit: cleanString(row[1]) || 'Nos',
          rate: normRate,
          gst_pct: normGstPct,
          is_active: true,
          source_file: 'PRICING_8.9%GST.xlsx',
          sheet_name: sheetName,
          row_number: r + 1
        });
      }
    }
  }

  // 3. Parse Structure formulae & lookups
  console.log('\nParsing mounting structure lookups and accessory specs...');
  const structWorkbook = XLSX.readFile(structPath);
  
  const weightRows: any[] = [];
  const purlinRafterSheet = structWorkbook.Sheets['purlin n rafter'];
  if (purlinRafterSheet) {
    const data: any[][] = XLSX.utils.sheet_to_json(purlinRafterSheet, { header: 1 });
    
    let currentCapacityMin = 0;
    let currentCapacityMax = 0;
    let panelQty = 0;

    for (let r = 2; r < data.length; r++) {
      const row = data[r];
      if (!row || row.length < 8) continue;

      const label = cleanString(row[0]);
      const material = cleanString(row[1]);
      const textDesc = cleanString(row[2]);

      if (label && label.includes('KW')) {
        const kwMatch = label.match(/(\d+)\s*KW/i);
        const panelMatch = label.match(/(\d+)\s*Panel/i);
        const cap = kwMatch ? parseFloat(kwMatch[1]) : 3.0;
        panelQty = panelMatch ? parseInt(panelMatch[1]) : 6;
        currentCapacityMin = cap;
        currentCapacityMax = cap + 0.999;
      }

      if (material === 'GI' || material === 'GP') {
        const rafterWeight = Number(row[4]) || 0;
        const purlinWeight = Number(row[5]) || 0;
        const totalWeight = Number(row[6]) || 0;

        summary.rows_processed++;

        if (totalWeight > 0) {
          weightRows.push({
            capacity_kw_min: currentCapacityMin,
            capacity_kw_max: currentCapacityMax,
            panel_qty: panelQty,
            material,
            rafter_weight: rafterWeight,
            purlin_weight: purlinWeight,
            total_weight: totalWeight,
            source_file: 'structure rate_formulae.xlsx',
            sheet_name: 'purlin n rafter',
            row_number: r + 1,
            notes: `${material === 'GI' ? 'GI' : 'GP'} Structure Weight Lookup`
          });
        }
      }
    }
  }
  console.log(`Parsed structure weight lookups: ${weightRows.length} valid entries.`);

  // Deduplicate and resolve updates vs inserts
  console.log('\nComparing master data sets...');

  // 1. Process Panels
  const uniquePanels = new Map<string, any>();
  for (const p of panelUpserts) {
    const key = `${p.brand}|${p.model}|${p.wattage_w}`;
    uniquePanels.set(key, p);
  }
  for (const [key, p] of uniquePanels) {
    const match = (dbPanels ?? []).find(x => x.brand === p.brand && x.model === p.model && x.wattage_w === p.wattage_w);
    if (match) {
      const rateDiff = Math.abs(Number(match.selling_price) - p.rate_per_panel) > 0.01;
      const gstDiff = Math.abs(Number(match.gst_pct) - p.gst_pct) > 0.001;

      if (rateDiff || gstDiff) {
        summary.rate_changes_detected += rateDiff ? 1 : 0;
        summary.gst_changes_detected += gstDiff ? 1 : 0;
        summary.rows_updated++;
        changeLogs.push({
          entity_type: 'eq_panels',
          brand: p.brand,
          model: p.model,
          change_type: 'updated',
          old_values: { rate: match.selling_price, gst: match.gst_pct },
          new_values: { rate: p.rate_per_panel, gst: p.gst_pct }
        });
      }
    } else {
      summary.new_equipment_added++;
      summary.rows_imported++;
      changeLogs.push({
        entity_type: 'eq_panels',
        brand: p.brand,
        model: p.model,
        change_type: 'inserted',
        old_values: null,
        new_values: p
      });
    }
  }

  // 2. Process Inverters
  const uniqueInverters = new Map<string, any>();
  for (const i of inverterUpserts) {
    const key = `${i.brand}|${i.model}|${i.capacity_kw}|${i.inverter_type}`;
    uniqueInverters.set(key, i);
  }
  for (const [key, i] of uniqueInverters) {
    const match = (dbInverters ?? []).find(x => x.brand === i.brand && x.model === i.model && Number(x.capacity_kw) === i.capacity_kw && x.inverter_type === i.inverter_type);
    if (match) {
      const rateDiff = Math.abs(Number(match.selling_price) - i.rate) > 0.01;
      const gstDiff = Math.abs(Number(match.gst_pct) - i.gst_pct) > 0.001;

      if (rateDiff || gstDiff) {
        summary.rate_changes_detected += rateDiff ? 1 : 0;
        summary.gst_changes_detected += gstDiff ? 1 : 0;
        summary.rows_updated++;
        changeLogs.push({
          entity_type: 'eq_inverters',
          brand: i.brand,
          model: i.model,
          change_type: 'updated',
          old_values: { rate: match.selling_price, gst: match.gst_pct },
          new_values: { rate: i.rate, gst: i.gst_pct }
        });
      }
    } else {
      summary.new_equipment_added++;
      summary.rows_imported++;
      changeLogs.push({
        entity_type: 'eq_inverters',
        brand: i.brand,
        model: i.model,
        change_type: 'inserted',
        old_values: null,
        new_values: i
      });
    }
  }

  // 3. Process Batteries
  const uniqueBatteries = new Map<string, any>();
  for (const b of batteryUpserts) {
    const key = `${b.brand}|${b.model}|${b.capacity_kwh}`;
    uniqueBatteries.set(key, b);
  }
  for (const [key, b] of uniqueBatteries) {
    const match = (dbBatteries ?? []).find(x => x.brand === b.brand && x.model === b.model && Number(x.capacity_kwh) === b.capacity_kwh);
    if (match) {
      const rateDiff = Math.abs(Number(match.selling_price) - b.rate) > 0.01;
      const gstDiff = Math.abs(Number(match.gst_pct) - b.gst_pct) > 0.001;

      if (rateDiff || gstDiff) {
        summary.rate_changes_detected += rateDiff ? 1 : 0;
        summary.gst_changes_detected += gstDiff ? 1 : 0;
        summary.rows_updated++;
        changeLogs.push({
          entity_type: 'eq_batteries',
          brand: b.brand,
          model: b.model,
          change_type: 'updated',
          old_values: { rate: match.selling_price, gst: match.gst_pct },
          new_values: { rate: b.rate, gst: b.gst_pct }
        });
      }
    } else {
      summary.new_equipment_added++;
      summary.rows_imported++;
      changeLogs.push({
        entity_type: 'eq_batteries',
        brand: b.brand,
        model: b.model,
        change_type: 'inserted',
        old_values: null,
        new_values: b
      });
    }
  }

  // 4. Process Meters
  const uniqueMeters = new Map<string, any>();
  for (const m of meterUpserts) {
    const key = `${m.meter_type}|${m.phases}|${m.brand}|${m.model}`;
    uniqueMeters.set(key, m);
  }
  for (const [key, m] of uniqueMeters) {
    const match = (dbMeters ?? []).find(x => x.meter_type === m.meter_type && x.phases === m.phases && x.brand === m.brand && x.model === m.model);
    if (match) {
      const rateDiff = Math.abs(Number(match.selling_price) - m.rate) > 0.01;
      const gstDiff = Math.abs(Number(match.gst_pct) - m.gst_pct) > 0.001;

      if (rateDiff || gstDiff) {
        summary.rate_changes_detected += rateDiff ? 1 : 0;
        summary.gst_changes_detected += gstDiff ? 1 : 0;
        summary.rows_updated++;
        changeLogs.push({
          entity_type: 'eq_meters',
          brand: m.brand,
          model: m.model,
          change_type: 'updated',
          old_values: { rate: match.selling_price, gst: match.gst_pct },
          new_values: { rate: m.rate, gst: m.gst_pct }
        });
      }
    } else {
      summary.rows_imported++;
      changeLogs.push({
        entity_type: 'eq_meters',
        brand: m.brand,
        model: m.model,
        change_type: 'inserted',
        old_values: null,
        new_values: m
      });
    }
  }

  // 5. Process LAs
  const uniqueLAs = new Map<string, any>();
  for (const la of laUpserts) {
    const key = `${la.la_type}|${la.brand}|${la.model}`;
    uniqueLAs.set(key, la);
  }
  for (const [key, la] of uniqueLAs) {
    const match = (dbLAs ?? []).find(x => x.la_type === la.la_type && x.brand === la.brand && x.model === la.model);
    if (match) {
      const rateDiff = Math.abs(Number(match.selling_price) - la.rate) > 0.01;
      const gstDiff = Math.abs(Number(match.gst_pct) - la.gst_pct) > 0.001;

      if (rateDiff || gstDiff) {
        summary.rate_changes_detected += rateDiff ? 1 : 0;
        summary.gst_changes_detected += gstDiff ? 1 : 0;
        summary.rows_updated++;
        changeLogs.push({
          entity_type: 'eq_lightning_arresters',
          brand: la.brand,
          model: la.model,
          change_type: 'updated',
          old_values: { rate: match.selling_price, gst: match.gst_pct },
          new_values: { rate: la.rate, gst: la.gst_pct }
        });
      }
    } else {
      summary.rows_imported++;
      changeLogs.push({
        entity_type: 'eq_lightning_arresters',
        brand: la.brand,
        model: la.model,
        change_type: 'inserted',
        old_values: null,
        new_values: la
      });
    }
  }

  // 6. Process Generic BOM Items
  const uniqueBOMItems = new Map<string, any>();
  for (const item of bomItemUpserts) {
    const key = `${item.section}|${item.sub_type}|${item.item_description.toUpperCase()}`;
    uniqueBOMItems.set(key, item);
  }
  for (const [key, item] of uniqueBOMItems) {
    const match = (dbBOMItems ?? []).find(x => x.section === item.section && x.sub_type === item.sub_type);
    if (match) {
      const rateDiff = Math.abs(Number(match.selling_price) - item.rate) > 0.01;
      const gstDiff = Math.abs(Number(match.gst_pct) - item.gst_pct) > 0.001;

      if (rateDiff || gstDiff) {
        summary.rate_changes_detected += rateDiff ? 1 : 0;
        summary.gst_changes_detected += gstDiff ? 1 : 0;
        summary.rows_updated++;
        changeLogs.push({
          entity_type: 'eq_bom_items',
          name: item.item_description,
          change_type: 'updated',
          old_values: { rate: match.selling_price, gst: match.gst_pct },
          new_values: { rate: item.rate, gst: item.gst_pct }
        });
      }
    } else {
      summary.rows_imported++;
      changeLogs.push({
        entity_type: 'eq_bom_items',
        name: item.item_description,
        change_type: 'inserted',
        old_values: null,
        new_values: item
      });
    }
  }

  // 7. Process Pricing Reference
  for (const p of pricingRows) {
    const match = (dbPricingRefs ?? []).find(x => Number(x.capacity_kw) === p.capacity_kw && x.type === p.type);
    if (match) {
      const benDiff = Math.abs(Number(match.beneficiary_contribution) - p.beneficiary_contribution) > 0.01;
      const priceDiff = Math.abs(Number(match.system_price) - p.system_price) > 0.01;
      const subDiff = Math.abs(Number(match.subsidy) - p.subsidy) > 0.01;

      if (benDiff || priceDiff || subDiff) {
        summary.rows_updated++;
        changeLogs.push({
          entity_type: 'pricing_reference',
          name: `${p.capacity_kw}kW ${p.type}`,
          change_type: 'updated',
          old_values: { price: match.system_price, subsidy: match.subsidy },
          new_values: { price: p.system_price, subsidy: p.subsidy }
        });
      }
    } else {
      summary.rows_imported++;
      changeLogs.push({
        entity_type: 'pricing_reference',
        name: `${p.capacity_kw}kW ${p.type}`,
        change_type: 'inserted',
        old_values: null,
        new_values: p
      });
    }
  }

  // 8. Process Structure weight lookups
  for (const w of weightRows) {
    const structureId = resolveStructureId(w.material, w.notes);
    const match = (dbWeightLookups ?? []).find(x => x.structure_id === structureId && Number(x.capacity_kw_min) === w.capacity_kw_min && Number(x.capacity_kw_max) === w.capacity_kw_max);
    if (match) {
      const weightDiff = Math.abs(Number(match.bracket_fixed_weight) - w.total_weight) > 0.01;
      if (weightDiff) {
        summary.rows_updated++;
        changeLogs.push({
          entity_type: 'structure_weight_lookup',
          name: `${w.material} ${w.capacity_kw_min}kW-${w.capacity_kw_max}kW`,
          change_type: 'updated',
          old_values: { weight: match.bracket_fixed_weight },
          new_values: { weight: w.total_weight }
        });
      }
    } else {
      summary.rows_imported++;
      changeLogs.push({
        entity_type: 'structure_weight_lookup',
        name: `${w.material} ${w.capacity_kw_min}kW-${w.capacity_kw_max}kW`,
        change_type: 'inserted',
        old_values: null,
        new_values: w
      });
    }
  }

  // Generate Final Verification Report
  console.log('\n==================================================');
  console.log('             VALIDATION & INGESTION REPORT       ');
  console.log('==================================================');
  console.log(`Files Processed: 2`);
  console.log(`Sheets Processed: ${templateSheets.length + 2}`);
  console.log(`Rows Processed: ${summary.rows_processed}`);
  console.log(`Rows to Import (New): ${summary.rows_imported}`);
  console.log(`Rows to Update (Changes): ${summary.rows_updated}`);
  console.log(`Rows Rejected (Failures): ${summary.rows_rejected}`);
  console.log(`New Equipment Added: ${summary.new_equipment_added}`);
  console.log(`Rate Changes Detected: ${summary.rate_changes_detected}`);
  console.log(`GST Changes Detected: ${summary.gst_changes_detected}`);
  
  if (validationFailures.length > 0) {
    console.log('\n--- Validation Failures Logged ---');
    validationFailures.forEach(f => {
      console.log(`⚠️  [${f.file} -> ${f.sheet} (Row ${f.row})] Item: '${f.item}' | Reason: ${f.reason}`);
    });
  } else {
    console.log('\n✅ Zero validation failures detected. Clean data!');
  }

  if (changeLogs.length > 0) {
    console.log('\n--- Planned Database Changes Summary ---');
    changeLogs.forEach(c => {
      if (c.brand && c.model) {
        console.log(`* [${c.entity_type.toUpperCase()}] ${c.change_type.toUpperCase()}: brand='${c.brand}' model='${c.model}'`);
      } else {
        console.log(`* [${c.entity_type.toUpperCase()}] ${c.change_type.toUpperCase()}: name='${c.name}'`);
      }
      if (c.change_type === 'updated') {
        console.log(`  Old: ${JSON.stringify(c.old_values)} -> New: ${JSON.stringify(c.new_values)}`);
      }
    });
  }

  // Database writes
  if (isImport && !isDryRun) {
    console.log('\nExecuting transactional data mutation on the database...');
    const connectionString = process.env.DATABASE_URL;
    if (connectionString) {
      console.log('Connecting via direct PostgreSQL client for transaction safety...');
      const pgClient = new Client({ connectionString });
      pgClient.on('error', (err) => {
        console.error('Database connection error event:', err);
      });
      try {
        await pgClient.connect();
        await pgClient.query('BEGIN');

        console.log('Inserting into master_data_imports...');
        const batchRes = await pgClient.query(
          `INSERT INTO master_data_imports (source_file, status, summary) VALUES ($1, $2, $3) RETURNING id`,
          ['PRICING_8.9%GST.xlsx & structure rate_formulae.xlsx', 'completed', JSON.stringify(summary)]
        );
        const batchId = batchRes.rows[0].id;
        console.log(`Created import batch ID: ${batchId}`);

        // Perform Panel Upserts
        console.log(`Processing ${uniquePanels.size} unique panels...`);
        for (const [key, p] of uniquePanels) {
          const match = (dbPanels ?? []).find(x => x.brand === p.brand && x.model === p.model && x.wattage_w === p.wattage_w);
          if (match) {
            await pgClient.query(
              `UPDATE eq_panels SET buy_price = $1, selling_price = $2, gst_pct = $3, import_batch_id = $4, source_file = $5, sheet_name = $6, row_number = $7, imported_at = NOW(), version = version + 1 WHERE id = $8`,
              [p.rate_per_panel, p.rate_per_panel, p.gst_pct, batchId, p.source_file, p.sheet_name, p.row_number, match.id]
            );
            await pgClient.query(
              `INSERT INTO master_data_changes_log (import_batch_id, entity_type, entity_id, change_type, old_values, new_values) VALUES ($1, $2, $3, $4, $5, $6)`,
              [batchId, 'eq_panels', match.id, 'updated', JSON.stringify({ rate: match.selling_price, gst: match.gst_pct }), JSON.stringify({ rate: p.rate_per_panel, gst: p.gst_pct })]
            );
          } else {
            const insRes = await pgClient.query(
              `INSERT INTO eq_panels (brand, model, wattage_w, panel_type, buy_price, selling_price, gst_pct, description, import_batch_id, source_file, sheet_name, row_number, imported_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW()) RETURNING id`,
              [p.brand, p.model, p.wattage_w, p.panel_type, p.rate_per_panel, p.rate_per_panel, p.gst_pct, p.description, batchId, p.source_file, p.sheet_name, p.row_number]
            );
            const newId = insRes.rows[0].id;
            await pgClient.query(
              `INSERT INTO master_data_changes_log (import_batch_id, entity_type, entity_id, change_type, new_values) VALUES ($1, $2, $3, $4, $5)`,
              [batchId, 'eq_panels', newId, 'inserted', JSON.stringify(p)]
            );
          }
        }

        // Perform Inverter Upserts
        for (const [key, i] of uniqueInverters) {
          const match = (dbInverters ?? []).find(x => x.brand === i.brand && x.model === i.model && Number(x.capacity_kw) === i.capacity_kw && x.inverter_type === i.inverter_type);
          if (match) {
            await pgClient.query(
              `UPDATE eq_inverters SET buy_price = $1, selling_price = $2, gst_pct = $3, import_batch_id = $4, source_file = $5, sheet_name = $6, row_number = $7, imported_at = NOW(), version = version + 1 WHERE id = $8`,
              [i.rate, i.rate, i.gst_pct, batchId, i.source_file, i.sheet_name, i.row_number, match.id]
            );
            await pgClient.query(
              `INSERT INTO master_data_changes_log (import_batch_id, entity_type, entity_id, change_type, old_values, new_values) VALUES ($1, $2, $3, $4, $5, $6)`,
              [batchId, 'eq_inverters', match.id, 'updated', JSON.stringify({ rate: match.selling_price, gst: match.gst_pct }), JSON.stringify({ rate: i.rate, gst: i.gst_pct })]
            );
          } else {
            const insRes = await pgClient.query(
              `INSERT INTO eq_inverters (brand, model, capacity_kw, inverter_type, phases, buy_price, selling_price, gst_pct, import_batch_id, source_file, sheet_name, row_number, imported_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW()) RETURNING id`,
              [i.brand, i.model, i.capacity_kw, i.inverter_type, i.phases, i.rate, i.rate, i.gst_pct, batchId, i.source_file, i.sheet_name, i.row_number]
            );
            const newId = insRes.rows[0].id;
            await pgClient.query(
              `INSERT INTO master_data_changes_log (import_batch_id, entity_type, entity_id, change_type, new_values) VALUES ($1, $2, $3, $4, $5)`,
              [batchId, 'eq_inverters', newId, 'inserted', JSON.stringify(i)]
            );
          }
        }

        // Perform Battery Upserts
        for (const [key, b] of uniqueBatteries) {
          const match = (dbBatteries ?? []).find(x => x.brand === b.brand && x.model === b.model && Number(x.capacity_kwh) === b.capacity_kwh);
          if (match) {
            await pgClient.query(
              `UPDATE eq_batteries SET buy_price = $1, selling_price = $2, gst_pct = $3, import_batch_id = $4, source_file = $5, sheet_name = $6, row_number = $7, imported_at = NOW(), version = version + 1 WHERE id = $8`,
              [b.rate, b.rate, b.gst_pct, batchId, b.source_file, b.sheet_name, b.row_number, match.id]
            );
            await pgClient.query(
              `INSERT INTO master_data_changes_log (import_batch_id, entity_type, entity_id, change_type, old_values, new_values) VALUES ($1, $2, $3, $4, $5, $6)`,
              [batchId, 'eq_batteries', match.id, 'updated', JSON.stringify({ rate: match.selling_price, gst: match.gst_pct }), JSON.stringify({ rate: b.rate, gst: b.gst_pct })]
            );
          } else {
            const insRes = await pgClient.query(
              `INSERT INTO eq_batteries (brand, model, capacity_kwh, chemistry, dod_pct, buy_price, selling_price, gst_pct, import_batch_id, source_file, sheet_name, row_number, imported_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW()) RETURNING id`,
              [b.brand, b.model, b.capacity_kwh, b.chemistry, b.dod_pct, b.rate, b.rate, b.gst_pct, batchId, b.source_file, b.sheet_name, b.row_number]
            );
            const newId = insRes.rows[0].id;
            await pgClient.query(
              `INSERT INTO master_data_changes_log (import_batch_id, entity_type, entity_id, change_type, new_values) VALUES ($1, $2, $3, $4, $5)`,
              [batchId, 'eq_batteries', newId, 'inserted', JSON.stringify(b)]
            );
          }
        }

        // Perform Meter Upserts
        for (const [key, m] of uniqueMeters) {
          const match = (dbMeters ?? []).find(x => x.meter_type === m.meter_type && x.phases === m.phases && x.brand === m.brand && x.model === m.model);
          if (match) {
            await pgClient.query(
              `UPDATE eq_meters SET buy_price = $1, selling_price = $2, gst_pct = $3, import_batch_id = $4, source_file = $5, sheet_name = $6, row_number = $7, imported_at = NOW(), version = version + 1 WHERE id = $8`,
              [m.rate, m.rate, m.gst_pct, batchId, m.source_file, m.sheet_name, m.row_number, match.id]
            );
          } else {
            await pgClient.query(
              `INSERT INTO eq_meters (meter_type, brand, model, phases, buy_price, selling_price, gst_pct, description, import_batch_id, source_file, sheet_name, row_number, imported_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())`,
              [m.meter_type, m.brand, m.model, m.phases, m.rate, m.rate, m.gst_pct, m.description, batchId, m.source_file, m.sheet_name, m.row_number]
            );
          }
        }

        // Perform LA Upserts
        for (const [key, la] of uniqueLAs) {
          const match = (dbLAs ?? []).find(x => x.la_type === la.la_type && x.brand === la.brand && x.model === la.model);
          if (match) {
            await pgClient.query(
              `UPDATE eq_lightning_arresters SET buy_price = $1, selling_price = $2, gst_pct = $3, import_batch_id = $4, source_file = $5, sheet_name = $6, row_number = $7, imported_at = NOW(), version = version + 1 WHERE id = $8`,
              [la.rate, la.rate, la.gst_pct, batchId, la.source_file, la.sheet_name, la.row_number, match.id]
            );
          } else {
            await pgClient.query(
              `INSERT INTO eq_lightning_arresters (la_type, brand, model, buy_price, selling_price, gst_pct, description, import_batch_id, source_file, sheet_name, row_number, imported_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())`,
              [la.la_type, la.brand, la.model, la.rate, la.rate, la.gst_pct, la.description, batchId, la.source_file, la.sheet_name, la.row_number]
            );
          }
        }

        // Perform Generic BOM Item Upserts
        for (const [key, item] of uniqueBOMItems) {
          const match = (dbBOMItems ?? []).find(x => x.section === item.section && x.sub_type === item.sub_type);
          if (match) {
            await pgClient.query(
              `UPDATE eq_bom_items SET buy_price = $1, selling_price = $2, gst_pct = $3, import_batch_id = $4, source_file = $5, sheet_name = $6, row_number = $7, imported_at = NOW(), version = version + 1 WHERE id = $8`,
              [item.rate, item.rate, item.gst_pct, batchId, item.source_file, item.sheet_name, item.row_number, match.id]
            );
          } else {
            await pgClient.query(
              `INSERT INTO eq_bom_items (section, sub_type, description, unit, buy_price, selling_price, gst_pct, import_batch_id, source_file, sheet_name, row_number, imported_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())`,
              [item.section, item.sub_type, item.item_description, item.unit, item.rate, item.rate, item.gst_pct, batchId, item.source_file, item.sheet_name, item.row_number]
            );
          }
        }

        // Perform Pricing Reference Upserts
        for (const p of pricingRows) {
          await pgClient.query(
            `INSERT INTO pricing_reference (capacity_kw, panels, inverter_kw, type, beneficiary_contribution, subsidy, system_price, import_batch_id, source_file, sheet_name, row_number)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             ON CONFLICT (capacity_kw, type) DO UPDATE SET 
               panels = EXCLUDED.panels,
               inverter_kw = EXCLUDED.inverter_kw,
               beneficiary_contribution = EXCLUDED.beneficiary_contribution,
               subsidy = EXCLUDED.subsidy,
               system_price = EXCLUDED.system_price,
               import_batch_id = EXCLUDED.import_batch_id,
               source_file = EXCLUDED.source_file,
               sheet_name = EXCLUDED.sheet_name,
               row_number = EXCLUDED.row_number`,
            [p.capacity_kw, p.panels, p.inverter_kw, p.type, p.beneficiary_contribution, p.subsidy, p.system_price, batchId, p.source_file, p.sheet_name, p.row_number]
          );
        }

        // Perform Structure Weight Lookup Upserts
        for (const w of weightRows) {
          const structureId = resolveStructureId(w.material, w.notes);
          await pgClient.query(
            `INSERT INTO structure_weight_lookup (structure_id, capacity_kw_min, capacity_kw_max, panel_qty, weight_per_panel_kg, bracket_fixed_weight, notes, import_batch_id, source_file, sheet_name, row_number, imported_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
             ON CONFLICT (structure_id, capacity_kw_min, capacity_kw_max) DO UPDATE SET
               panel_qty = EXCLUDED.panel_qty,
               bracket_fixed_weight = EXCLUDED.bracket_fixed_weight,
               notes = EXCLUDED.notes,
               import_batch_id = EXCLUDED.import_batch_id,
               source_file = EXCLUDED.source_file,
               sheet_name = EXCLUDED.sheet_name,
               row_number = EXCLUDED.row_number`,
            [structureId, w.capacity_kw_min, w.capacity_kw_max, w.panel_qty, 0, w.total_weight, `${w.material} structure weight lookup`, batchId, w.source_file, w.sheet_name, w.row_number]
          );
        }

        await pgClient.query('COMMIT');
        console.log('✅ Ingestion database transactions committed successfully!');
      } catch (err) {
        await pgClient.query('ROLLBACK');
        console.error('❌ Ingestion transaction rolled back due to error:', err);
        process.exit(1);
      } finally {
        await pgClient.end();
      }
    } else {
      console.log('⚠️  DATABASE_URL not set in environment or .env.local.');
      console.log('Skipping PG direct transaction writes. Use manual updates or run again with DATABASE_URL set.');
    }
  } else {
    console.log('\nℹ️  Dry run completed. No data was mutated in the database.');
  }
}

run().catch(err => {
  console.error('\n❌ Ingestion runner crashed:', err);
  process.exit(1);
});
