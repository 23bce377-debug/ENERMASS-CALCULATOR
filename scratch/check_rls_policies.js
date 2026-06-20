const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function check() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  await client.connect();

  const tables = [
    'inventory_movements',
    'rate_master',
    'category_margins',
    'app_settings',
    'quotes',
    'quote_variants',
    'bom_categories',
    'bom_template_items',
    'eq_panels',
    'eq_inverters',
    'eq_batteries',
    'structure_material_rates',
    'structure_accessory_rates'
  ];

  console.log("=== Checking RLS status and policies on tables ===");

  try {
    for (const table of tables) {
      // Check if RLS is enabled
      const rlsRes = await client.query(`
        SELECT relname, relrowsecurity 
        FROM pg_class 
        WHERE oid = $1::regclass;
      `, [table]);

      if (rlsRes.rowCount === 0) {
        console.log(`Table "${table}": DOES NOT EXIST`);
        continue;
      }

      const row = rlsRes.rows[0];
      const isRlsEnabled = row.relrowsecurity;
      console.log(`\nTable "${table}": RLS Enabled = ${isRlsEnabled}`);

      // Query active policies
      const policiesRes = await client.query(`
        SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
        FROM pg_policies
        WHERE tablename = $1;
      `, [table]);

      for (const policy of policiesRes.rows) {
        console.log(`  Policy: "${policy.policyname}" | Command: ${policy.cmd} | Roles: ${policy.roles}`);
        console.log(`    USING (QUAL): ${policy.qual}`);
        if (policy.with_check) {
          console.log(`    WITH CHECK: ${policy.with_check}`);
        }
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

check();
