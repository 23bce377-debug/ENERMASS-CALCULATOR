import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function confirmEmail() {
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  console.log('Fetching users...');
  const { data: { users }, error: listError } = await adminClient.auth.admin.listUsers();
  if (listError) {
    console.error('Error listing users:', listError);
    return;
  }

  const unconfirmed = users.filter(u => !u.email_confirmed_at);
  if (unconfirmed.length === 0) {
    console.log('No unconfirmed users found.');
    return;
  }

  for (const user of unconfirmed) {
    console.log(`Confirming email for ${user.email} (ID: ${user.id})...`);
    const { data, error } = await adminClient.auth.admin.updateUserById(
      user.id,
      { email_confirm: true }
    );
    if (error) {
      console.error(`Failed to confirm ${user.email}:`, error);
    } else {
      console.log(`Successfully confirmed ${user.email}. Confirmed at: ${data.user?.email_confirmed_at}`);
    }
  }
}

confirmEmail();
