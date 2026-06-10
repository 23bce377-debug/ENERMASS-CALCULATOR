const { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: "postgresql://postgres.xjdqpwmizmfkcdcgcxqv:9BTkCoHcgWtYvE36@aws-1-ap-south-1.pooler.supabase.com:6543/postgres"
  });
  await client.connect();
  console.log("Connected!");

  const tables = ['eq_mounting_structures', 'eq_bom_items', 'vendors', 'calculation_schemes'];
  for (const table of tables) {
    const res = await client.query(`SELECT * FROM ${table}`);
    console.log(`=== ${table} ===`);
    console.log(res.rows);
  }

  await client.end();
}

run().catch(console.error);
