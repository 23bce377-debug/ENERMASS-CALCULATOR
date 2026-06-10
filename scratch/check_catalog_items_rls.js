const { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: "postgresql://postgres.xjdqpwmizmfkcdcgcxqv:9BTkCoHcgWtYvE36@aws-1-ap-south-1.pooler.supabase.com:6543/postgres"
  });
  await client.connect();
  const res = await client.query("SELECT relrowsecurity FROM pg_class WHERE relname = 'catalog_items'");
  console.log("RLS Enabled for catalog_items:", res.rows[0]?.relrowsecurity ? 'YES' : 'NO');
  await client.end();
}

run().catch(console.error);
