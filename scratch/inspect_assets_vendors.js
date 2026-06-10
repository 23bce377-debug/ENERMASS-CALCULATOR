const { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: "postgresql://postgres.xjdqpwmizmfkcdcgcxqv:9BTkCoHcgWtYvE36@aws-1-ap-south-1.pooler.supabase.com:6543/postgres"
  });
  await client.connect();

  try {
    for (const tbl of ['field_customer_assets', 'vendors']) {
      const r = await client.query(`
        SELECT column_name, data_type
        FROM information_schema.columns 
        WHERE table_name = '${tbl}'
        ORDER BY column_name
      `);
      console.log(`--- ${tbl} columns ---`);
      console.log(r.rows.map(x => x.column_name).join(', '));
    }
  } catch(e) {
    console.error(e);
  } finally {
    await client.end();
  }
}

run();
