import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { Client } from 'pg';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function run() {
  console.log('═══ ENERMASS Database Reporting Views Migration Runner ═══\n');

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ Error: DATABASE_URL environment variable is missing.');
    process.exit(1);
  }

  const sqlFilePath = path.resolve(process.cwd(), 'src/scripts/reporting.sql');
  if (!fs.existsSync(sqlFilePath)) {
    console.error(`❌ SQL migration file not found at: ${sqlFilePath}`);
    process.exit(1);
  }

  console.log(`Reading migration SQL from: ${sqlFilePath}`);
  const sql = fs.readFileSync(sqlFilePath, 'utf8');

  console.log('Connecting to PostgreSQL database...');
  const client = new Client({ 
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected successfully. Executing reporting views SQL...');
    
    await client.query(sql);

    console.log('✅ Reporting views applied successfully!');
  } catch (error) {
    console.error('❌ Migration failed!');
    console.error(error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
