import { supabase } from '@/lib/supabase/client';
import type { Database } from '@/lib/types/schema.types';

const createClient = async () => supabase;

export type LeadRow = Database['public']['Tables']['crm_leads']['Row'];
export type LeadInsert = Database['public']['Tables']['crm_leads']['Insert'];
export type LeadUpdate = Database['public']['Tables']['crm_leads']['Update'];

export type OpportunityRow = Database['public']['Tables']['crm_opportunities']['Row'];
export type OpportunityInsert = Database['public']['Tables']['crm_opportunities']['Insert'];
export type OpportunityUpdate = Database['public']['Tables']['crm_opportunities']['Update'];

export type TimelineRow = Database['public']['Tables']['crm_timeline']['Row'];
export type TimelineInsert = Database['public']['Tables']['crm_timeline']['Insert'];

export const LeadORM = {
  async getAll(orgId: string) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('crm_leads')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async getById(id: string) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('crm_leads')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async create(lead: Omit<LeadInsert, 'org_id'> & { org_id?: string }) {
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
      ...lead,
      org_id: profile.org_id
    };

    const { data, error } = await supabase
      .from('crm_leads')
      .insert(payload)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Failed to create lead');

    // Log timeline event
    await TimelineORM.createEvent({
      lead_id: data.id,
      title: 'Lead Created',
      description: `Lead for ${data.first_name} ${data.last_name || ''} created successfully.`,
      event_type: 'lead_created',
      logged_by: user.id
    });

    return data;
  },

  async update(id: string, updates: LeadUpdate) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('crm_leads')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async updateStatus(id: string, status: LeadRow['status']) {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Get old status
    const { data: oldLead, error: oldLeadError } = await supabase
      .from('crm_leads')
      .select('status')
      .eq('id', id)
      .maybeSingle();
    if (oldLeadError) throw oldLeadError;

    const { data, error } = await supabase
      .from('crm_leads')
      .update({ status })
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) throw error;

    // Log status changed event
    await TimelineORM.createEvent({
      lead_id: id,
      title: 'Status Changed',
      description: `Lead status updated from ${oldLead?.status || 'Unknown'} to ${status}.`,
      event_type: 'status_changed',
      logged_by: user.id
    });

    return data;
  },

  async delete(id: string) {
    const supabase = await createClient();
    // 1. Delete timeline events
    await supabase.from('crm_timeline' as any).delete().eq('lead_id', id);
    // 2. Delete site surveys
    await supabase.from('crm_site_surveys' as any).delete().eq('lead_id', id);
    // 3. Delete opportunities
    await supabase.from('crm_opportunities').delete().eq('lead_id', id);
    // 4. Delete the lead itself
    const { error } = await supabase.from('crm_leads').delete().eq('id', id);
    if (error) throw error;
    return true;
  }
};

export const OpportunityORM = {
  async getAll(orgId: string) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('crm_opportunities')
      .select('*, crm_leads(*)')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data as any[];
  },

  async create(opportunity: Omit<OpportunityInsert, 'org_id'> & { org_id?: string }) {
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
      ...opportunity,
      org_id: profile.org_id
    };

    const { data, error } = await supabase
      .from('crm_opportunities')
      .insert(payload)
      .select()
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async update(id: string, updates: OpportunityUpdate) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('crm_opportunities')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) throw error;
    return data;
  }
};

export const TimelineORM = {
  async getByLeadId(leadId: string) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('crm_timeline')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async createEvent(event: TimelineInsert) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('crm_timeline')
      .insert(event)
      .select()
      .maybeSingle();
    if (error) throw error;
    return data;
  }
};
