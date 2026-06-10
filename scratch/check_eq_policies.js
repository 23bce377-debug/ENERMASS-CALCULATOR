const { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: "postgresql://postgres.xjdqpwmizmfkcdcgcxqv:9BTkCoHcgWtYvE36@aws-1-ap-south-1.pooler.supabase.com:6543/postgres"
  });
  await client.connect();
  console.log("Connected!");

  const res = await client.query(`
    SELECT tablename, policyname, cmd, roles, qual, with_check 
    FROM pg_policies 
    WHERE schemaname = 'public' AND tablename LIKE 'eq_%' OR tablename = 'vendors' OR tablename = 'calculation_schemes'
    ORDER BY tablename, policyname;
  `);

  console.log("POLICIES:");
  res.rows.forEach(r => {
    console.log(`\nTable: ${r.tablename}`);
    console.log(`  Name: ${r.policyname}`);
    console.log(`  Cmd: ${r.cmd}`);
    console.log(`  Roles: ${r.roles}`);
    console.log(`  Qual: ${r.qual}`);
    console.log(`  With Check: ${r.with_check}`);
  });

  await client.end();
}

run().catch(console.error);
