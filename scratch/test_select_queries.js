const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function check() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  await client.connect();

  console.log("=== Testing cache loader SELECT queries on DB ===");

  const queries = {
    eq_panels: 'SELECT id, brand, model, wattage_w, rate_per_watt, gst_pct, is_active FROM eq_panels WHERE is_active = true LIMIT 1',
    eq_inverters: 'SELECT id, brand, model, capacity_kw, phase, rate, gst_pct, is_active FROM eq_inverters WHERE is_active = true LIMIT 1',
    eq_batteries: 'SELECT id, brand, model, capacity_kwh, voltage_v, rate, gst_pct, is_active FROM eq_batteries WHERE is_active = true LIMIT 1'
  };

  for (const [name, sql] of Object.entries(queries)) {
    try {
      const res = await client.query(sql);
      console.log(`[SUCCESS] ${name}: row count = ${res.rowCount}`);
    } catch (err) {
      console.log(`[FAILURE] ${name}: ${err.message}`);
    }
  }

  await client.end();
}

check();
