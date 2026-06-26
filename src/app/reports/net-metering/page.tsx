'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Activity, Search, Filter, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { Select } from '@/components/ui/Select';

const STAGE_LABELS = {
  'feasibility': 'Feasibility',
  'registration': 'Registration',
  'inspection': 'Inspection',
  'meter_change': 'Meter Change',
  'approved': 'Approved'
};

const STAGE_SLAS = {
  'feasibility': 15,
  'registration': 30,
  'inspection': 21,
  'meter_change': 15,
  'approved': 0
};

export default function NetMeteringReport() {
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [overdueOnly, setOverdueOnly] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        // Supabase join with epc_projects
        const { data, error } = await supabase
          .from('net_metering_applications')
          .select(`
            id,
            project_id,
            discom_name,
            consumer_number,
            current_stage,
            updated_at,
            epc_projects!inner(project_number)
          `)
          .order('updated_at', { ascending: false });

        if (error) throw error;
        setApplications(data || []);
      } catch (err) {
        console.error("Failed to load net metering applications", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const filteredApps = applications.filter(app => {
    const sla = STAGE_SLAS[app.current_stage as keyof typeof STAGE_SLAS];
    const daysInStage = Math.floor((new Date().getTime() - new Date(app.updated_at).getTime()) / (1000 * 3600 * 24));
    const isBreached = sla > 0 && daysInStage > sla;

    if (stageFilter !== 'all' && app.current_stage !== stageFilter) return false;
    if (overdueOnly && !isBreached) return false;
    return true;
  });

  if (loading) return <div className="p-8 text-center text-text-muted">Loading Applications...</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <Activity className="text-accent" /> Net Metering Tracker
          </h1>
          <p className="text-text-muted text-sm mt-1">Aggregate view of all active DISCOM applications and SLA compliance.</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 bg-surface p-4 rounded-xl border border-border items-center">
        <div className="flex-1 flex gap-4 w-full">
          <div className="relative flex-1">
            <Select 
              value={stageFilter}
              onChange={(val) => setStageFilter(val)}
              options={[
                { value: 'all', label: 'All Stages' },
                ...Object.entries(STAGE_LABELS).map(([k, v]) => ({ value: k, label: v }))
              ]}
              className="w-full"
            />
          </div>
          
          <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer whitespace-nowrap px-4 py-2 border border-border rounded-lg hover:border-accent transition-colors">
            <input 
              type="checkbox" 
              checked={overdueOnly} 
              onChange={(e) => setOverdueOnly(e.target.checked)}
              className="w-4 h-4 rounded text-accent focus:ring-accent accent-accent"
            />
            Overdue Only
          </label>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead>
              <tr className="bg-surface-active border-b border-border text-text-muted uppercase tracking-wider text-xs font-bold">
                <th className="px-4 py-4">Project No.</th>
                <th className="px-4 py-4">DISCOM</th>
                <th className="px-4 py-4">Consumer No</th>
                <th className="px-4 py-4">Current Stage</th>
                <th className="px-4 py-4">Elapsed Days</th>
                <th className="px-4 py-4">SLA Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredApps.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-text-muted">No applications match criteria.</td></tr>
              ) : (
                filteredApps.map(app => {
                  const sla = STAGE_SLAS[app.current_stage as keyof typeof STAGE_SLAS];
                  const daysInStage = Math.floor((new Date().getTime() - new Date(app.updated_at).getTime()) / (1000 * 3600 * 24));
                  const isBreached = sla > 0 && daysInStage > sla;

                  return (
                    <tr key={app.id} className="hover:bg-surface-hover transition-colors">
                      <td className="px-4 py-3 font-medium text-text-primary">
                        {app.epc_projects?.project_number || 'Unknown'}
                      </td>
                      <td className="px-4 py-3 text-text-primary">{app.discom_name}</td>
                      <td className="px-4 py-3 text-text-secondary">{app.consumer_number}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${app.current_stage === 'approved' ? 'bg-success/10 text-success' : 'bg-info/10 text-info'}`}>
                          {STAGE_LABELS[app.current_stage as keyof typeof STAGE_LABELS]}
                        </span>
                      </td>
                      <td className={`px-4 py-3 font-medium ${isBreached ? 'text-error' : 'text-text-primary'}`}>
                        {daysInStage} days
                      </td>
                      <td className="px-4 py-3">
                        {app.current_stage === 'approved' ? (
                          <span className="text-success text-xs font-semibold">Completed</span>
                        ) : isBreached ? (
                          <span className="flex items-center gap-1.5 text-error text-xs font-semibold">
                            <AlertTriangle size={14} /> Breached (SLA: {sla})
                          </span>
                        ) : (
                          <span className="text-success text-xs font-semibold">On Track (SLA: {sla})</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
