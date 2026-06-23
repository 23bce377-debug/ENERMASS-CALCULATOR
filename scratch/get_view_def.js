const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  await client.connect();
  const res = await client.query(`
    SELECT viewname, definition 
    FROM pg_views 
    WHERE schemaname = 'public' AND viewname IN ('v_project_profitability', 'v_ar_aging', 'v_margin_trends', 'v_procurement_spend', 'v_inventory_valuation', 'v_vendor_performance', 'v_quote_summary');
  `);
  for (const row of res.rows) {
    console.log(`\n=== VIEW: ${row.viewname} ===\n${row.definition}`);
  }
  await client.end();
}

run().catch(console.error);
