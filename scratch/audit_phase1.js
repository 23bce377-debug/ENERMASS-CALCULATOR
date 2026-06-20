const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function check() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  await client.connect();

  try {
    const tables = ['eq_panels', 'eq_inverters', 'eq_batteries'];
    for (const table of tables) {
      const res = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = $1
      `, [table]);
      console.log(`\nTable: ${table}`);
      console.log(res.rows.map(r => `${r.column_name} (${r.data_type})`));
    }
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

check();
