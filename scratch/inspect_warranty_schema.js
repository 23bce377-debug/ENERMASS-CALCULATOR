const { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: "postgresql://postgres.xjdqpwmizmfkcdcgcxqv:9BTkCoHcgWtYvE36@aws-1-ap-south-1.pooler.supabase.com:6543/postgres"
  });
  await client.connect();

  try {
    const r = await client.query(`
      SELECT column_name, column_default, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'proc_warranty_claims'
    `);
    console.log(r.rows);
  } catch(e) {
    console.error(e);
  } finally {
    await client.end();
  }
}

run();
