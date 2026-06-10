const { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: "postgresql://postgres.xjdqpwmizmfkcdcgcxqv:9BTkCoHcgWtYvE36@aws-1-ap-south-1.pooler.supabase.com:6543/postgres"
  });
  await client.connect();

  try {
    const r = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'quotes'
      ORDER BY column_name
    `);
    console.log('--- quotes columns ---');
    console.log(JSON.stringify(r.rows, null, 2));

  } catch(e) {
    console.error(e);
  } finally {
    await client.end();
  }
}

run();
