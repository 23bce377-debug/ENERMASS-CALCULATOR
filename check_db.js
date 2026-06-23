const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function check() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  await client.connect();

  const tables = ['inventory_summary', 'vendors', 'app_settings'];

  for (const table of tables) {
    console.log(`\n--- COLUMNS FOR ${table} ---`);
    const res = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = '${table}'
      ORDER BY ordinal_position;
    `);
    console.log(res.rows.map(r => `${r.column_name}: ${r.data_type} (${r.is_nullable === 'YES' ? 'null' : 'not null'})`).join('\n'));
  }

  await client.end();
}

check().catch(console.error);
