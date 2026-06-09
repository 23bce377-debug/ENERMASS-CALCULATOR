import { supabase } from '../../lib/supabase/client';
import type { Database } from '../../lib/types/schema.types';

export type SystemRow = Database['public']['Tables']['systems']['Row'];
export type SystemInsert = Database['public']['Tables']['systems']['Insert'];
export type SystemUpdate = Database['public']['Tables']['systems']['Update'];

export type SystemItemRow = Database['public']['Tables']['system_items']['Row'];
export type SystemItemInsert = Database['public']['Tables']['system_items']['Insert'];
export type SystemItemUpdate = Database['public']['Tables']['system_items']['Update'];

export const SystemORM = {
  async getAll(orgId?: string) {
    const query = supabase.from('systems').select('*');
    if (orgId) {
      query.or(`org_id.eq.${orgId},org_id.is.null`);
    } else {
      query.is('org_id', null);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async getById(id: string) {
    const { data, error } = await supabase
      .from('systems')
      .select('*, system_items(*)')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data as any;
  },

  async create(system: SystemInsert) {
    const { data, error } = await supabase
      .from('systems')
      .insert(system)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, updates: SystemUpdate) {
    const { data, error } = await supabase
      .from('systems')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('systems')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return true;
  }
};

export const SystemItemORM = {
  async getBySystemId(systemId: string) {
    const { data, error } = await supabase
      .from('system_items')
      .select('*')
      .eq('system_id', systemId)
      .order('sort_order', { ascending: true });
    if (error) throw error;
    return data;
  },

  async create(item: SystemItemInsert) {
    const { data, error } = await supabase
      .from('system_items')
      .insert(item)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, updates: SystemItemUpdate) {
    const { data, error } = await supabase
      .from('system_items')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('system_items')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return true;
  }
};
