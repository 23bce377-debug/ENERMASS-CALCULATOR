import { supabase } from '../../lib/supabase/client';
import type { Database } from '../../lib/types/schema.types';

// Types
export type QuoteRow = Database['public']['Tables']['quotes']['Row'];
export type QuoteInsert = Database['public']['Tables']['quotes']['Insert'];
export type QuoteUpdate = Database['public']['Tables']['quotes']['Update'];

export type QuoteItemRow = Database['public']['Tables']['quote_items']['Row'];
export type QuoteItemInsert = Database['public']['Tables']['quote_items']['Insert'];
export type QuoteItemUpdate = Database['public']['Tables']['quote_items']['Update'];

export type QuoteAdditionalCostRow = Database['public']['Tables']['quote_additional_costs']['Row'];
export type QuoteAdditionalCostInsert = Database['public']['Tables']['quote_additional_costs']['Insert'];
export type QuoteAdditionalCostUpdate = Database['public']['Tables']['quote_additional_costs']['Update'];

export type QuoteStatusHistoryRow = Database['public']['Tables']['quote_status_history']['Row'];
export type QuoteStatusHistoryInsert = Database['public']['Tables']['quote_status_history']['Insert'];

export type QuoteVariantRow = Database['public']['Tables']['quote_variants']['Row'];
export type QuoteVariantInsert = Database['public']['Tables']['quote_variants']['Insert'];
export type QuoteVariantUpdate = Database['public']['Tables']['quote_variants']['Update'];

// ORMs
export const QuoteORM = {
  async getById(id: string) {
    const { data, error } = await supabase
      .from('quotes')
      .select('*, quote_items(*), quote_additional_costs(*), quote_variants(*)')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data as any;
  },

  async getAll(orgId: string) {
    const { data, error } = await supabase
      .from('quotes')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async create(quote: QuoteInsert) {
    const { data, error } = await supabase
      .from('quotes')
      .insert(quote)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, updates: QuoteUpdate, expectedVersion?: number) {
    let query = supabase
      .from('quotes')
      .update(updates)
      .eq('id', id);

    if (expectedVersion !== undefined && expectedVersion !== null) {
      query = query.eq('version', expectedVersion);
    }

    const { data, error } = await query
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        const err = new Error('Concurrency conflict: The quote has been modified by another user. Please refresh and try again.');
        (err as any).status = 409;
        (err as any).code = 'CONCURRENCY_CONFLICT';
        throw err;
      }
      throw error;
    }
    return data;
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('quotes')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return true;
  }
};

export const QuoteItemORM = {
  async getByQuoteId(quoteId: string) {
    const { data, error } = await supabase
      .from('quote_items')
      .select('*')
      .eq('quote_id', quoteId)
      .order('sort_order', { ascending: true });
    if (error) throw error;
    return data;
  },

  async createMany(items: QuoteItemInsert[]) {
    const { data, error } = await supabase
      .from('quote_items')
      .insert(items)
      .select();
    if (error) throw error;
    return data;
  },

  async update(id: string, updates: QuoteItemUpdate) {
    const { data, error } = await supabase
      .from('quote_items')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('quote_items')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return true;
  }
};

export const QuoteAdditionalCostORM = {
  async getByQuoteId(quoteId: string) {
    const { data, error } = await supabase
      .from('quote_additional_costs')
      .select('*')
      .eq('quote_id', quoteId)
      .order('sort_order', { ascending: true });
    if (error) throw error;
    return data;
  },

  async create(cost: QuoteAdditionalCostInsert) {
    const { data, error } = await supabase
      .from('quote_additional_costs')
      .insert(cost)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('quote_additional_costs')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return true;
  }
};

export const QuoteStatusHistoryORM = {
  async getByQuoteId(quoteId: string) {
    const { data, error } = await supabase
      .from('quote_status_history')
      .select('*')
      .eq('quote_id', quoteId)
      .order('changed_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async create(log: QuoteStatusHistoryInsert) {
    const { data, error } = await supabase
      .from('quote_status_history')
      .insert(log)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
};

export const QuoteVariantORM = {
  async getByQuoteId(quoteId: string) {
    const { data, error } = await supabase
      .from('quote_variants')
      .select('*')
      .eq('quote_id', quoteId);
    if (error) throw error;
    return data;
  },

  async create(variant: QuoteVariantInsert) {
    const { data, error } = await supabase
      .from('quote_variants')
      .insert(variant)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, updates: QuoteVariantUpdate) {
    const { data, error } = await supabase
      .from('quote_variants')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('quote_variants')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return true;
  }
};
