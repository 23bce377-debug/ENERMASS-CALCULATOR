import { supabase } from '../../lib/supabase/client';
import type { Database } from '../../lib/types/schema.types';

// Types
export type StateRuleRow = Database['public']['Tables']['state_rules']['Row'];
export type StateRuleInsert = Database['public']['Tables']['state_rules']['Insert'];
export type StateRuleUpdate = Database['public']['Tables']['state_rules']['Update'];

export type CalculationSchemeRow = Database['public']['Tables']['calculation_schemes']['Row'];
export type CalculationSchemeInsert = Database['public']['Tables']['calculation_schemes']['Insert'];
export type CalculationSchemeUpdate = Database['public']['Tables']['calculation_schemes']['Update'];

export type SchemeSlabRow = Database['public']['Tables']['scheme_slabs']['Row'];
export type SchemeSlabInsert = Database['public']['Tables']['scheme_slabs']['Insert'];
export type SchemeSlabUpdate = Database['public']['Tables']['scheme_slabs']['Update'];

export type StateSchemeOverrideRow = Database['public']['Tables']['state_scheme_overrides']['Row'];
export type StateSchemeOverrideInsert = Database['public']['Tables']['state_scheme_overrides']['Insert'];
export type StateSchemeOverrideUpdate = Database['public']['Tables']['state_scheme_overrides']['Update'];

export type CategoryMarginRow = Database['public']['Tables']['category_margins']['Row'];
export type CategoryMarginInsert = Database['public']['Tables']['category_margins']['Insert'];
export type CategoryMarginUpdate = Database['public']['Tables']['category_margins']['Update'];

export type QuoteFormatTemplateRow = Database['public']['Tables']['quote_format_templates']['Row'];
export type QuoteFormatTemplateInsert = Database['public']['Tables']['quote_format_templates']['Insert'];
export type QuoteFormatTemplateUpdate = Database['public']['Tables']['quote_format_templates']['Update'];

export type AppSettingRow = Database['public']['Tables']['app_settings']['Row'];
export type AppSettingInsert = Database['public']['Tables']['app_settings']['Insert'];
export type AppSettingUpdate = Database['public']['Tables']['app_settings']['Update'];

// ORMs
export const StateRuleORM = {
  async getAll() {
    const { data, error } = await supabase.from('state_rules').select('*').eq('is_active', true);
    if (error) throw error;
    return data;
  },
  async getByCode(code: string) {
    const { data, error } = await supabase.from('state_rules').select('*').eq('state_code', code).maybeSingle();
    if (error) throw error;
    return data;
  },
  async create(item: StateRuleInsert) {
    const { data, error } = await supabase.from('state_rules').insert(item).select().maybeSingle();
    if (error) throw error;
    return data;
  },
  async update(id: string, updates: StateRuleUpdate) {
    const { data, error } = await supabase.from('state_rules').update(updates).eq('id', id).select().maybeSingle();
    if (error) throw error;
    return data;
  }
};

export const CalculationSchemeORM = {
  async getAll() {
    const { data, error } = await supabase.from('calculation_schemes').select('*, scheme_slabs(*)').eq('is_active', true);
    if (error) throw error;
    return data as any;
  },
  async getById(id: string) {
    const { data, error } = await supabase.from('calculation_schemes').select('*, scheme_slabs(*)').eq('id', id).maybeSingle();
    if (error) throw error;
    return data as any;
  },
  async create(item: CalculationSchemeInsert) {
    const { data, error } = await supabase.from('calculation_schemes').insert(item).select().maybeSingle();
    if (error) throw error;
    return data;
  },
  async update(id: string, updates: CalculationSchemeUpdate) {
    const { data, error } = await supabase.from('calculation_schemes').update(updates).eq('id', id).select().maybeSingle();
    if (error) throw error;
    return data;
  }
};

export const SchemeSlabORM = {
  async getBySchemeId(schemeId: string) {
    const { data, error } = await supabase.from('scheme_slabs').select('*').eq('scheme_id', schemeId).order('slab_index', { ascending: true });
    if (error) throw error;
    return data;
  },
  async create(item: SchemeSlabInsert) {
    const { data, error } = await supabase.from('scheme_slabs').insert(item).select().maybeSingle();
    if (error) throw error;
    return data;
  }
};

export const StateSchemeOverrideORM = {
  async getByStateId(stateId: string) {
    const { data, error } = await supabase.from('state_scheme_overrides').select('*').eq('state_id', stateId);
    if (error) throw error;
    return data;
  },
  async create(item: StateSchemeOverrideInsert) {
    const { data, error } = await supabase.from('state_scheme_overrides').insert(item).select().maybeSingle();
    if (error) throw error;
    return data;
  }
};

export const CategoryMarginORM = {
  async getByOrgId(orgId: string) {
    const { data, error } = await supabase.from('category_margins').select('*').eq('org_id', orgId);
    if (error) throw error;
    return data;
  },
  async create(item: CategoryMarginInsert) {
    const { data, error } = await supabase.from('category_margins').insert(item).select().maybeSingle();
    if (error) throw error;
    return data;
  },
  async update(id: string, updates: CategoryMarginUpdate) {
    const { data, error } = await supabase.from('category_margins').update(updates).eq('id', id).select().maybeSingle();
    if (error) throw error;
    return data;
  }
};

export const QuoteFormatTemplateORM = {
  async getAll(orgId?: string) {
    const query = supabase.from('quote_format_templates').select('*');
    if (orgId) {
      query.or(`org_id.eq.${orgId},org_id.is.null`);
    } else {
      query.is('org_id', null);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },
  async create(item: QuoteFormatTemplateInsert) {
    const { data, error } = await supabase.from('quote_format_templates').insert(item).select().maybeSingle();
    if (error) throw error;
    return data;
  },
  async update(id: string, updates: QuoteFormatTemplateUpdate) {
    const { data, error } = await supabase.from('quote_format_templates').update(updates).eq('id', id).select().maybeSingle();
    if (error) throw error;
    return data;
  }
};

export const AppSettingORM = {
  async getByOrgId(orgId: string) {
    const { data, error } = await supabase.from('app_settings').select('*').eq('org_id', orgId).maybeSingle();
    if (error) throw error;
    return data;
  },
  async create(item: AppSettingInsert) {
    const { data, error } = await supabase.from('app_settings').insert(item).select().maybeSingle();
    if (error) throw error;
    return data;
  },
  async update(orgId: string, updates: AppSettingUpdate) {
    const { data, error } = await supabase.from('app_settings').update(updates).eq('org_id', orgId).select().maybeSingle();
    if (error) throw error;
    return data;
  }
};
