import * as dotenv from 'dotenv';
import * as path from 'path';
import { Client } from 'pg';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is missing in .env.local');
    process.exit(1);
  }

  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log('Connected to PostgreSQL successfully.');

    // Query panels schema and sample rows
    const columns = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'eq_panels';
    `);
    console.log('--- eq_panels columns ---');
    console.log(columns.rows);

    const rows = await client.query(`
      SELECT * FROM eq_panels LIMIT 3;
    `);
    console.log('--- eq_panels sample rows ---');
    console.log(rows.rows);

  } catch (err) {
    console.error('Failed to query panels:', err);
  } finally {
    await client.end();
  }
}

main();
