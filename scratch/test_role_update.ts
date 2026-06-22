import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function testRoleUpdate() {
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const email = 'hrushib.2501@gmail.com';
  console.log(`Checking profile and org member for email: ${email}`);

  // 1. Get user ID from auth.admin
  const { data: { users }, error: listError } = await adminClient.auth.admin.listUsers();
  if (listError) {
    console.error('Error listing auth users:', listError);
    return;
  }

  const authUser = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
  if (!authUser) {
    console.error(`Auth user not found for email: ${email}`);
    return;
  }

  const userId = authUser.id;
  console.log(`Found auth user ID: ${userId}`);

  // Get user profile
  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (profileError) {
    console.error('Error fetching profile:', profileError);
    return;
  }

  if (!profile) {
    console.error(`Profile not found for email: ${email}`);
    return;
  }

  console.log('Profile before update:', profile);

  // 2. Get org member details
  const { data: member, error: memberError } = await adminClient
    .from('org_members')
    .select('*')
    .eq('user_id', profile.id)
    .maybeSingle();

  if (memberError) {
    console.error('Error fetching org member:', memberError);
    return;
  }

  console.log('Org member before update:', member);

  // 3. Perform update of profile
  console.log('Updating profile role to admin...');
  const { error: profileUpdateError } = await adminClient
    .from('profiles')
    .update({ role: 'admin' })
    .eq('id', profile.id);

  if (profileUpdateError) {
    console.error('Profile update failed:', profileUpdateError);
  } else {
    console.log('Profile update succeeded!');
  }

  // 4. Perform update of org member
  console.log('Updating org member role to admin...');
  const { error: memberUpdateError } = await adminClient
    .from('org_members')
    .update({ role: 'admin' })
    .eq('user_id', profile.id);

  if (memberUpdateError) {
    console.error('Org member update failed:', memberUpdateError);
  } else {
    console.log('Org member update succeeded!');
  }

  // 5. Query both again to check final status
  const { data: updatedProfile } = await adminClient
    .from('profiles')
    .select('*')
    .eq('id', profile.id)
    .single();

  const { data: updatedMember } = await adminClient
    .from('org_members')
    .select('*')
    .eq('user_id', profile.id)
    .maybeSingle();

  console.log('Updated Profile:', updatedProfile);
  console.log('Updated Org Member:', updatedMember);
}

testRoleUpdate().catch(console.error);
