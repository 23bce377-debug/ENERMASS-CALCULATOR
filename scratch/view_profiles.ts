import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function viewProfiles() {
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data: profiles } = await adminClient.from('profiles').select('*');
  console.log('--- PROFILES ---');
  console.log(profiles);

  const { data: users } = await adminClient.auth.admin.listUsers();
  console.log('--- AUTH USERS ---');
  console.log(users.users.map(u => ({ id: u.id, email: u.email, app_metadata: u.app_metadata })));
}

viewProfiles();
