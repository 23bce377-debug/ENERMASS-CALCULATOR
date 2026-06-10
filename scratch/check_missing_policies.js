const { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: "postgresql://postgres.xjdqpwmizmfkcdcgcxqv:9BTkCoHcgWtYvE36@aws-1-ap-south-1.pooler.supabase.com:6543/postgres"
  });
  await client.connect();
  console.log("Connected to DB!");

  const res = await client.query(`
    SELECT c.relname as tablename
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' 
      AND c.relkind = 'r' 
      AND c.relrowsecurity = true
      AND NOT EXISTS (
        SELECT 1 FROM pg_policies p 
        WHERE p.schemaname = 'public' AND p.tablename = c.relname
      )
    ORDER BY c.relname;
  `);

  console.log("\n=== RLS-ENABLED TABLES WITH ZERO POLICIES ===");
  if (res.rows.length === 0) {
    console.log("None! All RLS-enabled tables have at least one policy.");
  } else {
    res.rows.forEach(r => {
      console.log(`  - ${r.tablename}`);
    });
  }

  await client.end();
}

run().catch(console.error);
