'use client';

import { ProjectList } from '@/components/projects/ProjectList';
import { ProjectDetailView } from '@/components/projects/ProjectDetailView';
import { CreateProjectModal } from '@/components/projects/CreateProjectModal';

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import {
  useProjectsQuery,
  useProjectDetailsQuery,
  useUpdateProjectStatusMutation,
  useAssignPMMutation
} from '@/lib/hooks/useProjects';
import { 
  ClipboardList, Activity, ShieldCheck, Plus
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/Confirm';

export const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  in_progress: 'In Progress',
  on_hold: 'On Hold',
  completed: 'Completed',
  cancelled: 'Cancelled'
};

export const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
  in_progress: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  on_hold: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  completed: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  cancelled: 'bg-red-500/10 text-red-500 border-red-500/20'
};

export default function ProjectsPage() {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const searchParams = useSearchParams();
  const createForLead = searchParams.get('createForLead');
  const initialProjectId = searchParams.get('projectId');
    
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(initialProjectId);

  const { toast } = useToast();
  const confirm = useConfirm();

  useEffect(() => {
    async function loadAuthAndProfiles() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      setUserId(session.user.id);
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('id', session.user.id)
        .single();
        
      if (profile?.org_id) {
        setOrgId(profile.org_id);
        const { data: profList } = await supabase
          .from('profiles')
          .select('id, full_name')
          .eq('org_id', profile.org_id);
        setProfiles(profList || []);
      }
    }
    loadAuthAndProfiles();
  }, []);

  useEffect(() => {
    if (createForLead && orgId && userId) {
      setIsCreateModalOpen(true);
    }
    if (initialProjectId && !selectedProjectId) {
      setSelectedProjectId(initialProjectId);
    }
  }, [createForLead, initialProjectId, orgId, userId]);

  const { data: projects = [], isLoading: projectsLoading, refetch: refetchProjects } = useProjectsQuery(orgId);
  const { data: projectDetails = null, isLoading: detailsLoading } = useProjectDetailsQuery(selectedProjectId);

  const updateStatusMutation = useUpdateProjectStatusMutation();
  const assignPMMutation = useAssignPMMutation();

  const handleUpdateStatus = async (status: string) => {
    if (!projectDetails || !orgId) return;
    const confirmed = await confirm({
      title: 'Update Project Status?',
      message: `Change status to "${STATUS_LABELS[status]}"?`,
      confirmLabel: 'Update Status',
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
        toast(`Project status updated to ${STATUS_LABELS[status]}`, 'success');
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

  const dashboardStats = useMemo(() => {
    const total = projects.length;
    const active = projects.filter(p => p.status === 'in_progress').length;
    const completed = projects.filter(p => p.status === 'completed').length;
    return { total, active, completed };
  }, [projects]);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <main className="flex-1 p-4 md:p-6 max-w-7xl mx-auto w-full space-y-6">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-text-primary">Projects Ledger</h1>
            <p className="text-sm text-text-muted mt-0.5">Manage and track high-level project statuses.</p>
          </div>
          
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 bg-[#f0a500] hover:bg-[#d08f00] text-black font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 shrink-0 self-start sm:self-auto cursor-pointer"
          >
            <Plus size={14} />
            Add Project
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
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
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">In Progress</p>
              <h4 className="text-2xl font-black text-text-primary font-mono mt-1">{dashboardStats.active}</h4>
            </div>
          </div>

          <div className="bg-surface border border-border/40 rounded-2xl p-5 shadow-md card-hover flex items-center gap-4 relative overflow-hidden group">
            <div className="absolute right-0 top-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-all duration-300" />
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center border border-emerald-500/20 shrink-0">
              <ShieldCheck size={22} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Completed</p>
              <h4 className="text-2xl font-black text-text-primary font-mono mt-1">{dashboardStats.completed}</h4>
            </div>
          </div>
        </div>

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
            orgId={orgId}
            onAssignPM={handleAssignPM}
            onUpdateStatus={handleUpdateStatus}
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
