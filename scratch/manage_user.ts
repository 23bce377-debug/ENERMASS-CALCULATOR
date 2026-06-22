import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function manageUser() {
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const email = 'hrushibhanvadiya@gmail.com';
  console.log(`Checking auth user for email: ${email}`);

  const { data: { users }, error: listError } = await adminClient.auth.admin.listUsers();
  if (listError) {
    console.error('Error listing users:', listError);
    return;
  }

  const user = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
  if (!user) {
    console.log(`User ${email} does not exist. Creating...`);
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password: 'Hrushi@2501',
      email_confirm: true
    });
    if (createError) {
      console.error('Error creating user:', createError);
      return;
    }
    console.log('User created:', newUser.user?.id);
  } else {
    console.log(`User exists: ${user.id}. Resetting password to Hrushi@2501...`);
    const { data: updatedUser, error: updateError } = await adminClient.auth.admin.updateUserById(
      user.id,
      { password: 'Hrushi@2501' }
    );
    if (updateError) {
      console.error('Error updating password:', updateError);
      return;
    }
    console.log('Password reset successfully for user:', updatedUser.user?.email);
  }

  // Check profiles table
  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('*')
    .eq('email', email)
    .single();

  console.log('Profile details:', profile || 'None found');
  if (profileError) {
    console.error('Profile error:', profileError);
  }

  // Let's also check org memberships
  const { data: memberships, error: membershipError } = await adminClient
    .from('org_members')
    .select('*, org:orgs(*)')
    .eq('user_id', user ? user.id : '');
  
  console.log('Org memberships:', memberships || 'None found');
  if (membershipError) {
    console.error('Membership error:', membershipError);
  }

  // Also query user_devices
  const { data: devices, error: deviceError } = await adminClient
    .from('user_devices')
    .select('*')
    .eq('user_id', user ? user.id : '');
  
  console.log('Devices:', devices || 'None found');
}

manageUser();
