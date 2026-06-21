const { Client } = require('pg');

require('dotenv').config({ path: '.env.local' });

const client = new Client({
  connectionString: process.env.DATABASE_URL
});

async function main() {
  await client.connect();

  console.log('--- Columns of crm_site_surveys ---');
  const resSurveys = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'crm_site_surveys'
    ORDER BY ordinal_position;
  `);
  resSurveys.rows.forEach(row => {
    console.log(`${row.column_name}: ${row.data_type}`);
  });

  await client.end();
}

main().catch(console.error);
