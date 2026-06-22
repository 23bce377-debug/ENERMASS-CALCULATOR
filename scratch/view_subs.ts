import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function viewSubs() {
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data: orgs } = await adminClient.from('organisations').select('*');
  console.log('--- ORGANISATIONS ---');
  console.log(orgs);

  const { data: subs } = await adminClient.from('org_subscriptions').select('*');
  console.log('--- SUBSCRIPTIONS ---');
  console.log(subs);
}

viewSubs();
