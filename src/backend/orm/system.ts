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
      .maybeSingle();
    if (error) throw error;
    return data as any;
  },

  async create(system: SystemInsert) {
    const { data, error } = await supabase
      .from('systems')
      .insert(system)
      .select()
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async update(id: string, updates: SystemUpdate) {
    const { data, error } = await supabase
      .from('systems')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle();
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
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async update(id: string, updates: SystemItemUpdate) {
    const { data, error } = await supabase
      .from('system_items')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle();
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
  },

  async saveFullSystem(
    metadata: {
      name: string;
      capacity_kw: number;
      category?: string;
      target_margin_pct?: number;
      is_custom?: boolean;
    },
    lines: Array<{
      description: string;
      effectiveQty: number;
      unit?: string;
      categoryId?: string;
      isIncludedByDefault?: boolean;
      remarks?: string;
    }>,
    existingSystemId?: string
  ) {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    let orgId = null;
    if (userId) {
      const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', userId).maybeSingle();
      orgId = profile?.org_id;
    }

    let systemId = existingSystemId;

    if (existingSystemId) {
      // Update existing
      const { error: sysErr } = await supabase.from('systems').update({
        name: metadata.name,
        capacity_kw: metadata.capacity_kw,
        category: (metadata.category || 'on_grid') as any,
        target_margin_pct: metadata.target_margin_pct || 20,
        updated_at: new Date().toISOString()
      }).eq('id', existingSystemId);
      if (sysErr) throw sysErr;
      
      // Delete old items
      await supabase.from('system_items').delete().eq('system_id', existingSystemId);
    } else {
      // Create new
      const { data: newSys, error: sysErr } = await supabase.from('systems').insert({
        org_id: orgId,
        name: metadata.name,
        capacity_kw: metadata.capacity_kw,
        category: (metadata.category || 'on_grid') as any,
        target_margin_pct: metadata.target_margin_pct || 20,
        is_active: true,
        is_custom: metadata.is_custom ?? true
      }).select().maybeSingle();
      if (sysErr) throw sysErr;
      systemId = newSys.id;
    }

    if (!systemId) throw new Error('Failed to determine system ID');

    // Insert new items
    if (lines && lines.length > 0) {
      const itemsToInsert = lines.map((line, idx) => ({
        system_id: systemId!,
        section: (line.categoryId || 'mounting_structure') as any,
        description: line.description,
        unit: line.unit || 'Nos',
        default_qty: line.effectiveQty,
        sort_order: idx + 1,
        is_included_by_default: line.isIncludedByDefault ?? true,
        is_mandatory: true,
        remarks: line.remarks
      }));
      
      const { error: itemsErr } = await supabase.from('system_items').insert(itemsToInsert);
      if (itemsErr) {
        console.error('Error inserting items:', itemsErr);
        throw itemsErr;
      }
    }

    return systemId;
  }
};
