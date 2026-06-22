import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function fixSuperAdmin() {
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const email = 'hrushibhanvadiya@gmail.com';
  console.log(`Checking/Fixing super admin details for: ${email}`);

  const { data: { users }, error: listError } = await adminClient.auth.admin.listUsers();
  if (listError) {
    console.error('Error listing users:', listError);
    return;
  }

  const user = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
  if (!user) {
    console.error(`User ${email} does not exist in auth. Please register it first.`);
    return;
  }

  console.log(`User ID: ${user.id}`);

  // Fetch organization
  const { data: orgs, error: orgError } = await adminClient.from('organisations').select('id, name');
  if (orgError) {
    console.error('Error fetching organisations:', orgError);
    return;
  }
  console.log('Available organisations:', orgs);

  const targetOrg = orgs?.[0];
  if (!targetOrg) {
    console.error('No organization found. Please create one.');
    return;
  }

  // Create or update profile
  const { data: existingProfile, error: getProfileError } = await adminClient
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  console.log('Existing profile:', existingProfile);

  const profileData = {
    id: user.id,
    org_id: targetOrg.id,
    role: 'superadmin',
    is_super_admin: true,
    full_name: 'Hrushi (Super Admin)',
    is_active: true
  };

  const { data: newProfile, error: upsertError } = await adminClient
    .from('profiles')
    .upsert(profileData)
    .select()
    .single();

  if (upsertError) {
    console.error('Error upserting profile:', upsertError);
  } else {
    console.log('Profile upserted successfully:', newProfile);
  }

  // Create or update org membership
  const { data: existingMember, error: getMemberError } = await adminClient
    .from('org_members')
    .select('*')
    .eq('user_id', user.id)
    .eq('org_id', targetOrg.id)
    .maybeSingle();

  console.log('Existing org member:', existingMember);

  const memberData = {
    org_id: targetOrg.id,
    user_id: user.id,
    role: 'owner', // Must be owner or admin
    status: 'active'
  };

  const { data: newMember, error: upsertMemberError } = await adminClient
    .from('org_members')
    .upsert(memberData, { onConflict: 'org_id,user_id' })
    .select()
    .single();

  if (upsertMemberError) {
    console.error('Error upserting membership:', upsertMemberError);
  } else {
    console.log('Membership upserted successfully:', newMember);
  }

  // Update Auth App Metadata
  const { data: updatedUser, error: updateAuthError } = await adminClient.auth.admin.updateUserById(
    user.id,
    {
      app_metadata: {
        ...user.app_metadata,
        user_role: 'superadmin',
        active_org_id: targetOrg.id,
        org_id: targetOrg.id
      },
      user_metadata: {
        ...user.user_metadata,
        active_org_id: targetOrg.id,
        org_id: targetOrg.id
      }
    }
  );

  if (updateAuthError) {
    console.error('Error updating auth metadata:', updateAuthError);
  } else {
    console.log('Auth app metadata updated successfully:', updatedUser.user?.app_metadata);
  }

  // Double check subscriptions for the org
  const { data: subs } = await adminClient.from('org_subscriptions').select('*').eq('org_id', targetOrg.id);
  console.log('Org Subscriptions:', subs);
}

fixSuperAdmin();
