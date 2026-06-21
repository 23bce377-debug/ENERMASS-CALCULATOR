import { createClient } from '@supabase/supabase-js';

async function grantSuperAdmin() {
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const email = 'hrushibhainvadiya@gmail.com';

  console.log(`Looking up user by email: ${email}`);
  const { data: { users }, error } = await adminClient.auth.admin.listUsers();
  if (error) {
    console.error('Error listing users', error);
    process.exit(1);
  }

  let user = users.find(u => u.email === email);
  if (!user) {
    console.log('User not found. Creating user...');
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name: 'Super Admin' }
    });
    if (createError) {
      console.error('Error creating user', createError);
      process.exit(1);
    }
    user = newUser.user;
  }

  console.log(`User ID: ${user.id}`);
  
  // Get an org ID
  const { data: orgs } = await adminClient.from('organisations').select('id').limit(1);
  const orgId = orgs?.[0]?.id;
  if (!orgId) {
    console.log("No organizations found in database. Please create one first.");
    process.exit(1);
  }

  // Upsert profile
  const { error: profileError } = await adminClient
    .from('profiles')
    .upsert({ id: user.id, org_id: orgId, role: 'superadmin', is_super_admin: true, full_name: 'Hrushi (Super Admin)' }, { onConflict: 'id' });

  if (profileError) {
    console.error('Error updating profile', profileError);
    process.exit(1);
  }

  // Update app_metadata directly just in case triggers don't fire
  await adminClient.auth.admin.updateUserById(user.id, {
    app_metadata: {
      ...user.app_metadata,
      user_role: 'superadmin'
    }
  });

  console.log('Successfully granted superadmin role to', email);
}

grantSuperAdmin();
