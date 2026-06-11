const { Client } = require('pg');

const DATABASE_URL = 'postgresql://postgres.xjdqpwmizmfkcdcgcxqv:9BTkCoHcgWtYvE36@aws-1-ap-south-1.pooler.supabase.com:6543/postgres';

async function main() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();

  try {
    const res = await client.query(`
      SELECT p.proname AS function_name, pg_get_functiondef(p.oid) AS definition
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
        AND p.proname IN ('process_grn_receipt', 'mark_acquisition_as_received', 'fn_post_issue_to_gl', 'fn_generate_grn_number', 'reserve_stock', 'dispatch_reserved_stock', 'release_stock_reservation')
    `);
    res.rows.forEach(r => {
      console.log('--- ' + r.function_name + ' ---');
      console.log(r.definition);
    });
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

main();