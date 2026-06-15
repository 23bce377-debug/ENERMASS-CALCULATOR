import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function seed() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  await client.connect();

  try {
    // 1. Verify tables exist and counts
    const catCountRes = await client.query('SELECT COUNT(*) FROM bom_categories');
    const itemsCountRes = await client.query('SELECT COUNT(*) FROM bom_template_items');
    
    console.log(`Initial Categories count: ${catCountRes.rows[0].count}`);
    console.log(`Initial Items count: ${itemsCountRes.rows[0].count}`);

    // 2. Seed Categories
    console.log('\n--- Seeding bom_categories ---');
    await client.query(`
      INSERT INTO bom_categories (name, display_order, is_optional) VALUES
        ('Panels & Inverter',      1, false),
        ('Mounting Structure',     2, false),
        ('DC Protection',          3, false),
        ('AC Protection',          4, false),
        ('Cables & Conduit',       5, false),
        ('Earthing',               6, false),
        ('Civil Works',            7, true),
        ('Monitoring & Safety',    8, false),
        ('Logistics & Handling',   9, false)
      ON CONFLICT (name) DO NOTHING;
    `);

    // Fetch categories to get their IDs
    const { rows: categories } = await client.query('SELECT id, name FROM bom_categories');
    const catMap: Record<string, string> = {};
    categories.forEach((c) => {
      catMap[c.name] = c.id;
    });

    console.log('Categories mapped:', Object.keys(catMap).length);

    // 3. Seed Items
    console.log('\n--- Seeding bom_template_items ---');

    const items = [
      // DC PROTECTION
      ['DC Protection', 'DCDB-01',  'DC Distribution Box (DCDB)',         'units', 2500,  4000, 3000, 'CEIL(system_kw / 5)',                            false, false, '1 unit per 5kW string group. Includes fuse holders.'],
      ['DC Protection', 'MC4-PAIR', 'MC4 Connector Pair (male+female)',   'pairs', 45,    80,   60,   'panel_count * 2 + CEIL(panel_count * 0.1)',      false, false, 'Includes 10% spare. High-failure item — use IP68 rated only.'],
      ['DC Protection', 'DC-SPD-01', 'DC Surge Protection Device (SPD)',  'units', 800,  1500, 1100,  'CEIL(system_kw / 5)',                            false, false, '1 per DCDB. Type 2 SPD minimum.'],

      // AC PROTECTION
      ['AC Protection', 'ACDB-01', 'AC Distribution Box (ACDB)',          'units', 3500,  5000, 4200, 'CEIL(system_kw / inverter_kw)',                  false, false, '1 per inverter output. IP65 for outdoor installations.'],
      ['AC Protection', 'AC-MCB-01', 'AC MCB (Miniature Circuit Breaker)', 'units', 250,  400, 320,   'CEIL(system_kw / inverter_kw)',                  false, false, '1 per inverter. Rating: inverter_ac_output_amps * 1.25'],
      ['AC Protection', 'AC-SPD-01', 'AC Surge Protection Device',        'units', 1200, 2000, 1500,  '1',                                              false, false, 'Type 1+2 SPD on main AC incomer.'],

      // CABLES & CONDUIT
      ['Cables & Conduit', 'DC-CABLE-4', 'DC Cable 4mm² Copper (Flexible)',  'meters', 28,  35,  31,   null,                                             true,  false, 'SURVEY REQUIRED: qty = distancePanelToInverter × 2 × string_count + 15% spare'],
      ['Cables & Conduit', 'AC-CABLE-6', 'AC Cable 6mm² Copper (3-phase)',   'meters', 55,  75,  63,   null,                                             true,  false, 'SURVEY REQUIRED: qty = distanceInverterToMeter × 3 for 3-phase'],
      ['Cables & Conduit', 'AC-CABLE-4', 'AC Cable 4mm² Copper (single-phase)', 'meters', 45, 65, 52, null,                                             true,  false, 'SURVEY REQUIRED: qty = distanceInverterToMeter × 2 for single-phase'],
      ['Cables & Conduit', 'CONDUIT-GI', 'GI Conduit Pipe 25mm',             'meters', 85, 120, 100,  null,                                             true,  false, 'SURVEY REQUIRED: qty = (dc_cable_m + ac_cable_m) × 1.1'],
      ['Cables & Conduit', 'CABLE-TRAY', 'Cable Tray Perforated 100mm',      'meters', 180, 250, 210, null,                                             true,  false, 'Optional. For roof cable runs >15m. Survey dependent.'],

      // EARTHING
      ['Earthing', 'CHEM-EARTH', 'Chemical Earthing Kit (pipe + compound)', 'pits', 2200, 3500, 2800, 'GREATEST(2, CEIL(system_kw / 10))',              false, false, 'Minimum 2 pits. DISCOM mandatory. Use Plate or Pipe electrode.'],
      ['Earthing', 'GI-STRIP',  'GI Flat Strip 25×3mm',              'meters', 85,  120, 100, null,                                             true,  false, 'SURVEY REQUIRED. Run from panel frames to earth pits.'],
      ['Earthing', 'EARTH-BB',  'Copper Earth Bus Bar',               'units',  400, 700, 550,  '1',                                              false, false, '1 per system. All earth connections terminate here.'],

      // MONITORING & SAFETY
      ['Monitoring & Safety', 'LA-01',     'Lightning Arrester (Class B)',       'units', 1800, 3000, 2200, null,                                             true,  false, 'SURVEY REQUIRED: qty = CEIL(roof_area_sqft / 1500)'],
      ['Monitoring & Safety', 'EARTH-ROD', 'GI Earth Rod 1.5m (backup)',         'units',  350,  500, 420,  '1',                                              false, false, 'Supplementary to chemical earthing. Always include.'],

      // CIVIL WORKS
      ['Civil Works', 'CIV-CEM',   'Portland Cement 50kg bag',           'bags',   380,  420, 400,  'CEIL(system_kw * 0.4)',                          false, true, 'For anchor bolt pockets and column bases.'],
      ['Civil Works', 'CIV-SAND',  'River Sand (filling)',               'cubic_m', 1800, 2400, 2100, 'ROUND(system_kw * 0.02, 2)',                     false, true, 'For concrete mix.'],
      ['Civil Works', 'CIV-AGG',   'Coarse Aggregate 20mm',              'cubic_m', 2200, 2800, 2500, 'ROUND(system_kw * 0.015, 2)',                    false, true, 'For concrete mix.'],
      ['Civil Works', 'CIV-BRICK', 'Red Brick (standard)',               'units',     8,   12,  10,   'CEIL(system_kw * 15)',                           false, true, 'For anchor column construction.'],
      ['Civil Works', 'CIV-BOLT',  'Anchor Bolt M12×150mm (with nut)',   'units',    35,   55,  45,   'panel_count * 4',                               false, true, '4 bolts per panel position. HDG coated.'],

      // LOGISTICS
      ['Logistics & Handling', 'LOG-T1',    'Transport: Vendor to Warehouse',     'trip',  2000, 6000, 3500, '1',                                              false, false, 'Flat rate per delivery trip. Adjust for distance.'],
      ['Logistics & Handling', 'LOG-T2',    'Transport: Warehouse to Site',       'trip',  1500, 4500, 2500, '1',                                              false, false, 'Per dispatch trip. May be multiple trips for large systems.'],
      ['Logistics & Handling', 'LOG-LUL',   'Loading/Unloading Labour',           'days',   600,  900, 750,  'CEIL(system_kw / 3)',                            false, false, '1 day per 3kW. Two labourers minimum.'],
      ['Logistics & Handling', 'LOG-PACK',  'Packing Material (straps, foam)',    'lumpsum', 500, 1200, 800, '1',                                              false, false, 'Per project. Panel corner protectors + strapping.']
    ];

    for (const item of items) {
      const [
        categoryName, skuCode, name, uom, minRate, maxRate, defaultRate,
        qtyFormula, isSurveyDependent, civilRequiredOnly, notes
      ] = item;

      const categoryId = catMap[categoryName as string];
      if (!categoryId) {
        console.error(`Category not found: ${categoryName}`);
        continue;
      }

      await client.query(`
        INSERT INTO bom_template_items (
          category_id, sku_code, description, unit, unit_rate_min, unit_rate_max, default_rate,
          qty_formula, is_survey_dependent, civil_required_only, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (sku_code) DO UPDATE SET
          description = EXCLUDED.description,
          default_rate = EXCLUDED.default_rate,
          qty_formula = EXCLUDED.qty_formula,
          category_id = EXCLUDED.category_id;
      `, [categoryId, skuCode, name, uom, minRate, maxRate, defaultRate, qtyFormula, isSurveyDependent, civilRequiredOnly, notes]);
    }

    console.log('Items seeded.');

    // 4. Verify counts
    console.log('\n--- Verification ---');
    const verifyRes = await client.query(`
      SELECT bc.name, COUNT(bti.id) AS items
      FROM bom_categories bc
      LEFT JOIN bom_template_items bti ON bti.category_id = bc.id
      GROUP BY bc.name ORDER BY bc.name;
    `);

    console.table(verifyRes.rows);

    const checkStructRes = await client.query(`
      SELECT sku_code, default_rate FROM bom_template_items
      WHERE category_id = (SELECT id FROM bom_categories WHERE name = 'Mounting Structure');
    `);
    
    if (checkStructRes.rows.length > 0) {
      console.log('\nStructure Items (should all be >= 3200):');
      console.table(checkStructRes.rows);
    } else {
      console.log('\nNo structure items found (as expected, none were in the prompt array).');
    }

  } catch (err) {
    console.error('Error during seeding:', err);
  } finally {
    await client.end();
  }
}

seed();
