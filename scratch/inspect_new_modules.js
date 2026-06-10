const { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: "postgresql://postgres.xjdqpwmizmfkcdcgcxqv:9BTkCoHcgWtYvE36@aws-1-ap-south-1.pooler.supabase.com:6543/postgres"
  });
  await client.connect();

  try {
    const tables = ['field_amc_contracts', 'crm_leads', 'crm_opportunities', 'crm_timeline', 'proc_warranty_claims'];
    for (const tbl of tables) {
      const r = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = '${tbl}'
        ORDER BY column_name
      `);
      console.log(`--- ${tbl} columns ---`);
      r.rows.forEach(col => {
        console.log(`  ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
      });
    }
  } catch(e) {
    console.error(e);
  } finally {
    await client.end();
  }
}

run();
