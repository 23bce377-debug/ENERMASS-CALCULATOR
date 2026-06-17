'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { LeadORM, TimelineORM, type LeadRow, type TimelineRow } from '@/backend/orm/crm';
import { 
  User, Phone, Mail, MapPin, Calendar, Clock, 
  ArrowRight, FileText, CheckCircle2, ChevronRight,
  ClipboardList, CreditCard
} from 'lucide-react';
import Link from 'next/link';

const STAGES = ['New', 'Contacted', 'Surveyed', 'Quoted', 'Won', 'Lost'];

export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [lead, setLead] = useState<LeadRow | null>(null);
  const [timeline, setTimeline] = useState<TimelineRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const leadData = await LeadORM.getById(id);
        if (!leadData) throw new Error('Lead not found');
        setLead(leadData);
        
        const timelineData = await TimelineORM.getByLeadId(id);
        setTimeline(timelineData);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id]);

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#f0a500]"></div>
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="bg-red-500/10 border border-red-500/30 text-red-500 p-4 rounded-lg">
          Error: {error || 'Lead not found'}
        </div>
      </div>
    );
  }

  const currentStageIndex = STAGES.findIndex(s => s.toLowerCase() === lead.status.toLowerCase());
  const displayStageIndex = currentStageIndex === -1 ? 0 : currentStageIndex;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 bg-[#1a1a1a] p-6 rounded-xl border border-[#2a2a2a] shadow-lg">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-full bg-[#f0a500]/20 flex items-center justify-center text-[#f0a500]">
              <User size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">
                {lead.first_name} {lead.last_name || ''}
              </h1>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#f0a500]/10 text-[#f0a500] border border-[#f0a500]/20 mt-1">
                {lead.status.toUpperCase()}
              </span>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-4 text-sm text-[#888]">
            {lead.phone && (
              <div className="flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer">
                <Phone size={14} /> {lead.phone}
              </div>
            )}
            {lead.email && (
              <div className="flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer">
                <Mail size={14} /> {lead.email}
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Calendar size={14} /> Added {new Date(lead.created_at).toLocaleDateString()}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2">
          <Link href={`/projects?createForLead=${id}`}>
            <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2a2a2a] text-white hover:bg-[#333] transition-colors text-sm font-medium border border-[#444]">
              <ClipboardList size={16} />
              Convert to Project
            </button>
          </Link>
          <Link href={`/calculator?leadId=${id}`}>
            <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#f0a500] text-black hover:bg-[#f0a500]/90 transition-colors text-sm font-bold shadow-[0_0_15px_rgba(240,165,0,0.3)]">
              <FileText size={16} />
              New Quote
            </button>
          </Link>
        </div>
      </div>

      {/* Pipeline Visualizer */}
      <div className="bg-[#1a1a1a] p-6 rounded-xl border border-[#2a2a2a] shadow-lg">
        <h2 className="text-sm font-semibold text-[#888] uppercase tracking-wider mb-6">Pipeline Stage</h2>
        <div className="relative flex items-center justify-between w-full">
          {/* Connecting Line */}
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-[#2a2a2a] rounded-full z-0" />
          <div 
            className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-[#f0a500] rounded-full z-0 transition-all duration-500 ease-in-out" 
            style={{ width: `${(displayStageIndex / (STAGES.length - 1)) * 100}%` }}
          />
          
          {STAGES.map((stage, index) => {
            const isCompleted = index <= displayStageIndex;
            const isCurrent = index === displayStageIndex;
            return (
              <div key={stage} className="relative z-10 flex flex-col items-center gap-2">
                <div 
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg
                    ${isCompleted ? 'bg-[#f0a500] text-black border-2 border-[#1a1a1a]' : 'bg-[#1a1a1a] text-[#555] border-2 border-[#333]'}
                    ${isCurrent ? 'ring-4 ring-[#f0a500]/20 scale-110' : ''}
                  `}
                >
                  {isCompleted ? <CheckCircle2 size={16} /> : <span className="text-xs font-bold">{index + 1}</span>}
                </div>
                <span className={`text-xs font-medium transition-colors ${isCurrent ? 'text-[#f0a500]' : isCompleted ? 'text-white' : 'text-[#555]'}`}>
                  {stage}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Details */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-[#1a1a1a] p-6 rounded-xl border border-[#2a2a2a] shadow-lg">
            <h2 className="text-sm font-semibold text-[#888] uppercase tracking-wider mb-4 border-b border-[#2a2a2a] pb-2">Lead Info</h2>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-[#666] mb-1">Source</p>
                <p className="text-sm text-white font-medium">{lead.lead_source || 'Unknown'}</p>
              </div>
              <div>
                <p className="text-xs text-[#666] mb-1">Monthly Bill Estimate</p>
                <p className="text-sm text-white font-medium">
                  {lead.monthly_bill ? `₹${lead.monthly_bill.toLocaleString()}` : 'Not provided'}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#666] mb-1">Roof Area Estimate</p>
                <p className="text-sm text-white font-medium">
                  {lead.roof_area_estimate ? `${lead.roof_area_estimate} sq.ft` : 'Not provided'}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#666] mb-1">Assigned Rep</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-6 h-6 rounded-full bg-[#333] flex items-center justify-center text-xs text-[#888]">
                    {lead.assigned_to ? 'SR' : '?'}
                  </div>
                  <p className="text-sm text-white font-medium">{lead.assigned_to || 'Unassigned'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Activity Log */}
        <div className="lg:col-span-2">
          <div className="bg-[#1a1a1a] p-6 rounded-xl border border-[#2a2a2a] shadow-lg h-full">
            <div className="flex items-center justify-between mb-6 border-b border-[#2a2a2a] pb-3">
              <h2 className="text-sm font-semibold text-[#888] uppercase tracking-wider">Activity Timeline</h2>
              <button className="text-xs text-[#f0a500] hover:text-[#f0a500]/80 font-medium">+ Add Note</button>
            </div>
            
            {timeline.length === 0 ? (
              <div className="text-center py-12 text-[#555]">
                <Clock size={32} className="mx-auto mb-3 opacity-50" />
                <p className="text-sm">No activity recorded yet.</p>
              </div>
            ) : (
              <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-[#333] before:to-transparent">
                {timeline.map((event, i) => (
                  <div key={event.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    {/* Icon */}
                    <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-[#1a1a1a] bg-[#2a2a2a] text-[#888] shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                      {event.event_type === 'lead_created' ? <User size={14} /> : 
                       event.event_type === 'status_changed' ? <ArrowRight size={14} /> : 
                       <Clock size={14} />}
                    </div>
                    {/* Card */}
                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded border border-[#2a2a2a] bg-[#111] shadow">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-bold text-white text-sm">{event.title}</h3>
                        <time className="text-[10px] text-[#555] font-mono">{new Date(event.created_at).toLocaleDateString()}</time>
                      </div>
                      <p className="text-sm text-[#888]">{event.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
