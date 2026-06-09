import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
  const { data: schemes } = await supabaseAdmin.from('calculation_schemes').select('*');
  console.log('--- CALCULATION SCHEMES ---');
  console.log(schemes);

  const { data: slabs } = await supabaseAdmin.from('scheme_slabs').select('*');
  console.log('--- SCHEME SLABS ---');
  console.log(slabs);
}

main();
