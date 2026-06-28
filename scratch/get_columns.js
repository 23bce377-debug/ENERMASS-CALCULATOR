const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  await client.connect();
  const res = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'quotes'
    ORDER BY ordinal_position;
  `);
  console.log(res.rows.map(r => `${r.column_name}: ${r.data_type}`).join('\n'));
  await client.end();
}

run().catch(console.error);
