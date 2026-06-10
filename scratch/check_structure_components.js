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
      WHERE table_name = 'eq_structure_components'
    `);
    console.log("Columns of eq_structure_components:", cols.rows);

    const rows = await client.query("SELECT * FROM eq_structure_components LIMIT 10");
    console.log("Rows in eq_structure_components:", rows.rows);
  } catch (e) {
    console.error("Error:", e.message);
  }

  await client.end();
}

run().catch(console.error);
