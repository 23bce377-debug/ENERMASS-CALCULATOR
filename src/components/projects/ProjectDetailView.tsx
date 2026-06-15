import React, { useState } from 'react';
import { Clock, Wrench, User, Activity, ClipboardList, CheckCircle, PackageSearch, AlertTriangle, ExternalLink } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { STATUS_LABELS, STATUS_STYLES, MILESTONE_LABELS } from '@/app/projects/page';
import { formatINR } from '@/lib/engine/calculator';
import { FinanceTimeline } from './FinanceTimeline';

interface ProjectDetailViewProps {
  projectDetails: any;
  detailsLoading: boolean;
  profiles: any[];
  onAssignPM: (pmId: string | null) => void;
  onUpdateStatus: (status: string) => void;
  onToggleMilestone: (milestone: any) => void;
}

export const ProjectDetailView = React.memo(function ProjectDetailView({
  projectDetails,
  detailsLoading,
  profiles,
  onAssignPM,
  onUpdateStatus,
  onToggleMilestone
}: ProjectDetailViewProps) {

  if (detailsLoading) {
    return (
      <Card className="flex-1 min-h-[400px] flex flex-col items-center justify-center">
        <Clock className="animate-spin text-accent mb-3" size={32} />
        <p className="text-sm text-text-muted">Loading technical project files...</p>
      </Card>
    );
  }

  if (!projectDetails) {
    return (
      <Card className="flex-1 min-h-[400px] flex flex-col items-center justify-center text-center space-y-3">
        <Wrench className="text-text-muted" size={40} />
        <div>
          <h4 className="text-sm font-bold text-text-primary">No Project Selected</h4>
          <p className="text-xs text-text-muted mt-1 max-w-sm">Select a rooftop project ledger from the left panel to review drawings, track civil milestone cure logs, and update status timelines.</p>
        </div>
      </Card>
    );
  }

  const stages = ['survey_phase', 'engineering_design', 'permitting', 'material_dispatched', 'installation_started', 'net_metering_pending', 'commissioned', 'closed'];

  return (
    <div className="flex-1 min-w-0 space-y-6">
      {/* Project Header Widget */}
      <Card className="flex flex-col md:flex-row md:items-center justify-between gap-4">
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
              onChange={(e) => onAssignPM(e.target.value ? e.target.value : null)}
              className="px-2 py-1.5 border border-border rounded-lg bg-background text-xs text-text-primary focus:outline-none focus:border-accent"
            >
              <option value="">Assign Project PM</option>
              {profiles.map(prof => (
                <option key={prof.id} value={prof.id}>{prof.full_name}</option>
              ))}
            </select>
          </div>

          <select
            value={projectDetails.status}
            onChange={(e) => onUpdateStatus(e.target.value)}
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

          <a
            href={`/projects/${projectDetails.id}/net-metering`}
            className="px-3 py-1.5 border border-border rounded-lg bg-surface-hover hover:bg-accent hover:text-white transition-colors text-xs font-semibold text-text-primary flex items-center gap-1"
          >
            <Activity size={14} />
            Net Metering Tracker
          </a>
        </div>
      </Card>

      {/* Progress Pipeline Timeline */}
      <Card className="space-y-3">
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
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Milestone Tracking Checklist */}
        <Card className="space-y-4">
          <h3 className="text-xs font-black uppercase text-text-muted tracking-widest flex items-center gap-1.5">
            <ClipboardList size={14} className="text-accent" />
            Statutory & EPC Milestone Tracking
          </h3>

          <div className="divide-y divide-border/40 font-mono text-xs">
            {(projectDetails.epc_project_milestones || [])
              .sort((a: any, b: any) => {
                const order = ['survey_approved', 'structural_design_freeze', 'civil_foundation_done', 'concrete_curing', 'panel_installation_done', 'inverter_wiring_done', 'net_metering_approved', 'discom_charging', 'handover'];
                return order.indexOf(a.milestone) - order.indexOf(b.milestone);
              })
              .map((m: any) => {
                const isDone = m.status === 'completed';
                
                // Show curing countdown
                const isCuring = m.milestone === 'concrete_curing' && !isDone;
                let daysLeft = 0;
                if (isCuring && m.target_date) {
                  const targetTime = new Date(m.target_date).getTime();
                  const nowTime = new Date().getTime();
                  daysLeft = Math.ceil((targetTime - nowTime) / (1000 * 60 * 60 * 24));
                }
                const isCuringDone = isCuring && daysLeft <= 0;

                return (
                  <div key={m.id} className="flex items-center justify-between py-3">
                    <div className="space-y-0.5">
                      <h4 className="font-sans font-bold text-text-primary">{MILESTONE_LABELS[m.milestone]}</h4>
                      <div className="text-[10px] text-text-muted">
                        Target: {m.target_date} {m.actual_date ? `| Actual: ${m.actual_date}` : ''}
                      </div>
                      
                      {isCuring && !isCuringDone && (
                        <div className="text-[10px] text-warning flex items-center gap-1 mt-1">
                          <Clock size={10} /> Curing in progress: {daysLeft} days remaining.
                        </div>
                      )}
                      {isCuringDone && !isDone && (
                        <div className="text-[10px] text-success flex items-center gap-1 mt-1 font-bold">
                          <CheckCircle size={10} /> Curing complete! Ready for sign off.
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => onToggleMilestone(m)}
                      disabled={isCuring && !isCuringDone}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-black transition-all
                        ${isDone 
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500 cursor-pointer' 
                          : isCuring && !isCuringDone
                          ? 'bg-surface-active border-border text-text-muted cursor-not-allowed opacity-60'
                          : 'bg-background border-border text-text-muted hover:border-accent hover:text-accent cursor-pointer'}`}
                    >
                      {isDone ? (
                        <>
                          <CheckCircle size={12} />
                          Completed
                        </>
                      ) : isCuring && !isCuringDone ? (
                        'Wait'
                      ) : (
                        'Mark Done'
                      )}
                    </button>
                  </div>
                );
              })}
          </div>
        </Card>

        {/* Additional panels (Finance, Inventory) */}
        <div className="space-y-6">
          <Card className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase text-text-muted tracking-widest flex items-center gap-1.5">
                <PackageSearch size={14} className="text-accent" />
                Inventory & Logistics
              </h3>
              <a 
                href={`/projects/${projectDetails.id}/inventory`}
                className="text-xs font-bold text-accent hover:text-accent-hover flex items-center gap-1"
              >
                Track Site <ExternalLink size={12} />
              </a>
            </div>
            
            <div className="p-4 bg-surface-active border border-border/40 rounded-xl">
              <div className="flex items-center gap-3 text-sm font-medium text-text-primary mb-2">
                <AlertTriangle size={16} className="text-warning" />
                Action Required
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">
                Logistics tracking requires verification. Ensure materials are dispatched from the warehouse before marking 'Materials Dispatched' in the milestone tracker.
              </p>
            </div>
          </Card>
          
          {projectDetails?.quote_id && <FinanceTimeline quoteId={projectDetails.quote_id} />}
        </div>
      </div>
    </div>
  );
});
