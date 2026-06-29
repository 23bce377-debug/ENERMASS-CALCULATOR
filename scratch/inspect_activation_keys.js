const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  await client.connect();

  try {
    const orgIds = ['5763b935-b4b0-4488-a386-2bbba0fa7fa1', 'e2cd83e6-aa64-44e7-95e9-002af95725a8'];
    const orgIdsString = orgIds.map(id => `'${id}'`).join(',');

    const resKeys = await client.query(`
      SELECT * FROM activation_keys WHERE org_id IN (${orgIdsString})
    `);
    console.log('Activation keys count:', resKeys.rows.length);
    console.log('Keys details:');
    console.log(resKeys.rows);

  } catch (err) {
    console.error('Error during key inspection:', err);
  } finally {
    await client.end();
  }
}

run();
