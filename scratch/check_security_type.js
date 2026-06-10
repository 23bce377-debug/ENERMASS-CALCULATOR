const { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: "postgresql://postgres.xjdqpwmizmfkcdcgcxqv:9BTkCoHcgWtYvE36@aws-1-ap-south-1.pooler.supabase.com:6543/postgres"
  });
  await client.connect();
  const res = await client.query("SELECT security_type FROM information_schema.routines WHERE routine_name = 'auth_org_id'");
  console.log("Security Type:", res.rows[0]?.security_type);
  await client.end();
}

run().catch(console.error);
