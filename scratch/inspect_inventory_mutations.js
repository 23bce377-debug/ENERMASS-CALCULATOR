const { Client } = require('pg');

const DATABASE_URL = 'postgresql://postgres.xjdqpwmizmfkcdcgcxqv:9BTkCoHcgWtYvE36@aws-1-ap-south-1.pooler.supabase.com:6543/postgres';

async function main() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  try {
    // Check PG version and use appropriate column to exclude aggregates
    const verRes = await client.query("SELECT current_setting('server_version_num')::int AS ver");
    const isModern = verRes.rows[0].ver >= 110000;
    const filter = isModern ? "p.prokind = 'f'" : "NOT p.proisagg";

    const query = `
      SELECT p.proname AS function_name, pg_get_functiondef(p.oid) AS definition
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
        AND ${filter}
        AND (
          pg_get_functiondef(p.oid) ILIKE '%inv_stock_balances%'
          OR pg_get_functiondef(p.oid) ILIKE '%inventory_summary%'
          OR pg_get_functiondef(p.oid) ILIKE '%inventory_ledger%'
        )
    `;
    const res = await client.query(query);
    console.log(`Found ${res.rows.length} functions referencing inventory tables:\n`);
    res.rows.forEach(r => {
      console.log(`- ${r.function_name}`);
    });
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

main();
