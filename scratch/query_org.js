const { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: "postgresql://postgres.xjdqpwmizmfkcdcgcxqv:9BTkCoHcgWtYvE36@aws-1-ap-south-1.pooler.supabase.com:6543/postgres"
  });
  await client.connect();
  console.log("Connected!");

  const profiles = await client.query('SELECT * FROM profiles');
  console.log("PROFILES:", profiles.rows);

  const orgs = await client.query('SELECT * FROM organisations');
  console.log("ORGANISATIONS:", orgs.rows);

  await client.end();
}

run().catch(console.error);
