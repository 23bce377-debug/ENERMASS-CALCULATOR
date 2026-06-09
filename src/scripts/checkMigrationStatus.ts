import * as path from 'path';
import { Client } from 'pg';

const dotenv = require(path.join(process.cwd(), 'node_modules', 'dotenv'));
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
  const connectionString = process.env.DATABASE_URL!.replace(/"/g, '');
  const url = new URL(connectionString);
  const password = decodeURIComponent(url.password);

  const client = new Client({
    host: url.hostname,
    port: parseInt(url.port || '6543'),
    database: url.pathname.substring(1),
    user: decodeURIComponent(url.username),
    password,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  console.log('--- TABLES IN PUBLIC SCHEMA ---');
  const tables = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name
  `);
  for (const t of tables.rows) {
    console.log(`- ${t.table_name}`);
  }

  console.log('\n--- SCHEMA VERSION INFO ---');
  try {
    const versions = await client.query('SELECT * FROM schema_migrations');
    console.log(versions.rows);
  } catch (err) {
    console.log('No schema_migrations table found.');
  }

  await client.end();
}

main().catch(console.error);
