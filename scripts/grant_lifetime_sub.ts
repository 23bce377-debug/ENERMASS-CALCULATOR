import { createClient } from '@supabase/supabase-js';

async function grantLifetimeSubscription() {
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const orgId = '11111111-1111-1111-1111-111111111111';
  
  // Upsert an Enterprise/Lifetime Plan
  const planId = '22222222-2222-2222-2222-222222222222';
  await adminClient.from('subscription_plans').upsert({
    id: planId,
    code: 'lifetime-admin',
    name: 'Lifetime Admin Access',
    monthly_price: 0,
    yearly_price: 0,
    seat_limit: 10000,
    features: { calculator: true, erp: true },
    is_active: true
  });

  // Upsert subscription
  const { error } = await adminClient.from('org_subscriptions').upsert({
    org_id: orgId,
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
    console.error('Error creating subscription:', error);
  } else {
    console.log('Successfully granted lifetime subscription with 10000 seats to org:', orgId);
  }
}

grantLifetimeSubscription();
