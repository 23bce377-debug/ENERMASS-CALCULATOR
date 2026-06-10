const { Client } = require('pg');

const DATABASE_URL = 'postgresql://postgres.xjdqpwmizmfkcdcgcxqv:9BTkCoHcgWtYvE36@aws-1-ap-south-1.pooler.supabase.com:6543/postgres';

async function main() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();

  try {
    console.log('--- Checking for RPC Functions ---');
    const res = await client.query(`
      SELECT routine_name 
      FROM information_schema.routines 
      WHERE routine_schema = 'public'
      ORDER BY routine_name
    `);
    console.log(res.rows.map(r => r.routine_name).join(', '));
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

main();
