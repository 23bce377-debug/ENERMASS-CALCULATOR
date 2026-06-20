const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function check() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  await client.connect();

  const tables = [
    'eq_panels',
    'eq_inverters',
    'eq_batteries',
    'inventory_movements',
    'rate_master',
    'category_margins',
    'app_settings',
    'profiles'
  ];

  for (const table of tables) {
    try {
      const res = await client.query(`SELECT COUNT(*) FROM "${table}"`);
      console.log(`Table "${table}" row count: ${res.rows[0].count}`);
    } catch (err) {
      console.log(`Table "${table}" error: ${err.message}`);
    }
  }

  await client.end();
}

check();
