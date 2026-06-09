import * as dotenv from 'dotenv';
import * as path from 'path';
import { Client } from 'pg';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
  console.log('═══ Applying Nullable Patch to Old Polymorphic Columns ═══\n');
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is missing in .env.local');
    process.exit(1);
  }

  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log('Connected to PostgreSQL. Dropping NOT NULL constraints...');
    await client.query(`
      ALTER TABLE inv_stock_balances ALTER COLUMN item_type DROP NOT NULL, ALTER COLUMN item_id DROP NOT NULL;
      ALTER TABLE inv_serialized_items ALTER COLUMN item_type DROP NOT NULL, ALTER COLUMN item_id DROP NOT NULL;
      ALTER TABLE inv_stock_transactions ALTER COLUMN item_type DROP NOT NULL, ALTER COLUMN item_id DROP NOT NULL;
      ALTER TABLE proc_rfq_items ALTER COLUMN item_type DROP NOT NULL, ALTER COLUMN item_id DROP NOT NULL;
      ALTER TABLE proc_po_items ALTER COLUMN item_type DROP NOT NULL, ALTER COLUMN item_id DROP NOT NULL;
      ALTER TABLE proc_grn_items ALTER COLUMN item_type DROP NOT NULL, ALTER COLUMN item_id DROP NOT NULL;
      ALTER TABLE inv_transfer_items ALTER COLUMN item_type DROP NOT NULL, ALTER COLUMN item_id DROP NOT NULL;
    `);
    console.log('✅ Nullable patch applied successfully!');
  } catch (err) {
    console.error('❌ Failed to apply nullable patch:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
