const { Client } = require('pg');

const DATABASE_URL = 'postgresql://postgres.xjdqpwmizmfkcdcgcxqv:9BTkCoHcgWtYvE36@aws-1-ap-south-1.pooler.supabase.com:6543/postgres';

async function runTests() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  console.log("Connected for testing...");

  // Set up mock test tenants
  const tenant1 = '00000000-0000-0000-0000-000000000001';
  const tenant2 = '00000000-0000-0000-0000-000000000002'; // Victim / different org

  // Get our test user belonging to tenant1
  const testUserId = '5e35b271-beba-429e-ad3f-49e553cc8782'; // Hrushi

  // Clean / prepare database before tests
  await client.query('DELETE FROM proc_goods_receipt_notes WHERE grn_number LIKE \'TEST-GRN-%\'');
  await client.query('DELETE FROM acquisitions WHERE notes = \'TEST-ACQ\'');
  await client.query(`
    DELETE FROM inventory_summary 
    WHERE catalog_item_id IN (
      SELECT id FROM catalog_items 
      WHERE item_id IN (SELECT id FROM eq_bom_items WHERE description = 'Test Cable 4 SQMM')
    )
  `);
  await client.query(`
    DELETE FROM inventory_ledger 
    WHERE catalog_item_id IN (
      SELECT id FROM catalog_items 
      WHERE item_id IN (SELECT id FROM eq_bom_items WHERE description = 'Test Cable 4 SQMM')
    )
  `);
  await client.query(`
    DELETE FROM inv_stock_balances 
    WHERE catalog_item_id IN (
      SELECT id FROM catalog_items 
      WHERE item_id IN (SELECT id FROM eq_bom_items WHERE description = 'Test Cable 4 SQMM')
    )
  `);
  await client.query('DELETE FROM catalog_items WHERE id IN (SELECT id FROM eq_bom_items WHERE description = \'Test Cable 4 SQMM\')');
  await client.query('DELETE FROM eq_bom_items WHERE description = \'Test Cable 4 SQMM\'');
  await client.query('DELETE FROM inv_warehouses WHERE name IN (\'Test Warehouse 1\', \'Test Warehouse 2\')');
  
  // Ensure tenant2 exists in organizations table
  await client.query(`
    INSERT INTO organisations (id, name, quote_prefix)
    VALUES ('${tenant2}', 'Test Tenant 2', 'T2')
    ON CONFLICT (id) DO NOTHING
  `);

  // Ensure warehouse exists for both tenants
  const wh1Res = await client.query(`
    INSERT INTO inv_warehouses (org_id, name, code)
    VALUES ('${tenant1}', 'Test Warehouse 1', 'TWH1')
    RETURNING id
  `);
  const wh1 = wh1Res.rows[0].id;

  const wh2Res = await client.query(`
    INSERT INTO inv_warehouses (org_id, name, code)
    VALUES ('${tenant2}', 'Test Warehouse 2', 'TWH2')
    RETURNING id
  `);
  const wh2 = wh2Res.rows[0].id;

  // Insert a test catalog item
  const catItemRes = await client.query(`
    INSERT INTO eq_bom_items (org_id, description, sub_type, selling_price, buy_price, unit, section)
    VALUES ('${tenant1}', 'Test Cable 4 SQMM', 'dc_cable', 50.00, 40.00, 'Mtr', 'cabling')
    RETURNING id
  `);
  const bomItemId = catItemRes.rows[0].id;

  // Retrieve the generated catalog_items.id mapping to this BOM item
  const catalogItemRow = await client.query(`
    SELECT id FROM catalog_items WHERE item_id = $1 AND item_type = 'bom_item'
  `, [bomItemId]);
  const catalogItemId = catalogItemRow.rows[0].id;

  // Insert standard inventory balance for testing
  await client.query(`
    INSERT INTO inv_stock_balances (warehouse_id, catalog_item_id, qty_on_hand, qty_reserved, wac_price)
    VALUES ('${wh1}', '${catalogItemId}', 100, 10, 40.00)
    ON CONFLICT (warehouse_id, catalog_item_id) DO UPDATE SET qty_on_hand = 100, qty_reserved = 10
  `);

  console.log("Mock data set up successfully.");

  // Helper to run query under authenticated session context simulating testUserId
  async function runAuthenticated(userId, queryText, values = []) {
    const testClient = new Client({
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    await testClient.connect();
    try {
      await testClient.query('BEGIN');
      await testClient.query('SET local role TO authenticated');
      await testClient.query(`SELECT set_config('request.jwt.claims', '{"sub": "${userId}"}', true)`);
      const res = await testClient.query(queryText, values);
      await testClient.query('COMMIT');
      return res;
    } catch (err) {
      await testClient.query('ROLLBACK');
      throw err;
    } finally {
      await testClient.end();
    }
  }

  // ==========================================
  // Test P0-1: Global Master Data Tampering
  // ==========================================
  console.log("\n--- Testing P0-1: Global Master Data Tampering (RLS Writes) ---");
  try {
    // Attempt write on structure_material_rates as authenticated user
    await runAuthenticated(testUserId, `
      INSERT INTO structure_material_rates (material_type, rate_per_kg)
      VALUES ('GP', 99.0)
    `);
    console.log("❌ Test P0-1 Failed: Authenticated user was able to INSERT pricing rate directly!");
  } catch (err) {
    if (err.message.includes('permission denied') || err.message.includes('row-level security policy')) {
      console.log("✅ Test P0-1 Passed: Direct write on structure_material_rates rejected with permission error.");
    } else {
      console.log("❌ Test P0-1 Failed with unexpected error:", err.message);
    }
  }

  // ==========================================
  // Test P0-2: Cross-Tenant Inventory Manipulation
  // ==========================================
  console.log("\n--- Testing P0-2: Cross-Tenant Inventory Manipulation ---");
  try {
    // Attempt reserve_stock in competitor's warehouse (wh2) using user session from tenant1
    await runAuthenticated(testUserId, `
      SELECT reserve_stock($1, $2, $3, $4)
    `, [tenant1, wh2, catalogItemId, 5]);
    console.log("❌ Test P0-2 Failed: Cross-tenant stock reservation succeeded without validation!");
  } catch (err) {
    if (err.message.includes('Warehouse does not belong to your organization')) {
      console.log("✅ Test P0-2 Passed: Cross-tenant stock reservation rejected with exception:", err.message);
    } else {
      console.log("❌ Test P0-2 Failed with unexpected error:", err.message);
    }
  }

  // ==========================================
  // Test P0-3: Cross-Tenant Acquisition Hijacking
  // ==========================================
  console.log("\n--- Testing P0-3: Cross-Tenant Acquisition Hijacking ---");
  try {
    // Ensure vendor exists for tenant2 if query references it
    const vendorRes = await client.query(`
      INSERT INTO vendors (org_id, name, status)
      VALUES ('${tenant2}', 'Test Vendor T2', 'active')
      ON CONFLICT (org_id, name) DO UPDATE SET status = EXCLUDED.status
      RETURNING id
    `);
    const vendorId = vendorRes.rows[0].id;

    const acqRes = await client.query(`
      INSERT INTO acquisitions (org_id, vendor_id, invoice_number, invoice_date, status, notes)
      VALUES ('${tenant2}', '${vendorId}', 'INV-999', NOW(), 'pending', 'TEST-ACQ')
      RETURNING id
    `);
    const acqId = acqRes.rows[0].id;

    // Call mark_acquisition_as_received as user in tenant1
    const res = await runAuthenticated(testUserId, `
      SELECT mark_acquisition_as_received($1)
    `, [acqId]);
    
    if (res.rows[0].mark_acquisition_as_received.error === 'Unauthorized') {
      console.log("✅ Test P0-3 Passed: Cross-tenant acquisition markAsReceived returned Unauthorized.");
    } else {
      console.log("❌ Test P0-3 Failed: Succeeded or returned unexpected result:", res.rows[0]);
    }
  } catch (err) {
    console.log("❌ Test P0-3 Failed with exception:", err.message);
  }

  // ==========================================
  // Test P0-5: Negative Quantity Math Vulnerability
  // ==========================================
  console.log("\n--- Testing P0-5: Negative Quantity Math Vulnerability ---");
  try {
    await runAuthenticated(testUserId, `
      SELECT reserve_stock($1, $2, $3, $4)
    `, [tenant1, wh1, catalogItemId, -500]);
    console.log("❌ Test P0-5 Failed: reserve_stock accepted negative quantity!");
  } catch (err) {
    if (err.message.includes('Quantity must be positive')) {
      console.log("✅ Test P0-5 Passed: reserve_stock rejected negative quantity.");
    } else {
      console.log("❌ Test P0-5 Failed with unexpected error:", err.message);
    }
  }

  // ==========================================
  // Test P0-6: Acquisition Ledger Duplication (Idempotency)
  // ==========================================
  console.log("\n--- Testing P0-6: Acquisition Ledger Duplication (Idempotency) ---");
  try {
    // Insert acquisition and item for tenant1
    const acq1Res = await client.query(`
      INSERT INTO acquisitions (org_id, status, total_amount, notes)
      VALUES ('${tenant1}', 'pending', 177000.00, 'TEST-ACQ')
      RETURNING id
    `);
    const acq1Id = acq1Res.rows[0].id;

    await client.query(`
      INSERT INTO acquisition_items (acquisition_id, item_description, category, qty, rate_per_unit, catalog_item_id)
      VALUES ('${acq1Id}', 'Test Panel Mono 550W', 'solar_panels', 10, 15000.00, '${catalogItemId}')
    `);

    // Call mark_acquisition_as_received first time
    const res1 = await runAuthenticated(testUserId, `SELECT mark_acquisition_as_received($1)`, [acq1Id]);
    console.log("First mark_acquisition_as_received call result:", res1.rows[0]);

    // Call second time (should return error 'Already processed')
    const res2 = await runAuthenticated(testUserId, `SELECT mark_acquisition_as_received($1)`, [acq1Id]);
    console.log("Second mark_acquisition_as_received call result:", res2.rows[0]);

    if (res2.rows[0].mark_acquisition_as_received.error === 'Already processed') {
      console.log("✅ Test P0-6 Passed: Double-processing acquisition blocked successfully.");
    } else {
      console.log("❌ Test P0-6 Failed: Double processing did not yield correct idempotency status:", res2.rows[0]);
    }
  } catch (err) {
    console.log("❌ Test P0-6 Failed with error:", err.message);
  }

  // ==========================================
  // Test P0-4: Infinite Stock Inflation via Idempotency Failure (GRN)
  // ==========================================
  console.log("\n--- Testing P0-4: Infinite Stock Inflation via GRN Idempotency ---");
  try {
    // Ensure vendor exists for tenant1
    const vendor1Res = await client.query(`
      INSERT INTO vendors (org_id, name, status)
      VALUES ('${tenant1}', 'Test Vendor T1', 'active')
      ON CONFLICT (org_id, name) DO UPDATE SET status = EXCLUDED.status
      RETURNING id
    `);
    const vendor1Id = vendor1Res.rows[0].id;

    const poRes = await client.query(`
      INSERT INTO proc_purchase_orders (org_id, po_number, vendor_id, status)
      VALUES ('${tenant1}', 'TEST-PO-001', '${vendor1Id}', 'draft')
      RETURNING id
    `);
    const poId = poRes.rows[0].id;

    const catalogItemRes = await client.query(`
      SELECT id FROM catalog_items WHERE org_id = '${tenant1}' LIMIT 1
    `);
    
    // Ensure we have a catalog_item_id
    let testCatItemId;
    if (catalogItemRes.rowCount > 0) {
      testCatItemId = catalogItemRes.rows[0].id;
    } else {
      // Find a catalog item or panel
      const panelRes = await client.query(`SELECT id FROM eq_panels WHERE org_id = '${tenant1}' OR org_id IS NULL LIMIT 1`);
      testCatItemId = panelRes.rows[0].id;
      // Register in catalog items
      await client.query(`
        INSERT INTO catalog_items (id, org_id, item_id, item_type)
        VALUES ('${testCatItemId}', '${tenant1}', '${testCatItemId}', 'panel')
        ON CONFLICT DO NOTHING
      `);
    }

    await client.query(`
      INSERT INTO proc_po_items (po_id, catalog_item_id, qty_ordered, unit_price, gst_pct)
      VALUES ('${poId}', '${testCatItemId}', 10, 12000.00, 18.00)
    `);

    // Insert dummy GRN
    const grnRes = await client.query(`
      INSERT INTO proc_goods_receipt_notes (org_id, po_id, warehouse_id, grn_number, receipt_date, status)
      VALUES ('${tenant1}', '${poId}', '${wh1}', 'TEST-GRN-001', NOW(), 'pending')
      RETURNING id
    `);
    const grnId = grnRes.rows[0].id;

    await client.query(`
      INSERT INTO proc_grn_items (grn_id, catalog_item_id, qty_received)
      VALUES ('${grnId}', '${testCatItemId}', 5)
    `);

    // First process_grn_receipt call
    const grnCall1 = await runAuthenticated(testUserId, `SELECT process_grn_receipt($1)`, [grnId]);
    console.log("First process_grn_receipt call result:", grnCall1.rows[0]);

    // Second process_grn_receipt call (should say 'Goods Receipt Note already processed')
    const grnCall2 = await runAuthenticated(testUserId, `SELECT process_grn_receipt($1)`, [grnId]);
    console.log("Second process_grn_receipt call result:", grnCall2.rows[0]);

    if (grnCall2.rows[0].process_grn_receipt.error === 'Goods Receipt Note already processed') {
      console.log("✅ Test P0-4 Passed: Double-processing GRN blocked successfully.");
    } else {
      console.log("❌ Test P0-4 Failed: Double processing did not yield correct status:", grnCall2.rows[0]);
    }
  } catch (err) {
    console.log("❌ Test P0-4 Failed with error:", err.message);
  }

  // Cleanup testing mocks
  console.log("\nCleaning up test mocks...");
  await client.query('DELETE FROM proc_goods_receipt_notes WHERE grn_number LIKE \'TEST-GRN-%\'');
  await client.query('DELETE FROM proc_purchase_orders WHERE po_number LIKE \'TEST-PO-%\'');
  await client.query('DELETE FROM acquisitions WHERE notes = \'TEST-ACQ\'');
  await client.query('DELETE FROM vendors WHERE name IN (\'Test Vendor T1\', \'Test Vendor T2\')');
  await client.query(`
    DELETE FROM inventory_summary 
    WHERE catalog_item_id IN (
      SELECT id FROM catalog_items 
      WHERE item_id IN (SELECT id FROM eq_bom_items WHERE description = 'Test Cable 4 SQMM')
    )
  `);
  await client.query(`
    DELETE FROM inventory_ledger 
    WHERE catalog_item_id IN (
      SELECT id FROM catalog_items 
      WHERE item_id IN (SELECT id FROM eq_bom_items WHERE description = 'Test Cable 4 SQMM')
    )
  `);
  await client.query(`
    DELETE FROM inv_stock_balances 
    WHERE catalog_item_id IN (
      SELECT id FROM catalog_items 
      WHERE item_id IN (SELECT id FROM eq_bom_items WHERE description = 'Test Cable 4 SQMM')
    )
  `);
  await client.query('DELETE FROM catalog_items WHERE id IN (SELECT id FROM eq_bom_items WHERE description = \'Test Cable 4 SQMM\')');
  await client.query('DELETE FROM eq_bom_items WHERE description = \'Test Cable 4 SQMM\'');
  await client.query('DELETE FROM inv_warehouses WHERE name IN (\'Test Warehouse 1\', \'Test Warehouse 2\')');
  
  await client.end();
  console.log("Tests complete.");
}

runTests().catch(console.error);
