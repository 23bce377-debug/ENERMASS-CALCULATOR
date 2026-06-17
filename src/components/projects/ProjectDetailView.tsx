import React, { useState, useEffect } from 'react';
import { Clock, Wrench, User, FileText, Calendar, Zap, Save, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { STATUS_LABELS, STATUS_STYLES } from '@/app/projects/page';
import { Select } from '@/components/ui/Select';

interface ProjectDetailViewProps {
  projectDetails: any;
  detailsLoading: boolean;
  profiles: any[];
  onAssignPM: (pmId: string | null) => void;
  onUpdateStatus: (status: string) => void;
  onUpdateNotes: (notes: string) => Promise<void>;
}

export const ProjectDetailView = React.memo(function ProjectDetailView({
  projectDetails,
  detailsLoading,
  profiles,
  onAssignPM,
  onUpdateStatus,
  onUpdateNotes
}: ProjectDetailViewProps) {
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setNotes(projectDetails?.project_notes ?? '');
  }, [projectDetails?.id, projectDetails?.project_notes]);

  if (detailsLoading) {
    return (
      <Card className="flex-1 min-h-[400px] flex flex-col items-center justify-center">
        <Clock className="animate-spin text-accent mb-3" size={32} />
        <p className="text-sm text-text-muted font-medium">Loading project details...</p>
      </Card>
    );
  }

  if (!projectDetails) {
    return (
      <Card className="flex-1 min-h-[400px] flex flex-col items-center justify-center text-center space-y-3 p-8">
        <Wrench className="text-text-muted" size={40} />
        <div>
          <h4 className="text-sm font-bold text-text-primary">No Project Selected</h4>
          <p className="text-xs text-text-muted mt-1 max-w-sm">
            Select a project ledger from the left panel to review customer details, edit notes, and track milestones.
          </p>
        </div>
      </Card>
    );
  }

  const handleSaveNotes = async () => {
    setSaving(true);
    try {
      await onUpdateNotes(notes);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 min-w-0 space-y-6">
      {/* Project Header Widget */}
      <Card className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-black font-mono text-text-primary">{projectDetails.project_number}</h2>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${STATUS_STYLES[projectDetails.status]}`}>
              {STATUS_LABELS[projectDetails.status]}
            </span>
          </div>
          <p className="text-sm text-text-muted">
            Rooftop Client: <span className="font-bold text-text-secondary">{projectDetails.quotes?.customer_name}</span> | Phone: {projectDetails.quotes?.customer_phone || '—'}
          </p>
        </div>

        {/* Operational controls */}
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

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Left Column: System & Dates */}
        <div className="space-y-6">
          {/* Card 1: System Details */}
          <Card className="p-5 space-y-4">
            <h3 className="text-xs font-black uppercase text-text-muted tracking-widest flex items-center gap-1.5">
              <Zap size={14} className="text-accent" />
              System Configuration
            </h3>
            
            <div className="grid grid-cols-2 gap-4 text-xs font-mono">
              <div className="space-y-1">
                <span className="text-text-muted font-sans font-medium">System Name</span>
                <p className="text-sm font-bold text-text-primary font-sans">{projectDetails.quotes?.system_name || 'Custom Solar System'}</p>
              </div>
              <div className="space-y-1">
                <span className="text-text-muted font-sans font-medium">Capacity (kW)</span>
                <p className="text-sm font-bold text-text-primary">{projectDetails.quotes?.system_capacity_kw ? `${projectDetails.quotes.system_capacity_kw} kW` : '—'}</p>
              </div>
              <div className="space-y-1">
                <span className="text-text-muted font-sans font-medium">Project Type</span>
                <p className="text-sm font-bold text-text-primary font-sans capitalize">{projectDetails.quotes?.project_type || 'Residential'}</p>
              </div>
            </div>
          </Card>

          {/* Card 2: Dates Schedule */}
          <Card className="p-5 space-y-4">
            <h3 className="text-xs font-black uppercase text-text-muted tracking-widest flex items-center gap-1.5">
              <Calendar size={14} className="text-accent" />
              Project Schedule & Timeline
            </h3>

            <div className="grid grid-cols-2 gap-4 text-xs font-mono">
              <div className="space-y-1">
                <span className="text-text-muted font-sans font-medium">Planned Start</span>
                <p className="text-sm font-bold text-text-primary">{projectDetails.planned_start || '—'}</p>
              </div>
              <div className="space-y-1">
                <span className="text-text-muted font-sans font-medium">Planned End</span>
                <p className="text-sm font-bold text-text-primary">{projectDetails.planned_end || '—'}</p>
              </div>
              <div className="space-y-1 border-t border-border/40 pt-2 col-span-2 grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-text-muted font-sans font-medium">Actual Start</span>
                  <p className="text-sm font-bold text-text-primary">{projectDetails.actual_start || '—'}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-text-muted font-sans font-medium">Actual End</span>
                  <p className="text-sm font-bold text-text-primary">{projectDetails.actual_end || '—'}</p>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column: Project Notes */}
        <Card className="p-5 flex flex-col space-y-4 h-full min-h-[350px]">
          <h3 className="text-xs font-black uppercase text-text-muted tracking-widest flex items-center gap-1.5">
            <FileText size={14} className="text-accent" />
            Project Notes & Log
          </h3>

          <div className="flex-1 flex flex-col space-y-3">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="flex-1 w-full min-h-[200px] p-3 rounded-xl bg-background border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent resize-none focus:ring-1 focus:ring-accent"
              placeholder="Record notes, updates, issues, or key metadata about this project here..."
            />
            
            <button
              onClick={handleSaveNotes}
              disabled={saving}
              className="self-end px-4 py-2 bg-accent hover:bg-accent-hover text-black font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save Notes
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
});
