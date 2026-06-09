import * as dotenv from 'dotenv';
import * as path from 'path';
import { Client } from 'pg';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
  console.log('═══ Applying Quotes Patch (from schema.sql lines 1345-1354) ═══\n');
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is missing in .env.local');
    process.exit(1);
  }

  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log('Connected to PostgreSQL successfully. Running ALTER TABLE quotes...');
    await client.query(`
      ALTER TABLE quotes 
        ADD COLUMN IF NOT EXISTS structure_id UUID REFERENCES eq_mounting_structures(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS structure_pricing_mode TEXT DEFAULT 'weight',
        ADD COLUMN IF NOT EXISTS solar_meter_id UUID REFERENCES eq_meters(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS solar_meter_qty INTEGER DEFAULT 1,
        ADD COLUMN IF NOT EXISTS net_meter_id UUID REFERENCES eq_meters(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS net_meter_qty INTEGER DEFAULT 1,
        ADD COLUMN IF NOT EXISTS la_id UUID REFERENCES eq_lightning_arresters(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS la_qty INTEGER DEFAULT 1;
    `);
    console.log('✅ ALTER TABLE quotes completed successfully!');
  } catch (err) {
    console.error('❌ Failed to patch quotes table:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
