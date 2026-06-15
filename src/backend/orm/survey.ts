import { supabase } from '@/lib/supabase/client';
import type { Database } from '@/lib/types/schema.types';

export type SurveyRow = any;
export type SurveyInsert = any;
export type SurveyUpdate = any;

export const SurveyORM = {
  async getByLeadId(leadId: string): Promise<SurveyRow[]> {
    const { data, error } = await supabase
      .from('crm_site_surveys')
      .select('*, profiles!conducted_by(full_name), profiles!waived_by(full_name)')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data as any;
  },

  async getByQuoteId(quoteId: string): Promise<SurveyRow | null> {
    // First resolve the internal UUID from quote_number
    const { data: quote, error: qErr } = await supabase
      .from('quotes')
      .select('id, lead_id')
      .eq('quote_number', quoteId)
      .maybeSingle();
    if (qErr) throw qErr;
    if (!quote?.lead_id) return null;

    const { data, error } = await supabase
      .from('crm_site_surveys')
      .select('*, profiles!conducted_by(full_name), profiles!waived_by(full_name)')
      .eq('lead_id', quote.lead_id)
      .in('status', ['completed', 'waived'])
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data as any;
  },

  /**
   * Get any survey for a lead (including scheduled/in_progress) 
   * so we can show survey state even when not yet completed.
   */
  async getLatestByLeadId(leadId: string): Promise<SurveyRow | null> {
    const { data, error } = await supabase
      .from('crm_site_surveys')
      .select('*, profiles!conducted_by(full_name), profiles!waived_by(full_name)')
      .eq('lead_id', leadId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data as any;
  },

  /**
   * Check if a quote's lead has a completed/waived survey.
   * Returns the survey row if gated, null if clear.
   */
  async checkGate(quoteNumber: string): Promise<{ blocked: boolean; survey: SurveyRow | null }> {
    const { data: quote } = await supabase
      .from('quotes')
      .select('id, lead_id')
      .eq('quote_number', quoteNumber)
      .maybeSingle();

    if (!quote?.lead_id) {
      // No lead linked → blocked (can't verify survey)
      return { blocked: true, survey: null };
    }

    const { data: survey } = await supabase
      .from('crm_site_surveys')
      .select('*')
      .eq('lead_id', quote.lead_id)
      .in('status', ['completed', 'waived'])
      .limit(1)
      .maybeSingle();

    return { blocked: !survey, survey: survey as any };
  },

  async create(payload: SurveyInsert): Promise<SurveyRow> {
    const { data, error } = await supabase
      .from('crm_site_surveys')
      .insert({ ...payload, updated_at: new Date().toISOString() })
      .select()
      .maybeSingle();
    if (error) throw error;
    return data as any;
  },

  async update(id: string, updates: SurveyUpdate): Promise<SurveyRow> {
    const { data, error } = await supabase
      .from('crm_site_surveys')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) throw error;
    return data as any;
  },

  async waive(
    leadId: string,
    orgId: string,
    waivedById: string,
    reason: string,
    quoteId?: string
  ): Promise<SurveyRow> {
    // Find existing survey for this lead or create a waived one
    const { data: existing } = await supabase
      .from('crm_site_surveys')
      .select('id')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      const { data, error } = await supabase
        .from('crm_site_surveys')
        .update({
          status: 'waived',
          waived_by: waivedById,
          waive_reason: reason,
          quote_id: quoteId ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select('*, profiles!waived_by(full_name)')
        .maybeSingle();
      if (error) throw error;
      return data as any;
    }

    // Create a new waived survey
    const { data, error } = await supabase
      .from('crm_site_surveys')
      .insert({
        org_id: orgId,
        lead_id: leadId,
        quote_id: quoteId ?? null,
        status: 'waived',
        waived_by: waivedById,
        waive_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .select('*, profiles!waived_by(full_name)')
      .maybeSingle();
    if (error) throw error;
    return data as any;
  },
};
