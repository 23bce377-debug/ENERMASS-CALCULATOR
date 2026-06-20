const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function verify() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  await client.connect();

  try {
    const res = await client.query(`
      SELECT table_name, column_name, data_type, is_generated, generation_expression 
      FROM information_schema.columns 
      WHERE table_name IN ('eq_panels', 'eq_inverters', 'eq_batteries')
        AND column_name IN ('rate_per_watt', 'rate', 'selling_price', 'buy_price')
      ORDER BY table_name, column_name;
    `);
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

verify();
