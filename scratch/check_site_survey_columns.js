const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.xjdqpwmizmfkcdcgcxqv:9BTkCoHcgWtYvE36@aws-1-ap-south-1.pooler.supabase.com:6543/postgres'
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
