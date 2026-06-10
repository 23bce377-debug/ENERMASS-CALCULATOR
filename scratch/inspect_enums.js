const { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: "postgresql://postgres.xjdqpwmizmfkcdcgcxqv:9BTkCoHcgWtYvE36@aws-1-ap-south-1.pooler.supabase.com:6543/postgres"
  });
  await client.connect();

  try {
    const r = await client.query(`
      SELECT table_name, column_name, udt_name 
      FROM information_schema.columns 
      WHERE data_type = 'USER-DEFINED' 
        AND table_name IN ('field_amc_contracts', 'crm_leads', 'crm_opportunities', 'crm_timeline', 'proc_warranty_claims')
    `);
    console.log("=== USER-DEFINED column types ===");
    for (const row of r.rows) {
      console.log(`${row.table_name}.${row.column_name}: ${row.udt_name}`);
      const labels = await client.query(`
        SELECT enumlabel 
        FROM pg_enum 
        JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
        WHERE pg_type.typname = '${row.udt_name}'
      `);
      console.log(`  Labels:`, labels.rows.map(x => x.enumlabel));
    }
  } catch(e) {
    console.error(e);
  } finally {
    await client.end();
  }
}

run();
