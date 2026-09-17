const fs = require('fs');
const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const sql = fs.readFileSync('supabase/migrations/0102_comprehensive_rls_and_tenant_security.sql', 'utf8');
  console.log('Applying migration 0102...');
  await client.query(sql);
  console.log('Migration 0102 applied successfully!');

  await client.end();
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
