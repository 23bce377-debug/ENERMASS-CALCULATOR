import React, { useState, useMemo } from 'react';
import { Search, ChevronRight } from 'lucide-react';
import { Select } from '@/components/ui/Select';
import { Card } from '@/components/ui/Card';
import { STATUS_LABELS, STATUS_STYLES } from '@/app/projects/page';

interface ProjectListProps {
  projects: any[];
  selectedProjectId: string | null | undefined;
  onSelectProject: (id: string) => void;
}

export const ProjectList = React.memo(function ProjectList({ projects, selectedProjectId, onSelectProject }: ProjectListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      const text = searchQuery.toLowerCase();
      const matchesSearch = 
        p.project_number.toLowerCase().includes(text) ||
        (p.quotes?.customer_name || '').toLowerCase().includes(text) ||
        (p.quotes?.customer_phone || '').toLowerCase().includes(text);

      const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [projects, searchQuery, statusFilter]);

  return (
    <Card className="w-full lg:w-96 shrink-0 space-y-4">
      <h3 className="font-bold text-text-primary text-sm">Project Master Ledger</h3>
      
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          type="text"
          placeholder="Search project number, client..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-xs border border-border rounded-lg bg-background text-text-primary focus:outline-none focus:border-accent"
        />
      </div>

      <Select
        value={statusFilter}
        onChange={setStatusFilter}
        options={[
          { value: 'all', label: 'All Projects' },
          { value: 'survey_phase', label: 'Survey Phase' },
          { value: 'engineering_design', label: 'Engineering Design' },
          { value: 'permitting', label: 'Permitting' },
          { value: 'material_dispatched', label: 'Materials Dispatched' },
          { value: 'installation_started', label: 'Installation Started' },
          { value: 'net_metering_pending', label: 'Net Metering Pending' },
          { value: 'commissioned', label: 'Commissioned' },
          { value: 'closed', label: 'Closed / Handover' }
        ]}
        className="text-xs"
      />

      <div className="h-px bg-border/40" />

      <div className="max-h-[600px] overflow-y-auto space-y-2 pr-1 scrollbar-thin scrollbar-thumb-border">
        {filteredProjects.length === 0 ? (
          <div className="text-center py-8 text-xs text-text-muted">No matching projects found</div>
        ) : (
          filteredProjects.map((p) => {
            const isSelected = p.id === selectedProjectId;
            return (
              <button
                key={p.id}
                onClick={() => onSelectProject(p.id)}
                className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all duration-200 cursor-pointer
                  ${isSelected 
                    ? 'border-accent bg-accent-glow shadow-md shadow-accent/5' 
                    : 'border-border bg-surface hover:border-border-light hover:bg-surface-hover'}`}
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-black text-text-primary">{p.project_number}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold border ${STATUS_STYLES[p.status] || ''}`}>
                      {STATUS_LABELS[p.status] || p.status}
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
    </Card>
  );
});
