const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function check() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  await client.connect();

  try {
    // Query constraint definition
    const res = await client.query(`
      SELECT conname, pg_get_constraintdef(oid) as def
      FROM pg_constraint
      WHERE conrelid = 'inventory_movements'::regclass;
    `);
    console.log(JSON.stringify(res.rows, null, 2));

    // Also get the single row currently in inventory_movements to see its data
    const rowRes = await client.query('SELECT * FROM inventory_movements LIMIT 1');
    console.log("Current row:", rowRes.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

check();
