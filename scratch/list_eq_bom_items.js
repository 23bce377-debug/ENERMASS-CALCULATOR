const { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: "postgresql://postgres.xjdqpwmizmfkcdcgcxqv:9BTkCoHcgWtYvE36@aws-1-ap-south-1.pooler.supabase.com:6543/postgres"
  });
  await client.connect();
  console.log("Connected!");

  try {
    const cols = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'eq_bom_items'
    `);
    console.log("Columns of eq_bom_items:", cols.rows);

    const res = await client.query("SELECT * FROM eq_bom_items LIMIT 5");
    console.log("=== EQ BOM ITEMS ROWS ===");
    console.log(res.rows);
  } catch (e) {
    console.error("Error:", e.message);
  }

  await client.end();
}

run().catch(console.error);
