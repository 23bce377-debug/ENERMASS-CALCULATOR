const { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: "postgresql://postgres.xjdqpwmizmfkcdcgcxqv:9BTkCoHcgWtYvE36@aws-1-ap-south-1.pooler.supabase.com:6543/postgres"
  });
  await client.connect();
  console.log("Connected!");

  const rlsRes = await client.query(`
    SELECT c.relname as tablename, c.relrowsecurity as rls_enabled
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    ORDER BY c.relname;
  `);

  console.log("RLS STATUS FOR ALL TABLES:");
  const rlsMap = {};
  rlsRes.rows.forEach(r => {
    rlsMap[r.tablename] = r.rls_enabled ? 'YES' : 'NO';
    console.log(`  ${r.tablename}: ${r.rls_enabled ? 'YES' : 'NO'}`);
  });

  const polRes = await client.query(`
    SELECT tablename, policyname, cmd, roles, qual, with_check 
    FROM pg_policies 
    WHERE schemaname = 'public'
    ORDER BY tablename, policyname;
  `);

  console.log("\nPOLICIES DEFINED IN DATABASE:");
  polRes.rows.forEach(r => {
    console.log(`Table: ${r.tablename} | Policy: ${r.policyname} | Cmd: ${r.cmd} | Roles: ${r.roles}`);
    console.log(`  Qual: ${r.qual}`);
    if (r.with_check) console.log(`  With Check: ${r.with_check}`);
  });

  await client.end();
}

run().catch(console.error);
