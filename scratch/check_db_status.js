const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function run() {
  console.log('Connecting using:', process.env.DATABASE_URL ? 'FOUND' : 'MISSING');
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  await client.connect();

  try {
    console.log('--- Organisations ---');
    const orgs = await client.query('SELECT id, name FROM organisations');
    console.log(orgs.rows);

    console.log('--- Keys ---');
    const keys = await client.query('SELECT id, org_id, key_prefix, status, max_uses FROM activation_keys');
    console.log(keys.rows);

    console.log('--- Devices ---');
    const devices = await client.query('SELECT id, user_id, device_name, status FROM user_devices');
    console.log(devices.rows);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

run();
