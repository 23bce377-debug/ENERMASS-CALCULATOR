import React, { useState, useMemo } from 'react';
import { Search, Phone, ChevronRight } from 'lucide-react';
import { Select } from '@/components/ui/Select';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

export const LEAD_STATUS_LABELS: Record<string, string> = {
  new: 'New Lead',
  site_survey_requested: 'Survey Requested',
  qualified: 'Qualified',
  quote_presented: 'Proposal Sent',
  negotiation: 'In Negotiation',
  won: 'Won / Signed',
  lost: 'Closed / Lost'
};

const LEAD_STATUS_VARIANTS: Record<string, any> = {
  new: 'info',
  site_survey_requested: 'outline',
  qualified: 'default',
  quote_presented: 'info',
  negotiation: 'warning',
  won: 'success',
  lost: 'error'
};

interface LeadLedgerProps {
  leads: any[];
  selectedLeadId: string | undefined;
  onSelectLead: (lead: any) => void;
  loading: boolean;
}

export const LeadLedger = React.memo(function LeadLedger({ leads, selectedLeadId, onSelectLead, loading }: LeadLedgerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const filteredLeads = useMemo(() => {
    return leads.filter(l => {
      const text = searchQuery.toLowerCase();
      const matchesSearch = 
        `${l.first_name} ${l.last_name || ''}`.toLowerCase().includes(text) ||
        (l.email || '').toLowerCase().includes(text) ||
        (l.phone || '').toLowerCase().includes(text) ||
        (l.lead_source || '').toLowerCase().includes(text);

      const matchesStatus = statusFilter === 'all' || l.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [leads, searchQuery, statusFilter]);

  return (
    <Card className="w-full lg:w-96 shrink-0 space-y-4">
      <h3 className="font-bold text-text-primary text-sm">Customer Lead Ledger</h3>
      
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          type="text"
          placeholder="Search customer, phone, source..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-xs border border-border rounded-lg bg-background text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
        />
      </div>

      <Select
        value={statusFilter}
        onChange={setStatusFilter}
        options={[
          { value: 'all', label: 'All Lead Stages' },
          { value: 'new', label: 'New Lead' },
          { value: 'site_survey_requested', label: 'Site Survey' },
          { value: 'qualified', label: 'Qualified' },
          { value: 'quote_presented', label: 'Quote Presented' },
          { value: 'negotiation', label: 'In Negotiation' },
          { value: 'won', label: 'Closed Won' },
          { value: 'lost', label: 'Closed Lost' }
        ]}
        className="text-xs"
      />

      <div className="h-px bg-border/40" />

      {/* Scrollable list */}
      <div className="max-h-[500px] overflow-y-auto space-y-2 pr-1 scrollbar-thin scrollbar-thumb-border">
        {loading ? (
          <div className="text-center py-8 text-xs text-text-muted font-mono animate-pulse uppercase tracking-wider">Loading files...</div>
        ) : filteredLeads.length === 0 ? (
          <div className="text-center py-8 text-xs text-text-muted">No leads match filters.</div>
        ) : (
          filteredLeads.map((l) => {
            const isSelected = selectedLeadId === l.id;
            return (
              <button
                key={l.id}
                onClick={() => onSelectLead(l)}
                className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all duration-200 cursor-pointer
                  ${isSelected 
                    ? 'border-accent bg-accent-glow shadow shadow-accent/5' 
                    : 'border-border bg-surface hover:border-border-light hover:bg-surface-hover'}`}
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-sans font-bold text-text-primary text-xs truncate">
                      {l.first_name} {l.last_name || ''}
                    </span>
                    <Badge variant={LEAD_STATUS_VARIANTS[l.status] || 'default'} className="shrink-0 text-[10px]">
                      {LEAD_STATUS_LABELS[l.status] || l.status}
                    </Badge>
                  </div>
                  <div className="text-[10px] text-text-secondary flex items-center gap-1">
                    <Phone size={9} /> {l.phone}
                  </div>
                  <div className="text-[9px] text-text-muted uppercase">
                    Source: {l.lead_source} {l.roof_area_estimate ? `· ${l.roof_area_estimate} sqft` : ''}
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
