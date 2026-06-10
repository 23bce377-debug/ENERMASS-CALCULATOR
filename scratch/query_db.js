const { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: "postgresql://postgres.xjdqpwmizmfkcdcgcxqv:9BTkCoHcgWtYvE36@aws-1-ap-south-1.pooler.supabase.com:6543/postgres"
  });
  await client.connect();
  console.log("Connected!");

  try {
    const res = await client.query("SELECT * FROM eq_structure_components LIMIT 20");
    console.log("=== EQ STRUCTURE COMPONENTS ROWS ===");
    console.log(res.rows);
  } catch (e) {
    console.error("Error:", e);
  }

  await client.end();
}

run().catch(console.error);
