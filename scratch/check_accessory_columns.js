const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function check() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  await client.connect();

  const tables = ['eq_meters', 'eq_lightning_arresters'];

  for (const table of tables) {
    try {
      const res = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = $1;
      `, [table]);
      console.log(`Table "${table}":`);
      console.log(res.rows.map(r => `${r.column_name} (${r.data_type})`));
    } catch (err) {
      console.error(err);
    }
  }

  await client.end();
}

check();
