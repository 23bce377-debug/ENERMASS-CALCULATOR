const { Client } = require('pg');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

async function check() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  await client.connect();

  try {
    const tables = [
      'structure_accessory_rates',
      'structure_material_rates',
      'structure_weight_lookup',
      'eq_structure_components',
      'eq_structure_bom',
      'eq_structure_addons'
    ];
    
    console.log('--- DATABASE CHECK ---');
    for (const table of tables) {
      const res = await client.query(`
        SELECT count(*) FROM information_schema.tables WHERE table_name = $1
      `, [table]);
      const exists = res.rows[0].count > 0;
      console.log(`Table: ${table} exists? ${exists}`);
    }
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

check();
