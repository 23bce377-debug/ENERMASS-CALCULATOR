import { supabase } from '@/lib/supabase/client';
import { SurveyORM } from '@/backend/orm/survey';

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
  milestone: 'survey_approved' | 'structural_design_freeze' | 'civil_foundation_done' | 'concrete_curing' | 'panel_installation_done' | 'inverter_wiring_done' | 'net_metering_approved' | 'discom_charging' | 'handover';
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
  sanctioned_load_kw?: number;
  meter_phase?: string;
  distance_panel_to_inverter_m?: number;
  distance_inverter_to_meter_m?: number;
  roof_height_ft?: number;
  discom_name?: string;
  consumer_number?: string;
  net_metering_available?: boolean;
  photo_urls?: string[];
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
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async updateStatus(id: string, status: string, version: number) {
    const updates: any = { status, updated_at: new Date().toISOString() };
    if (status === 'commissioned') {
      updates.actual_end = new Date().toISOString().split('T')[0];
      
      const { data: proj } = await supabase.from('epc_projects').select('org_id, project_number, assigned_pm_id').eq('id', id).maybeSingle();
      if (proj) {
        const { data: payments } = await supabase
          .from('vendor_payments')
          .select('retention_amount')
          .eq('project_id', id)
          .is('retention_released_at', null);

        const totalRetention = (payments || []).reduce((sum: number, p: any) => sum + Number(p.retention_amount || 0), 0);

        if (totalRetention > 0) {
          // If no assigned PM, fallback to a dummy uuid that satisfies the type system 
          // (assuming no strict FK, or we would query for admin)
          await supabase.from('sys_notifications').insert({
            org_id: proj.org_id,
            recipient_id: proj.assigned_pm_id || '00000000-0000-0000-0000-000000000000',
            title: `Release vendor retention — ${proj.project_number || id}`,
            body: `Commissioning complete. Release ₹${totalRetention.toLocaleString('en-IN')} in vendor retention across all purchase orders for this project. Requires finance manager approval before payment.`,
            is_read: false
          });
          console.log(`[FINANCE NOTIFICATION] Triggered retention release notification for ${id}.`);
        }
      }
      
    } else if (status === 'survey_phase' && !updates.actual_start) {
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

    if (status === 'net_metering_pending') {
      // Auto-create net_metering_applications record
      const { data: projectData } = await supabase.from('epc_projects').select('quote_id').eq('id', id).maybeSingle();
      if (projectData?.quote_id) {
        const { data: surveyData } = await supabase.from('crm_site_surveys').select('discom_name, consumer_number').eq('quote_id', projectData.quote_id).order('created_at', { ascending: false }).limit(1).maybeSingle();
        
        // Only insert if it doesn't already exist
        const { data: existingApp } = await supabase.from('net_metering_applications').select('id').eq('project_id', id).maybeSingle();
        if (!existingApp) {
          await supabase.from('net_metering_applications').insert({
            project_id: id,
            discom_name: surveyData?.discom_name || 'Pending DISCOM',
            consumer_number: surveyData?.consumer_number || 'Pending Consumer No',
            current_stage: 'feasibility',
            application_date: new Date().toISOString()
          });
          console.log(`[NET METERING] Auto-created application for project ${id}`);
        }
      }
    }

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
      .maybeSingle();
    if (error) throw error;

    // Inject Concrete Curing milestone if civil is done
    if (status === 'completed' && data && data.milestone === 'civil_foundation_done') {
      const curingDate = new Date(actualDate || new Date().toISOString());
      curingDate.setDate(curingDate.getDate() + 7);
      
      const { error: curingErr } = await supabase
        .from('epc_project_milestones')
        .insert({
          project_id: data.project_id,
          milestone: 'concrete_curing' as any,
          target_date: curingDate.toISOString().split('T')[0],
          status: 'pending'
        });
      if (curingErr) console.error('Failed to inject concrete curing milestone:', curingErr);
    }

    return data;
  },

  async saveSiteSurvey(survey: Partial<SiteSurvey>) {
    const { data, error } = await supabase
      .from('epc_site_surveys')
      .upsert(survey as any, { onConflict: 'project_id' })
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

    // Initialize milestones for the project
    const milestones = [
      { milestone: 'survey_approved', target: 5 },
      { milestone: 'structural_design_freeze', target: 12 },
      { milestone: 'civil_foundation_done', target: 20 },
      { milestone: 'panel_installation_done', target: 28 },
      { milestone: 'inverter_wiring_done', target: 33 },
      { milestone: 'net_metering_approved', target: 45 },
      { milestone: 'discom_charging', target: 50 },
      { milestone: 'handover', target: 60 }
    ];

    const milestoneInserts = milestones.map(m => {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + m.target);
      return {
        project_id: newProject.id,
        milestone: m.milestone as any,
        target_date: targetDate.toISOString().split('T')[0],
        status: 'pending',
        updated_at: new Date().toISOString()
      };
    });

    const { error: milestoneError } = await supabase
      .from('epc_project_milestones')
      .insert(milestoneInserts);

    if (milestoneError) {
      console.error('Failed to initialize milestones:', milestoneError);
    }

    return newProject;
  },

  /**
   * Auto-populate quote fields from the CRM site survey before
   * the project record is created.  Call this when transitioning
   * a quote to "Won" / creating a project from a won quote.
   *
   * Returns the survey data merged into the quote row, or null
   * if no completed survey exists.
   */
  async backfillQuoteFromSurvey(quoteNumber: string): Promise<{
    roof_type: string | null;
    sanctioned_load_kw: number | null;
    meter_phase: 'single' | 'three' | null;
  } | null> {
    try {
      const survey = await SurveyORM.getByQuoteId(quoteNumber);
      if (!survey || survey.status !== 'completed') return null;

      const backfill: any = {};
      if (survey.roof_type) backfill.roof_type = survey.roof_type;
      if (survey.sanctioned_load_kw) backfill.sanctioned_load_kw = Number(survey.sanctioned_load_kw);
      if (survey.meter_phase) backfill.meter_phase = survey.meter_phase;

      if (Object.keys(backfill).length > 0) {
        await supabase
          .from('quotes')
          .update(backfill)
          .eq('quote_number', quoteNumber);
      }

      return {
        roof_type: survey.roof_type,
        sanctioned_load_kw: survey.sanctioned_load_kw ? Number(survey.sanctioned_load_kw) : null,
        meter_phase: survey.meter_phase as 'single' | 'three' | null,
      };
    } catch (err) {
      console.error('[ProjectORM.backfillQuoteFromSurvey] Error:', err);
      return null;
    }
  }
};

