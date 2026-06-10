const { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: "postgresql://postgres.xjdqpwmizmfkcdcgcxqv:9BTkCoHcgWtYvE36@aws-1-ap-south-1.pooler.supabase.com:6543/postgres"
  });
  await client.connect();

  try {
    const views = [
      'v_quote_summary', 
      'v_margin_trends', 
      'v_project_profitability', 
      'v_procurement_spend', 
      'v_ar_aging', 
      'v_vendor_performance', 
      'v_inventory_valuation'
    ];
    for (const v of views) {
      const r = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = '${v}'
        ORDER BY column_name
      `);
      console.log(`--- ${v} columns ---`);
      console.log(r.rows.map(x => `${x.column_name} (${x.data_type})`).join(', '));
    }
  } catch(e) {
    console.error(e);
  } finally {
    await client.end();
  }
}

run();
