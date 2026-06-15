import { supabase } from '../../lib/supabase/client';
import type { Database } from '../../lib/types/schema.types';

export type OrganisationRow = Database['public']['Tables']['organisations']['Row'];
export type OrganisationInsert = Database['public']['Tables']['organisations']['Insert'];
export type OrganisationUpdate = Database['public']['Tables']['organisations']['Update'];

export const OrganisationORM = {
  async getById(id: string) {
    const { data, error } = await supabase
      .from('organisations')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async getAll() {
    const { data, error } = await supabase
      .from('organisations')
      .select('*');
    if (error) throw error;
    return data;
  },

  async create(org: OrganisationInsert) {
    const { data, error } = await supabase
      .from('organisations')
      .insert(org)
      .select()
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async update(id: string, updates: OrganisationUpdate) {
    const { data, error } = await supabase
      .from('organisations')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('organisations')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return true;
  }
};
