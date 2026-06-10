const { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: "postgresql://postgres.xjdqpwmizmfkcdcgcxqv:9BTkCoHcgWtYvE36@aws-1-ap-south-1.pooler.supabase.com:6543/postgres"
  });
  await client.connect();

  try {
    const r1 = await client.query(`
      SELECT column_name, data_type, udt_name, numeric_precision, numeric_scale 
      FROM information_schema.columns 
      WHERE table_name = 'acquisition_items'
    `);
    console.log('--- acquisition_items columns ---');
    console.log(r1.rows);

    const r2 = await client.query(`
      SELECT column_name, data_type, udt_name, numeric_precision, numeric_scale 
      FROM information_schema.columns 
      WHERE table_name = 'bundle_preset_items'
    `);
    console.log('\n--- bundle_preset_items columns ---');
    console.log(r2.rows);

    const r3 = await client.query(`
      SELECT column_name, data_type, udt_name 
      FROM information_schema.columns 
      WHERE table_name = 'bundle_presets'
    `);
    console.log('\n--- bundle_presets columns ---');
    console.log(r3.rows);

  } catch(e) {
    console.error(e);
  } finally {
    await client.end();
  }
}

run();
