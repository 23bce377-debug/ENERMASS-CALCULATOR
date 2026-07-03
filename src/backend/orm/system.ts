import { supabase } from '../../lib/supabase/client';
import type { Database } from '../../lib/types/schema.types';

export type SystemRow = Database['public']['Tables']['systems']['Row'];
export type SystemInsert = Database['public']['Tables']['systems']['Insert'];
export type SystemUpdate = Database['public']['Tables']['systems']['Update'];

export type SystemItemRow = Database['public']['Tables']['system_items']['Row'];
export type SystemItemInsert = Database['public']['Tables']['system_items']['Insert'];
export type SystemItemUpdate = Database['public']['Tables']['system_items']['Update'];

function normalizeMarginPct(value: unknown, fallback = 0.2): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return fallback;
  return num > 1 ? num / 100 : num;
}

function mapDatabaseError(error: any, fallbackMessage: string): Error {
  if (!error) return new Error(fallbackMessage);
  const msg = (error.message || '').toLowerCase();
  const code = error.code || '';
  if (msg.includes('row-level security') || msg.includes('violates row-level security policy') || code === '42501') {
    if (msg.includes('system_state_availability')) {
      return new Error('You do not have permission to assign this preset to the selected state. Please contact your administrator.');
    }
    if (msg.includes('systems') || msg.includes('system_items')) {
      return new Error('You do not have permission to modify system presets. Please contact your administrator.');
    }
    return new Error('Access Denied: You do not have the required permissions to perform this action.');
  }
  return new Error(`${fallbackMessage}: ${error.message}`);
}

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
      state_id?: string | null;
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
    if (!metadata.state_id) {
      throw new Error('Please select a state before saving a system preset.');
    }

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
        state_id: metadata.state_id,
        target_margin_pct: normalizeMarginPct(metadata.target_margin_pct),
        updated_at: new Date().toISOString()
      }).eq('id', existingSystemId);
      if (sysErr) throw mapDatabaseError(sysErr, 'Failed to update system metadata');
      
      // Delete old items
      await supabase.from('system_items').delete().eq('system_id', existingSystemId);
    } else {
      // Create new
      const { data: newSys, error: sysErr } = await supabase.from('systems').insert({
        org_id: orgId,
        name: metadata.name,
        capacity_kw: metadata.capacity_kw,
        category: (metadata.category || 'on_grid') as any,
        state_id: metadata.state_id,
        target_margin_pct: normalizeMarginPct(metadata.target_margin_pct),
        is_active: true,
        is_custom: metadata.is_custom ?? true
      }).select().maybeSingle();
      if (sysErr) throw mapDatabaseError(sysErr, 'Failed to create system preset');
      systemId = newSys.id;
    }

    if (!systemId) throw new Error('Failed to determine system ID');

    await (supabase as any)
      .from('system_state_availability')
      .delete()
      .eq('system_id', systemId);

    const { error: stateErr } = await (supabase as any)
      .from('system_state_availability')
      .insert({ system_id: systemId, state_id: metadata.state_id });
    if (stateErr) throw mapDatabaseError(stateErr, 'Failed to update preset state');

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
        throw mapDatabaseError(itemsErr, 'Failed to insert new system items');
      }
    }

    return systemId;
  }
};
