const { Client } = require('pg');

const DATABASE_URL = 'postgresql://postgres.xjdqpwmizmfkcdcgcxqv:9BTkCoHcgWtYvE36@aws-1-ap-south-1.pooler.supabase.com:6543/postgres';

async function main() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  try {
    const tables = [
      'eq_panels', 'eq_inverters', 'eq_batteries', 'eq_meters', 'eq_lightning_arresters',
      'eq_mounting_structures', 'eq_bom_items', 'eq_communication_devices', 'systems',
      'system_items', 'inventory_summary', 'vendors', 'eq_structure_components', 'eq_structure_bom'
    ];
    for (const table of tables) {
      const res = await client.query(`SELECT count(*) FROM ${table}`);
      console.log(`${table}: ${res.rows[0].count}`);
    }
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

main();
