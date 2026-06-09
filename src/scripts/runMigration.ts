import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { Client } from 'pg';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function run() {
  console.log('═══ ENERMASS Database Migration Runner ═══\n');

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ Error: DATABASE_URL environment variable is missing.');
    console.error('To run this migration, you have two options:');
    console.error('1. Define DATABASE_URL in your .env.local or shell:');
    console.error('   DATABASE_URL=postgresql://postgres:[password]@db.xjdqpwmizmfkcdcgcxqv.supabase.co:5432/postgres');
    console.error('   And run: npx tsx src/scripts/runMigration.ts');
    console.error('2. Or manually copy the contents of:');
    console.error('   src/scripts/migration_versioning.sql');
    console.error('   and execute them in the Supabase Dashboard SQL Editor.\n');
    process.exit(1);
  }

  const sqlFilePath = path.resolve(process.cwd(), 'src/scripts/migration_versioning.sql');
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
    console.log('Connected successfully. Executing migration SQL inside a transaction...');
    
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');

    console.log('✅ Migration applied successfully!');
  } catch (error) {
    console.error('❌ Migration failed!');
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
