const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  await client.connect();

  try {
    console.log('--- POST-CLEANUP VERIFICATION ---');

    const enermassOrgId = 'e2cd83e6-aa64-44e7-95e9-002af95725a8';
    const primaryOrgId = '5763b935-b4b0-4488-a386-2bbba0fa7fa1';

    // 1. Check organisations matching '%enermass%'
    const enermassOrgs = await client.query(
      "SELECT * FROM organisations WHERE name ILIKE '%enermass%'"
    );
    console.log('Organisations matching "%enermass%":', enermassOrgs.rows);

    // 2. Check if the deleted Enermass Org ID still exists
    const deletedOrg = await client.query(
      "SELECT * FROM organisations WHERE id = $1",
      [enermassOrgId]
    );
    console.log(`Deleted Org ID ${enermassOrgId} exists:`, deletedOrg.rows.length > 0);

    // 3. Check if primary Org has correct restored name
    const primaryOrg = await client.query(
      "SELECT id, name, email FROM organisations WHERE id = $1",
      [primaryOrgId]
    );
    console.log('Primary Org details:', primaryOrg.rows);

    // 4. Verify cascade deletions for the deleted organization ID
    const tables = ['profiles', 'quotes', 'org_members', 'org_subscriptions', 'activation_keys'];
    for (const table of tables) {
      const countRes = await client.query(
        `SELECT COUNT(*) FROM "${table}" WHERE org_id = $1`,
        [enermassOrgId]
      );
      console.log(`Count in table "${table}" for org ${enermassOrgId}:`, countRes.rows[0].count);
    }

  } catch (err) {
    console.error('Error during verification:', err);
  } finally {
    await client.end();
  }
}

run();
