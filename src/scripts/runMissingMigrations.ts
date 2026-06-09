import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { Client } from 'pg';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function run() {
  console.log('═══ ENERMASS Missing Tables Migration Runner ═══\n');

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ Error: DATABASE_URL environment variable is missing in .env.local.');
    process.exit(1);
  }

  // Parse connection string
  const rawUrl = connectionString.replace(/"/g, ''); // strip quotes
  const url = new URL(rawUrl);
  
  const password = decodeURIComponent(url.password);

  // Connection config 1: Pooler (provided by user)
  const configPooler = {
    host: url.hostname,
    port: parseInt(url.port || '6543'),
    database: url.pathname.substring(1),
    user: decodeURIComponent(url.username),
    password,
    ssl: { rejectUnauthorized: false }
  };

  // Connection config 2: Direct (derived from Supabase project ID)
  const configDirect = {
    host: 'db.xjdqpwmizmfkcdcgcxqv.supabase.co',
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password,
    ssl: { rejectUnauthorized: false }
  };

  const sqlFilePath = path.resolve(process.cwd(), 'src/scripts/create_missing_tables.sql');
  const sql = fs.readFileSync(sqlFilePath, 'utf8');

  let client: Client;
  
  console.log('Attempting connection via direct host on port 5432...');
  try {
    client = new Client(configDirect);
    await client.connect();
    console.log('Connected successfully via direct connection!');
  } catch (directErr: any) {
    console.log(`⚠️ Direct connection failed: ${directErr.message}`);
    console.log('Attempting connection via pooler host on port 6543...');
    try {
      client = new Client(configPooler);
      await client.connect();
      console.log('Connected successfully via pooler connection!');
    } catch (poolerErr: any) {
      console.error('❌ Both direct and pooler connection attempts failed!');
      console.error(`Direct Error: ${directErr.message}`);
      console.error(`Pooler Error: ${poolerErr.message}`);
      process.exit(1);
    }
  }

  try {
    console.log('Executing migration SQL inside a transaction...');
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('✅ Migration applied successfully!');
  } catch (error) {
    console.error('❌ Migration execution failed!');
    try {
      await client.query('ROLLBACK');
    } catch (rbErr) {}
    console.error(error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
