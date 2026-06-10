const { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: "postgresql://postgres.xjdqpwmizmfkcdcgcxqv:9BTkCoHcgWtYvE36@aws-1-ap-south-1.pooler.supabase.com:6543/postgres"
  });
  await client.connect();
  console.log("Connected!");

  const tables = [
    'organisations',
    'profiles',
    'state_rules',
    'calculation_schemes',
    'scheme_slabs',
    'state_scheme_overrides',
    'eq_panels',
    'eq_inverters',
    'eq_batteries',
    'eq_meters',
    'eq_lightning_arresters',
    'eq_mounting_structures',
    'structure_weight_lookup',
    'eq_bom_items',
    'eq_communication_devices',
    'rate_master',
    'systems',
    'system_items',
    'category_margins',
    'quotes',
    'quote_financials',
    'quote_items',
    'vendors',
    'eq_structure_components',
    'eq_structure_bom',
    'eq_structure_addons'
  ];

  for (const table of tables) {
    try {
      const res = await client.query(`SELECT COUNT(*) FROM ${table}`);
      console.log(`${table}: ${res.rows[0].count} rows`);
    } catch (e) {
      console.log(`Failed to count rows in ${table}: ${e.message}`);
    }
  }

  await client.end();
}

run().catch(console.error);
