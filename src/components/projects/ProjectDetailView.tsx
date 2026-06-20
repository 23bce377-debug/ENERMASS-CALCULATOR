import React, { useState, useEffect } from 'react';
import { Clock, Wrench, User, FileText, CheckCircle, Search, Save } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { STATUS_LABELS, STATUS_STYLES } from '@/app/projects/page';
import { useUpdateProjectNotesMutation } from '@/lib/hooks/useProjects';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';

interface ProjectDetailViewProps {
  projectDetails: any;
  detailsLoading: boolean;
  profiles: any[];
  orgId: string | null;
  onAssignPM: (pmId: string | null) => void;
  onUpdateStatus: (status: string) => void;
}

export const ProjectDetailView = React.memo(function ProjectDetailView({
  projectDetails,
  detailsLoading,
  profiles,
  orgId,
  onAssignPM,
  onUpdateStatus
}: ProjectDetailViewProps) {

  const [notes, setNotes] = useState('');
  const updateNotesMutation = useUpdateProjectNotesMutation();
  const { toast } = useToast();

  useEffect(() => {
    if (projectDetails) {
      setNotes(projectDetails.project_notes || '');
    }
  }, [projectDetails]);

  if (detailsLoading) {
    return (
      <Card className="flex-1 min-h-[400px] flex flex-col items-center justify-center">
        <Clock className="animate-spin text-accent mb-3" size={32} />
        <p className="text-sm text-text-muted">Loading project details...</p>
      </Card>
    );
  }

  if (!projectDetails) {
    return (
      <Card className="flex-1 min-h-[400px] flex flex-col items-center justify-center text-center space-y-3">
        <Wrench className="text-text-muted" size={40} />
        <div>
          <h4 className="text-sm font-bold text-text-primary">No Project Selected</h4>
          <p className="text-xs text-text-muted mt-1 max-w-sm">Select a project from the left panel to view and edit basic details and notes.</p>
        </div>
      </Card>
    );
  }

  const handleSaveNotes = async () => {
    if (!orgId) return;
    try {
      await updateNotesMutation.mutateAsync({
        projectId: projectDetails.id,
        notes: notes,
        orgId
      });
      toast('Notes saved successfully', 'success');
    } catch (e) {
      toast('Failed to save notes', 'error');
    }
  };

  return (
    <div className="flex-1 min-w-0 space-y-6">
      <Card className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-black font-mono text-text-primary">{projectDetails.project_number}</h2>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${STATUS_STYLES[projectDetails.status] || STATUS_STYLES.draft}`}>
              {STATUS_LABELS[projectDetails.status] || projectDetails.status}
            </span>
          </div>
          <p className="text-sm text-text-muted">
            Client: <span className="font-bold text-text-secondary">{projectDetails.quotes?.customer_name || 'Unknown'}</span> | Phone: {projectDetails.quotes?.customer_phone || '—'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 min-w-[170px]">
            <User size={14} className="text-text-muted shrink-0" />
            <Select
              value={projectDetails.assigned_pm_id || ''}
              onChange={(val) => onAssignPM(val ? val : null)}
              options={profiles.map(prof => ({
                value: prof.id,
                label: prof.full_name
              }))}
              placeholder="Assign Project PM"
              size="sm"
              triggerClassName="text-xs border-border hover:border-border-light min-h-[30px] w-full"
            />
          </div>

          <Select
            value={projectDetails.status}
            onChange={(val) => onUpdateStatus(val)}
            options={[
              { value: 'draft', label: 'Draft' },
              { value: 'in_progress', label: 'In Progress' },
              { value: 'on_hold', label: 'On Hold' },
              { value: 'completed', label: 'Completed' },
              { value: 'cancelled', label: 'Cancelled' }
            ]}
            size="sm"
            triggerClassName="text-xs border-border hover:border-border-light font-semibold min-h-[30px] min-w-[150px]"
          />
        </div>
      </Card>

      <Card className="p-5 flex flex-col space-y-4 h-full min-h-[350px]">
         <h3 className="text-xs font-black uppercase text-text-muted tracking-widest flex items-center gap-1.5">
            <FileText size={14} className="text-accent" />
            Project Notes & Updates
          </h3>
          <div className="flex-1 flex flex-col space-y-3">
            <textarea
              className="flex-1 w-full min-h-[200px] p-3 rounded-xl bg-background border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent resize-none focus:ring-1 focus:ring-accent"
              placeholder="Add status updates, issues, or general project notes here..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <div className="flex justify-end">
              <button
                onClick={handleSaveNotes}
                disabled={updateNotesMutation.isPending}
                className="px-4 py-2 bg-accent hover:bg-accent-hover text-black font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer disabled:opacity-50"
              >
                {updateNotesMutation.isPending ? <Clock size={14} className="animate-spin" /> : <Save size={14} />}
                Save Notes
              </button>
            </div>
          </div>
      </Card>
    </div>
  );
});
