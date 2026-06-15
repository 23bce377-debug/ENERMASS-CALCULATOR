import React, { useState, useMemo } from 'react';
import { Search, DollarSign } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { formatINR } from '@/lib/engine/calculator';

interface OpportunityBoardProps {
  opportunities: any[];
  loading: boolean;
}

export const OpportunityBoard = React.memo(function OpportunityBoard({ opportunities, loading }: OpportunityBoardProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredOpps = useMemo(() => {
    return opportunities.filter(o => {
      const text = searchQuery.toLowerCase();
      return (
        o.title.toLowerCase().includes(text) ||
        `${o.crm_leads?.first_name} ${o.crm_leads?.last_name || ''}`.toLowerCase().includes(text) ||
        o.stage.toLowerCase().includes(text)
      );
    });
  }, [opportunities, searchQuery]);

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between border-b border-border/30 pb-3">
        <h3 className="font-bold text-text-primary text-sm">Operational Deal Pipeline</h3>
        <div className="relative w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Search deals, clients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-border rounded-lg bg-background text-text-primary focus:outline-none focus:border-accent"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-xs text-text-muted font-mono uppercase tracking-widest animate-pulse">Loading deal sheets...</div>
      ) : filteredOpps.length === 0 ? (
        <div className="text-center py-20 text-xs text-text-muted">No active pipeline deals mapped. Select a lead and click "Launch Pipeline Opportunity".</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-background/80 border-b border-border text-[10px] uppercase tracking-wider text-text-muted font-bold">
                <th className="px-4 py-3">Project Deal Title</th>
                <th className="px-4 py-3">Associated Client</th>
                <th className="px-4 py-3 text-right">Deal Value (INR)</th>
                <th className="px-4 py-3 text-center">Probability</th>
                <th className="px-4 py-3">Closing Target</th>
                <th className="px-4 py-3 text-center">Deal Stage</th>
              </tr>
            </thead>
            <tbody>
              {filteredOpps.map((opp) => (
                <tr key={opp.id} className="border-b border-border/30 hover:bg-surface-hover/20 transition-colors">
                  <td className="px-4 py-3 font-bold text-text-primary flex items-center gap-1.5">
                    <DollarSign size={14} className="text-accent" />
                    {opp.title}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">
                    {opp.crm_leads?.first_name} {opp.crm_leads?.last_name || ''}
                    <div className="text-[10px] text-text-muted font-mono mt-0.5">{opp.crm_leads?.phone}</div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-accent">{formatINR(opp.expected_value)}</td>
                  <td className="px-4 py-3 text-center font-mono font-bold">
                    {opp.probability_pct}%
                    <div className="w-16 h-1 bg-background rounded-full mx-auto mt-1 overflow-hidden">
                      <div className="h-full bg-accent" style={{ width: `${opp.probability_pct}%` }} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-text-secondary font-mono">{opp.close_date || 'TBD'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[9px] font-semibold bg-accent-dim border border-accent/20 text-accent">
                      {opp.stage}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
});
