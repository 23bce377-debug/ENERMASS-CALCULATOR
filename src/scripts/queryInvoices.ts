import * as dotenv from 'dotenv';
import * as path from 'path';
import { Client } from 'pg';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
  const connectionString = process.env.DATABASE_URL;
  const client = new Client({ connectionString });
  try {
    await client.connect();
    const res = await client.query('SELECT DISTINCT status FROM acc_invoices;');
    console.log('--- acc_invoices.status values ---');
    console.log(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

main();
