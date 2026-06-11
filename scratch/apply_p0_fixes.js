const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = 'postgresql://postgres.xjdqpwmizmfkcdcgcxqv:9BTkCoHcgWtYvE36@aws-1-ap-south-1.pooler.supabase.com:6543/postgres';

async function main() {
  console.log("Reading migration script...");
  const sqlPath = path.join(__dirname, '../scripts/13_p0_security_reliability_remediation.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log("Connecting to Supabase PostgreSQL database...");
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  await client.connect();
  console.log("Connected successfully.");

  try {
    console.log("Applying migration 13_p0_security_reliability_remediation.sql...");
    await client.query(sql);
    console.log("Migration applied successfully!");
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  } finally {
    await client.end();
    console.log("Database connection closed.");
  }
}

main();
