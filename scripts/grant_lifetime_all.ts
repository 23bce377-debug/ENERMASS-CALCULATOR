import { createClient } from '@supabase/supabase-js';

async function grantLifetimeSubscriptionAll() {
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const planId = '22222222-2222-2222-2222-222222222222';
  
  const { data: orgs } = await adminClient.from('organisations').select('id');
  
  if (!orgs) return;

  for (const org of orgs) {
    const { error } = await adminClient.from('org_subscriptions').upsert({
      org_id: org.id,
      plan_id: planId,
      billing_cycle: 'manual',
      status: 'active',
      current_period_start: new Date().toISOString(),
      current_period_end: new Date('2099-12-31T23:59:59Z').toISOString(), // lifetime
      seat_limit: 10000, 
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    if (error) {
      console.error('Error creating subscription for', org.id, error);
    } else {
      console.log('Successfully granted lifetime subscription to org:', org.id);
    }
  }
}

grantLifetimeSubscriptionAll();
