import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

// Initialize Supabase Client with the service role key to bypass RLS and use Admin Auth APIs
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function main() {
  const email = 'demo123@gmail.com';
  const password = 'admin123';
  const fullName = 'Demo Admin';
  const role = 'admin';

  console.log('--- Creating Demo User ---');

  // 1. Get or create organisation
  let orgId = '';
  const { data: orgs, error: orgsError } = await supabase
    .from('organisations')
    .select('id, name')
    .limit(1);

  if (orgsError) {
    console.error('❌ Error fetching organisations:', orgsError);
    process.exit(1);
  }

  if (orgs && orgs.length > 0) {
    orgId = orgs[0].id;
    console.log(`✅ Found existing organisation: "${orgs[0].name}" (ID: ${orgId})`);
  } else {
    console.log('⚠️ No organisation found. Creating a default organisation...');
    const { data: newOrg, error: createOrgError } = await supabase
      .from('organisations')
      .insert({
        name: 'Enermass Solar Demo Org',
        quote_counter: 1000,
        quote_prefix: 'QM',
        version: 1
      })
      .select('id')
      .single();

    if (createOrgError) {
      console.error('❌ Error creating organisation:', createOrgError);
      process.exit(1);
    }
    orgId = newOrg.id;
    console.log(`✅ Created default organisation (ID: ${orgId})`);
  }

  // 2. Check auth users
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    console.error('❌ Error listing auth users:', listError);
    process.exit(1);
  }

  const existingUser = users.find(u => u.email === email);
  let userId = '';

  if (existingUser) {
    userId = existingUser.id;
    console.log(`✅ Auth user already exists: ${email} (ID: ${userId}). Updating password...`);
    const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
      password: password,
      email_confirm: true
    });
    if (updateError) {
      console.error('❌ Error updating user password:', updateError);
      process.exit(1);
    }
    console.log('✅ Auth user password updated.');
  } else {
    console.log(`Creating new auth user: ${email}...`);
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (createError) {
      console.error('❌ Error creating auth user:', createError);
      process.exit(1);
    }
    userId = newUser.user.id;
    console.log(`✅ Auth user created successfully (ID: ${userId})`);
  }

  // 3. Upsert Profile
  const { data: profile, error: profileSelectError } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (profileSelectError) {
    console.error('❌ Error fetching profile:', profileSelectError);
    process.exit(1);
  }

  if (profile) {
    console.log(`✅ Profile already exists for user ID ${userId}. Updating profile...`);
    const { error: profileUpdateError } = await supabase
      .from('profiles')
      .update({
        org_id: orgId,
        full_name: fullName,
        role: role,
        is_active: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (profileUpdateError) {
      console.error('❌ Error updating profile:', profileUpdateError);
      process.exit(1);
    }
    console.log('✅ Profile updated successfully.');
  } else {
    console.log(`Creating profile for user ID ${userId}...`);
    const { error: profileInsertError } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        org_id: orgId,
        full_name: fullName,
        role: role,
        is_active: true
      });

    if (profileInsertError) {
      console.error('❌ Error creating profile:', profileInsertError);
      process.exit(1);
    }
    console.log('✅ Profile created successfully.');
  }

  console.log('🎉 Demo user setup complete! You can now log in.');
}

main().catch(err => {
  console.error('❌ Unhandled error in script:', err);
  process.exit(1);
});
