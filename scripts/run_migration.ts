import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL;
const client = new Client({
  connectionString,
});

async function runMigration() {
  await client.connect();
  const sqlPath = path.resolve(__dirname, '../supabase/migrations/202606200009_device_binding_challenges.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  await client.query(sql);
  console.log('Migration applied successfully.');
  await client.end();
}

runMigration().catch(console.error);
