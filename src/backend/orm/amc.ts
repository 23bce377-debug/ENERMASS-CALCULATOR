import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/types/schema.types';

export type AmcContractRow = Database['public']['Tables']['field_amc_contracts']['Row'];
export type AmcContractInsert = Database['public']['Tables']['field_amc_contracts']['Insert'];
export type AmcContractUpdate = Database['public']['Tables']['field_amc_contracts']['Update'];

export const AmcContractORM = {
  async getAll(orgId: string) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('field_amc_contracts')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async getById(id: string) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('field_amc_contracts')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async create(contract: Omit<AmcContractInsert, 'org_id'> & { org_id?: string }) {
    const supabase = await createClient();
    
    // Auto-inject org_id from session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('Unauthorized or session expired');
    }
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('org_id')
      .eq('id', user.id)
      .maybeSingle();
    if (profileError || !profile) {
      throw new Error('User profile or organization not found');
    }

    const payload = {
      ...contract,
      org_id: profile.org_id
    };

    const { data, error } = await supabase
      .from('field_amc_contracts')
      .insert(payload)
      .select()
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async update(id: string, updates: AmcContractUpdate) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('field_amc_contracts')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async incrementVisits(id: string) {
    const supabase = await createClient();
    // Fetch current completed_visits
    const { data: current, error: fetchErr } = await supabase
      .from('field_amc_contracts')
      .select('completed_visits, visits_per_year')
      .eq('id', id)
      .maybeSingle();
    if (fetchErr) throw fetchErr;

    const newCompleted = Math.min((current?.completed_visits || 0) + 1, current?.visits_per_year || 0);

    const { data, error } = await supabase
      .from('field_amc_contracts')
      .update({ completed_visits: newCompleted })
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) throw error;
    return data;
  }
};
