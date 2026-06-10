const { Client } = require('pg');

const DATABASE_URL = 'postgresql://postgres.xjdqpwmizmfkcdcgcxqv:9BTkCoHcgWtYvE36@aws-1-ap-south-1.pooler.supabase.com:6543/postgres';

async function main() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();

  try {
    console.log('--- Checking Columns for eq_panels ---');
    const resPanels = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'eq_panels'
    `);
    resPanels.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type}`));

    console.log('--- Checking Columns for eq_inverters ---');
    const resInverters = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'eq_inverters'
    `);
    resInverters.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type}`));

    console.log('--- Checking Columns for eq_batteries ---');
    const resBatteries = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'eq_batteries'
    `);
    resBatteries.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type}`));

    console.log('--- Checking All Tables in public Schema ---');
    const resTables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    console.log(resTables.rows.map(r => r.table_name).join(', '));
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

main();
