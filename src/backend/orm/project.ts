import { supabase } from '@/lib/supabase/client';

export interface Project {
  id: string;
  org_id: string;
  quote_id: string;
  project_number: string;
  status: 'draft' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled';
  assigned_pm_id?: string;
  planned_start?: string;
  planned_end?: string;
  actual_start?: string;
  actual_end?: string;
  project_notes?: string;
  created_at: string;
  updated_at: string;
  version: number;
}

export const ProjectORM = {
  async getAll(orgId: string) {
    const { data, error } = await supabase
      .from('epc_projects')
      .select('*, quotes(customer_name, customer_phone, system_name, system_capacity_kw, project_type), profiles(full_name)')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async getById(id: string) {
    const { data, error } = await supabase
      .from('epc_projects')
      .select(`
        *,
        quotes(*),
        profiles(id, full_name)
      `)
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async updateStatus(id: string, status: string, version: number) {
    const updates: any = { status, updated_at: new Date().toISOString() };
    if (status === 'completed') {
      updates.actual_end = new Date().toISOString().split('T')[0];
    } else if (status === 'in_progress' && !updates.actual_start) {
      updates.actual_start = new Date().toISOString().split('T')[0];
    }

    const { data, error } = await supabase
      .from('epc_projects')
      .update(updates)
      .eq('id', id)
      .eq('version', version)
      .select()
      .maybeSingle();
    if (error) throw error;

    return data;
  },

  async updateNotes(id: string, projectNotes: string) {
    const { data, error } = await supabase
      .from('epc_projects')
      .update({ project_notes: projectNotes, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async assignPM(id: string, pmId: string | null) {
    const { data, error } = await supabase
      .from('epc_projects')
      .update({ assigned_pm_id: pmId, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async create(project: {
    org_id: string;
    quote_id?: string | null;
    project_number: string;
    status: string;
    assigned_pm_id?: string | null;
    planned_start?: string | null;
    planned_end?: string | null;
    project_notes?: string | null;
  }) {
    const { data: newProject, error: projectError } = await supabase
      .from('epc_projects')
      .insert({
        ...project,
        version: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
    if (projectError) throw projectError;

    return newProject;
  }
};
