import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function main() {
  const email = 'enermass.admin@gmail.com';
  const password = 'admin@123';

  console.log(`Checking if user ${email} exists...`);
  
  // 1. Get or create auth user
  let userId;
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
  
  if (listError) {
    console.error("Error listing users:", listError);
    return;
  }
  
  const existingUser = users.find(u => u.email === email);
  if (existingUser) {
    console.log(`User already exists with ID: ${existingUser.id}`);
    userId = existingUser.id;
    // Optional: update password to ensure it matches
    const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
      password: password,
      user_metadata: { role: 'admin' }
    });
    if (updateError) {
      console.error("Failed to update user password:", updateError);
    } else {
      console.log("Updated existing user password.");
    }
  } else {
    console.log(`Creating user ${email}...`);
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: 'admin' }
    });
    
    if (createError) {
      console.error("Error creating user:", createError);
      return;
    }
    
    userId = newUser.user.id;
    console.log(`Created user with ID: ${userId}`);
  }

  // 2. Ensure Organisation exists
  console.log("Checking for Organisation...");
  const { data: orgs, error: orgError } = await supabase
    .from('organisations')
    .select('id, name')
    .limit(1);

  if (orgError) {
    console.error("Error querying organisations:", orgError);
    return;
  }

  let orgId;
  if (orgs && orgs.length > 0) {
    orgId = orgs[0].id;
    console.log(`Found existing organisation '${orgs[0].name}' with ID: ${orgId}`);
  } else {
    console.log("Creating new organisation 'Enermass'...");
    const { data: newOrg, error: createOrgError } = await supabase
      .from('organisations')
      .insert({ name: 'Enermass', email: 'hello@enermass.com' })
      .select('id')
      .single();
      
    if (createOrgError) {
      console.error("Error creating organisation:", createOrgError);
      return;
    }
    orgId = newOrg.id;
    console.log(`Created organisation with ID: ${orgId}`);
  }

  // 3. Ensure Profile exists
  console.log("Checking for Profile...");
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .single();

  if (profileError && profileError.code !== 'PGRST116') {
    // PGRST116 means no rows found, which is fine
    console.error("Error querying profile:", profileError);
  }

  if (profile) {
    console.log(`Profile already exists for user ${userId}. Updating role...`);
    await supabase.from('profiles').update({ role: 'admin', org_id: orgId }).eq('id', userId);
  } else {
    console.log(`Creating profile for user ${userId}...`);
    const { error: createProfileError } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        org_id: orgId,
        full_name: 'Enermass Admin',
        role: 'admin',
        is_active: true
      });
      
    if (createProfileError) {
      console.error("Error creating profile:", createProfileError);
      return;
    }
    console.log("Profile created successfully.");
  }

  console.log("Done! User is ready.");
}

main().catch(console.error);
