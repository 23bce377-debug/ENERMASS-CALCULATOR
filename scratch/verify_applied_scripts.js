const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function verifyAppliedScripts() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  await client.connect();

  console.log("=== Checking if original SQL scripts were applied to the DB ===");

  // 1. Check if structure_vendors_deprecated exists
  try {
    const res = await client.query("SELECT * FROM information_schema.tables WHERE table_name = 'structure_vendors_deprecated'");
    console.log(`[04] structure_vendors_deprecated exists? ${res.rowCount > 0 ? "YES" : "NO"}`);
  } catch (err) {
    console.log(`[04] Error checking: ${err.message}`);
  }

  // 2. Check if structure_component_vendor_rates exists
  try {
    const res = await client.query("SELECT * FROM information_schema.tables WHERE table_name = 'structure_component_vendor_rates'");
    console.log(`[05] structure_component_vendor_rates exists? ${res.rowCount > 0 ? "YES" : "NO"}`);
  } catch (err) {
    console.log(`[05] Error checking: ${err.message}`);
  }

  // 3. Check if amc_contract_id column exists in field_service_tickets
  try {
    const res = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'field_service_tickets' AND column_name = 'amc_contract_id'
    `);
    console.log(`[14] field_service_tickets.amc_contract_id exists? ${res.rowCount > 0 ? "YES" : "NO"}`);
  } catch (err) {
    console.log(`[14] Error checking: ${err.message}`);
  }

  // 4. Check if version column exists in vendors
  try {
    const res = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'vendors' AND column_name = 'version'
    `);
    console.log(`[15] vendors.version exists? ${res.rowCount > 0 ? "YES" : "NO"}`);
  } catch (err) {
    console.log(`[15] Error checking: ${err.message}`);
  }

  // 5. Check if any panel has gst_pct > 1
  try {
    const res = await client.query("SELECT COUNT(*) FROM eq_panels WHERE gst_pct > 1");
    const count = parseInt(res.rows[0].count);
    console.log(`[25] Panels with gst_pct > 1 count: ${count} (${count === 0 ? "FIXED/APPLIED" : "NOT FIXED/NOT APPLIED"})`);
  } catch (err) {
    console.log(`[25] Error checking: ${err.message}`);
  }

  await client.end();
}

verifyAppliedScripts().catch(console.error);
