const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  await client.connect();

  try {
    const res = await client.query(`
      SELECT quote_number, system_id, system_name, system_capacity_kw, annual_savings_inr, final_customer_price, status 
      FROM quotes 
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    console.log(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

run();
