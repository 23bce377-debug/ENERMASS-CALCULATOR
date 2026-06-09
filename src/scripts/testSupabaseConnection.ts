import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const tables = [
  'organisations',
  'profiles',
  'state_rules',
  'calculation_schemes',
  'scheme_slabs',
  'state_scheme_overrides',
  'eq_panels',
  'eq_inverters',
  'eq_batteries',
  'eq_meters',
  'eq_lightning_arresters',
  'eq_mounting_structures',
  'structure_weight_lookup',
  'eq_bom_items',
  'eq_communication_devices',
  'rate_master',
  'systems',
  'system_items',
  'vendors',
  'gst_master',
  'gst_rates'
];

async function main() {
  console.log('Checking which tables exist...');
  for (const table of tables) {
    try {
      const { data, error } = await supabaseAdmin.from(table).select('*').limit(1);
      if (error) {
        console.log(`❌ Table "${table}": error: ${error.message} (code: ${error.code})`);
      } else {
        console.log(`✅ Table "${table}": exists (found ${data.length} records)`);
      }
    } catch (err: any) {
      console.log(`❌ Table "${table}": exception: ${err.message}`);
    }
  }
}

main();
