const fs = require('fs');
const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  await client.connect();

  try {
    console.log('Running 202606260000_audit_remediations.sql...');
    const sql = fs.readFileSync('supabase/migrations/202606260000_audit_remediations.sql', 'utf8');
    await client.query(sql);
    console.log('Successfully ran 202606260000_audit_remediations.sql');
  } catch (err) {
    console.error('Error running remediation migration:', err);
  } finally {
    await client.end();
  }
}

run();
