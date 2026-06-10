import * as dotenv from 'dotenv';
import * as path from 'path';
import { Client } from 'pg';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
  console.log('═══ Applying Quotes GST Patch ═══\n');
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is missing in .env.local');
    process.exit(1);
  }

  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log('Connected to PostgreSQL successfully. Running ALTER TABLE quote_items...');
    await client.query(`
      ALTER TABLE quote_items 
        ADD COLUMN IF NOT EXISTS is_gst_overridden BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS original_gst NUMERIC(6,5);
    `);
    console.log('✅ ALTER TABLE quote_items completed successfully!');
  } catch (err) {
    console.error('❌ Failed to patch quote_items table:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
