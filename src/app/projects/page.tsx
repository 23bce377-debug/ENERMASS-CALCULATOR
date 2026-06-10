'use client';

import { useState, useEffect, useMemo } from 'react';
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
  Map, FileText, CheckCircle, RefreshCw
} from 'lucide-react';
import { formatINR } from '@/lib/engine/calculator';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/Confirm';
import { Select } from '@/components/ui/Select';

// Status labels and styling
const STATUS_LABELS: Record<string, string> = {
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

const STATUS_STYLES: Record<string, string> = {
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

const MILESTONE_LABELS: Record<string, string> = {
  survey_approved: 'Site Survey Validation',
  structural_design_freeze: 'Structural Design Freeze',
  civil_foundation_done: 'Civil Foundation Curing',
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

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

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
    gps_lng: 0
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

  // Filter project list
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const matchesSearch = 
        p.project_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.quotes?.customer_name?.toLowerCase() || '').includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [projects, searchQuery, statusFilter]);

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

        {/* Search, Filter & Workspace layout */}
        <div className="flex flex-col lg:flex-row gap-6">
          
          {/* Projects Sidebar (Left) */}
          <div className="w-full lg:w-96 shrink-0 space-y-4">
            <div className="bg-surface border border-border/40 rounded-2xl p-4 shadow-md space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-text-primary text-sm">Rooftop Project Ledger</h3>
                <button onClick={() => refetchProjects()} className="p-1 hover:bg-surface-hover rounded text-text-muted transition-colors cursor-pointer">
                  <RefreshCw size={14} />
                </button>
              </div>

              {/* Search input */}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="text"
                  placeholder="Search PRJ # or customer..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-border rounded-lg bg-background text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                />
              </div>

              {/* Status filter selection */}
              <div className="flex items-center gap-2">
                <Filter size={12} className="text-text-muted" />
                <Select
                  value={statusFilter}
                  onChange={setStatusFilter}
                  options={[
                    { value: 'all', label: 'All Project Stages' },
                    { value: 'survey_phase', label: 'Site Survey' },
                    { value: 'engineering_design', label: 'Engineering Design' },
                    { value: 'permitting', label: 'Permitting' },
                    { value: 'material_dispatched', label: 'Materials Dispatched' },
                    { value: 'installation_started', label: 'Installation In Progress' },
                    { value: 'net_metering_pending', label: 'Net Metering Pending' },
                    { value: 'commissioned', label: 'Commissioned' },
                    { value: 'closed', label: 'Closed' }
                  ]}
                  className="text-xs"
                />
              </div>

              <div className="h-px bg-border/40" />

              {/* Projects List Scrollable */}
              <div className="max-h-[500px] overflow-y-auto space-y-2 pr-1 scrollbar-thin scrollbar-thumb-border">
                {loading ? (
                  <div className="text-center py-8 text-xs text-text-muted">Loading project files...</div>
                ) : filteredProjects.length === 0 ? (
                  <div className="text-center py-8 text-xs text-text-muted">No matching projects found</div>
                ) : (
                  filteredProjects.map((p) => {
                    const isSelected = p.id === selectedProjectId;
                    return (
                      <button
                        key={p.id}
                        onClick={() => setSelectedProjectId(p.id)}
                        className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all duration-200 cursor-pointer
                          ${isSelected 
                            ? 'border-accent bg-accent-glow shadow-md shadow-accent/5' 
                            : 'border-border bg-surface hover:border-border-light hover:bg-surface-hover'}`}
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-black text-text-primary">{p.project_number}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold border ${STATUS_STYLES[p.status]}`}>
                              {STATUS_LABELS[p.status]}
                            </span>
                          </div>
                          <h4 className="text-xs font-bold text-text-secondary truncate">{p.quotes?.customer_name || 'Generic Client'}</h4>
                          <div className="flex items-center gap-2 text-[10px] text-text-muted">
                            <span>{p.quotes?.system_capacity_kw || '—'} kW</span>
                            <span>•</span>
                            <span className="capitalize">{p.quotes?.project_type || 'residential'}</span>
                          </div>
                        </div>
                        <ChevronRight size={14} className="text-text-muted shrink-0 ml-2" />
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Project Details Workspace (Right) */}
          <div className="flex-1 min-w-0">
            {detailsLoading ? (
              <div className="bg-surface border border-border/40 rounded-2xl p-8 shadow-md flex flex-col items-center justify-center min-h-[400px]">
                <Clock className="animate-spin text-accent mb-3" size={32} />
                <p className="text-sm text-text-muted">Loading technical project files...</p>
              </div>
            ) : !projectDetails ? (
              <div className="bg-surface border border-border/40 rounded-2xl p-8 shadow-md flex flex-col items-center justify-center min-h-[400px] text-center space-y-3">
                <Wrench className="text-text-muted" size={40} />
                <div>
                  <h4 className="text-sm font-bold text-text-primary">No Project Selected</h4>
                  <p className="text-xs text-text-muted mt-1 max-w-sm">Select a rooftop project ledger from the left panel to review drawings, track civil milestone cure logs, and update status timelines.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                
                {/* Project Header Widget */}
                <div className="bg-surface border border-border/40 rounded-2xl p-5 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <h2 className="text-lg font-black font-mono text-text-primary">{projectDetails.project_number}</h2>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${STATUS_STYLES[projectDetails.status]}`}>
                        {STATUS_LABELS[projectDetails.status]}
                      </span>
                    </div>
                    <p className="text-sm text-text-muted">
                      Rooftop Client: <span className="font-bold text-text-secondary">{projectDetails.quotes?.customer_name}</span> | Phone: {projectDetails.quotes?.customer_phone || '—'}
                    </p>
                  </div>

                  {/* Operational controls */}
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                      <User size={14} className="text-text-muted" />
                      <select
                        value={projectDetails.assigned_pm_id || ''}
                        onChange={(e) => handleAssignPM(e.target.value ? e.target.value : null)}
                        className="px-2 py-1.5 border border-border rounded-lg bg-background text-xs text-text-primary focus:outline-none focus:border-accent"
                      >
                        <option value="">Assign Project PM</option>
                        {profiles.map(prof => (
                          <option key={prof.id} value={prof.id}>{prof.full_name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        value={projectDetails.status}
                        onChange={(e) => handleUpdateStatus(e.target.value)}
                        className="px-2.5 py-1.5 border border-border rounded-lg bg-background text-xs font-semibold text-text-primary focus:outline-none focus:border-accent"
                      >
                        <option value="survey_phase">Survey Phase</option>
                        <option value="engineering_design">Engineering Design</option>
                        <option value="permitting">Permitting</option>
                        <option value="material_dispatched">Materials Dispatched</option>
                        <option value="installation_started">Installation started</option>
                        <option value="net_metering_pending">Net Metering Pending</option>
                        <option value="commissioned">Commissioned</option>
                        <option value="closed">Closed / Handover</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Progress Pipeline Timeline */}
                <div className="bg-surface border border-border/40 rounded-2xl p-5 shadow-md space-y-3">
                  <h3 className="text-xs font-black uppercase text-text-muted tracking-widest flex items-center gap-1.5">
                    <Activity size={14} className="text-accent" />
                    Project Status Timeline
                  </h3>
                  
                  {/* Step track */}
                  <div className="grid grid-cols-2 md:grid-cols-8 gap-2.5 pt-2">
                    {[
                      { key: 'survey_phase', label: 'Survey' },
                      { key: 'engineering_design', label: 'Design' },
                      { key: 'permitting', label: 'Permits' },
                      { key: 'material_dispatched', label: 'Logistics' },
                      { key: 'installation_started', label: 'Erection' },
                      { key: 'net_metering_pending', label: 'Grid Sync' },
                      { key: 'commissioned', label: 'Commissioned' },
                      { key: 'closed', label: 'Handover' }
                    ].map((step, idx) => {
                      const stages = ['survey_phase', 'engineering_design', 'permitting', 'material_dispatched', 'installation_started', 'net_metering_pending', 'commissioned', 'closed'];
                      const currentIdx = stages.indexOf(projectDetails.status);
                      const stepIdx = stages.indexOf(step.key);
                      const isCompleted = stepIdx < currentIdx;
                      const isActive = step.key === projectDetails.status;
                      
                      return (
                        <div 
                          key={step.key} 
                          className={`p-2.5 rounded-xl border text-center transition-all duration-300
                            ${isActive 
                              ? 'bg-accent/10 border-accent text-accent font-bold shadow-md shadow-accent/5' 
                              : isCompleted 
                              ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-500' 
                              : 'bg-background/40 border-border/60 text-text-muted'}`}
                        >
                          <div className="text-[10px] font-mono font-black">0{idx+1}</div>
                          <div className="text-xs font-bold mt-1 truncate">{step.label}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  
                  {/* Milestone Tracking Checklist */}
                  <div className="bg-surface border border-border/40 rounded-2xl p-5 shadow-md space-y-4">
                    <h3 className="text-xs font-black uppercase text-text-muted tracking-widest flex items-center gap-1.5">
                      <ClipboardList size={14} className="text-accent" />
                      Statutory & EPC Milestone Tracking
                    </h3>

                    <div className="divide-y divide-border/40 font-mono text-xs">
                      {(projectDetails.epc_project_milestones || [])
                        .sort((a: any, b: any) => {
                          const order = ['survey_approved', 'structural_design_freeze', 'civil_foundation_done', 'panel_installation_done', 'inverter_wiring_done', 'net_metering_approved', 'discom_charging', 'handover'];
                          return order.indexOf(a.milestone) - order.indexOf(b.milestone);
                        })
                        .map((m: any) => {
                          const isDone = m.status === 'completed';
                          return (
                            <div key={m.id} className="flex items-center justify-between py-3">
                              <div className="space-y-0.5">
                                <h4 className="font-sans font-bold text-text-primary">{MILESTONE_LABELS[m.milestone]}</h4>
                                <div className="text-[10px] text-text-muted">
                                  Target: {m.target_date} {m.actual_date ? `| Actual: ${m.actual_date}` : ''}
                                </div>
                              </div>

                              <button
                                onClick={() => handleToggleMilestone(m)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-black cursor-pointer transition-all
                                  ${isDone 
                                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' 
                                    : 'bg-background border-border text-text-muted hover:border-accent hover:text-accent'}`}
                              >
                                {isDone ? (
                                  <>
                                    <CheckCircle size={12} />
                                    Completed
                                  </>
                                ) : (
                                  'Mark Done'
                                )}
                              </button>
                            </div>
                          );
                        })}
                    </div>
                  </div>

                  {/* Site Survey Profile Form */}
                  <div className="bg-surface border border-border/40 rounded-2xl p-5 shadow-md space-y-4">
                    <h3 className="text-xs font-black uppercase text-text-muted tracking-widest flex items-center gap-1.5">
                      <Map size={14} className="text-accent" />
                      Engineering Site Assessment
                    </h3>

                    <form onSubmit={handleSaveSurvey} className="space-y-4 text-xs">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-text-secondary font-bold">Roof Mounting Type</label>
                          <select
                            value={surveyForm.roof_mount_type || 'rcc_flat'}
                            onChange={(e) => setSurveyForm({ ...surveyForm, roof_mount_type: e.target.value })}
                            className="w-full px-3 py-2 border border-border rounded-lg bg-background text-text-primary focus:outline-none focus:border-accent"
                          >
                            <option value="rcc_flat">RCC Flat Slab</option>
                            <option value="rcc_sloped">RCC Sloped</option>
                            <option value="tin_shed">Tin Shed</option>
                            <option value="metal_sheet">Metal Sheet</option>
                            <option value="ground_mount">Ground Mount</option>
                            <option value="elevated">Elevated Structure</option>
                          </select>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-text-secondary font-bold">Tilt Angle (Degrees)</label>
                          <input
                            type="number"
                            value={surveyForm.tilt_angle_deg || ''}
                            onChange={(e) => setSurveyForm({ ...surveyForm, tilt_angle_deg: Number(e.target.value) })}
                            className="w-full px-3 py-2 border border-border rounded-lg bg-background text-text-primary focus:outline-none focus:border-accent font-mono"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-text-secondary font-bold">Usable Area (Sqft)</label>
                          <input
                            type="number"
                            value={surveyForm.usable_area_sqft || ''}
                            onChange={(e) => setSurveyForm({ ...surveyForm, usable_area_sqft: Number(e.target.value) })}
                            className="w-full px-3 py-2 border border-border rounded-lg bg-background text-text-primary focus:outline-none focus:border-accent font-mono"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-text-secondary font-bold">Shading Losses (%)</label>
                          <input
                            type="number"
                            value={surveyForm.shading_percentage || ''}
                            onChange={(e) => setSurveyForm({ ...surveyForm, shading_percentage: Number(e.target.value) })}
                            className="w-full px-3 py-2 border border-border rounded-lg bg-background text-text-primary focus:outline-none focus:border-accent font-mono"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-text-secondary font-bold">GPS Latitude</label>
                          <input
                            type="number"
                            step="any"
                            value={surveyForm.gps_lat || ''}
                            onChange={(e) => setSurveyForm({ ...surveyForm, gps_lat: Number(e.target.value) })}
                            className="w-full px-3 py-2 border border-border rounded-lg bg-background text-text-primary focus:outline-none focus:border-accent font-mono"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-text-secondary font-bold">GPS Longitude</label>
                          <input
                            type="number"
                            step="any"
                            value={surveyForm.gps_lng || ''}
                            onChange={(e) => setSurveyForm({ ...surveyForm, gps_lng: Number(e.target.value) })}
                            className="w-full px-3 py-2 border border-border rounded-lg bg-background text-text-primary focus:outline-none focus:border-accent font-mono"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-text-secondary font-bold">Survey & Design Obstruction Notes</label>
                        <textarea
                          rows={3}
                          value={surveyForm.survey_notes || ''}
                          onChange={(e) => setSurveyForm({ ...surveyForm, survey_notes: e.target.value })}
                          placeholder="Note down cable routing paths, transformer distance, structural obstructions, etc."
                          className="w-full px-3 py-2 border border-border rounded-lg bg-background text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full flex items-center justify-center gap-1.5 py-2 px-4 bg-accent hover:bg-accent-hover text-background text-xs font-bold rounded-lg cursor-pointer transition-colors shadow-md shadow-accent/10"
                      >
                        Save Assessment Data
                      </button>
                    </form>
                  </div>
                </div>

                {/* technical BOM reference */}
                <div className="bg-surface border border-border/40 rounded-2xl p-5 shadow-md space-y-3">
                  <h3 className="text-xs font-black uppercase text-text-muted tracking-widest flex items-center gap-1.5">
                    <FileText size={14} className="text-accent" />
                    Associated Sizing Details & Technical BOM
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
                    <div className="p-3 bg-background/50 border border-border/40 rounded-xl">
                      <span className="text-[10px] text-text-muted font-sans font-bold block uppercase tracking-wider">System Sizing</span>
                      <span className="text-text-primary font-bold text-sm mt-0.5 block">{projectDetails.quotes?.system_name}</span>
                    </div>
                    <div className="p-3 bg-background/50 border border-border/40 rounded-xl">
                      <span className="text-[10px] text-text-muted font-sans font-bold block uppercase tracking-wider">PV Array Power</span>
                      <span className="text-text-primary font-bold text-sm mt-0.5 block">{projectDetails.quotes?.system_capacity_kw} kW</span>
                    </div>
                    <div className="p-3 bg-background/50 border border-border/40 rounded-xl">
                      <span className="text-[10px] text-text-muted font-sans font-bold block uppercase tracking-wider">Output GST Rate</span>
                      <span className="text-text-primary font-bold text-sm mt-0.5 block">{projectDetails.quotes?.gst_output_rate ? `${(Number(projectDetails.quotes.gst_output_rate) * 100).toFixed(1)}%` : '—'}</span>
                    </div>
                    <div className="p-3 bg-background/50 border border-border/40 rounded-xl">
                      <span className="text-[10px] text-text-muted font-sans font-bold block uppercase tracking-wider">Project Value</span>
                      <span className="text-text-primary font-bold text-sm mt-0.5 block text-accent">{formatINR(projectDetails.quotes?.beneficiary_contribution || 0)}</span>
                    </div>
                  </div>
                </div>

              </div>
            )}
          </div>

        </div>

      </main>
    </div>
  );
}
