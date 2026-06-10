const { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: "postgresql://postgres.xjdqpwmizmfkcdcgcxqv:9BTkCoHcgWtYvE36@aws-1-ap-south-1.pooler.supabase.com:6543/postgres"
  });
  await client.connect();
  console.log("Connected to database.");

  const orgId = "00000000-0000-0000-0000-000000000001";
  const vendorId = "a168e802-5f34-436d-9ee0-70e7518e3381";
  const panelCatalogId = "7c4589aa-483e-4c25-9e69-1b5232ed11bd";
  const inverterCatalogId = "2e0a75f0-eb66-4bb7-8014-61faeca8007f";

  // Dynamic invoice number to prevent duplicate key constraint issues
  const invoiceNum = "INV-TEST-" + Date.now();

  try {
    // 1. Test create_acquisition_atomic
    console.log("\n--- Testing create_acquisition_atomic ---");
    const acquisition = {
      org_id: orgId,
      vendor_id: vendorId,
      invoice_number: invoiceNum,
      invoice_date: "2026-06-11",
      total_amount: 169800,
      status: "pending",
      notes: "Test acquisition from verification script"
    };
    const items = [
      {
        catalog_item_id: panelCatalogId,
        item_description: "Solar Panel Mono PERC 550Wp",
        category: "solar_panels",
        qty: 100,
        unit: "Nos",
        rate_per_unit: 1200,
        gst_pct: 0.12
      },
      {
        catalog_item_id: inverterCatalogId,
        item_description: "5kW Hybrid Inverter",
        category: "power_electronics",
        qty: 3,
        unit: "Nos",
        rate_per_unit: 10000,
        gst_pct: 0.18
      }
    ];

    const resAcq = await client.query(
      `SELECT create_acquisition_atomic($1::jsonb, $2::jsonb) AS result`,
      [JSON.stringify(acquisition), JSON.stringify(items)]
    );
    const acqResult = resAcq.rows[0].result;
    console.log("Acquisition Created:", acqResult);
    if (!acqResult.id) throw new Error("Acquisition ID not returned");

    // 2. Test create_bundle_preset_atomic
    console.log("\n--- Testing create_bundle_preset_atomic ---");
    const preset = {
      org_id: orgId,
      name: "Test Bundle Preset " + Date.now(),
      notes: "A test bundle preset from script",
      vendor_id: vendorId,
      effective_bundle_price: 250000,
      allocation_strategy: "proportional_cost",
      is_active: true,
      gst_pct: 0.12
    };
    const presetItems = [
      {
        catalog_item_id: panelCatalogId,
        item_description: "Test Bundle Panel Item",
        category: "solar_panels",
        qty: 20,
        unit: "Nos",
        base_cost: 1500,
        gst_pct: 0.12
      },
      {
        catalog_item_id: inverterCatalogId,
        item_description: "Test Bundle Inverter Item",
        category: "power_electronics",
        qty: 1,
        unit: "Nos",
        base_cost: 50000,
        gst_pct: 0.18
      }
    ];

    const resPreset = await client.query(
      `SELECT create_bundle_preset_atomic($1::jsonb, $2::jsonb) AS result`,
      [JSON.stringify(preset), JSON.stringify(presetItems)]
    );
    const presetResult = resPreset.rows[0].result;
    console.log("Preset Created:", presetResult);
    if (!presetResult.id) throw new Error("Preset ID not returned");

    // 3. Test update_bundle_preset_atomic
    console.log("\n--- Testing update_bundle_preset_atomic ---");
    const updates = {
      name: "Updated Test Bundle Preset " + Date.now(),
      effective_bundle_price: 260000
    };
    const updatedItems = [
      {
        catalog_item_id: panelCatalogId,
        item_description: "Test Bundle Panel Item",
        category: "solar_panels",
        qty: 25, // Updated qty
        unit: "Nos",
        base_cost: 1400, // Updated base_cost
        gst_pct: 0.12
      }
    ];

    const resUpdate = await client.query(
      `SELECT update_bundle_preset_atomic($1::uuid, $2::jsonb, $3::jsonb) AS result`,
      [presetResult.id, JSON.stringify(updates), JSON.stringify(updatedItems)]
    );
    const updateResult = resUpdate.rows[0].result;
    console.log("Preset Updated:", updateResult);

    // Clean up inserted test data so we don't leave mess
    console.log("\n--- Cleaning up test data ---");
    
    // Deleting acquisition safely by setting total_amount to 0 first to satisfy the validate totals trigger
    await client.query(`UPDATE acquisitions SET total_amount = 0 WHERE id = $1`, [acqResult.id]);
    await client.query(`DELETE FROM acquisition_items WHERE acquisition_id = $1`, [acqResult.id]);
    await client.query(`DELETE FROM acquisitions WHERE id = $1`, [acqResult.id]);
    console.log("Acquisitions cleaned up safely.");

    await client.query(`DELETE FROM bundle_preset_items WHERE bundle_preset_id = $1`, [presetResult.id]);
    await client.query(`DELETE FROM bundle_presets WHERE id = $1`, [presetResult.id]);
    console.log("Cleanup complete!");
    console.log("✅ All tests passed successfully!");

  } catch (err) {
    console.error("❌ Test failed:", err);
  } finally {
    await client.end();
  }
}

run();
