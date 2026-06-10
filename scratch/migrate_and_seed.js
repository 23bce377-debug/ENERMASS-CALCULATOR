const { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: "postgresql://postgres.xjdqpwmizmfkcdcgcxqv:9BTkCoHcgWtYvE36@aws-1-ap-south-1.pooler.supabase.com:6543/postgres"
  });
  await client.connect();
  console.log("Connected to DB!");

  try {
    await client.query('BEGIN');
    console.log("Transaction started.");

    // 1. Create table structure_component_master
    await client.query(`
      CREATE TABLE IF NOT EXISTS structure_component_master (
        id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id              UUID REFERENCES organisations(id) ON DELETE CASCADE,
        name                TEXT NOT NULL,
        type                TEXT, -- 'tube', 'plate', 'channel', etc.
        weight_per_meter    NUMERIC(10,4),
        material            TEXT, -- 'GP', 'GI', etc.
        selling_price       NUMERIC(12,4) NOT NULL DEFAULT 0,
        buy_price           NUMERIC(12,4) NOT NULL DEFAULT 0,
        gst_pct             NUMERIC(6,5) NOT NULL DEFAULT 0.18000,
        is_active           BOOLEAN NOT NULL DEFAULT TRUE,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    
    // Create unique index
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_struct_comp_name 
      ON structure_component_master (name, COALESCE(org_id::text, 'global'));
    `);
    console.log("Table structure_component_master and index verified/created.");

    // 2. Enable RLS and add visibility policy
    await client.query(`ALTER TABLE structure_component_master ENABLE ROW LEVEL SECURITY;`);
    
    // Check if policy exists first
    const policyCheckVisibility = await client.query(`
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'public' AND tablename = 'structure_component_master' AND policyname = 'structure_component_master_visibility'
    `);
    if (policyCheckVisibility.rowCount === 0) {
      await client.query(`
        CREATE POLICY structure_component_master_visibility ON structure_component_master 
        FOR SELECT USING ((org_id IS NULL) OR (org_id = auth_org_id()));
      `);
      console.log("Policy structure_component_master_visibility created.");
    }

    const policyCheckWrite = await client.query(`
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'public' AND tablename = 'structure_component_master' AND policyname = 'structure_component_master_write'
    `);
    if (policyCheckWrite.rowCount === 0) {
      await client.query(`
        CREATE POLICY structure_component_master_write ON structure_component_master 
        FOR ALL TO authenticated USING (org_id = auth_org_id()) WITH CHECK (org_id = auth_org_id());
      `);
      console.log("Policy structure_component_master_write created.");
    }

    // 3. Add column structure_component_id to system_items if not exists
    const columnCheck = await client.query(`
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'system_items' AND column_name = 'structure_component_id'
    `);
    if (columnCheck.rowCount === 0) {
      await client.query(`
        ALTER TABLE system_items ADD COLUMN structure_component_id UUID REFERENCES structure_component_master(id) ON DELETE SET NULL;
      `);
      console.log("Column structure_component_id added to system_items.");
    }

    // 4. Update the ck_single_ref constraint
    // Drop it if exists
    await client.query(`ALTER TABLE system_items DROP CONSTRAINT IF EXISTS ck_single_ref;`);
    await client.query(`
      ALTER TABLE system_items ADD CONSTRAINT ck_single_ref CHECK (
        (CASE WHEN panel_id               IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN inverter_id            IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN battery_id             IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN solar_meter_id         IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN net_meter_id           IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN la_id                  IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN structure_id           IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN bom_item_id            IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN comm_device_id         IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN structure_component_id IS NOT NULL THEN 1 ELSE 0 END
        ) = 1
      );
    `);
    console.log("Check constraint ck_single_ref recreated on system_items.");

    // 5. Seed Inverters (Solis 3kW and Solis 6kW)
    const seedInverters = [
      {
        brand: 'Solis',
        model: 'Solis 3kW',
        capacity_kw: 3.0,
        inverter_type: 'on_grid',
        phases: 1,
        selling_price: 15000.0,
        buy_price: 15000.0,
        gst_pct: 0.12
      },
      {
        brand: 'Solis',
        model: 'Solis 6kW',
        capacity_kw: 6.0,
        inverter_type: 'on_grid',
        phases: 3,
        selling_price: 24000.0,
        buy_price: 24000.0,
        gst_pct: 0.12
      }
    ];

    const inverterIds = {};
    for (const inv of seedInverters) {
      const checkInv = await client.query(
        "SELECT id FROM eq_inverters WHERE brand = $1 AND model = $2 AND capacity_kw = $3",
        [inv.brand, inv.model, inv.capacity_kw]
      );
      if (checkInv.rowCount > 0) {
        inverterIds[inv.model] = checkInv.rows[0].id;
        console.log(`Inverter ${inv.model} already exists in DB.`);
      } else {
        const insertInv = await client.query(`
          INSERT INTO eq_inverters (brand, model, capacity_kw, inverter_type, phases, selling_price, buy_price, gst_pct, is_active)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
          RETURNING id
        `, [inv.brand, inv.model, inv.capacity_kw, inv.inverter_type, inv.phases, inv.selling_price, inv.buy_price, inv.gst_pct]);
        inverterIds[inv.model] = insertInv.rows[0].id;
        console.log(`Inverter ${inv.model} inserted.`);
      }
    }

    // 6. Seed reusable masters in eq_bom_items
    const seedBomItems = [
      { section: 'electrical_protection', sub_type: 'acdb_1ph', description: 'ACDB', selling_price: 850.0, unit: 'Nos', gst_pct: 0.18 },
      { section: 'electrical_protection', sub_type: 'acdb_3ph', description: 'ACDB 3 Phase', selling_price: 1900.0, unit: 'Nos', gst_pct: 0.18 },
      { section: 'electrical_protection', sub_type: 'dcdb_1ph', description: 'DCDB', selling_price: 850.0, unit: 'Nos', gst_pct: 0.18 },
      { section: 'electrical_protection', sub_type: 'dcdb_3ph', description: 'DCDB SPD 1 In 1 Out', selling_price: 1900.0, unit: 'Nos', gst_pct: 0.18 },
      { section: 'electrical_protection', sub_type: 'mcb_box_3ph', description: 'MCB Box 3 Phase', selling_price: 300.0, unit: 'Nos', gst_pct: 0.18 },
      { section: 'electrical_protection', sub_type: 'isolator_2p', description: 'Isolator 2 Pole 40A', selling_price: 290.0, unit: 'Nos', gst_pct: 0.18 },
      { section: 'electrical_protection', sub_type: 'isolator_4p', description: 'Isolator 4 Pole 40A', selling_price: 650.0, unit: 'Nos', gst_pct: 0.18 },
      { section: 'metering', sub_type: 'meter_box_1ph', description: 'Meter Box Single Phase', selling_price: 90.0, unit: 'Nos', gst_pct: 0.18 },
      { section: 'metering', sub_type: 'solar_meter_1ph', description: 'Solar Meter Single Phase', selling_price: 1700.0, unit: 'Nos', gst_pct: 0.18 },
      { section: 'metering', sub_type: 'solar_meter_3ph', description: 'Solar Meter 3 Phase', selling_price: 3750.0, unit: 'Nos', gst_pct: 0.18 },
      { section: 'cabling', sub_type: 'dc_cable_bos', description: 'DC Cable', selling_price: 48.0, unit: 'm', gst_pct: 0.18 },
      { section: 'cabling', sub_type: 'ac_cable_bos', description: 'AC Cable', selling_price: 49.0, unit: 'm', gst_pct: 0.18 },
      { section: 'cabling', sub_type: 'ac_cable_4mm', description: 'AC Cable 4mm', selling_price: 60.0, unit: 'm', gst_pct: 0.18 },
      { section: 'wiring', sub_type: 'wiring_pipe_20mm', description: 'Wiring Pipe 20mm', selling_price: 55.0, unit: 'm', gst_pct: 0.18 },
      { section: 'wiring', sub_type: 'wiring_tray', description: 'Wiring Tray 45x45', selling_price: 110.0, unit: 'Nos', gst_pct: 0.18 },
      { section: 'wiring', sub_type: 'flexible_pipe', description: 'Flexible Pipe 25mm', selling_price: 25.0, unit: 'm', gst_pct: 0.18 },
      { section: 'wiring', sub_type: 'pvc_elbow', description: 'PVC Elbow 20mm', selling_price: 8.0, unit: 'Nos', gst_pct: 0.18 },
      { section: 'wiring', sub_type: 'pvc_tee', description: 'PVC Tee 20mm', selling_price: 11.0, unit: 'Nos', gst_pct: 0.18 },
      { section: 'wiring', sub_type: 'circle_clip', description: 'Plastic Circle Clip', selling_price: 1.8, unit: 'Nos', gst_pct: 0.18 },
      { section: 'wiring', sub_type: 'fisher_screw', description: 'Fisher & Screw', selling_price: 4.0, unit: 'Nos', gst_pct: 0.18 },
      { section: 'earthing', sub_type: 'earth_rod', description: 'Earth Rod', selling_price: 180.0, unit: 'Nos', gst_pct: 0.18 },
      { section: 'earthing', sub_type: 'earth_compound', description: 'Earth Compound', selling_price: 110.0, unit: 'Nos', gst_pct: 0.18 },
      { section: 'earthing', sub_type: 'copper_wire_2_5', description: '2.5mm Copper Wire', selling_price: 33.0, unit: 'm', gst_pct: 0.18 },
      { section: 'earthing', sub_type: 'copper_lug_6mm', description: 'Copper Round Lug 6mm', selling_price: 7.0, unit: 'Nos', gst_pct: 0.18 },
      { section: 'earthing', sub_type: 'la_bos', description: 'Lightning Arrester', selling_price: 350.0, unit: 'Nos', gst_pct: 0.18 },
      { section: 'wiring', sub_type: 'ss_bolt_m6', description: 'M6x40 SS Bolt', selling_price: 20.0, unit: 'Nos', gst_pct: 0.18 },
      { section: 'wiring', sub_type: 'cable_tie_300', description: 'Cable Tie 300mm', selling_price: 2.5, unit: 'Nos', gst_pct: 0.18 },
      { section: 'wiring', sub_type: 'mc4_connector', description: 'MC4 Connector', selling_price: 27.0, unit: 'Pair', gst_pct: 0.18 },
      { section: 'services', sub_type: 'concrete_material', description: 'Concrete Material', selling_price: 1500.0, unit: 'Set', gst_pct: 0.18 },
      { section: 'mounting_structure', sub_type: 'panel_u_bolt', description: 'Panel U Bolt', selling_price: 15.0, unit: 'Nos', gst_pct: 0.18 },
      { section: 'mounting_structure', sub_type: 'nut_bolt', description: 'Nut & Bolt', selling_price: 10.0, unit: 'Nos', gst_pct: 0.18 }
    ];

    const bomItemIds = {};
    for (const item of seedBomItems) {
      // Check if it already exists by (section, sub_type)
      const checkRes = await client.query(
        "SELECT id FROM eq_bom_items WHERE section = $1 AND sub_type = $2",
        [item.section, item.sub_type]
      );
      if (checkRes.rowCount > 0) {
        bomItemIds[item.sub_type] = checkRes.rows[0].id;
        // Update price in case it has changed
        await client.query(
          "UPDATE eq_bom_items SET selling_price = $1, buy_price = $2, description = $3, unit = $4 WHERE id = $5",
          [item.selling_price, item.selling_price, item.description, item.unit, checkRes.rows[0].id]
        );
      } else {
        const insertRes = await client.query(`
          INSERT INTO eq_bom_items (section, sub_type, description, selling_price, buy_price, unit, gst_pct, is_active)
          VALUES ($1, $2, $3, $4, $5, $6, $7, true)
          RETURNING id
        `, [item.section, item.sub_type, item.description, item.selling_price, item.selling_price, item.unit, item.gst_pct]);
        bomItemIds[item.sub_type] = insertRes.rows[0].id;
        console.log(`BOM item ${item.description} inserted.`);
      }
    }

    // 7. Seed structure_component_master
    const seedStructureComponents = [
      { name: 'GP 75x75x1.6mm Tube (6m)', material: 'GP', type: 'tube', weight_per_meter: 3.5, selling_price: 2000.0 },
      { name: 'GP 60x40x1.6mm Tube (4400mm)', material: 'GP', type: 'tube', weight_per_meter: 2.3, selling_price: 1000.0 },
      { name: 'GP 60x40x1.6mm Tube', material: 'GP', type: 'tube', weight_per_meter: 2.3, selling_price: 1360.0 },
      { name: 'GP 40x40x1.6mm Tube (3600mm)', material: 'GP', type: 'tube', weight_per_meter: 1.8, selling_price: 600.0 },
      { name: 'GP 40x40x1.6mm Tube', material: 'GP', type: 'tube', weight_per_meter: 1.8, selling_price: 1000.0 },
      { name: 'GP 40x40x1.6mm LA Support (80mm)', material: 'GP', type: 'tube', weight_per_meter: 1.8, selling_price: 150.0 },
      { name: 'GP 40x40 LA Support', material: 'GP', type: 'tube', weight_per_meter: 1.8, selling_price: 150.0 },
      { name: 'C Channel Cross Bar', material: 'GP', type: 'channel', weight_per_meter: 2.0, selling_price: 180.0 },
      { name: 'Base Plate 80x80x6mm', material: 'MS', type: 'plate', weight_per_meter: null, selling_price: 150.0 },
      { name: 'Base Plate 80x80x6', material: 'MS', type: 'plate', weight_per_meter: null, selling_price: 150.0 }
    ];

    const structCompIds = {};
    for (const comp of seedStructureComponents) {
      const checkRes = await client.query(
        "SELECT id FROM structure_component_master WHERE name = $1",
        [comp.name]
      );
      if (checkRes.rowCount > 0) {
        structCompIds[comp.name] = checkRes.rows[0].id;
        await client.query(
          "UPDATE structure_component_master SET material = $1, type = $2, weight_per_meter = $3, selling_price = $4 WHERE id = $5",
          [comp.material, comp.type, comp.weight_per_meter, comp.selling_price, checkRes.rows[0].id]
        );
      } else {
        const insertRes = await client.query(`
          INSERT INTO structure_component_master (name, material, type, weight_per_meter, selling_price, buy_price, gst_pct, is_active)
          VALUES ($1, $2, $3, $4, $5, $6, 0.18000, true)
          RETURNING id
        `, [comp.name, comp.material, comp.type, comp.weight_per_meter, comp.selling_price, comp.selling_price]);
        structCompIds[comp.name] = insertRes.rows[0].id;
        console.log(`Structure component ${comp.name} inserted.`);
      }
    }

    // 8. Systems Rajasthan templates seed
    const systemsTemplates = [
      { name: 'Rajasthan 3KW', capacity_kw: 3.0, panel_qty: 6, panel_wattage_w: 540 },
      { name: 'Rajasthan 5KW', capacity_kw: 5.0, panel_qty: 8, panel_wattage_w: 540 },
      { name: 'Rajasthan 6KW', capacity_kw: 6.0, panel_qty: 10, panel_wattage_w: 540 }
    ];

    // Waaree 540W ID
    const panelId = '762b18ee-14e7-16f0-9eb4-9364d7ba5955';

    for (const sys of systemsTemplates) {
      // Check if system exists
      let systemId;
      const checkSys = await client.query("SELECT id FROM systems WHERE name = $1", [sys.name]);
      if (checkSys.rowCount > 0) {
        systemId = checkSys.rows[0].id;
        console.log(`System ${sys.name} already exists. Deleting its old items to re-insert...`);
        await client.query("DELETE FROM system_items WHERE system_id = $1", [systemId]);
      } else {
        const insertSys = await client.query(`
          INSERT INTO systems (name, category, capacity_kw, panel_qty, panel_wattage_w, target_margin_pct, is_active, is_custom)
          VALUES ($1, 'on_grid', $2, $3, $4, 0.20, true, false)
          RETURNING id
        `, [sys.name, sys.capacity_kw, sys.panel_qty, sys.panel_wattage_w]);
        systemId = insertSys.rows[0].id;
        console.log(`System ${sys.name} inserted.`);
      }

      // Add items for each system
      let sysItems = [];
      if (sys.name === 'Rajasthan 3KW') {
        sysItems = [
          // Panels
          { panel_id: panelId, section: 'solar_panels', description: 'Waaree 540W Panel', unit: 'Nos', default_qty: 6 },
          // Inverter
          { inverter_id: inverterIds['Solis 3kW'], section: 'power_electronics', description: 'Solis 3kW Inverter', unit: 'Nos', default_qty: 1 },
          // Structure Components
          { structure_component_id: structCompIds['GP 75x75x1.6mm Tube (6m)'], section: 'mounting_structure', description: 'GP 75x75x1.6mm Tube (6m)', unit: 'Nos', default_qty: 2 },
          { structure_component_id: structCompIds['GP 60x40x1.6mm Tube (4400mm)'], section: 'mounting_structure', description: 'GP 60x40x1.6mm Tube (4400mm)', unit: 'Nos', default_qty: 2 },
          { structure_component_id: structCompIds['GP 40x40x1.6mm Tube (3600mm)'], section: 'mounting_structure', description: 'GP 40x40x1.6mm Tube (3600mm)', unit: 'Nos', default_qty: 4 },
          { structure_component_id: structCompIds['GP 40x40x1.6mm LA Support (80mm)'], section: 'mounting_structure', description: 'GP 40x40x1.6mm LA Support (80mm)', unit: 'No', default_qty: 1 },
          { structure_component_id: structCompIds['C Channel Cross Bar'], section: 'mounting_structure', description: 'C Channel Cross Bar', unit: 'Meter', default_qty: 2 },
          { structure_component_id: structCompIds['Base Plate 80x80x6mm'], section: 'mounting_structure', description: 'Base Plate 80x80x6mm', unit: 'Nos', default_qty: 4 },
          // Structure items in eq_bom_items
          { bom_item_id: bomItemIds['nut_bolt'], section: 'mounting_structure', description: 'Nut & Bolt', unit: 'Nos', default_qty: 12 },
          { bom_item_id: bomItemIds['anchor_bolt_bos'] || '7872ba22-3805-404f-bd2e-7c108468d809', section: 'mounting_structure', description: 'Anchor Bolt', unit: 'Nos', default_qty: 16 },
          { bom_item_id: bomItemIds['panel_u_bolt'], section: 'mounting_structure', description: 'Panel U Bolt', unit: 'Nos', default_qty: 24 },
          // Concrete
          { bom_item_id: bomItemIds['concrete_material'], section: 'services', description: 'Concrete Material', unit: 'Set', default_qty: 1 },
          // Electrical BOS
          { bom_item_id: bomItemIds['acdb_1ph'], section: 'electrical_protection', description: 'ACDB', unit: 'Nos', default_qty: 1 },
          { bom_item_id: bomItemIds['dcdb_1ph'], section: 'electrical_protection', description: 'DCDB', unit: 'Nos', default_qty: 1 },
          { bom_item_id: bomItemIds['meter_box_1ph'], section: 'metering', description: 'Meter Box Single Phase', unit: 'Nos', default_qty: 1 },
          { bom_item_id: bomItemIds['solar_meter_1ph'], section: 'metering', description: 'Solar Meter', unit: 'Nos', default_qty: 1 },
          { bom_item_id: bomItemIds['isolator_2p'], section: 'electrical_protection', description: 'Isolator 2 Pole 40A', unit: 'Nos', default_qty: 1 },
          // Cabling
          { bom_item_id: bomItemIds['dc_cable_bos'], section: 'cabling', description: 'DC Cable', unit: 'm', default_qty: 50 },
          { bom_item_id: bomItemIds['ac_cable_bos'], section: 'cabling', description: 'AC Cable', unit: 'm', default_qty: 20 },
          // Wiring Accessories
          { bom_item_id: bomItemIds['wiring_pipe_20mm'], section: 'wiring', description: 'Wiring Pipe 20mm', unit: 'm', default_qty: 15 },
          { bom_item_id: bomItemIds['wiring_tray'], section: 'wiring', description: 'Wiring Tray 45x45', unit: 'Nos', default_qty: 2 },
          { bom_item_id: bomItemIds['flexible_pipe'], section: 'wiring', description: 'Flexible Pipe 25mm', unit: 'm', default_qty: 1 },
          { bom_item_id: bomItemIds['pvc_elbow'], section: 'wiring', description: 'PVC Elbow 20mm', unit: 'Nos', default_qty: 20 },
          { bom_item_id: bomItemIds['pvc_tee'], section: 'wiring', description: 'PVC Tee 20mm', unit: 'Nos', default_qty: 5 },
          { bom_item_id: bomItemIds['circle_clip'], section: 'wiring', description: 'Plastic Circle Clip', unit: 'Nos', default_qty: 50 },
          { bom_item_id: bomItemIds['fisher_screw'], section: 'wiring', description: 'Fisher & Screw', unit: 'Nos', default_qty: 20 },
          // Earthing & Protection
          { bom_item_id: bomItemIds['earth_rod'], section: 'earthing', description: 'Earth Rod', unit: 'Nos', default_qty: 3 },
          { bom_item_id: bomItemIds['earth_compound'], section: 'earthing', description: 'Earth Compound', unit: 'Nos', default_qty: 1 },
          { bom_item_id: bomItemIds['copper_wire_2_5'], section: 'earthing', description: '2.5mm Copper Wire', unit: 'm', default_qty: 35 },
          { bom_item_id: bomItemIds['copper_lug_6mm'], section: 'earthing', description: 'Copper Round Lug 6mm', unit: 'Nos', default_qty: 5 },
          { bom_item_id: bomItemIds['la_bos'], section: 'earthing', description: 'Lightning Arrester', unit: 'Nos', default_qty: 1 },
          // Miscellaneous
          { bom_item_id: bomItemIds['ss_bolt_m6'], section: 'wiring', description: 'M6x40 SS Bolt', unit: 'Nos', default_qty: 5 },
          { bom_item_id: bomItemIds['cable_tie_300'], section: 'wiring', description: 'Cable Tie 300mm', unit: 'Nos', default_qty: 30 },
          { bom_item_id: bomItemIds['mc4_connector'], section: 'wiring', description: 'MC4 Connector', unit: 'Pair', default_qty: 2 }
        ];
      } else if (sys.name === 'Rajasthan 5KW') {
        sysItems = [
          // Panels
          { panel_id: panelId, section: 'solar_panels', description: 'Waaree 540W Panel', unit: 'Nos', default_qty: 8 },
          // Inverter
          { inverter_id: '06d582e1-a77d-f8cf-41a6-5d77331c993d', section: 'power_electronics', description: 'Solis 5kW Inverter', unit: 'Nos', default_qty: 1 },
          // Structure Components
          { structure_component_id: structCompIds['GP 75x75x1.6mm Tube (6m)'], section: 'mounting_structure', description: 'GP 75x75x1.6mm Tube (6m)', unit: 'Nos', default_qty: 3 },
          { structure_component_id: structCompIds['GP 60x40x1.6mm Tube'], section: 'mounting_structure', description: 'GP 60x40x1.6mm Tube (15m)', unit: 'Nos', default_qty: 2.5 },
          { structure_component_id: structCompIds['GP 40x40x1.6mm Tube'], section: 'mounting_structure', description: 'GP 40x40x1.6mm Tube (21m)', unit: 'Nos', default_qty: 3.5 },
          { structure_component_id: structCompIds['GP 40x40 LA Support'], section: 'mounting_structure', description: 'GP 40x40 LA Support', unit: 'No', default_qty: 1 },
          { structure_component_id: structCompIds['C Channel Cross Bar'], section: 'mounting_structure', description: 'C Channel Cross Bar', unit: 'Meter', default_qty: 3 },
          { structure_component_id: structCompIds['Base Plate 80x80x6'], section: 'mounting_structure', description: 'Base Plate 80x80x6', unit: 'Nos', default_qty: 6 },
          // Structure items in eq_bom_items
          { bom_item_id: bomItemIds['nut_bolt'], section: 'mounting_structure', description: 'Nut Bolt', unit: 'Nos', default_qty: 24 },
          { bom_item_id: bomItemIds['anchor_bolt_bos'] || '7872ba22-3805-404f-bd2e-7c108468d809', section: 'mounting_structure', description: 'Anchor Bolt', unit: 'Nos', default_qty: 24 },
          { bom_item_id: bomItemIds['panel_u_bolt'], section: 'mounting_structure', description: 'Panel U Bolt', unit: 'Nos', default_qty: 32 },
          // Concrete
          { bom_item_id: bomItemIds['concrete_material'], section: 'services', description: 'Concrete Material', unit: 'Set', default_qty: 1 },
          // Electrical BOS
          { bom_item_id: bomItemIds['acdb_3ph'], section: 'electrical_protection', description: 'ACDB 3 Phase', unit: 'Nos', default_qty: 1 },
          { bom_item_id: bomItemIds['dcdb_3ph'], section: 'electrical_protection', description: 'DCDB SPD 1 In 1 Out', unit: 'Nos', default_qty: 1 },
          { bom_item_id: bomItemIds['mcb_box_3ph'], section: 'electrical_protection', description: 'MCB Box 3 Phase', unit: 'Nos', default_qty: 1 },
          { bom_item_id: bomItemIds['solar_meter_3ph'], section: 'metering', description: 'Solar Meter', unit: 'Nos', default_qty: 1 },
          { bom_item_id: bomItemIds['isolator_4p'], section: 'electrical_protection', description: 'Isolator 4 Pole 40A', unit: 'Nos', default_qty: 1 },
          // Cabling
          { bom_item_id: bomItemIds['dc_cable_bos'], section: 'cabling', description: 'DC Cable', unit: 'm', default_qty: 50 },
          { bom_item_id: bomItemIds['ac_cable_4mm'], section: 'cabling', description: 'AC Cable 4mm', unit: 'm', default_qty: 40 },
          // Wiring Accessories
          { bom_item_id: bomItemIds['wiring_pipe_20mm'], section: 'wiring', description: 'Wiring Pipe 20mm', unit: 'm', default_qty: 15 },
          { bom_item_id: bomItemIds['wiring_tray'], section: 'wiring', description: 'Wiring Tray 45x45', unit: 'Nos', default_qty: 2 },
          { bom_item_id: bomItemIds['flexible_pipe'], section: 'wiring', description: 'Flexible Pipe 25mm', unit: 'm', default_qty: 1 },
          { bom_item_id: bomItemIds['pvc_elbow'], section: 'wiring', description: 'PVC Elbow 20mm', unit: 'Nos', default_qty: 20 },
          { bom_item_id: bomItemIds['pvc_tee'], section: 'wiring', description: 'PVC Tee 20mm', unit: 'Nos', default_qty: 5 },
          { bom_item_id: bomItemIds['circle_clip'], section: 'wiring', description: 'Plastic Circle Clip', unit: 'Nos', default_qty: 50 },
          { bom_item_id: bomItemIds['fisher_screw'], section: 'wiring', description: 'Fisher & Screw', unit: 'Nos', default_qty: 20 },
          // Earthing & Protection
          { bom_item_id: bomItemIds['earth_rod'], section: 'earthing', description: 'Earth Rod', unit: 'Nos', default_qty: 3 },
          { bom_item_id: bomItemIds['earth_compound'], section: 'earthing', description: 'Earth Compound', unit: 'Nos', default_qty: 1 },
          { bom_item_id: bomItemIds['copper_wire_2_5'], section: 'earthing', description: '2.5mm Copper Wire', unit: 'm', default_qty: 35 },
          { bom_item_id: bomItemIds['copper_lug_6mm'], section: 'earthing', description: 'Copper Round Lug 6mm', unit: 'Nos', default_qty: 5 },
          { bom_item_id: bomItemIds['la_bos'], section: 'earthing', description: 'Lightning Arrester', unit: 'Nos', default_qty: 1 },
          // Miscellaneous
          { bom_item_id: bomItemIds['ss_bolt_m6'], section: 'wiring', description: 'M6x40 SS Bolt', unit: 'Nos', default_qty: 5 },
          { bom_item_id: bomItemIds['cable_tie_300'], section: 'wiring', description: 'Cable Tie 300mm', unit: 'Nos', default_qty: 30 },
          { bom_item_id: bomItemIds['mc4_connector'], section: 'wiring', description: 'MC4 Connector', unit: 'Pair', default_qty: 2 }
        ];
      } else if (sys.name === 'Rajasthan 6KW') {
        sysItems = [
          // Panels
          { panel_id: panelId, section: 'solar_panels', description: 'Waaree 540W Panel', unit: 'Nos', default_qty: 10 },
          // Inverter
          { inverter_id: inverterIds['Solis 6kW'], section: 'power_electronics', description: 'Solis 6kW Inverter', unit: 'Nos', default_qty: 1 },
          // Structure Components
          { structure_component_id: structCompIds['GP 75x75x1.6mm Tube (6m)'], section: 'mounting_structure', description: 'GP 75x75x1.6mm Tube (6m)', unit: 'Nos', default_qty: 3 },
          { structure_component_id: structCompIds['GP 60x40x1.6mm Tube'], section: 'mounting_structure', description: 'GP 60x40x1.6mm Tube (15m)', unit: 'Nos', default_qty: 2.5 },
          { structure_component_id: structCompIds['GP 40x40x1.6mm Tube'], section: 'mounting_structure', description: 'GP 40x40x1.6mm Tube (24m)', unit: 'Nos', default_qty: 4 },
          { structure_component_id: structCompIds['GP 40x40 LA Support'], section: 'mounting_structure', description: 'GP 40x40 LA Support', unit: 'No', default_qty: 1 },
          { structure_component_id: structCompIds['C Channel Cross Bar'], section: 'mounting_structure', description: 'C Channel Cross Bar', unit: 'Meter', default_qty: 3 },
          { structure_component_id: structCompIds['Base Plate 80x80x6'], section: 'mounting_structure', description: 'Base Plate 80x80x6', unit: 'Nos', default_qty: 6 },
          // Structure items in eq_bom_items
          { bom_item_id: bomItemIds['nut_bolt'], section: 'mounting_structure', description: 'Nut Bolt', unit: 'Nos', default_qty: 24 },
          { bom_item_id: bomItemIds['anchor_bolt_bos'] || '7872ba22-3805-404f-bd2e-7c108468d809', section: 'mounting_structure', description: 'Anchor Bolt', unit: 'Nos', default_qty: 24 },
          { bom_item_id: bomItemIds['panel_u_bolt'], section: 'mounting_structure', description: 'Panel U Bolt', unit: 'Nos', default_qty: 40 },
          // Concrete
          { bom_item_id: bomItemIds['concrete_material'], section: 'services', description: 'Concrete Material', unit: 'Set', default_qty: 1 },
          // Electrical BOS
          { bom_item_id: bomItemIds['acdb_3ph'], section: 'electrical_protection', description: 'ACDB 3 Phase', unit: 'Nos', default_qty: 1 },
          { bom_item_id: bomItemIds['dcdb_3ph'], section: 'electrical_protection', description: 'DCDB SPD 1 In 1 Out', unit: 'Nos', default_qty: 1 },
          { bom_item_id: bomItemIds['mcb_box_3ph'], section: 'electrical_protection', description: 'MCB Box 3 Phase', unit: 'Nos', default_qty: 1 },
          { bom_item_id: bomItemIds['solar_meter_3ph'], section: 'metering', description: 'Solar Meter', unit: 'Nos', default_qty: 1 },
          { bom_item_id: bomItemIds['isolator_4p'], section: 'electrical_protection', description: 'Isolator 4 Pole 40A', unit: 'Nos', default_qty: 1 },
          // Cabling
          { bom_item_id: bomItemIds['dc_cable_bos'], section: 'cabling', description: 'DC Cable', unit: 'm', default_qty: 50 },
          { bom_item_id: bomItemIds['ac_cable_4mm'], section: 'cabling', description: 'AC Cable 4mm', unit: 'm', default_qty: 40 },
          // Wiring Accessories
          { bom_item_id: bomItemIds['wiring_pipe_20mm'], section: 'wiring', description: 'Wiring Pipe 20mm', unit: 'm', default_qty: 15 },
          { bom_item_id: bomItemIds['wiring_tray'], section: 'wiring', description: 'Wiring Tray 45x45', unit: 'Nos', default_qty: 2 },
          { bom_item_id: bomItemIds['flexible_pipe'], section: 'wiring', description: 'Flexible Pipe 25mm', unit: 'm', default_qty: 1 },
          { bom_item_id: bomItemIds['pvc_elbow'], section: 'wiring', description: 'PVC Elbow 20mm', unit: 'Nos', default_qty: 20 },
          { bom_item_id: bomItemIds['pvc_tee'], section: 'wiring', description: 'PVC Tee 20mm', unit: 'Nos', default_qty: 5 },
          { bom_item_id: bomItemIds['circle_clip'], section: 'wiring', description: 'Plastic Circle Clip', unit: 'Nos', default_qty: 50 },
          { bom_item_id: bomItemIds['fisher_screw'], section: 'wiring', description: 'Fisher & Screw', unit: 'Nos', default_qty: 20 },
          // Earthing & Protection
          { bom_item_id: bomItemIds['earth_rod'], section: 'earthing', description: 'Earth Rod', unit: 'Nos', default_qty: 3 },
          { bom_item_id: bomItemIds['earth_compound'], section: 'earthing', description: 'Earth Compound', unit: 'Nos', default_qty: 1 },
          { bom_item_id: bomItemIds['copper_wire_2_5'], section: 'earthing', description: '2.5mm Copper Wire', unit: 'm', default_qty: 35 },
          { bom_item_id: bomItemIds['copper_lug_6mm'], section: 'earthing', description: 'Copper Round Lug 6mm', unit: 'Nos', default_qty: 5 },
          { bom_item_id: bomItemIds['la_bos'], section: 'earthing', description: 'Lightning Arrester', unit: 'Nos', default_qty: 1 },
          // Miscellaneous
          { bom_item_id: bomItemIds['ss_bolt_m6'], section: 'wiring', description: 'M6x40 SS Bolt', unit: 'Nos', default_qty: 5 },
          { bom_item_id: bomItemIds['cable_tie_300'], section: 'wiring', description: 'Cable Tie 300mm', unit: 'Nos', default_qty: 30 },
          { bom_item_id: bomItemIds['mc4_connector'], section: 'wiring', description: 'MC4 Connector', unit: 'Pair', default_qty: 2 }
        ];
      }

      // Insert system items
      let sortOrder = 0;
      for (const item of sysItems) {
        await client.query(`
          INSERT INTO system_items (
            system_id, panel_id, inverter_id, structure_component_id, bom_item_id, 
            section, description, unit, default_qty, sort_order
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [
          systemId, 
          item.panel_id || null, 
          item.inverter_id || null, 
          item.structure_component_id || null, 
          item.bom_item_id || null,
          item.section,
          item.description,
          item.unit,
          item.default_qty,
          sortOrder++
        ]);
      }
      console.log(`System items for ${sys.name} inserted successfully. Total items: ${sysItems.length}`);
    }

    // 9. Seed pricing_reference entries for Rajasthan 3KW, 5KW, 6KW
    // We match/insert based on (capacity_kw, type)
    const seedPricingRef = [
      { capacity_kw: 3.0, panels: 6, inverter_kw: 3.0, type: 'premium', beneficiary_contribution: 125000.0, subsidy: 78000.0, system_price: 203000.0 },
      { capacity_kw: 3.0, panels: 6, inverter_kw: 3.0, type: 'standard', beneficiary_contribution: 115000.0, subsidy: 0.0, system_price: 193000.0 },
      { capacity_kw: 5.0, panels: 8, inverter_kw: 5.0, type: 'premium', beneficiary_contribution: 235000.0, subsidy: 78000.0, system_price: 313000.0 },
      { capacity_kw: 5.0, panels: 8, inverter_kw: 5.0, type: 'standard', beneficiary_contribution: 220000.0, subsidy: 0.0, system_price: 298000.0 },
      { capacity_kw: 6.0, panels: 10, inverter_kw: 6.0, type: 'premium', beneficiary_contribution: 275000.0, subsidy: 78000.0, system_price: 353000.0 },
      { capacity_kw: 6.0, panels: 10, inverter_kw: 6.0, type: 'standard', beneficiary_contribution: 260000.0, subsidy: 0.0, system_price: 338000.0 }
    ];

    for (const pr of seedPricingRef) {
      const checkPr = await client.query(
        "SELECT id FROM pricing_reference WHERE capacity_kw = $1 AND type = $2",
        [pr.capacity_kw, pr.type]
      );
      if (checkPr.rowCount > 0) {
        await client.query(
          "UPDATE pricing_reference SET beneficiary_contribution = $1, subsidy = $2, system_price = $3, panels = $4, inverter_kw = $5 WHERE id = $6",
          [pr.beneficiary_contribution, pr.subsidy, pr.system_price, pr.panels, pr.inverter_kw, checkPr.rows[0].id]
        );
      } else {
        await client.query(`
          INSERT INTO pricing_reference (capacity_kw, panels, inverter_kw, type, beneficiary_contribution, subsidy, system_price, source_file, sheet_name, row_number)
          VALUES ($1, $2, $3, $4, $5, $6, $7, 'Rajasthan_BOM.xlsx', 'pricing', 99)
        `, [pr.capacity_kw, pr.panels, pr.inverter_kw, pr.type, pr.beneficiary_contribution, pr.subsidy, pr.system_price]);
      }
    }
    console.log("pricing_reference seeded.");

    await client.query('COMMIT');
    console.log("Transaction committed successfully!");
  } catch (e) {
    await client.query('ROLLBACK');
    console.error("Transaction rolled back due to error:", e);
    throw e;
  } finally {
    await client.end();
  }
}

run().catch(console.error);
