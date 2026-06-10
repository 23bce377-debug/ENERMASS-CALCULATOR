const { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: "postgresql://postgres.xjdqpwmizmfkcdcgcxqv:9BTkCoHcgWtYvE36@aws-1-ap-south-1.pooler.supabase.com:6543/postgres"
  });
  await client.connect();
  const res = await client.query(`
    SELECT relname, relrowsecurity 
    FROM pg_class c 
    JOIN pg_namespace n ON n.oid = c.relnamespace 
    WHERE n.nspname = 'public' AND relname IN ('scheme_slabs', 'calculation_schemes')
  `);
  res.rows.forEach(r => {
    console.log(`Table: ${r.relname} | RLS Enabled: ${r.relrowsecurity ? 'YES' : 'NO'}`);
  });
  await client.end();
}

run().catch(console.error);
