const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function run() {
  console.log('Connecting to database...');
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  await client.connect();

  try {
    console.log('Updating organisation name...');
    const res = await client.query(
      "UPDATE organisations SET name = 'Enermass' WHERE name = 'Pitbull Corporations' RETURNING id, name"
    );
    console.log('Updated rows:', res.rows);
  } catch (err) {
    console.error('Error during update:', err);
  } finally {
    await client.end();
  }
}

run();
