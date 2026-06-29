const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  await client.connect();

  try {
    await client.query('BEGIN');
    console.log('Transaction started.');

    const enermassOrgId = 'e2cd83e6-aa64-44e7-95e9-002af95725a8';
    const primaryOrgId = '5763b935-b4b0-4488-a386-2bbba0fa7fa1';

    // 1. Deactivate keys related to Enermass Org
    console.log(`Deactivating keys for org ${enermassOrgId}...`);
    const deactivateRes = await client.query(
      `UPDATE activation_keys 
       SET status = 'revoked', revoked_at = NOW(), updated_at = NOW() 
       WHERE org_id = $1 AND status != 'revoked'
       RETURNING id, key_prefix, status`,
      [enermassOrgId]
    );
    console.log('Deactivated keys:', deactivateRes.rows);

    // 2. Delete referencing records in order of foreign key dependencies
    console.log('Deleting referencing records...');
    
    // org_members references profiles
    await client.query('DELETE FROM org_members WHERE org_id = $1', [enermassOrgId]);
    console.log('Deleted org_members.');

    // activation_keys references profiles
    await client.query('DELETE FROM activation_keys WHERE org_id = $1', [enermassOrgId]);
    console.log('Deleted activation_keys.');

    // quotes references profiles
    await client.query('DELETE FROM quotes WHERE org_id = $1', [enermassOrgId]);
    console.log('Deleted quotes.');

    // profiles references organisations
    await client.query('DELETE FROM profiles WHERE org_id = $1', [enermassOrgId]);
    console.log('Deleted profiles.');

    // org_subscriptions references organisations
    await client.query('DELETE FROM org_subscriptions WHERE org_id = $1', [enermassOrgId]);
    console.log('Deleted org_subscriptions.');

    // 3. Delete the Enermass Org from organisations table
    console.log(`Deleting org ${enermassOrgId} from organisations...`);
    const deleteOrgRes = await client.query(
      `DELETE FROM organisations WHERE id = $1 RETURNING id, name`,
      [enermassOrgId]
    );
    console.log('Deleted organization:', deleteOrgRes.rows);

    // 4. Rename primary organisation back to "Pitbull Corporations"
    console.log(`Renaming primary org ${primaryOrgId} back to 'Pitbull Corporations'...`);
    const renameRes = await client.query(
      `UPDATE organisations 
       SET name = 'Pitbull Corporations', updated_at = NOW() 
       WHERE id = $1 
       RETURNING id, name`,
      [primaryOrgId]
    );
    console.log('Renamed organization:', renameRes.rows);

    await client.query('COMMIT');
    console.log('Transaction committed successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error encountered. Transaction rolled back:', err);
  } finally {
    await client.end();
  }
}

run();
