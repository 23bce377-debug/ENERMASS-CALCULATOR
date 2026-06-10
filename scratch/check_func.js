const { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: "postgresql://postgres.xjdqpwmizmfkcdcgcxqv:9BTkCoHcgWtYvE36@aws-1-ap-south-1.pooler.supabase.com:6543/postgres"
  });
  await client.connect();
  console.log("Connected to DB!");

  const res = await client.query("SELECT routine_definition FROM information_schema.routines WHERE routine_name = 'auth_org_id'");
  console.log("auth_org_id definition:");
  console.log(res.rows[0]?.routine_definition);

  const res2 = await client.query("SELECT routine_definition FROM information_schema.routines WHERE routine_name = 'auth_role'");
  console.log("auth_role definition:");
  console.log(res2.rows[0]?.routine_definition);

  await client.end();
}

run().catch(console.error);
