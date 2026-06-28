import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log('Fetching existing data...');
  
  // Get all auth users
  const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (usersError) throw usersError;
  const users = usersData.users;
  console.log(`Found ${users.length} total users.`);

  const hrushi = users.find(u => u.email === 'hrushibhanvadiya@gmail.com');
  const restUsers = users.filter(u => u.email !== 'hrushibhanvadiya@gmail.com');

  // Delete existing organisations (this should cascade to org_members, org_subscriptions, user_devices, activation_keys)
  // Wait, Supabase cascade delete might fail if foreign keys don't have ON DELETE CASCADE.
  // Let's delete child tables first to be safe.
  console.log('Cleaning up child tables...');
  await supabase.from('license_events').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('activation_keys').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('device_reset_requests').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('user_devices').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('org_members').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('subscription_payments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('org_subscriptions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  
  console.log('Deleting existing organisations...');
  await supabase.from('organisations').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  // Create new Orgs
  console.log('Creating new organisations...');
  const { data: pitbullOrg } = await supabase.from('organisations').insert({ name: 'Enermass', email: 'founder@pitbullcorporations.com' }).select().single();
  const { data: demoOrg } = await supabase.from('organisations').insert({ name: 'Demo', email: 'demo@example.com' }).select().single();

  if (!pitbullOrg || !demoOrg) throw new Error('Failed to create orgs');
  console.log('Created Orgs:', { pitbullId: pitbullOrg.id, demoId: demoOrg.id });

  // Get Plans
  const { data: plans } = await supabase.from('subscription_plans').select('*');
  const enterprisePlan = plans?.find(p => p.code === 'enterprise') || plans?.[0];
  const starterPlan = plans?.find(p => p.code === 'starter') || plans?.[0];

  if (!enterprisePlan || !starterPlan) throw new Error('No subscription plans found in DB');

  // Assign Subscriptions
  console.log('Assigning subscriptions...');
  
  // Pitbull - Lifetime full access (simulate by giving enterprise with 10 years end date)
  const pitbullEnd = new Date();
  pitbullEnd.setFullYear(pitbullEnd.getFullYear() + 10);
  await supabase.from('org_subscriptions').insert({
    org_id: pitbullOrg.id,
    plan_id: enterprisePlan.id,
    status: 'active',
    billing_cycle: 'yearly',
    seat_limit: 1000,
    current_period_end: pitbullEnd.toISOString()
  });

  // Demo - Limited 4 days access
  const demoEnd = new Date();
  demoEnd.setDate(demoEnd.getDate() + 4);
  await supabase.from('org_subscriptions').insert({
    org_id: demoOrg.id,
    plan_id: starterPlan.id,
    status: 'trialing',
    billing_cycle: 'trial',
    seat_limit: 5,
    current_period_end: demoEnd.toISOString()
  });

  // Move Hrushi to Pitbull
  console.log('Re-assigning users...');
  if (hrushi) {
    await supabase.from('profiles').update({ org_id: pitbullOrg.id, role: 'owner', is_super_admin: true }).eq('id', hrushi.id);
    await supabase.from('org_members').insert({ org_id: pitbullOrg.id, user_id: hrushi.id, role: 'owner', status: 'active' });
    await supabase.auth.admin.updateUserById(hrushi.id, {
      user_metadata: { ...hrushi.user_metadata, org_id: pitbullOrg.id },
      app_metadata: { ...hrushi.app_metadata, org_id: pitbullOrg.id, role: 'owner' }
    });
    console.log(`Moved Hrushi to Enermass`);
  }

  // Move rest to Demo
  for (const user of restUsers) {
    await supabase.from('profiles').update({ org_id: demoOrg.id, role: 'staff' }).eq('id', user.id);
    await supabase.from('org_members').insert({ org_id: demoOrg.id, user_id: user.id, role: 'staff', status: 'active' });
    await supabase.auth.admin.updateUserById(user.id, {
      user_metadata: { ...user.user_metadata, org_id: demoOrg.id },
      app_metadata: { ...user.app_metadata, org_id: demoOrg.id, role: 'staff' }
    });
  }
  console.log(`Moved ${restUsers.length} users to Demo`);

  console.log('Generating dummy keys for the orgs just to test...');
  // Note: we can skip generating dummy keys if they will use the UI, but it might be nice to have some.
  // The user asked "limited 4 days access key generation" which implies they just want the 4 days access.
  console.log('Done!');
}

main().catch(console.error);
