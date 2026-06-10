/**
 * ENERMASS — Structure Components Import Script
 * ==============================================
 * Reads structure rate.xlsx, categorizes all components intelligently,
 * then upserts into eq_structure_components, eq_structure_bom, eq_structure_addons.
 *
 * Run: npx tsx src/scripts/importStructureComponents.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as xlsx from 'xlsx';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// ─── Component category mapping ─────────────────────────────────────────────

type Category = 'steel_section' | 'hardware' | 'finishing' | 'civil' | 'fabrication' | 'addon';

function categorize(name: string): Category {
  const n = name.toLowerCase();
  if (n.includes('rafter') || n.includes('purlin') || n.includes('rectangle tube') || n.includes('square tube') || n.includes('squre tube')) return 'steel_section';
  if (n.includes('plate') || n.includes('bolt') || n.includes('end cap') || n.includes('anchor') || n.includes('angor')) return 'hardware';
  if (n.includes('primer') || n.includes('thinner') || n.includes('brush') || n.includes('epoxy')) return 'finishing';
  if (n.includes('block') || n.includes('grout') || n.includes('chemical') || n.includes('chemickal') || n.includes('nano')) return 'civil';
  if (n.includes('welding') || n.includes('cutting') || n.includes('wheel') || n.includes('rad')) return 'fabrication';
  if (n.includes('walkway') || n.includes('ladder')) return 'addon';
  return 'hardware'; // fallback
}

function unitFor(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('primer') || n.includes('thinner')) return 'Liter';
  if (n.includes('rafter') || n.includes('purlin') || n.includes('rectangle') || n.includes('squre') || n.includes('square')) return 'Kg';
  if (n.includes('walkway') || n.includes('ladder')) return 'Meter';
  if (n.includes('welding') || n.includes('rad')) return 'Nos';
  if (n.includes('cutting') || n.includes('wheel')) return 'Nos';
  return 'Nos';
}

function cleanName(raw: string): string {
  return raw
    .replace(/\s+/g, ' ')
    .replace(/rectangle tube-?/gi, 'Rectangle Tube')
    .replace(/Squre/gi, 'Square')
    .replace(/squre/gi, 'Square')
    .replace(/Angor/gi, 'Anchor')
    .replace(/Chemickal/gi, 'Chemical')
    .replace(/welding rad/gi, 'Welding Rod')
    .replace(/Welding- rad/gi, 'Welding Rod')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// ─── Parse the gi sheet (GI material BOM for multiple capacities) ────────────

interface ComponentDef {
  name: string;
  cleanName: string;
  category: Category;
  unit: string;
  rateAppolo: number;
  rateTata: number;
  rateDeemac: number;
  sellingPrice: number;
}

interface BomEntry {
  componentName: string;
  capacityKwMin: number;
  capacityKwMax: number;
  panelQty: number;
  qty: number;
  totalWeightKg: number | null;
}

function parseStructureSheet(
  ws: xlsx.WorkSheet,
  material: 'GI' | 'GP'
): { systems: Array<{ capacityKW: number; panelQty: number; componentTotals: number; rows: Array<{ name: string; qty: number; totalWeight: number | null; rateA: number; rateB: number }> }> } {
  const rows: any[][] = xlsx.utils.sheet_to_json(ws, { header: 1, defval: '' });
  const systems: any[] = [];
  let currentSystem: any = null;
  let headerRow: any[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const firstCell = String(row[0] || '').trim();
    const secondCell = String(row[1] || '').trim();

    // Detect system header: "5KW ENERMASS STRUCTURE RATE- ..."
    const sysMatch = firstCell.match(/^(\d+(?:\.\d+)?)\s*KW/i);
    if (sysMatch && firstCell.toLowerCase().includes('enermass')) {
      const capKW = parseFloat(sysMatch[1]);
      const panelMatch = firstCell.match(/(\d+)\s*(?:panel|panels)/i);
      const panelQty = panelMatch ? parseInt(panelMatch[1]) : 0;
      currentSystem = { capacityKW: capKW, panelQty, items: [], total: 0 };
      systems.push(currentSystem);
      continue;
    }

    // Detect column header row
    if (secondCell.toLowerCase() === 'item' && currentSystem) {
      headerRow = row;
      continue;
    }

    // Skip non-data rows
    if (!currentSystem) continue;
    if (typeof row[0] !== 'number') continue;

    const itemName = String(row[1] || row[3] || '').trim();
    if (!itemName || itemName.toLowerCase() === 'total') continue;

    // Columns: [slno, Item, Required qty, Total weight, Rate-A, Total-A, Rate-B, Total-B]
    const qty = typeof row[2] === 'number' ? row[2] : (parseFloat(String(row[2])) || 0);
    const totalWeight = typeof row[3] === 'number' ? row[3] : null;
    const rateA = typeof row[4] === 'number' ? row[4] : 0;
    const rateB = typeof row[6] === 'number' ? row[6] : 0;

    currentSystem.items.push({ name: itemName, qty, totalWeight, rateA, rateB });
  }

  return { systems };
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔════════════════════════════════════════════════╗');
  console.log('║  ENERMASS Structure Components Import Engine   ║');
  console.log('╚════════════════════════════════════════════════╝\n');

  const wb = xlsx.readFile(path.resolve(process.cwd(), 'structure rate.xlsx'));
  console.log('Sheets found:', wb.SheetNames.join(', '));

  // ── Step 1: Parse sheets ─────────────────────────────────────────────────
  const giSheet = wb.Sheets['gi'];
  const gpSheet = wb.Sheets['gp'];
  const walkwaySheet = wb.Sheets['walkway and ladder'];

  const { systems: giSystems } = parseStructureSheet(giSheet, 'GI');
  const { systems: gpSystems } = parseStructureSheet(gpSheet, 'GP');

  console.log(`\nParsed ${giSystems.length} GI system configs`);
  console.log(`Parsed ${gpSystems.length} GP system configs`);

  // ── Step 2: Look up existing structure IDs ───────────────────────────────
  const { data: existingStructs, error: structErr } = await sb
    .from('eq_mounting_structures')
    .select('id, name, material, roof_mount_type')
    .is('org_id', null);

  if (structErr) {
    console.error('Failed to load structures:', structErr.message);
    process.exit(1);
  }
  console.log(`\nFound ${existingStructs?.length ?? 0} existing mounting structures in DB`);

  // Helper: find structure ID by material
  function findStructureId(material: 'GI' | 'GP'): string | null {
    const s = existingStructs?.find(
      (s) => s.material?.toUpperCase() === material ||
             s.name?.toUpperCase().includes(material)
    );
    return s?.id ?? null;
  }

  const giStructId = findStructureId('GI');
  const gpStructId = findStructureId('GP');

  console.log(`GI structure ID: ${giStructId ?? 'NOT FOUND — will create'}`);
  console.log(`GP structure ID: ${gpStructId ?? 'NOT FOUND — will create'}`);

  // ── Step 3: Create structures if missing ─────────────────────────────────
  async function ensureStructure(material: 'GI' | 'GP', existingId: string | null): Promise<string> {
    if (existingId) return existingId;

    const { data, error } = await sb
      .from('eq_mounting_structures')
      .upsert({
        name: material === 'GI' ? 'GI Structure (Appolo/Tata)' : 'GP Structure (Appolo/Deemac)',
        material: material.toLowerCase(),
        roof_mount_type: 'sheet_roof',
        raw_material_rate: material === 'GI' ? 110 : 85,
        fabrication_rate: 0,
        galvanizing_rate: 0,
        wastage_pct: 0.05,
        fastener_weight_pct: 0.02,
        base_weight_kg: 0,
        gst_pct: 0.18,
        is_active: true,
      }, { onConflict: 'name,material,roof_mount_type,elevation_height_mm', ignoreDuplicates: false })
      .select('id')
      .single();

    if (error) {
      console.error(`Failed to create ${material} structure:`, error.message);
      process.exit(1);
    }
    console.log(`✅ Created ${material} structure: ${data.id}`);
    return data.id;
  }

  const giId = await ensureStructure('GI', giStructId);
  const gpId = await ensureStructure('GP', gpStructId);

  // ── Step 4: Build deduplicated component catalogue ───────────────────────
  // Collect all unique components across all systems for each material
  const componentCatalog = new Map<string, ComponentDef & { material: string; structureId: string }>();

  function registerComponents(systems: any[], material: 'GI' | 'GP', structureId: string) {
    for (const sys of systems) {
      for (const item of sys.items) {
        const cn = cleanName(item.name);
        const key = `${material}::${cn.toLowerCase()}`;
        if (!componentCatalog.has(key)) {
          const cat = categorize(cn);
          // For GI: rateA = Appolo/Deemac, rateB = Tata/Appolo
          // For GP: rateA = Deemac, rateB = Appolo
          const sellingPrice = material === 'GI'
            ? (item.rateA > 0 ? item.rateA : item.rateB)
            : item.rateB > 0 ? item.rateB : item.rateA;

          componentCatalog.set(key, {
            name: cn,
            cleanName: cn,
            category: cat,
            unit: unitFor(cn),
            rateAppolo: material === 'GI' ? item.rateA : item.rateB,
            rateTata: material === 'GI' ? item.rateB : 0,
            rateDeemac: material === 'GP' ? item.rateA : 0,
            sellingPrice,
            material,
            structureId,
          });
        }
      }
    }
  }

  registerComponents(giSystems, 'GI', giId);
  registerComponents(gpSystems, 'GP', gpId);

  console.log(`\n📦 Unique components catalogued: ${componentCatalog.size}`);
  componentCatalog.forEach((c, k) => {
    console.log(`  [${c.material}] [${c.category.padEnd(14)}] ${c.cleanName} (₹${c.sellingPrice}/${c.unit})`);
  });

  // ── Step 5: Upsert components ────────────────────────────────────────────
  console.log('\n💾 Upserting structure components...');

  const componentInserts = [...componentCatalog.values()].map((c) => ({
    structure_id: c.structureId,
    org_id: null,
    category: c.category,
    name: c.cleanName,
    unit: c.unit,
    rate_appolo: c.rateAppolo,
    rate_tata: c.rateTata,
    rate_deemac: c.rateDeemac,
    selling_price: c.sellingPrice,
    buy_price: c.sellingPrice, // start same
    gst_pct: 0.18,
    is_active: true,
  }));

  const { data: insertedComponents, error: compErr } = await sb
    .from('eq_structure_components')
    .upsert(componentInserts, { onConflict: 'structure_id,name', ignoreDuplicates: false })
    .select('id, name, structure_id');

  if (compErr) {
    console.error('Component upsert failed:', compErr.message);
    process.exit(1);
  }
  console.log(`✅ Upserted ${insertedComponents?.length ?? 0} components`);

  // Build name→id lookup
  const compIdMap = new Map<string, string>();
  insertedComponents?.forEach((c) => compIdMap.set(`${c.structure_id}::${c.name.toLowerCase()}`, c.id));

  // ── Step 6: Upsert BOM quantities ────────────────────────────────────────
  console.log('\n📋 Upserting BOM quantity entries...');

  const bomInserts: any[] = [];

  function buildBomEntries(systems: any[], material: 'GI' | 'GP', structureId: string) {
    for (const sys of systems) {
      // Determine capacity range (±0.5kW band)
      const capMin = Math.max(0, sys.capacityKW - 0.5);
      const capMax = sys.capacityKW + 0.5;

      for (const item of sys.items) {
        const cn = cleanName(item.name);
        const key = `${structureId}::${cn.toLowerCase()}`;
        const compId = compIdMap.get(key);
        if (!compId) {
          console.warn(`  ⚠️  No component ID for [${material}] "${cn}"`);
          continue;
        }

        bomInserts.push({
          component_id: compId,
          structure_id: structureId,
          capacity_kw_min: capMin,
          capacity_kw_max: capMax,
          panel_qty: sys.panelQty || null,
          qty: item.qty,
          total_weight_kg: item.totalWeight,
          notes: `${material} - ${sys.capacityKW}kW`,
        });
      }
    }
  }

  buildBomEntries(giSystems, 'GI', giId);
  buildBomEntries(gpSystems, 'GP', gpId);

  const { error: bomErr } = await sb
    .from('eq_structure_bom')
    .upsert(bomInserts, { onConflict: 'component_id,capacity_kw_min,capacity_kw_max', ignoreDuplicates: false });

  if (bomErr) {
    console.error('BOM upsert failed:', bomErr.message);
    process.exit(1);
  }
  console.log(`✅ Upserted ${bomInserts.length} BOM quantity entries`);

  // ── Step 7: Parse and upsert walkway/ladder add-ons ─────────────────────
  console.log('\n🚶 Upserting walkway/ladder add-ons...');

  if (walkwaySheet) {
    const walkRows: any[][] = xlsx.utils.sheet_to_json(walkwaySheet, { header: 1, defval: '' });

    // Walkway: row 14, col 3 = ₹837.33/m
    // Ladder: row 29, col 0 = ₹898.33/m
    let walkwayRate = 0;
    let ladderRate = 0;

    for (let i = 0; i < walkRows.length; i++) {
      const row = walkRows[i];
      const cell1 = String(row[1] || '').toLowerCase();
      if (cell1.includes('1 meter walkway')) {
        walkwayRate = typeof row[3] === 'number' ? row[3] : parseFloat(String(row[3]) || '0');
      }
      if (cell1.includes('1 meter ladder') || String(row[0] || '').toString().includes('898')) {
        ladderRate = typeof row[0] === 'number' ? row[0] : parseFloat(String(row[0]) || '0');
        if (!ladderRate) ladderRate = typeof row[2] === 'number' ? row[2] : 0;
      }
    }

    // Fallback from known values
    if (!walkwayRate) walkwayRate = 837.33;
    if (!ladderRate) ladderRate = 898.33;

    console.log(`  Walkway: ₹${walkwayRate.toFixed(2)}/meter`);
    console.log(`  Ladder:  ₹${ladderRate.toFixed(2)}/meter`);

    const addonInserts = [
      {
        org_id: null,
        name: 'Walkway',
        material: 'GP',
        unit: 'Meter',
        rate_per_unit: Math.round(walkwayRate * 100) / 100,
        buy_price: Math.round(walkwayRate * 100) / 100,
        gst_pct: 0.18,
        is_active: true,
        notes: '6-meter section cost ÷ 6 = ₹837.33/m (Appolo GP material)',
      },
      {
        org_id: null,
        name: 'Ladder',
        material: 'GP',
        unit: 'Meter',
        rate_per_unit: Math.round(ladderRate * 100) / 100,
        buy_price: Math.round(ladderRate * 100) / 100,
        gst_pct: 0.18,
        is_active: true,
        notes: '3.6-meter section cost ÷ 3.6 = ₹898.33/m (Appolo GP material)',
      },
    ];

    const { error: addonErr } = await sb
      .from('eq_structure_addons')
      .upsert(addonInserts, { onConflict: 'name,material', ignoreDuplicates: false });

    if (addonErr) {
      console.error('Addon upsert failed:', addonErr.message);
    } else {
      console.log(`✅ Upserted ${addonInserts.length} add-on records`);
    }
  }

  // ── Step 8: Summary ──────────────────────────────────────────────────────
  console.log('\n╔════════════════════════════════════════════════╗');
  console.log('║               IMPORT COMPLETE                  ║');
  console.log('╠════════════════════════════════════════════════╣');
  console.log(`║  Structure types : GI, GP                      ║`);
  console.log(`║  Components      : ${String(componentCatalog.size).padStart(3)} unique items            ║`);
  console.log(`║  BOM entries     : ${String(bomInserts.length).padStart(3)} (capacity × component)  ║`);
  console.log(`║  Add-ons         : Walkway, Ladder (₹/meter)   ║`);
  console.log('╚════════════════════════════════════════════════╝\n');
}

main().catch((err) => {
  console.error('\n❌ Fatal error:', err);
  process.exit(1);
});
