import { createClient } from '@/lib/supabase/server';

export async function getCurrentOrgId(): Promise<string> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthenticated');
  
  // The schema defines profiles as having the org_id, not users
  const { data, error } = await supabase
    .from('profiles')
    .select('org_id')
    .eq('id', user.id)
    .maybeSingle();
  
  if (error) {
    throw new Error(`Failed to fetch current organisation: ${error.message}`);
  }

  if (!data?.org_id) {
    throw new Error('User has no org_id — cannot proceed');
  }
  
  return data.org_id;
}
