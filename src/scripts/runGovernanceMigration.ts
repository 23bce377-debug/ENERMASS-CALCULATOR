import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { Client } from 'pg';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function run() {
  console.log('═══ ENERMASS Database Platform Governance Migration Runner ═══\n');

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ Error: DATABASE_URL environment variable is missing.');
    process.exit(1);
  }

  const sqlFilePath = path.resolve(process.cwd(), 'src/scripts/migration_platform_governance.sql');
  if (!fs.existsSync(sqlFilePath)) {
    console.error(`❌ SQL migration file not found at: ${sqlFilePath}`);
    process.exit(1);
  }

  console.log(`Reading migration SQL from: ${sqlFilePath}`);
  const sql = fs.readFileSync(sqlFilePath, 'utf8');

  console.log('Connecting to PostgreSQL database...');
  const client = new Client({ connectionString });

  try {
    await client.connect();
    console.log('Connected successfully. Executing platform governance migration SQL...');
    
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');

    console.log('✅ Platform Governance Migration applied successfully!');
  } catch (error) {
    console.error('❌ Platform Governance Migration failed!');
    try {
      await client.query('ROLLBACK');
      console.log('Transaction rolled back.');
    } catch (rollbackError) {
      console.error('Failed to rollback transaction:', rollbackError);
    }
    console.error(error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
