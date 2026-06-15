'use client';

import { ProjectList } from '@/components/projects/ProjectList';
import { ProjectDetailView } from '@/components/projects/ProjectDetailView';
import { CreateProjectModal } from '@/components/projects/CreateProjectModal';

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { ProjectORM, type Project, type ProjectMilestone, type SiteSurvey } from '@/backend/orm/project';
import {
  useProjectsQuery,
  useProjectDetailsQuery,
  useUpdateProjectStatusMutation,
  useAssignPMMutation,
  useUpdateMilestoneMutation,
  useSaveSiteSurveyMutation
} from '@/lib/hooks/useProjects';
import { 
  Wrench, ShieldCheck, CheckCircle2, Clock, 
  Search, Filter, MapPin, ChevronRight, X, 
  User, Calendar, Activity, ClipboardList, 
  Map, FileText, CheckCircle, RefreshCw, Plus
} from 'lucide-react';
import { formatINR } from '@/lib/engine/calculator';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/Confirm';
import { Select } from '@/components/ui/Select';

// Status labels and styling
export const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  survey_phase: 'Site Survey',
  engineering_design: 'Engineering Design',
  permitting: 'Permitting Approval',
  material_dispatched: 'Materials Dispatched',
  installation_started: 'Installation In Progress',
  net_metering_pending: 'Net Metering Pending',
  commissioned: 'Commissioned & Active',
  closed: 'Closed / Handed Over',
  cancelled: 'Cancelled'
};

export const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
  survey_phase: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  engineering_design: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  permitting: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
  material_dispatched: 'bg-sky-500/10 text-sky-500 border-sky-500/20',
  installation_started: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  net_metering_pending: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  commissioned: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  closed: 'bg-teal-500/10 text-teal-500 border-teal-500/20',
  cancelled: 'bg-red-500/10 text-red-500 border-red-500/20'
};

export const MILESTONE_LABELS: Record<string, string> = {
  survey_approved: 'Site Survey Validation',
  structural_design_freeze: 'Structural Design Freeze',
  civil_foundation_done: 'Civil Foundation Curing',
  concrete_curing: 'Concrete Curing Period',
  panel_installation_done: 'Solar Panels Erection',
  inverter_wiring_done: 'Inverter & AC/DC Wiring',
  net_metering_approved: 'Net Metering Bi-Dir Approval',
  discom_charging: 'DisCom Charging Clearance',
  handover: 'Final Client Handover'
};

export default function ProjectsPage() {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const searchParams = useSearchParams();
  const createForLead = searchParams.get('createForLead');

  // Search & Filters
    
  // Selected Project Details
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  // Site Survey Editable State
  const [surveyForm, setSurveyForm] = useState<Partial<SiteSurvey>>({
    roof_mount_type: 'rcc_flat',
    tilt_angle_deg: 0,
    usable_area_sqft: 0,
    roof_load_capacity_kgm2: 0,
    distribution_distance_m: 0,
    shading_percentage: 0,
    solar_access_pct: 100,
    survey_notes: '',
    gps_lat: 0,
    gps_lng: 0,
    sanctioned_load_kw: 0,
    meter_phase: 'single',
    distance_panel_to_inverter_m: 0,
    distance_inverter_to_meter_m: 0,
    roof_height_ft: 0,
    discom_name: '',
    consumer_number: '',
    net_metering_available: false,
    photo_urls: []
  });

  const { toast } = useToast();
  const confirm = useConfirm();

  // Load Session and Org Context
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUserId(session.user.id);
        supabase.from('profiles').select('org_id').eq('id', session.user.id).single()
          .then(({ data }: any) => {
            if (data?.org_id) {
              setOrgId(data.org_id);
              // Load profiles list
              supabase.from('profiles').select('id, full_name').eq('org_id', data.org_id)
                .then(({ data: profList }) => {
                  setProfiles(profList || []);
                });
            }
          });
      }
    });
  }, []);

  useEffect(() => {
    if (createForLead && orgId && userId) {
      setIsCreateModalOpen(true);
    }
  }, [createForLead, orgId, userId]);

  // TanStack Query Hooks
  const { data: projects = [], isLoading: projectsLoading, refetch: refetchProjects } = useProjectsQuery(orgId);
  const { data: projectDetails = null, isLoading: detailsLoading } = useProjectDetailsQuery(selectedProjectId);

  const updateStatusMutation = useUpdateProjectStatusMutation();
  const assignPMMutation = useAssignPMMutation();
  const updateMilestoneMutation = useUpdateMilestoneMutation();
  const saveSurveyMutation = useSaveSiteSurveyMutation();

  const loading = projectsLoading;

  // Load specific project details & seed site survey form
  useEffect(() => {
    if (!projectDetails) return;

    const survey = Array.isArray(projectDetails.epc_site_surveys)
      ? projectDetails.epc_site_surveys[0]
      : projectDetails.epc_site_surveys;

    if (survey) {
      setSurveyForm({
        ...(survey as any),
        tilt_angle_deg: Number(survey.tilt_angle_deg || 0),
        usable_area_sqft: Number(survey.usable_area_sqft || 0),
        roof_load_capacity_kgm2: Number(survey.roof_load_capacity_kgm2 || 0),
        distribution_distance_m: Number(survey.distribution_distance_m || 0),
        shading_percentage: Number(survey.shading_percentage || 0),
        solar_access_pct: Number(survey.solar_access_pct || 100),
        gps_lat: Number(survey.gps_lat || 0),
        gps_lng: Number(survey.gps_lng || 0),
        sanctioned_load_kw: Number(survey.sanctioned_load_kw || 0),
        meter_phase: survey.meter_phase || 'single',
        distance_panel_to_inverter_m: Number(survey.distance_panel_to_inverter_m || 0),
        distance_inverter_to_meter_m: Number(survey.distance_inverter_to_meter_m || 0),
        roof_height_ft: Number(survey.roof_height_ft || 0),
        discom_name: survey.discom_name || '',
        consumer_number: survey.consumer_number || '',
        net_metering_available: !!survey.net_metering_available,
        photo_urls: survey.photo_urls || []
      });
    } else {
      setSurveyForm({
        project_id: projectDetails.id,
        roof_mount_type: 'rcc_flat',
        tilt_angle_deg: 0,
        usable_area_sqft: 0,
        roof_load_capacity_kgm2: 0,
        distribution_distance_m: 0,
        shading_percentage: 0,
        solar_access_pct: 100,
        survey_notes: '',
        gps_lat: 0,
        gps_lng: 0
      });
    }
  }, [projectDetails]);

  // Project Actions
  const handleUpdateStatus = async (status: string) => {
    if (!projectDetails || !orgId) return;
    const confirmed = await confirm({
      title: 'Update Project Status?',
      message: `Are you sure you want to transition this project to the stage: "${STATUS_LABELS[status]}"?`,
      confirmLabel: 'Transition Stage',
      cancelLabel: 'Cancel',
      type: 'info'
    });

    if (confirmed) {
      try {
        await updateStatusMutation.mutateAsync({
          projectId: projectDetails.id,
          status,
          version: projectDetails.version,
          orgId
        });
        toast(`Project transitioned to ${STATUS_LABELS[status]}`, 'success');
      } catch (err: any) {
        toast(err.message || 'Failed to update status', 'error');
      }
    }
  };

  const handleAssignPM = async (pmId: string | null) => {
    if (!projectDetails || !orgId) return;
    try {
      await assignPMMutation.mutateAsync({
        projectId: projectDetails.id,
        pmId,
        orgId
      });
      toast('Project Manager updated successfully', 'success');
    } catch (err) {
      toast('Failed to assign project manager', 'error');
    }
  };

  const handleToggleMilestone = async (m: ProjectMilestone) => {
    if (!projectDetails || !orgId) return;
    const isCompleted = m.status === 'completed';
    const nextStatus = isCompleted ? 'pending' : 'completed';
    const actualDate = isCompleted ? null : new Date().toISOString().split('T')[0];

    // UI-level Concrete Curing enforcement
    if (nextStatus === 'completed' && m.milestone === 'panel_installation_done') {
      const curing = projectDetails.epc_project_milestones?.find((x: any) => x.milestone === 'concrete_curing');
      if (!curing || curing.status !== 'completed' || !curing.actual_date) {
        toast('Concrete curing must be completed before panel installation.', 'error');
        return;
      }
      
      const curingStart = new Date(curing.actual_date);
      const diffDays = (Date.now() - curingStart.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays < 7) {
        const safeDate = new Date(curingStart);
        safeDate.setDate(safeDate.getDate() + 7);
        toast(`Concrete curing requires 7 days. Started: ${curing.actual_date}. Safe to proceed: ${safeDate.toISOString().split('T')[0]}`, 'error');
        return;
      }
    }

    try {
      await updateMilestoneMutation.mutateAsync({
        milestoneId: m.id,
        status: nextStatus,
        actualDate,
        userId: userId || undefined,
        projectId: projectDetails.id,
        orgId
      });
      toast(`Milestone "${MILESTONE_LABELS[m.milestone]}" marked as ${nextStatus}!`, 'success');
    } catch (err) {
      toast('Failed to toggle milestone state', 'error');
    }
  };

  const handleSaveSurvey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectDetails || !orgId) return;
    try {
      await saveSurveyMutation.mutateAsync({
        survey: {
          ...surveyForm,
          project_id: projectDetails.id
        },
        projectId: projectDetails.id,
        orgId
      });
      toast('Site survey details saved!', 'success');
    } catch (err) {
      toast('Failed to save site survey', 'error');
    }
  };

  // Dashboard Stats Computation
  const dashboardStats = useMemo(() => {
    const total = projects.length;
    const active = projects.filter(p => !['closed', 'cancelled', 'draft'].includes(p.status)).length;
    const netMetering = projects.filter(p => p.status === 'net_metering_pending').length;
    const commissioned = projects.filter(p => p.status === 'commissioned' || p.status === 'closed').length;
    return { total, active, netMetering, commissioned };
  }, [projects]);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <main className="flex-1 p-4 md:p-6 max-w-7xl mx-auto w-full space-y-6">
        
        {/* Header section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-text-primary">Projects Delivery Ledger</h1>
            <p className="text-sm text-text-muted mt-0.5">Track site surveys, milestone execution, engineering approvals, and grid commissioning.</p>
          </div>
          
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 bg-[#f0a500] hover:bg-[#d08f00] text-black font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 shrink-0 self-start sm:self-auto cursor-pointer"
          >
            <Plus size={14} />
            Add Project
          </button>
        </div>

        {/* KPI Summary Widgets */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          <div className="bg-surface border border-border/40 rounded-2xl p-5 shadow-md card-hover flex items-center gap-4 relative overflow-hidden group">
            <div className="absolute right-0 top-0 w-24 h-24 bg-accent/5 rounded-full blur-2xl group-hover:bg-accent/10 transition-all duration-300" />
            <div className="w-12 h-12 rounded-xl bg-accent-dim text-accent flex items-center justify-center border border-accent/20 shrink-0">
              <ClipboardList size={22} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Total Projects</p>
              <h4 className="text-2xl font-black text-text-primary font-mono mt-1">{dashboardStats.total}</h4>
            </div>
          </div>

          <div className="bg-surface border border-border/40 rounded-2xl p-5 shadow-md card-hover flex items-center gap-4 relative overflow-hidden group">
            <div className="absolute right-0 top-0 w-24 h-24 bg-info/5 rounded-full blur-2xl group-hover:bg-info/10 transition-all duration-300" />
            <div className="w-12 h-12 rounded-xl bg-info/10 text-info flex items-center justify-center border border-info/20 shrink-0">
              <Activity size={22} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Active Pipeline</p>
              <h4 className="text-2xl font-black text-text-primary font-mono mt-1">{dashboardStats.active}</h4>
            </div>
          </div>

          <div className="bg-surface border border-border/40 rounded-2xl p-5 shadow-md card-hover flex items-center gap-4 relative overflow-hidden group">
            <div className="absolute right-0 top-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl group-hover:bg-purple-500/10 transition-all duration-300" />
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center border border-purple-500/20 shrink-0">
              <Clock size={22} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Net Metering Pending</p>
              <h4 className="text-2xl font-black text-text-primary font-mono mt-1">{dashboardStats.netMetering}</h4>
            </div>
          </div>

          <div className="bg-surface border border-border/40 rounded-2xl p-5 shadow-md card-hover flex items-center gap-4 relative overflow-hidden group">
            <div className="absolute right-0 top-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-all duration-300" />
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center border border-emerald-500/20 shrink-0">
              <ShieldCheck size={22} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Commissioned Plants</p>
              <h4 className="text-2xl font-black text-text-primary font-mono mt-1">{dashboardStats.commissioned}</h4>
            </div>
          </div>
        </div>

        {/* Projects Master View Split */}
        <div className="flex flex-col lg:flex-row gap-6 mt-6">
          <ProjectList 
            projects={projects}
            selectedProjectId={selectedProjectId}
            onSelectProject={setSelectedProjectId}
          />
          <ProjectDetailView 
            projectDetails={projectDetails}
            detailsLoading={detailsLoading}
            profiles={profiles}
            onAssignPM={handleAssignPM}
            onUpdateStatus={handleUpdateStatus}
            onToggleMilestone={handleToggleMilestone}
          />
        </div>
      </main>

      {orgId && userId && (
        <CreateProjectModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          orgId={orgId}
          userId={userId}
          profiles={profiles}
          prefilledLeadId={createForLead}
          onCreated={(newProjId) => {
            setSelectedProjectId(newProjId);
            refetchProjects();
          }}
        />
      )}
    </div>
  );
}
