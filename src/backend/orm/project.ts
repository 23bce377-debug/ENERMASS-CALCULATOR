import { supabase } from '@/lib/supabase/client';

export interface Project {
  id: string;
  org_id: string;
  quote_id: string;
  project_number: string;
  status: 'draft' | 'survey_phase' | 'engineering_design' | 'permitting' | 'material_dispatched' | 'installation_started' | 'net_metering_pending' | 'commissioned' | 'closed' | 'cancelled';
  assigned_pm_id?: string;
  planned_start?: string;
  planned_end?: string;
  actual_start?: string;
  actual_end?: string;
  created_at: string;
  updated_at: string;
  version: number;
}

export interface ProjectMilestone {
  id: string;
  project_id: string;
  milestone: 'survey_approved' | 'structural_design_freeze' | 'civil_foundation_done' | 'panel_installation_done' | 'inverter_wiring_done' | 'net_metering_approved' | 'discom_charging' | 'handover';
  target_date: string;
  actual_date?: string;
  status: 'pending' | 'completed' | 'overdue';
  completed_by?: string;
  updated_at: string;
}

export interface SiteSurvey {
  id: string;
  project_id: string;
  surveyor_id?: string;
  surveyed_at?: string;
  roof_mount_type: string;
  tilt_angle_deg?: number;
  usable_area_sqft?: number;
  roof_load_capacity_kgm2?: number;
  distribution_distance_m?: number;
  shading_percentage?: number;
  solar_access_pct?: number;
  survey_notes?: string;
  gps_lat?: number;
  gps_lng?: number;
  created_at: string;
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
        epc_project_milestones(*),
        epc_site_surveys(*),
        profiles(id, full_name)
      `)
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async updateStatus(id: string, status: string, version: number) {
    const updates: any = { status, updated_at: new Date().toISOString() };
    if (status === 'commissioned') {
      updates.actual_end = new Date().toISOString().split('T')[0];
    } else if (status === 'survey_phase' && !updates.actual_start) {
      updates.actual_start = new Date().toISOString().split('T')[0];
    }
    
    const { data, error } = await supabase
      .from('epc_projects')
      .update(updates)
      .eq('id', id)
      .eq('version', version)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async assignPM(id: string, pmId: string | null) {
    const { data, error } = await supabase
      .from('epc_projects')
      .update({ assigned_pm_id: pmId, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateMilestone(milestoneId: string, status: 'pending' | 'completed' | 'overdue', actualDate: string | null, userId?: string) {
    const updates: any = {
      status,
      actual_date: actualDate,
      completed_by: status === 'completed' ? userId : null,
      updated_at: new Date().toISOString()
    };
    const { data, error } = await supabase
      .from('epc_project_milestones')
      .update(updates)
      .eq('id', milestoneId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async saveSiteSurvey(survey: Partial<SiteSurvey>) {
    const { data, error } = await supabase
      .from('epc_site_surveys')
      .upsert(survey as any, { onConflict: 'project_id' })
      .select()
      .single();
    if (error) throw error;
    return data;
  }
};
