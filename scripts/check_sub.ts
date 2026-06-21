import { createClient } from '@supabase/supabase-js';

async function checkSub() {
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const orgId = '00000000-0000-0000-0000-000000000001';
  const { data: sub } = await adminClient.from('org_subscriptions').select('*').eq('org_id', orgId).single();
  console.log('Subscription for 0000...01:', sub);
  
  const { data: orgs } = await adminClient.from('organisations').select('*').eq('id', orgId);
  console.log('Organization for 0000...01:', orgs);
}

checkSub();
