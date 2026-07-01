const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  // Check if catalog_rate_snapshots table exists
  const r1 = await client.query(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'catalog_rate_snapshots'
    ) as exists
  `);
  console.log('catalog_rate_snapshots table exists:', r1.rows[0].exists);

  // Check if source_table column exists in quote_items
  const r2 = await client.query(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'quote_items' AND column_name = 'source_table'
    ) as exists
  `);
  console.log('quote_items.source_table column exists:', r2.rows[0].exists);

  // Check if snapshot_catalog_rates function exists
  const r3 = await client.query(`
    SELECT EXISTS (
      SELECT 1 FROM pg_proc WHERE proname = 'snapshot_catalog_rates'
    ) as exists
  `);
  console.log('snapshot_catalog_rates function exists:', r3.rows[0].exists);

  // Check bom_template_items has gst_pct column
  const r4 = await client.query(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'bom_template_items' AND column_name = 'gst_pct'
    ) as exists
  `);
  console.log('bom_template_items.gst_pct column exists:', r4.rows[0].exists);

  // Check structure_component_master exists
  const r5 = await client.query(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'structure_component_master'
    ) as exists
  `);
  console.log('structure_component_master table exists:', r5.rows[0].exists);

  await client.end();
}

run().catch(console.error);
