import { createClient } from '@supabase/supabase-js';

async function checkUser() {
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data: users } = await adminClient.auth.admin.listUsers();
  const user = users.users.find(u => u.email === 'hrushibhainvadiya@gmail.com');
  if (!user) return console.log('User not found');

  const { data: profile } = await adminClient.from('profiles').select('*').eq('id', user.id).single();
  const { data: members } = await adminClient.from('org_members').select('*').eq('user_id', user.id);

  console.log('Profile org_id:', profile?.org_id);
  console.log('Members:', members?.map(m => m.org_id));
}

checkUser();
