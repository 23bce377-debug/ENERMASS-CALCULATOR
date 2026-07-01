const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    const migrationPath = path.resolve(__dirname, '../supabase/migrations/202607050006_quote_rate_snapshots.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('Applying migration 202607050006_quote_rate_snapshots.sql ...');
    await client.query(sql);
    console.log('Migration applied successfully.');

    // Verify columns
    const r1 = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'quote_items' 
      AND column_name IN ('source_table', 'source_item_id', 'source_label', 'quoted_rate_date')
      ORDER BY column_name
    `);
    console.log('\nquote_items new columns:', r1.rows.map(x => x.column_name).join(', '));

    // Verify catalog_rate_snapshots table
    const r2 = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'catalog_rate_snapshots'
      ) as exists
    `);
    console.log('catalog_rate_snapshots table exists:', r2.rows[0].exists);

    // Verify snapshot_catalog_rates function
    const r3 = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'snapshot_catalog_rates'
      ) as exists
    `);
    console.log('snapshot_catalog_rates function exists:', r3.rows[0].exists);

    // Reload PostgREST schema cache
    await client.query("NOTIFY pgrst, 'reload schema'");
    console.log('PostgREST schema cache reload notified.');

  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await client.end();
  }
}

run();
