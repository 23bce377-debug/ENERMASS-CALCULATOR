import * as dotenv from 'dotenv';
import * as path from 'path';
import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const connectionString = process.env.DATABASE_URL!;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const BACKUP_TABLES = [
  'organisations',
  'profiles',
  'state_rules',
  'calculation_schemes',
  'scheme_slabs',
  'eq_panels',
  'eq_inverters',
  'eq_batteries',
  'quotes',
  'quote_items',
  'quote_additional_costs',
  'quote_status_history',
  'quote_variants',
  'inv_stock_transactions',
  'acc_journal_entries',
  'acc_journal_lines',
  'epc_projects'
];

async function main() {
  console.log('Initiating automated database backup snapshot...');
  
  const pgClient = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  try {
    await pgClient.connect();
    console.log('✅ Connected to Postgres database.');

    const backupData: Record<string, any[]> = {};

    for (const table of BACKUP_TABLES) {
      console.log(`Dumping table: ${table}...`);
      try {
        const result = await pgClient.query(`SELECT * FROM public.${table};`);
        backupData[table] = result.rows;
        console.log(`  - Dumped ${result.rows.length} rows.`);
      } catch (err: any) {
        console.warn(`⚠️ Failed to dump table "${table}": ${err.message}`);
      }
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFilename = `db_backup_${timestamp}.json`;
    const payload = JSON.stringify({
      timestamp: new Date().toISOString(),
      version: '2.0.0',
      data: backupData
    }, null, 2);

    console.log(`Uploading backup snapshot "${backupFilename}" to Supabase Storage...`);
    
    // Ensure the bucket exists or use the quotes bucket
    // We will upload backups under backups/ folder of the 'quotes' bucket
    const filePath = `backups/${backupFilename}`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from('quotes')
      .upload(filePath, new Blob([payload], { type: 'application/json' }), {
        contentType: 'application/json',
        upsert: true
      });

    if (uploadError) {
      throw uploadError;
    }

    console.log(`✅ Automated backup snapshot successfully uploaded to storage bucket at: ${filePath}`);

  } catch (err: any) {
    console.error('❌ Database backup failed:', err.message || err);
    process.exit(1);
  } finally {
    await pgClient.end();
  }
}

main();
