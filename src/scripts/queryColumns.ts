import * as dotenv from 'dotenv';
import * as path from 'path';
import { Client } from 'pg';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
  const connectionString = process.env.DATABASE_URL;
  const client = new Client({ connectionString });
  try {
    await client.connect();
    const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'quotes' AND table_schema = 'public';
    `);
    console.log('--- quotes columns ---');
    console.log(res.rows.map(r => `${r.column_name}: ${r.data_type}`).join('\n'));
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

main();
