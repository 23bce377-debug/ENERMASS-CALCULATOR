import { supabase } from '../../lib/supabase/client';
import type { Database } from '../../lib/types/schema.types';

// Types
export type QuoteRow = Database['public']['Tables']['quotes']['Row'];
export type QuoteInsert = Database['public']['Tables']['quotes']['Insert'] & {
  panel_id?: string;
  inverter_id?: string;
  battery_id?: string;
};
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
      .maybeSingle();
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
    // 1. Rate drift validation
    if (quote.panel_rate_per_panel !== undefined && quote.panel_rate_per_panel !== null) {
      if (quote.panel_id) {
        const { data: panel } = await supabase
          .from('eq_panels')
          .select('selling_price')
          .eq('id', quote.panel_id)
          .eq('is_active', true)
          .maybeSingle();
        if (panel) {
          const dbRate = Number(panel.selling_price);
          const submittedRate = Number(quote.panel_rate_per_panel);
          if (Math.abs(dbRate - submittedRate) > 1.0) {
            throw new Error(`Rate drift detected for Panel: Database rate is ${dbRate}, but submitted rate is ${submittedRate}`);
          }
        }
      } else if (quote.panel_brand_model) {
        const { data: panels } = await supabase
          .from('eq_panels')
          .select('selling_price, brand, model')
          .eq('is_active', true);
        const matched = panels?.find(p => 
          `${p.brand} ${p.model}`.toUpperCase().includes(String(quote.panel_brand_model).toUpperCase()) ||
          String(quote.panel_brand_model).toUpperCase().includes(`${p.brand} ${p.model}`.toUpperCase())
        );
        if (matched) {
          const dbRate = Number(matched.selling_price);
          const submittedRate = Number(quote.panel_rate_per_panel);
          if (Math.abs(dbRate - submittedRate) > 1.0) {
            throw new Error(`Rate drift detected for Panel: Database rate is ${dbRate}, but submitted rate is ${submittedRate}`);
          }
        }
      }
    }

    if (quote.inverter_rate !== undefined && quote.inverter_rate !== null) {
      if (quote.inverter_id) {
        const { data: inverter } = await supabase
          .from('eq_inverters')
          .select('selling_price')
          .eq('id', quote.inverter_id)
          .eq('is_active', true)
          .maybeSingle();
        if (inverter) {
          const dbRate = Number(inverter.selling_price);
          const submittedRate = Number(quote.inverter_rate);
          if (Math.abs(dbRate - submittedRate) > 1.0) {
            throw new Error(`Rate drift detected for Inverter: Database rate is ${dbRate}, but submitted rate is ${submittedRate}`);
          }
        }
      } else if (quote.inverter_brand_model) {
        const { data: inverters } = await supabase
          .from('eq_inverters')
          .select('selling_price, brand, model')
          .eq('is_active', true);
        const matched = inverters?.find(inv => 
          `${inv.brand} ${inv.model}`.toUpperCase().includes(String(quote.inverter_brand_model).toUpperCase()) ||
          String(quote.inverter_brand_model).toUpperCase().includes(`${inv.brand} ${inv.model}`.toUpperCase())
        );
        if (matched) {
          const dbRate = Number(matched.selling_price);
          const submittedRate = Number(quote.inverter_rate);
          if (Math.abs(dbRate - submittedRate) > 1.0) {
            throw new Error(`Rate drift detected for Inverter: Database rate is ${dbRate}, but submitted rate is ${submittedRate}`);
          }
        }
      }
    }

    if (quote.battery_rate !== undefined && quote.battery_rate !== null) {
      if (quote.battery_id) {
        const { data: battery } = await supabase
          .from('eq_batteries')
          .select('selling_price')
          .eq('id', quote.battery_id)
          .eq('is_active', true)
          .maybeSingle();
        if (battery) {
          const dbRate = Number(battery.selling_price);
          const submittedRate = Number(quote.battery_rate);
          if (Math.abs(dbRate - submittedRate) > 1.0) {
            throw new Error(`Rate drift detected for Battery: Database rate is ${dbRate}, but submitted rate is ${submittedRate}`);
          }
        }
      } else if (quote.battery_brand_model) {
        const { data: batteries } = await supabase
          .from('eq_batteries')
          .select('selling_price, brand, model')
          .eq('is_active', true);
        const matched = batteries?.find(b => 
          `${b.brand} ${b.model}`.toUpperCase().includes(String(quote.battery_brand_model).toUpperCase()) ||
          String(quote.battery_brand_model).toUpperCase().includes(`${b.brand} ${b.model}`.toUpperCase())
        );
        if (matched) {
          const dbRate = Number(matched.selling_price);
          const submittedRate = Number(quote.battery_rate);
          if (Math.abs(dbRate - submittedRate) > 1.0) {
            throw new Error(`Rate drift detected for Battery: Database rate is ${dbRate}, but submitted rate is ${submittedRate}`);
          }
        }
      }
    }

    // 2. Perform insert, excluding non-database columns panel_id, inverter_id, battery_id
    const { panel_id, inverter_id, battery_id, ...dbQuote } = quote;
    const { data, error } = await supabase
      .from('quotes')
      .insert(dbQuote)
      .select()
      .maybeSingle();
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
      .maybeSingle();

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
      .maybeSingle();
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
      .maybeSingle();
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
      .maybeSingle();
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
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async update(id: string, updates: QuoteVariantUpdate) {
    const { data, error } = await supabase
      .from('quote_variants')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle();
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
