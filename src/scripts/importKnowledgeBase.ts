import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { Client } from 'pg';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const ORG_ID = '00000000-0000-0000-0000-000000000001'; // Default ENERMASS Solar Organisation UUID

// Deterministic UUID generator to keep the pipeline idempotent
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

interface ImportReport {
  timestamp: string;
  summary: {
    panelsImported: number;
    invertersImported: number;
    batteriesImported: number;
    metersImported: number;
    lightningArrestersImported: number;
    structuresImported: number;
    accessoriesImported: number;
    vendorsImported: number;
    gstMasterImported: number;
    pricingReferencesImported: number;
    rulesImported: number;
    systemsImported: number;
    systemItemsImported: number;
    recordsCreated: number;
    recordsUpdated: number;
    totalErrors: number;
    totalWarnings: number;
  };
  errors: string[];
  warnings: string[];
}

const report: ImportReport = {
  timestamp: new Date().toISOString(),
  summary: {
    panelsImported: 0,
    invertersImported: 0,
    batteriesImported: 0,
    metersImported: 0,
    lightningArrestersImported: 0,
    structuresImported: 0,
    accessoriesImported: 0,
    vendorsImported: 0,
    gstMasterImported: 0,
    pricingReferencesImported: 0,
    rulesImported: 0,
    systemsImported: 0,
    systemItemsImported: 0,
    recordsCreated: 0,
    recordsUpdated: 0,
    totalErrors: 0,
    totalWarnings: 0
  },
  errors: [],
  warnings: []
};

function logError(msg: string) {
  console.error(`❌ ERROR: ${msg}`);
  report.errors.push(msg);
  report.summary.totalErrors++;
}

function logWarning(msg: string) {
  console.warn(`⚠️ WARNING: ${msg}`);
  report.warnings.push(msg);
  report.summary.totalWarnings++;
}

// Normalize GST input value to standard decimal slabs
function normalizeGst(gstVal: any, rate?: number): number {
  if (gstVal === undefined || gstVal === null) return 0.18;
  let val = Number(gstVal);
  if (isNaN(val)) return 0.18;

  // If absolute amount is passed (like 6016.8 on a total of 50140)
  if (val > 1.0 && rate && rate > 0) {
    const calc = val / rate;
    const slabs = [0, 0.05, 0.089, 0.12, 0.138, 0.18, 0.28];
    return slabs.reduce((prev, curr) => Math.abs(curr - calc) < Math.abs(prev - calc) ? curr : prev);
  }

  if (val > 1.0) {
    val = val / 100;
  }

  const standardSlabs = [0, 0.05, 0.089, 0.12, 0.138, 0.18, 0.28];
  return standardSlabs.reduce((prev, curr) => Math.abs(prev - val) < Math.abs(curr - val) ? curr : prev);
}

// Map accessory item description to valid BOM section and subType
function resolveBomItemSectionAndSubType(desc: string): { section: string; subType: string } {
  const u = desc.toUpperCase().trim().replace(/\s+/g, ' ');

  if (u.includes('ALUM CABLE 50 SQMM')) return { section: 'cabling', subType: 'ALUM_CABLE_50_SQMM' };
  if (u.includes('ALUM CABLE 10 SQMM')) return { section: 'cabling', subType: 'ALUM_CABLE_10_SQMM' };
  if (u.includes('ALUM CABLE 16 SQMM')) return { section: 'cabling', subType: 'ALUM_CABLE_16_SQMM' };
  if (u.includes('DC CABLE')) return { section: 'cabling', subType: 'DC_CABLE' };
  if (u.includes('AC CABLE')) return { section: 'cabling', subType: 'AC_CABLE' };
  if (u.includes('CU CABLE') || u === 'CU' || u === 'COPPER') return { section: 'cabling', subType: 'CU_CABLE' };
  if (u.includes('AI CABLE')) return { section: 'cabling', subType: 'AI_CABLE' };

  if (u.includes('EARTH ROD')) return { section: 'earthing', subType: 'EARTH_ROD' };
  if (u.includes('GI STRIP')) return { section: 'earthing', subType: 'GI_STRIP' };
  if (u.includes('EARTH COMPOUND') || u.includes('CHEMICAL')) return { section: 'earthing', subType: 'EARTH_COMPOUND' };
  if (u.includes('CHAMBER BOX')) return { section: 'earthing', subType: 'CHAMBER_BOX' };
  if (u.includes('EARTH BENCH')) return { section: 'earthing', subType: 'EARTH_BENCH' };
  if (u.includes('EARTHMARKING')) return { section: 'wiring', subType: 'EARTHMARKING' };
  if (u === 'COPPER' || u === 'COPPER ROD') return { section: 'earthing', subType: 'COPPER' };

  if (u.includes('MAIN ACDB')) return { section: 'electrical_protection', subType: 'MAIN_ACDB' };
  if (u.includes('ACDB DCDB')) return { section: 'electrical_protection', subType: 'ACDB_DCDB' };
  if (u.includes('ACDB')) return { section: 'electrical_protection', subType: 'ACDB' };
  if (u.includes('DCDB')) return { section: 'electrical_protection', subType: 'DCDB' };
  if (u.includes('ISOLATOR')) return { section: 'electrical_protection', subType: 'ISOLATOR' };
  if (u.includes('METER BOX')) return { section: 'electrical_protection', subType: 'METER_BOX' };
  if (u === 'AC WIRE') return { section: 'electrical_protection', subType: 'AC_WIRE' };

  if (u.includes('LIAISONING') || u.includes('KSEB') || u.includes('FEASIBILITY')) {
    if (u.includes('FEASIBILITY')) return { section: 'wiring', subType: 'KSEB_FEASIBILITY' };
    if (u.includes('INSPECTORTATE') || u.includes('INSPECTORATE')) return { section: 'wiring', subType: 'KSEB_INSPECTORTATE' };
    return { section: 'services', subType: 'COMMISSIONING' };
  }
  if (u.includes('SITE VISIT')) return { section: 'services', subType: 'SITE_VISIT' };
  if (u.includes('TRANSPORTATION')) return { section: 'services', subType: 'TRANSPORTATION' };
  if (u.includes('INSTALLATION')) return { section: 'services', subType: 'INSTALLATION' };
  if (u.includes('COMMISSION')) return { section: 'services', subType: 'COMMISSION' };

  if (u.includes('WIRING PIPE') || u.includes('CONDUIT')) return { section: 'wiring', subType: 'WIRING_PIPE' };
  if (u.includes('WIRING ACCESSORIES')) return { section: 'wiring', subType: 'WIRING_ACCESSORIES' };
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
  if (u === 'NUT BOLTS(STRUCTURE)' || u.includes('NUT BOLTS(STRUCTURE)')) return { section: 'wiring', subType: 'NUT_BOLTS_STRUCTURE' };
  if (u === 'NUT BOLTS(PANEL)' || u.includes('NUT BOLTS(PANEL)')) return { section: 'wiring', subType: 'NUT_BOLTS_PANEL' };

  return { section: 'services', subType: 'ACCESSORIES' };
}

// Read JSON safe helper
function readJson(filePath: string): any {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Knowledge file not found at ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

async function main() {
  console.log('═══ ENERMASS KNOWLEDGE BASE INGESTION ENGINE ═══\n');

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ Error: DATABASE_URL environment variable is missing in .env.local.');
    process.exit(1);
  }

  const rawUrl = connectionString.replace(/"/g, ''); // strip quotes
  const url = new URL(rawUrl);
  const password = decodeURIComponent(url.password);

  const configPooler = {
    host: url.hostname,
    port: parseInt(url.port || '6543'),
    database: url.pathname.substring(1),
    user: decodeURIComponent(url.username),
    password,
    ssl: { rejectUnauthorized: false }
  };

  const configDirect = {
    host: 'db.xjdqpwmizmfkcdcgcxqv.supabase.co',
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password,
    ssl: { rejectUnauthorized: false }
  };

  let client: Client;
  
  console.log('Attempting connection via direct host on port 5432...');
  try {
    client = new Client(configDirect);
    await client.connect();
    console.log('Connected successfully via direct connection!');
  } catch (directErr: any) {
    console.log(`⚠️ Direct connection failed: ${directErr.message}`);
    console.log('Attempting connection via pooler host on port 6543...');
    try {
      client = new Client(configPooler);
      await client.connect();
      console.log('Connected successfully via pooler connection!');
    } catch (poolerErr: any) {
      console.error('❌ Both direct and pooler connection attempts failed!');
      console.error(`Direct Error: ${directErr.message}`);
      console.error(`Pooler Error: ${poolerErr.message}`);
      process.exit(1);
    }
  }

  try {
    console.log('Beginning database transaction...');
    await client.query('BEGIN');

    // ────────────────────────────────────────────────────────
    // PHASE 1 — READ KNOWLEDGE LAYER FILES
    // ────────────────────────────────────────────────────────
    const kbDir = path.resolve(process.cwd(), 'knowledge');
    
    console.log('Reading master JSON files...');
    const panelsJson = readJson(path.join(kbDir, 'masters', 'panels.json'));
    const invertersJson = readJson(path.join(kbDir, 'masters', 'inverters.json'));
    const batteriesJson = readJson(path.join(kbDir, 'masters', 'batteries.json'));
    const metersJson = readJson(path.join(kbDir, 'masters', 'meters.json'));
    const lasJson = readJson(path.join(kbDir, 'masters', 'lightning_arresters.json'));
    const structuresJson = readJson(path.join(kbDir, 'masters', 'structures.json'));
    const accessoriesJson = readJson(path.join(kbDir, 'masters', 'accessories.json'));
    const vendorsJson = readJson(path.join(kbDir, 'masters', 'vendors.json'));
    const gstJson = readJson(path.join(kbDir, 'masters', 'gst_rates.json'));
    
    console.log('Reading rules and formula files...');
    const engRules = readJson(path.join(kbDir, 'rules', 'engineering_rules.json'));
    const calcRules = readJson(path.join(kbDir, 'rules', 'calculation_rules.json'));
    const structRules = readJson(path.join(kbDir, 'rules', 'structure_formulae.json'));
    const upgradeRules = readJson(path.join(kbDir, 'rules', 'upgrade_rules.json'));
    const subsidyRules = readJson(path.join(kbDir, 'rules', 'subsidy_rules.json'));
    const pricingRules = readJson(path.join(kbDir, 'pricing', 'pricing_rules.json'));

    console.log('Reading system template files...');
    const systemTemplates = readJson(path.join(kbDir, 'systems', 'system_templates.json'));

    // Cache structures for O(1) in-memory relationship resolution
    const resolvedIds = {
      panels: new Map<string, string>(), // key -> UUID
      inverters: new Map<string, string>(),
      batteries: new Map<string, string>(),
      meters: new Map<string, string>(),
      las: new Map<string, string>(),
      structures: new Map<string, string>(),
      bomItems: new Map<string, string>(),
      vendors: new Map<string, string>()
    };

    // ────────────────────────────────────────────────────────
    // PHASE 2 — INGEST VENDORS
    // ────────────────────────────────────────────────────────
    console.log('Importing Vendors in bulk...');
    const vendorsToImport = [];
    const seenVendors = new Set();
    for (const v of vendorsJson) {
      if (!v.vendorName) {
        logWarning(`Skipping vendor without name: ${JSON.stringify(v)}`);
        continue;
      }
      const normName = v.vendorName.trim().toLowerCase();
      if (seenVendors.has(normName)) continue;
      seenVendors.add(normName);
      
      const id = getUuid('vendors', v.vendorName);
      vendorsToImport.push({ id, name: v.vendorName });
    }
    if (vendorsToImport.length > 0) {
      const valueStrings = [];
      const values = [];
      let idx = 1;
      for (const v of vendorsToImport) {
        valueStrings.push(`($${idx}, $${idx+1}, $${idx+2}, NOW(), NOW())`);
        values.push(v.id, ORG_ID, v.name);
        idx += 3;
      }
      const res = await client.query(`
        INSERT INTO vendors (id, org_id, name, created_at, updated_at)
        VALUES ${valueStrings.join(', ')}
        ON CONFLICT (org_id, name)
        DO UPDATE SET updated_at = NOW()
        RETURNING id, name, (xmax = 0) AS inserted;
      `, values);
      for (const row of res.rows) {
        resolvedIds.vendors.set(row.name.toLowerCase(), row.id);
        report.summary.vendorsImported++;
        if (row.inserted) report.summary.recordsCreated++;
        else report.summary.recordsUpdated++;
      }
    }

    // ────────────────────────────────────────────────────────
    // PHASE 3 — INGEST PANELS
    // ────────────────────────────────────────────────────────
    console.log('Importing Solar Panels in bulk...');
    const panelsToImport = [];
    const seenPanels = new Map();
    for (const p of panelsJson) {
      if (!p.model || p.wattage_w === undefined || p.wattage_w === null) {
        logWarning(`Panel missing model or wattage, skipping: ${JSON.stringify(p)}`);
        continue;
      }
      const brand = p.brand || 'Unknown';
      const key = `${brand}:${p.model}:${p.wattage_w}`.toLowerCase();
      const id = getUuid('panels', `${brand}:${p.model}:${p.wattage_w}`);
      const rate_per_watt = p.rate_per_panel ? (p.rate_per_panel / p.wattage_w) : 0;
      const gst = 0.05;
      const type = p.panel_type && p.panel_type !== 'Unknown' ? p.panel_type : 'Mono PERC';
      
      const panelObj = {
        id, brand, model: p.model, wattage_w: p.wattage_w, type, rate_per_watt, gst, description: p.description, is_active: p.is_active, is_custom: p.is_custom, rate_per_panel: p.rate_per_panel
      };
      
      if (!seenPanels.has(key)) {
        seenPanels.set(key, { unique: panelObj, all: [p] });
      } else {
        seenPanels.get(key).all.push(p);
      }
    }
    for (const entry of seenPanels.values()) {
      panelsToImport.push(entry.unique);
    }

    if (panelsToImport.length > 0) {
      const valueStrings = [];
      const values = [];
      let idx = 1;
      for (const p of panelsToImport) {
        valueStrings.push(`($${idx}, $${idx+1}, $${idx+2}, $${idx+3}, $${idx+4}, $${idx+5}, $${idx+6}, $${idx+7}, $${idx+8}, $${idx+9}, $${idx+10}, NOW(), NOW())`);
        values.push(p.id, null, p.brand, p.model, p.wattage_w, p.type, p.rate_per_watt, p.gst, p.description, p.is_active, p.is_custom);
        idx += 11;
      }
      const res = await client.query(`
        INSERT INTO eq_panels (id, org_id, brand, model, wattage_w, panel_type, rate_per_watt, gst_pct, description, is_active, is_custom, created_at, updated_at)
        VALUES ${valueStrings.join(', ')}
        ON CONFLICT (brand, model, wattage_w)
        DO UPDATE SET 
          rate_per_watt = EXCLUDED.rate_per_watt,
          panel_type = EXCLUDED.panel_type,
          updated_at = NOW()
        RETURNING id, brand, model, wattage_w, (xmax = 0) AS inserted;
      `, values);
      for (const row of res.rows) {
        const key = `${row.brand}:${row.model}:${row.wattage_w}`.toLowerCase();
        const entry = seenPanels.get(key);
        resolvedIds.panels.set(key, row.id);
        if (entry) {
          for (const orig of entry.all) {
            if (orig.rate_per_panel !== undefined && orig.rate_per_panel !== null) {
              resolvedIds.panels.set(orig.rate_per_panel.toString(), row.id);
            }
          }
        }
        report.summary.panelsImported++;
        if (row.inserted) report.summary.recordsCreated++;
        else report.summary.recordsUpdated++;
      }
    }

    // ────────────────────────────────────────────────────────
    // PHASE 4 — INGEST INVERTERS
    // ────────────────────────────────────────────────────────
    console.log('Importing Inverters in bulk...');
    const invertersToImport = [];
    const seenInverters = new Map();
    for (const inv of invertersJson) {
      if (!inv.model || inv.capacity_kw === undefined || inv.capacity_kw === null) {
        logWarning(`Inverter missing model or capacity, skipping: ${JSON.stringify(inv)}`);
        continue;
      }
      const brand = inv.brand || 'Unknown';
      let dbInvType = 'on_grid';
      const typeLower = String(inv.inverter_type).toLowerCase();
      if (typeLower.includes('hybrid')) dbInvType = 'hybrid';
      else if (typeLower.includes('micro')) dbInvType = 'micro';
      else if (typeLower.includes('3_phase')) dbInvType = '3_phase';

      const key = `${brand}:${inv.model}:${inv.capacity_kw}:${dbInvType}`.toLowerCase();
      const id = getUuid('inverters', `${brand}:${inv.model}:${inv.capacity_kw}:${dbInvType}`);
      const rate = inv.rate || 0;
      const gst = 0.12;

      const invObj = {
        id, brand, model: inv.model, capacity_kw: inv.capacity_kw, inverter_type: dbInvType, phases: inv.phases || 1, rate, gst, is_active: inv.is_active, is_custom: inv.is_custom
      };

      if (!seenInverters.has(key)) {
        seenInverters.set(key, { unique: invObj, all: [inv] });
      } else {
        seenInverters.get(key).all.push(inv);
      }
    }
    for (const entry of seenInverters.values()) {
      invertersToImport.push(entry.unique);
    }

    if (invertersToImport.length > 0) {
      const valueStrings = [];
      const values = [];
      let idx = 1;
      for (const inv of invertersToImport) {
        valueStrings.push(`($${idx}, $${idx+1}, $${idx+2}, $${idx+3}, $${idx+4}, $${idx+5}, $${idx+6}, $${idx+7}, $${idx+8}, $${idx+9}, $${idx+10}, $${idx+11}, NOW(), NOW())`);
        values.push(inv.id, null, inv.brand, inv.model, inv.capacity_kw, inv.inverter_type, inv.phases, inv.rate, inv.gst, inv.model, inv.is_active, inv.is_custom);
        idx += 12;
      }
      const res = await client.query(`
        INSERT INTO eq_inverters (id, org_id, brand, model, capacity_kw, inverter_type, phases, rate, gst_pct, description, is_active, is_custom, created_at, updated_at)
        VALUES ${valueStrings.join(', ')}
        ON CONFLICT (brand, model, capacity_kw, inverter_type)
        DO UPDATE SET 
          rate = EXCLUDED.rate,
          phases = EXCLUDED.phases,
          updated_at = NOW()
        RETURNING id, brand, model, capacity_kw, inverter_type, rate, (xmax = 0) AS inserted;
      `, values);
      for (const row of res.rows) {
        const key = `${row.brand}:${row.model}:${Number(row.capacity_kw)}:${row.inverter_type}`.toLowerCase();
        const entry = seenInverters.get(key);
        resolvedIds.inverters.set(key, row.id);
        if (entry) {
          for (const orig of entry.all) {
            if (orig.rate !== undefined && orig.rate !== null) {
              resolvedIds.inverters.set(orig.rate.toString(), row.id);
            }
          }
        }
        report.summary.invertersImported++;
        if (row.inserted) report.summary.recordsCreated++;
        else report.summary.recordsUpdated++;
      }
    }

    // ────────────────────────────────────────────────────────
    // PHASE 5 — INGEST BATTERIES
    // ────────────────────────────────────────────────────────
    console.log('Importing Batteries in bulk...');
    const batteriesToImport = [];
    const seenBatteries = new Map();
    for (const bat of batteriesJson) {
      if (!bat.model || bat.capacity_kwh === undefined || bat.capacity_kwh === null) {
        logWarning(`Battery missing model or capacity, skipping: ${JSON.stringify(bat)}`);
        continue;
      }
      const brand = bat.brand || 'Unknown';
      const key = `${brand}:${bat.model}:${bat.capacity_kwh}`.toLowerCase();
      const id = getUuid('batteries', `${brand}:${bat.model}:${bat.capacity_kwh}`);
      let chem = 'LFP';
      const chemStr = String(bat.chemistry).toUpperCase();
      if (chemStr.includes('LFP')) chem = 'LFP';
      else if (chemStr.includes('LI') || chemStr.includes('ION')) chem = 'Li-Ion';
      else if (chemStr.includes('NMC')) chem = 'NMC';
      else if (chemStr.includes('LEAD') || chemStr.includes('ACID')) chem = 'Lead-Acid';
      
      const rate = bat.rate || 0;
      const batObj = {
        id, brand, model: bat.model, capacity_kwh: bat.capacity_kwh, voltage_v: bat.voltage_v || 48, chemistry: chem, dod_pct: bat.dod_pct || 0.8, rate, gst: 0.12, description: bat.description, is_active: bat.is_active, is_custom: bat.is_custom
      };

      if (!seenBatteries.has(key)) {
        seenBatteries.set(key, { unique: batObj, all: [bat] });
      } else {
        seenBatteries.get(key).all.push(bat);
      }
    }
    for (const entry of seenBatteries.values()) {
      batteriesToImport.push(entry.unique);
    }

    if (batteriesToImport.length > 0) {
      const valueStrings = [];
      const values = [];
      let idx = 1;
      for (const bat of batteriesToImport) {
        valueStrings.push(`($${idx}, $${idx+1}, $${idx+2}, $${idx+3}, $${idx+4}, $${idx+5}, $${idx+6}, $${idx+7}, $${idx+8}, $${idx+9}, $${idx+10}, $${idx+11}, $${idx+12}, NOW(), NOW())`);
        values.push(bat.id, null, bat.brand, bat.model, bat.capacity_kwh, bat.voltage_v, bat.chemistry, bat.dod_pct, bat.rate, bat.gst, bat.description, bat.is_active, bat.is_custom);
        idx += 13;
      }
      const res = await client.query(`
        INSERT INTO eq_batteries (id, org_id, brand, model, capacity_kwh, voltage_v, chemistry, dod_pct, rate, gst_pct, description, is_active, is_custom, created_at, updated_at)
        VALUES ${valueStrings.join(', ')}
        ON CONFLICT (brand, model, capacity_kwh)
        DO UPDATE SET 
          rate = EXCLUDED.rate,
          chemistry = EXCLUDED.chemistry,
          updated_at = NOW()
        RETURNING id, brand, model, capacity_kwh, rate, (xmax = 0) AS inserted;
      `, values);
      for (const row of res.rows) {
        const key = `${row.brand}:${row.model}:${Number(row.capacity_kwh)}`.toLowerCase();
        const entry = seenBatteries.get(key);
        resolvedIds.batteries.set(key, row.id);
        if (entry) {
          for (const orig of entry.all) {
            const r = orig.rate || 0;
            resolvedIds.batteries.set(r.toString(), row.id);
          }
        }
        report.summary.batteriesImported++;
        if (row.inserted) report.summary.recordsCreated++;
        else report.summary.recordsUpdated++;
      }
    }

    // ────────────────────────────────────────────────────────
    // PHASE 6 — INGEST METERS
    // ────────────────────────────────────────────────────────
    console.log('Importing Meters in bulk...');
    const metersToImport = [];
    const seenMeters = new Map();
    for (const m of metersJson) {
      if (!m.model || !m.meter_type || m.rate === undefined || m.rate === null) {
        logWarning(`Meter missing model, type, or rate, skipping: ${JSON.stringify(m)}`);
        continue;
      }
      const brand = m.brand || 'Unknown';
      const type = m.meter_type === 'net_meter' ? 'net_meter' : 'solar_meter';
      const phases = m.phases || 1;
      const key = `${brand}:${m.model}:${type}:${phases}`.toLowerCase();
      const id = getUuid('meters', `${brand}:${m.model}:${type}:${phases}`);
      
      const mObj = {
        id, type, brand, model: m.model, phases, is_smart: m.is_smart || false, rate: m.rate, gst: 0.18, description: m.description, is_active: m.is_active
      };

      if (!seenMeters.has(key)) {
        seenMeters.set(key, { unique: mObj, all: [m] });
      } else {
        seenMeters.get(key).all.push(m);
      }
    }
    for (const entry of seenMeters.values()) {
      metersToImport.push(entry.unique);
    }

    if (metersToImport.length > 0) {
      const valueStrings = [];
      const values = [];
      let idx = 1;
      for (const m of metersToImport) {
        valueStrings.push(`($${idx}, $${idx+1}, $${idx+2}, $${idx+3}, $${idx+4}, $${idx+5}, $${idx+6}, $${idx+7}, $${idx+8}, $${idx+9}, $${idx+10}, NOW(), NOW())`);
        values.push(m.id, null, m.type, m.brand, m.model, m.phases, m.is_smart, m.rate, m.gst, m.description, m.is_active);
        idx += 11;
      }
      const res = await client.query(`
        INSERT INTO eq_meters (id, org_id, meter_type, brand, model, phases, is_smart, rate, gst_pct, description, is_active, created_at, updated_at)
        VALUES ${valueStrings.join(', ')}
        ON CONFLICT (brand, model, meter_type, phases)
        DO UPDATE SET 
          rate = EXCLUDED.rate,
          updated_at = NOW()
        RETURNING id, brand, model, meter_type, phases, rate, (xmax = 0) AS inserted;
      `, values);
      for (const row of res.rows) {
        const key = `${row.brand}:${row.model}:${row.meter_type}:${row.phases}`.toLowerCase();
        const entry = seenMeters.get(key);
        resolvedIds.meters.set(key, row.id);
        if (entry) {
          for (const orig of entry.all) {
            if (orig.rate !== undefined && orig.rate !== null) {
              resolvedIds.meters.set(orig.rate.toString(), row.id);
            }
          }
        }
        report.summary.metersImported++;
        if (row.inserted) report.summary.recordsCreated++;
        else report.summary.recordsUpdated++;
      }
    }

    // ────────────────────────────────────────────────────────
    // PHASE 7 — INGEST LIGHTNING ARRESTERS
    // ────────────────────────────────────────────────────────
    console.log('Importing Lightning Arresters in bulk...');
    const lasToImport = [];
    const seenLas = new Map();
    for (const la of lasJson) {
      if (!la.model || la.rate === undefined || la.rate === null) {
        logWarning(`Lightning arrester missing model or rate, skipping: ${JSON.stringify(la)}`);
        continue;
      }
      const brand = la.brand || 'Unknown';
      const type = la.la_type === 'multi' ? 'multi' : 'single';
      const key = `${brand}:${la.model}:${type}`.toLowerCase();
      const id = getUuid('las', `${brand}:${la.model}:${type}`);
      
      const laObj = {
        id, type, brand, model: la.model, max_capacity_kw: la.max_capacity_kw || null, rate: la.rate, gst: 0.18, description: la.description, is_active: la.is_active
      };

      if (!seenLas.has(key)) {
        seenLas.set(key, { unique: laObj, all: [la] });
      } else {
        seenLas.get(key).all.push(la);
      }
    }
    for (const entry of seenLas.values()) {
      lasToImport.push(entry.unique);
    }

    if (lasToImport.length > 0) {
      const valueStrings = [];
      const values = [];
      let idx = 1;
      for (const la of lasToImport) {
        valueStrings.push(`($${idx}, $${idx+1}, $${idx+2}, $${idx+3}, $${idx+4}, $${idx+5}, $${idx+6}, $${idx+7}, $${idx+8}, $${idx+9}, NOW(), NOW())`);
        values.push(la.id, null, la.type, la.brand, la.model, la.max_capacity_kw, la.rate, la.gst, la.description, la.is_active);
        idx += 10;
      }
      const res = await client.query(`
        INSERT INTO eq_lightning_arresters (id, org_id, la_type, brand, model, max_capacity_kw, rate, gst_pct, description, is_active, created_at, updated_at)
        VALUES ${valueStrings.join(', ')}
        ON CONFLICT (brand, model, la_type)
        DO UPDATE SET 
          rate = EXCLUDED.rate,
          updated_at = NOW()
        RETURNING id, brand, model, la_type, rate, (xmax = 0) AS inserted;
      `, values);
      for (const row of res.rows) {
        const key = `${row.brand}:${row.model}:${row.la_type}`.toLowerCase();
        const entry = seenLas.get(key);
        resolvedIds.las.set(key, row.id);
        if (entry) {
          for (const orig of entry.all) {
            if (orig.rate !== undefined && orig.rate !== null) {
              resolvedIds.las.set(orig.rate.toString(), row.id);
            }
          }
        }
        report.summary.lightningArrestersImported++;
        if (row.inserted) report.summary.recordsCreated++;
        else report.summary.recordsUpdated++;
      }
    }

    // ────────────────────────────────────────────────────────
    // PHASE 8 — INGEST MOUNTING STRUCTURES
    // ────────────────────────────────────────────────────────
    console.log('Importing Mounting Structures in bulk...');
    const structuresToImport = [];
    const seenStructures = new Map();
    for (const s of structuresJson) {
      if (!s.name || s.raw_material_rate === undefined || s.raw_material_rate === null) {
        logWarning(`Structure missing name or rate, skipping: ${JSON.stringify(s)}`);
        continue;
      }
      let mat = 'gi_galvanized';
      if (s.material.toLowerCase().includes('hot')) mat = 'hot_dip_galvanized';
      else if (s.material.toLowerCase().includes('alum')) mat = 'aluminum';
      else if (s.material.toLowerCase().includes('stainless')) mat = 'stainless_steel';

      let roof = 'rcc_flat';
      const r = s.roof_mount_type.toLowerCase();
      if (r.includes('rcc_sloped')) roof = 'rcc_sloped';
      else if (r.includes('tin') || r.includes('shed')) roof = 'tin_shed';
      else if (r.includes('metal') || r.includes('sheet')) roof = 'metal_sheet';
      else if (r.includes('ground')) roof = 'ground_mount';
      else if (r.includes('elevated')) roof = 'elevated';

      const elevation = s.elevation_height_mm || 0;
      const key = `${s.name}:${mat}:${roof}:${elevation}`.toLowerCase();
      const id = getUuid('structures', `${s.name}:${mat}:${roof}:${elevation}`);
      const raw_rate = s.raw_material_rate || 0;
      const fab_rate = s.fabrication_rate || 0;
      const galv_rate = s.galvanizing_rate || 0;
      const flat_rate = (s.raw_material_rate && !s.fabrication_rate && !s.galvanizing_rate) ? s.raw_material_rate : null;

      const sObj = {
        id, name: s.name, material: mat, roof_mount_type: roof, elevation_height_mm: elevation, raw_material_rate: raw_rate, fabrication_rate: fab_rate, galvanizing_rate: galv_rate, flat_rate, description: s.description, is_active: s.is_active, is_custom: s.is_custom
      };

      if (!seenStructures.has(key)) {
        seenStructures.set(key, { unique: sObj, all: [s] });
      } else {
        seenStructures.get(key).all.push(s);
      }
    }
    for (const entry of seenStructures.values()) {
      structuresToImport.push(entry.unique);
    }

    if (structuresToImport.length > 0) {
      const valueStrings = [];
      const values = [];
      let idx = 1;
      for (const s of structuresToImport) {
        valueStrings.push(`($${idx}, $${idx+1}, $${idx+2}, $${idx+3}, $${idx+4}, $${idx+5}, $${idx+6}, $${idx+7}, $${idx+8}, $${idx+9}, $${idx+10}, $${idx+11}, $${idx+12}, $${idx+13}, $${idx+14}, $${idx+15}, $${idx+16}, $${idx+17}, NOW(), NOW())`);
        values.push(s.id, null, s.name, s.material, s.roof_mount_type, s.elevation_height_mm, s.raw_material_rate, s.fabrication_rate, s.galvanizing_rate, 0.05, 0.02, 0.0, s.flat_rate, null, 0.18, s.description, s.is_active, s.is_custom);
        idx += 18;
      }
      const res = await client.query(`
        INSERT INTO eq_mounting_structures (id, org_id, name, material, roof_mount_type, elevation_height_mm, raw_material_rate, fabrication_rate, galvanizing_rate, wastage_pct, fastener_weight_pct, base_weight_kg, flat_rate, per_watt_rate, gst_pct, description, is_active, is_custom, created_at, updated_at)
        VALUES ${valueStrings.join(', ')}
        ON CONFLICT (name, material, roof_mount_type, elevation_height_mm)
        DO UPDATE SET 
          raw_material_rate = EXCLUDED.raw_material_rate,
          fabrication_rate = EXCLUDED.fabrication_rate,
          galvanizing_rate = EXCLUDED.galvanizing_rate,
          flat_rate = EXCLUDED.flat_rate,
          updated_at = NOW()
        RETURNING id, name, material, roof_mount_type, elevation_height_mm, raw_material_rate, flat_rate, (xmax = 0) AS inserted;
      `, values);
      for (const row of res.rows) {
        const key = `${row.name}:${row.material}:${row.roof_mount_type}:${row.elevation_height_mm}`.toLowerCase();
        const entry = seenStructures.get(key);
        resolvedIds.structures.set(key, row.id);
        if (entry) {
          for (const orig of entry.all) {
            resolvedIds.structures.set(Number(orig.raw_material_rate || 0).toString(), row.id);
            if (row.flat_rate) {
              resolvedIds.structures.set(Number(row.flat_rate).toString(), row.id);
            }
          }
        }
        report.summary.structuresImported++;
        if (row.inserted) report.summary.recordsCreated++;
        else report.summary.recordsUpdated++;
      }
    }

    // ────────────────────────────────────────────────────────
    // PHASE 9 — INGEST ACCESSORIES / BOM ITEMS
    // ────────────────────────────────────────────────────────
    console.log('Importing Accessories / BOM Items in bulk...');
    const accessoriesToImport = [];
    const seenAccessories = new Map();
    for (const a of accessoriesJson) {
      if (!a.item_description) {
        logWarning(`Accessory missing description, skipping: ${JSON.stringify(a)}`);
        continue;
      }
      const { section, subType } = resolveBomItemSectionAndSubType(a.item_description);
      const key = `${section}:${subType}`.toUpperCase();
      const id = getUuid('bom_items', `${section}:${subType}`);
      const rate = a.rate || 0;
      const gst = normalizeGst(a.gst_pct, rate);

      const aObj = {
        id, section, subType, description: a.item_description, unit: a.unit || 'Nos', rate, gst, is_active: a.is_active
      };

      if (!seenAccessories.has(key)) {
        seenAccessories.set(key, { unique: aObj, all: [a] });
      } else {
        seenAccessories.get(key).all.push(a);
      }
    }
    for (const entry of seenAccessories.values()) {
      accessoriesToImport.push(entry.unique);
    }

    const ACC_BATCH_SIZE = 100;
    for (let i = 0; i < accessoriesToImport.length; i += ACC_BATCH_SIZE) {
      const batch = accessoriesToImport.slice(i, i + ACC_BATCH_SIZE);
      const valueStrings = [];
      const values = [];
      let idx = 1;
      for (const a of batch) {
        valueStrings.push(`($${idx}, $${idx+1}, $${idx+2}, $${idx+3}, $${idx+4}, $${idx+5}, $${idx+6}, $${idx+7}, $${idx+8}, $${idx+9}, NOW(), NOW())`);
        values.push(a.id, null, a.section, a.subType, a.description, a.description, a.unit, a.rate, a.gst, a.is_active);
        idx += 10;
      }
      const res = await client.query(`
        INSERT INTO eq_bom_items (id, org_id, section, sub_type, description, remarks, unit, rate, gst_pct, is_active, created_at, updated_at)
        VALUES ${valueStrings.join(', ')}
        ON CONFLICT (section, sub_type, COALESCE(org_id::TEXT, 'global'))
        DO UPDATE SET 
          rate = EXCLUDED.rate,
          gst_pct = EXCLUDED.gst_pct,
          updated_at = NOW()
        RETURNING id, description, section, sub_type, (xmax = 0) AS inserted;
      `, values);
      for (const row of res.rows) {
        const key = `${row.section}:${row.sub_type}`.toUpperCase();
        const entry = seenAccessories.get(key);
        resolvedIds.bomItems.set(key, row.id);
        if (entry) {
          for (const orig of entry.all) {
            resolvedIds.bomItems.set(orig.item_description.toUpperCase(), row.id);
          }
        }
        report.summary.accessoriesImported++;
        if (row.inserted) report.summary.recordsCreated++;
        else report.summary.recordsUpdated++;
      }
    }

    // PHASE 10 — INGEST GST RATES
    // ────────────────────────────────────────────────────────
    console.log('Importing GST Rates in batches...');
    const gstToImport: any[] = [];
    const seenGst = new Set();
    for (const g of gstJson) {
      if (g.gstPct === undefined || g.gstPct === null) {
        logWarning(`GST record missing percentage, skipping: ${JSON.stringify(g)}`);
        continue;
      }
      const key = `${g.gstPct}:${g.sourceWorkbook}:${g.sourceSheet}:${g.sourceRow}`.toLowerCase();
      if (seenGst.has(key)) continue;
      seenGst.add(key);

      const id = getUuid('gst_master', `${g.gstPct}:${g.sourceWorkbook}:${g.sourceSheet}:${g.sourceRow}`);
      const inputs = g.gstFormulaInputs || [];
      const tpInputs = g.totalPriceFormulaInputs || [];
      
      gstToImport.push({
        id,
        gstPct: g.gstPct,
        sourceWorkbook: g.sourceWorkbook,
        sourceSheet: g.sourceSheet,
        sourceRow: g.sourceRow,
        gstAmount: g.gstAmount,
        gstRate: g.gstRate,
        effectiveGstRateOnTotal: g.effectiveGstRateOnTotal,
        gstFormula: g.gstFormula,
        inputs,
        sourceGstCell: g.sourceGstCell,
        pricingFormula: g.pricingFormula,
        totalPriceFormula: g.totalPriceFormula,
        tpInputs,
        sourceTotalCell: g.sourceTotalCell,
        totalPrice: g.totalPrice
      });
    }

    const GST_BATCH_SIZE = 100;
    for (let i = 0; i < gstToImport.length; i += GST_BATCH_SIZE) {
      const batch = gstToImport.slice(i, i + GST_BATCH_SIZE);
      const valueStrings: string[] = [];
      const values: any[] = [];
      let valIdx = 1;

      for (const g of batch) {
        valueStrings.push(`($${valIdx}, $${valIdx+1}, $${valIdx+2}, $${valIdx+3}, $${valIdx+4}, $${valIdx+5}, $${valIdx+6}, $${valIdx+7}, $${valIdx+8}, $${valIdx+9}, $${valIdx+10}, $${valIdx+11}, $${valIdx+12}, $${valIdx+13}, $${valIdx+14}, $${valIdx+15}, NOW(), NOW())`);
        values.push(
          g.id,
          g.gstPct,
          g.sourceWorkbook,
          g.sourceSheet,
          g.sourceRow,
          g.gstAmount,
          g.gstRate,
          g.effectiveGstRateOnTotal,
          g.gstFormula,
          g.inputs,
          g.sourceGstCell,
          g.pricingFormula,
          g.totalPriceFormula,
          g.tpInputs,
          g.sourceTotalCell,
          g.totalPrice
        );
        valIdx += 16;
      }

      const queryText = `
        INSERT INTO gst_master (
          id, gst_pct, source_workbook, source_sheet, source_row, gst_amount, gst_rate, effective_gst_rate_on_total, gst_formula, gst_formula_inputs, source_gst_cell, pricing_formula, total_price_formula, total_price_formula_inputs, source_total_cell, total_price, created_at, updated_at
        )
        VALUES ${valueStrings.join(', ')}
        ON CONFLICT (gst_pct, source_workbook, source_sheet, source_row)
        DO UPDATE SET 
          gst_amount = EXCLUDED.gst_amount,
          total_price = EXCLUDED.total_price,
          updated_at = NOW()
        RETURNING (xmax = 0) AS inserted;
      `;

      const res = await client.query(queryText, values);
      report.summary.gstMasterImported += batch.length;
      for (const row of res.rows) {
        if (row.inserted) {
          report.summary.recordsCreated++;
        } else {
          report.summary.recordsUpdated++;
        }
      }
    }

    // PHASE 11 — INGEST PRICING REFERENCES
    // ────────────────────────────────────────────────────────
    console.log('Importing Pricing/Subsidy References in bulk...');
    const combinedPricing = [...subsidyRules, ...pricingRules];
    
    // De-duplicate in-memory to prevent primary key clash
    const pricingMap = new Map<string, any>();
    for (const p of combinedPricing) {
      const key = `${p.capacityKW}:${p.priceType || 'standard'}`;
      pricingMap.set(key, p);
    }

    const pricingToImport = [];
    for (const p of pricingMap.values()) {
      if (p.capacityKW === undefined || p.capacityKW === null || isNaN(Number(p.capacityKW))) {
        logWarning(`Pricing reference missing or invalid capacity, skipping: ${JSON.stringify(p)}`);
        continue;
      }
      const type = p.priceType || 'standard';
      const id = getUuid('pricing_ref', `${p.capacityKW}:${type}`);
      const cap = p.capacityKW;
      const panels = p.panelCount || 0;
      const inv = p.inverterKW || null;
      const ben = p.beneficiaryContribution || 0;
      const sub = p.subsidy || 0;
      const sysPrice = p.systemPrice || 0;
      const file = p.sourceWorkbook || 'PRICING_8.9%GST.xlsx';
      const sheet = p.sourceSheet || 'pricing';
      const row = p.sourceRow || 0;
      pricingToImport.push({
        id, cap, panels, inv, type, ben, sub, sysPrice, file, sheet, row
      });
    }

    if (pricingToImport.length > 0) {
      const valueStrings = [];
      const values = [];
      let idx = 1;
      for (const p of pricingToImport) {
        valueStrings.push(`($${idx}, $${idx+1}, $${idx+2}, $${idx+3}, $${idx+4}, $${idx+5}, $${idx+6}, $${idx+7}, $${idx+8}, $${idx+9}, $${idx+10}, NOW())`);
        values.push(p.id, p.cap, p.panels, p.inv, p.type, p.ben, p.sub, p.sysPrice, p.file, p.sheet, p.row);
        idx += 11;
      }
      const res = await client.query(`
        INSERT INTO pricing_reference (id, capacity_kw, panels, inverter_kw, type, beneficiary_contribution, subsidy, system_price, source_file, sheet_name, row_number, imported_at)
        VALUES ${valueStrings.join(', ')}
        ON CONFLICT (capacity_kw, type)
        DO UPDATE SET 
          panels = EXCLUDED.panels,
          inverter_kw = EXCLUDED.inverter_kw,
          beneficiary_contribution = EXCLUDED.beneficiary_contribution,
          subsidy = EXCLUDED.subsidy,
          system_price = EXCLUDED.system_price,
          imported_at = NOW()
        RETURNING (xmax = 0) AS inserted;
      `, values);
      report.summary.pricingReferencesImported += pricingToImport.length;
      for (const row of res.rows) {
        if (row.inserted) report.summary.recordsCreated++;
        else report.summary.recordsUpdated++;
      }
    }

    // PHASE 12 — INGEST FORMULA/RULES METADATA
    // ────────────────────────────────────────────────────────
    console.log('Importing Rules Metadata in batches...');
    const rulesList = [
      { data: engRules, category: 'engineering_rule' },
      { data: calcRules, category: 'calculation_rule' },
      { data: structRules, category: 'structure_formula' },
      { data: upgradeRules, category: 'upgrade_rule' },
      { data: subsidyRules, category: 'subsidy_rule' }
    ];

    const allRulesToImport: any[] = [];
    const seenRules = new Set();
    for (const item of rulesList) {
      for (const r of item.data) {
        if (!r.ruleName || !r.formula) continue;
        const key = `${item.category}:${r.ruleName}`.toLowerCase();
        if (seenRules.has(key)) continue;
        seenRules.add(key);

        const id = getUuid('rules', `${item.category}:${r.ruleName}`);
        const inputs = r.inputs || [];
        const output = r.output || r.outputCell || null;
        const file = r.sourceWorkbook || r.workbook || null;
        const sheet = r.sourceSheet || r.sheet || null;
        const row = r.sourceRow || r.row || null;
        
        allRulesToImport.push({
          id,
          ruleName: r.ruleName,
          formula: r.formula,
          inputs,
          output,
          category: item.category,
          file,
          sheet,
          row,
          metadata: JSON.stringify(r)
        });
      }
    }

    const BATCH_SIZE = 500;
    for (let i = 0; i < allRulesToImport.length; i += BATCH_SIZE) {
      const batch = allRulesToImport.slice(i, i + BATCH_SIZE);
      const valueStrings: string[] = [];
      const values: any[] = [];
      let valIdx = 1;

      for (const rule of batch) {
        valueStrings.push(`($${valIdx}, $${valIdx+1}, $${valIdx+2}, $${valIdx+3}, $${valIdx+4}, $${valIdx+5}, $${valIdx+6}, $${valIdx+7}, $${valIdx+8}, $${valIdx+9}, NOW(), NOW())`);
        values.push(
          rule.id,
          rule.ruleName,
          rule.formula,
          rule.inputs,
          rule.output,
          rule.category,
          rule.file,
          rule.sheet,
          rule.row,
          rule.metadata
        );
        valIdx += 10;
      }

      const queryText = `
        INSERT INTO engineering_rules_metadata (
          id, rule_name, formula, inputs, output_var, category, source_workbook, source_sheet, source_row, metadata_json, created_at, updated_at
        )
        VALUES ${valueStrings.join(', ')}
        ON CONFLICT (category, rule_name)
        DO UPDATE SET 
          formula = EXCLUDED.formula,
          inputs = EXCLUDED.inputs,
          metadata_json = EXCLUDED.metadata_json,
          updated_at = NOW()
        RETURNING (xmax = 0) AS inserted;
      `;

      const res = await client.query(queryText, values);
      report.summary.rulesImported += batch.length;
      for (const row of res.rows) {
        if (row.inserted) {
          report.summary.recordsCreated++;
        } else {
          report.summary.recordsUpdated++;
        }
      }
    }

    // ────────────────────────────────────────────────────────
    // PHASE 13 — INGEST SYSTEMS & SYSTEM ITEMS (BOM TEMPLATES)
    // ────────────────────────────────────────────────────────
    console.log('Importing Systems and resolving component mappings...');
    
    // Dynamic BOM item seeding helper
    async function ensureBomItem(section: string, subType: string, description: string): Promise<string> {
      const key = `${section}:${subType}`.toUpperCase();
      let id = resolvedIds.bomItems.get(key);
      if (!id) {
        id = getUuid('bom_items', `${section}:${subType}`);
        const res = await client.query(`
          INSERT INTO eq_bom_items (id, org_id, section, sub_type, description, remarks, unit, rate, gst_pct, is_active, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
          ON CONFLICT (section, sub_type, COALESCE(org_id::TEXT, 'global'))
          DO UPDATE SET updated_at = NOW()
          RETURNING id;
        `, [id, null, section, subType, description, description, 'Nos', 0, 0.18, true]);
        const actualId = res.rows[0].id;
        resolvedIds.bomItems.set(key, actualId);
        resolvedIds.bomItems.set(description.toUpperCase(), actualId);
        report.summary.accessoriesImported++;
        report.summary.recordsCreated++;
        return actualId;
      }
      return id;
    }

    // We clean system_items and systems first or upsert them. 
    // To preserve integrity and prevent duplication of system items on re-runs, we can delete the old items of these templates.
    for (const s of systemTemplates) {
      if (!s.systemId || !s.systemName) {
        logWarning(`System template missing id or name, skipping: ${JSON.stringify(s)}`);
        continue;
      }
      
      const systemUuid = getUuid('systems', s.systemId);
      
      // Determine category
      let category = 'on_grid';
      const typeLower = String(s.systemType).toLowerCase();
      if (typeLower.includes('hybrid')) category = 'hybrid';
      else if (typeLower.includes('micro')) category = 'micro_inverter';
      else if (typeLower.includes('offgrid')) category = 'on_grid'; // default fallback for offgrid
      else if (typeLower.includes('upgrade')) category = 'upgrade';
      else if (typeLower.includes('3_phase')) category = '3_phase';
      else if (typeLower.includes('commercial')) category = 'commercial';

      // Resolve capacity and handle missing/invalid values
      let capacity = s.capacityKW;
      if (capacity === undefined || capacity === null || isNaN(capacity)) {
        if (s.systemId === '5ke_3p_tn_ongrid_na') {
          capacity = 5.0;
        } else if (s.systemId === 'sheet7_reference_na') {
          capacity = 26.45;
        } else {
          const nameMatch = String(s.systemName).match(/KW\s*:\s*(\d+(\.\d+)?)/i);
          if (nameMatch) {
            capacity = parseFloat(nameMatch[1]);
          } else {
            capacity = 0.0;
          }
        }
      }

      // Find panel details from line items to populate panel_wattage_w and panel_qty
      let panelQty = 0;
      let panelWattage = 550;
      const panelItem = s.lineItems.find((li: any) => li.itemType === 'panel');
      if (panelItem) {
        panelQty = panelItem.quantity;
        // wattage = capacity * 1000 / qty
        panelWattage = Math.round((capacity * 1000) / panelQty) || 550;
      }

      // Upsert System
      const sysRes = await client.query(`
        INSERT INTO systems (id, org_id, name, category, capacity_kw, panel_wattage_w, panel_qty, target_margin_pct, is_active, is_custom, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
        ON CONFLICT (id)
        DO UPDATE SET 
          name = EXCLUDED.name,
          category = EXCLUDED.category,
          capacity_kw = EXCLUDED.capacity_kw,
          panel_wattage_w = EXCLUDED.panel_wattage_w,
          panel_qty = EXCLUDED.panel_qty,
          updated_at = NOW()
        RETURNING (xmax = 0) AS inserted;
      `, [systemUuid, ORG_ID, s.systemName, category, capacity, panelWattage, panelQty, 0.20, true, false]);

      report.summary.systemsImported++;
      if (sysRes.rows[0]?.inserted) {
        report.summary.recordsCreated++;
      } else {
        report.summary.recordsUpdated++;
      }

      // Clean existing system items for this template to avoid orphans/duplicates
      await client.query('DELETE FROM system_items WHERE system_id = $1', [systemUuid]);

      // Insert line items
      let sortOrder = 1;
      for (const li of s.lineItems) {
        if (!li.description) {
          logWarning(`System item in "${s.systemId}" missing description, skipping line item`);
          continue;
        }
        const descUpper = li.description.toUpperCase();
        
        let panel_id: string | null = null;
        let inverter_id: string | null = null;
        let battery_id: string | null = null;
        let solar_meter_id: string | null = null;
        let net_meter_id: string | null = null;
        let la_id: string | null = null;
        let structure_id: string | null = null;
        let bom_item_id: string | null = null;

        // Resolve component FK using in-memory caches
        const rateStr = (li.ratePerUnit !== undefined && li.ratePerUnit !== null) ? li.ratePerUnit.toString() : '';

        if (li.itemType === 'panel') {
          panel_id = rateStr ? resolvedIds.panels.get(rateStr) || null : null;
          if (!panel_id) {
            // fallback match closest
            const key = `unknown:panel:${panelWattage}`.toLowerCase();
            panel_id = resolvedIds.panels.get(key) || null;
          }
        } else if (li.itemType === 'inverter') {
          inverter_id = rateStr ? resolvedIds.inverters.get(rateStr) || null : null;
          if (!inverter_id) {
            // Match by capacity
            const cap = li.capacityKW || capacity;
            const matches = Array.from(resolvedIds.inverters.keys()).filter(k => k.includes(`:${cap}:`));
            if (matches.length > 0) inverter_id = resolvedIds.inverters.get(matches[0]) || null;
          }
        } else if (li.itemType === 'battery') {
          battery_id = rateStr ? resolvedIds.batteries.get(rateStr) || null : null;
        } else if (li.itemType === 'meter' || li.itemType === 'solar_meter' || li.itemType === 'net_meter') {
          const resolvedMeter = rateStr ? resolvedIds.meters.get(rateStr) || null : null;
          if (descUpper.includes('SOLAR')) {
            solar_meter_id = resolvedMeter;
          } else {
            net_meter_id = resolvedMeter;
          }
        } else if (li.itemType === 'la' || li.itemType === 'lightning_arrester') {
          la_id = rateStr ? resolvedIds.las.get(rateStr) || null : null;
        } else if (li.itemType === 'structure') {
          structure_id = rateStr ? resolvedIds.structures.get(rateStr) || null : null;
        } else {
          // General accessory / service / BOM Item
          bom_item_id = resolvedIds.bomItems.get(descUpper) || null;
          if (!bom_item_id) {
            const { section, subType } = resolveBomItemSectionAndSubType(li.description);
            bom_item_id = await ensureBomItem(section, subType, li.description);
          }
        }

        // Integrity checking: raise warning if reference is orphan
        if (li.itemType === 'panel' && !panel_id) {
          logWarning(`System "${s.systemId}" panel not resolved. Rate: ${li.ratePerUnit}`);
        }
        if (li.itemType === 'inverter' && !inverter_id) {
          logWarning(`System "${s.systemId}" inverter not resolved. Rate: ${li.ratePerUnit}`);
        }
        if (li.itemType === 'structure' && !structure_id) {
          logWarning(`System "${s.systemId}" structure not resolved. Rate: ${li.ratePerUnit}`);
        }

        if (!panel_id && !inverter_id && !battery_id && !solar_meter_id && !net_meter_id && !la_id && !structure_id && !bom_item_id) {
          // If we couldn't resolve, fallback to a default accessories BOM item
          bom_item_id = await ensureBomItem('services', 'ACCESSORIES', 'ACCESSORIES');
        }


        const { section } = resolveBomItemSectionAndSubType(li.description);
        const itemUuid = getUuid('system_items', `${s.systemId}:${li.description}:${sortOrder}`);

        await client.query(`
          INSERT INTO system_items (id, system_id, panel_id, inverter_id, battery_id, solar_meter_id, net_meter_id, la_id, structure_id, bom_item_id, section, description, remarks, unit, default_qty, is_mandatory, is_included_by_default, sort_order)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        `, [
          itemUuid,
          systemUuid,
          panel_id,
          inverter_id,
          battery_id,
          solar_meter_id,
          net_meter_id,
          la_id,
          structure_id,
          bom_item_id,
          section,
          li.description,
          li.description,
          li.unit || 'Nos',
          li.quantity || 1,
          true,
          true,
          sortOrder++
        ]);

        report.summary.systemItemsImported++;
        report.summary.recordsCreated++;
      }
    }


    // ────────────────────────────────────────────────────────
    // PHASE 14 — AUDIT & VALIDATION
    // ────────────────────────────────────────────────────────
    console.log('Running schema checks and validations...');
    
    // Check 1: Duplicate equipment models
    const dupPanels = await client.query('SELECT brand, model, wattage_w, COUNT(*) FROM eq_panels GROUP BY brand, model, wattage_w HAVING COUNT(*) > 1');
    if (dupPanels.rows.length > 0) {
      logError(`Duplicate panels found in database: ${JSON.stringify(dupPanels.rows)}`);
    }

    // Check 2: Invalid GST percentages
    const invalidGst = await client.query('SELECT id, description, gst_pct FROM eq_bom_items WHERE gst_pct NOT IN (0, 0.05, 0.089, 0.12, 0.138, 0.18, 0.28)');
    if (invalidGst.rows.length > 0) {
      logWarning(`BOM items with non-standard GST rate: ${JSON.stringify(invalidGst.rows)}`);
    }

    // Check 3: Orphan system_items (no equipment and no BOM item linked)
    const orphans = await client.query(`
      SELECT id, description FROM system_items 
      WHERE panel_id IS NULL AND inverter_id IS NULL AND battery_id IS NULL 
        AND solar_meter_id IS NULL AND net_meter_id IS NULL AND la_id IS NULL 
        AND structure_id IS NULL AND bom_item_id IS NULL AND comm_device_id IS NULL
    `);
    if (orphans.rows.length > 0) {
      logError(`Orphan system items found (no target equipment): ${JSON.stringify(orphans.rows)}`);
    }

    // ────────────────────────────────────────────────────────
    // COMMIT TRANSACTION & SAVE REPORT
    // ────────────────────────────────────────────────────────
    if (report.summary.totalErrors > 0) {
      console.log('⚠️ Errors detected. Rolling back transaction to ensure consistency...');
      await client.query('ROLLBACK');
    } else {
      console.log('🎉 No errors detected. Committing transaction...');
      await client.query('COMMIT');
      console.log('✅ Database transaction committed successfully!');
    }

  } catch (err: any) {
    console.error('❌ Exception in import process. Rolling back...');
    try {
      await client.query('ROLLBACK');
    } catch (rbErr) {
      console.error('Failed to rollback:', rbErr);
    }
    logError(err.message);
  } finally {
    await client.end();
  }

  // Save report file
  const reportPath = path.resolve(process.cwd(), 'import-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`\n📄 Import Report saved to ${reportPath}`);
}

main();
