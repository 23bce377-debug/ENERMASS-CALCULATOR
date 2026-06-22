import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function fixIdentity() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL database.');

    const userId = '5e35b271-beba-429e-ad3f-49e553cc8782';

    // Fetch existing identities
    const res = await client.query('SELECT * FROM auth.identities WHERE user_id = $1', [userId]);
    console.log('Identities count:', res.rowCount);
    
    for (const row of res.rows) {
      console.log('Identity Row:', row.id, row.provider, row.identity_data);
      
      const identityData = typeof row.identity_data === 'string' 
        ? JSON.parse(row.identity_data) 
        : row.identity_data;
      
      identityData.email_verified = true;

      // Update the identity_data in auth.identities
      await client.query(
        'UPDATE auth.identities SET identity_data = $1 WHERE id = $2 AND provider = $3',
        [JSON.stringify(identityData), row.id, row.provider]
      );
      console.log(`Updated identity_data for id=${row.id}, provider=${row.provider} to set email_verified=true`);
    }

    // Also let's double check auth.users table
    const userRes = await client.query('SELECT email, email_confirmed_at, confirmed_at FROM auth.users WHERE id = $1', [userId]);
    if ((userRes.rowCount ?? 0) > 0) {
      const userRow = userRes.rows[0];
      console.log('User row details:', userRow);
      
      if (!userRow.email_confirmed_at || !userRow.confirmed_at) {
        await client.query(
          'UPDATE auth.users SET email_confirmed_at = NOW(), confirmed_at = NOW() WHERE id = $1',
          [userId]
        );
        console.log('Updated auth.users confirmed dates to NOW().');
      }
    }
  } catch (err) {
    console.error('Error during database update:', err);
  } finally {
    await client.end();
    console.log('Disconnected from database.');
  }
}

fixIdentity();
