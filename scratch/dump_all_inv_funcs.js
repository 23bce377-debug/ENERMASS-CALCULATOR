const { Client } = require('pg');
const fs = require('fs');

const DATABASE_URL = 'postgresql://postgres.xjdqpwmizmfkcdcgcxqv:9BTkCoHcgWtYvE36@aws-1-ap-south-1.pooler.supabase.com:6543/postgres';

async function main() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  const funcs = [
    'mark_acquisition_as_received',
    'update_inventory_summary',
    'process_grn_receipt',
    'reserve_stock',
    'dispatch_reserved_stock',
    'release_stock_reservation'
  ];

  let output = '';
  try {
    for (const f of funcs) {
      const res = await client.query("SELECT pg_get_functiondef(p.oid) AS def FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = $1", [f]);
      if (res.rows.length > 0) {
        output += `\n======================================================\n`;
        output += `=== FUNCTION: ${f} ===\n`;
        output += `======================================================\n`;
        output += res.rows[0].def + `\n`;
      }
    }
    fs.writeFileSync('scratch/inv_funcs_def.sql', output, 'utf8');
    console.log("Wrote inv_funcs_def.sql in UTF-8");
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

main();
