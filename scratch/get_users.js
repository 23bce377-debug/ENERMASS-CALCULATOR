const { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: "postgresql://postgres.xjdqpwmizmfkcdcgcxqv:9BTkCoHcgWtYvE36@aws-1-ap-south-1.pooler.supabase.com:6543/postgres"
  });
  await client.connect();
  console.log("Connected to DB!");

  // Profiles
  const profilesRes = await client.query("SELECT * FROM profiles");
  console.log("\n=== PROFILES ===");
  console.log(profilesRes.rows);

  // Auth users
  const usersRes = await client.query("SELECT id, email, raw_user_meta_data, raw_app_meta_data FROM auth.users");
  console.log("\n=== AUTH USERS ===");
  console.log(usersRes.rows);

  await client.end();
}

run().catch(console.error);
