const fs = require('fs');
const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  await client.connect();

  try {
    console.log('Running 0101_performance_optimizations.sql...');
    const sql11 = fs.readFileSync('scripts/0101_performance_optimizations.sql', 'utf8');
    await client.query(sql11);
    console.log('Successfully ran 0101_performance_optimizations.sql');

  } catch (err) {
    console.error('Error running migrations:', err);
  } finally {
    await client.end();
  }
}

run();
