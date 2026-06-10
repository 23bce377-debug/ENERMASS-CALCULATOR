'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase/client';
import { 
  Users, Plus, Search, Filter, RefreshCw, X, MessageSquare, 
  Phone, Mail, DollarSign, Calendar, Landmark, ClipboardList,
  Activity, CheckCircle2, ChevronRight, MessageCircle, Clock,
  ArrowRight, FileText
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/Confirm';
import { Select } from '@/components/ui/Select';
import { formatINR } from '@/lib/engine/calculator';

const LEAD_STATUS_LABELS: Record<string, string> = {
  new: 'New Lead',
  site_survey_requested: 'Survey Requested',
  qualified: 'Qualified',
  quote_presented: 'Proposal Sent',
  negotiation: 'In Negotiation',
  won: 'Won / Signed',
  lost: 'Closed / Lost'
};

const LEAD_STATUS_STYLES: Record<string, string> = {
  new: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  site_survey_requested: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  qualified: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
  quote_presented: 'bg-sky-500/10 text-sky-500 border-sky-500/20',
  negotiation: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  won: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  lost: 'bg-red-500/10 text-red-500 border-red-500/20'
};

const EVENT_TYPE_ICONS: Record<string, any> = {
  lead_created: <Users size={12} className="text-blue-500" />,
  status_changed: <Activity size={12} className="text-amber-500" />,
  phone_call: <Phone size={12} className="text-teal-500" />,
  email_sent: <Mail size={12} className="text-indigo-500" />,
  email_received: <Mail size={12} className="text-purple-500" />,
  whatsapp_sent: <MessageCircle size={12} className="text-emerald-500" />,
  whatsapp_received: <MessageCircle size={12} className="text-emerald-500" />,
  quote_generated: <FileText size={12} className="text-accent" />
};

export default function CrmPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Active view tabs
  const [activeTab, setActiveTab] = useState<'leads' | 'opportunities'>('leads');

  // Filters & State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedLead, setSelectedLead] = useState<any | null>(null);

  // Modals
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isOppModalOpen, setIsOppModalOpen] = useState(false);

  // New Lead Form State
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [leadSource, setLeadSource] = useState('Website');
  const [monthlyBill, setMonthlyBill] = useState('');
  const [roofArea, setRoofArea] = useState('');

  // New Event Form State
  const [eventType, setEventType] = useState('phone_call');
  const [eventTitle, setEventTitle] = useState('');
  const [eventDescription, setEventDescription] = useState('');

  // New Opportunity Form State
  const [oppTitle, setOppTitle] = useState('');
  const [expectedValue, setExpectedValue] = useState('');
  const [probability, setProbability] = useState('50');
  const [closeDate, setCloseDate] = useState('');
  const [oppStage, setOppStage] = useState('Proposal');

  const { toast } = useToast();
  const confirm = useConfirm();

  // Load Context
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('org_id')
          .eq('id', session.user.id)
          .single();
        if (profile?.org_id) {
          setOrgId(profile.org_id);
        }
      }
    });
  }, []);

  // Fetch CRM Data
  const fetchData = async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      // Fetch Leads
      const { data: leadsData, error: leadsErr } = await supabase
        .from('crm_leads')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false });
      if (leadsErr) throw leadsErr;
      setLeads(leadsData || []);

      // Fetch Opportunities
      const { data: oppsData, error: oppsErr } = await supabase
        .from('crm_opportunities')
        .select('*, crm_leads(first_name, last_name, phone)')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false });
      if (oppsErr) throw oppsErr;
      setOpportunities(oppsData || []);

    } catch (err: any) {
      console.error(err);
      toast(err.message || 'Failed to fetch CRM workspace data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (orgId) {
      fetchData();
    }
  }, [orgId]);

  // Load timeline for selected lead
  const fetchLeadTimeline = async (leadId: string) => {
    try {
      const { data, error } = await supabase
        .from('crm_timeline')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setTimeline(data || []);
    } catch (err: any) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (selectedLead) {
      fetchLeadTimeline(selectedLead.id);
    } else {
      setTimeline([]);
    }
  }, [selectedLead]);

  // Create Lead
  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const payload = {
        org_id: orgId,
        first_name: firstName,
        last_name: lastName || null,
        email: email || null,
        phone,
        lead_source: leadSource,
        monthly_bill: parseFloat(monthlyBill) || null,
        roof_area_estimate: parseFloat(roofArea) || null,
        status: 'new' as any
      };

      const { data: lead, error } = await supabase
        .from('crm_leads')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;

      // Log initial timeline event
      await supabase.from('crm_timeline').insert({
        lead_id: lead.id,
        title: 'Lead Created',
        description: `Lead for ${firstName} ${lastName || ''} was created in the system.`,
        event_type: 'lead_created',
        logged_by: user.id
      });

      toast(`Lead "${firstName} ${lastName || ''}" logged successfully!`, 'success');
      setIsLeadModalOpen(false);

      // Reset
      setFirstName('');
      setLastName('');
      setEmail('');
      setPhone('');
      setMonthlyBill('');
      setRoofArea('');

      fetchData();
    } catch (err: any) {
      toast(err.message || 'Failed to create lead', 'error');
    }
  };

  // Update Lead Status
  const handleUpdateStatus = async (leadId: string, newStatus: string) => {
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Unauthorized');

      const { error } = await supabase
        .from('crm_leads')
        .update({ 
          status: newStatus as any,
          updated_at: new Date().toISOString()
        })
        .eq('id', leadId);

      if (error) throw error;

      // Log to timeline
      await supabase.from('crm_timeline').insert({
        lead_id: leadId,
        title: 'Status Transitioned',
        description: `Lead stage changed from "${LEAD_STATUS_LABELS[lead.status]}" to "${LEAD_STATUS_LABELS[newStatus]}".`,
        event_type: 'status_changed',
        logged_by: user.id
      });

      toast(`Lead stage transitioned to: ${LEAD_STATUS_LABELS[newStatus]}`, 'success');
      if (selectedLead?.id === leadId) {
        setSelectedLead({ ...selectedLead, status: newStatus });
      }
      fetchData();
    } catch (err: any) {
      toast(err.message || 'Failed to update status', 'error');
    }
  };

  // Add Timeline Event
  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Unauthorized');

      const { error } = await supabase
        .from('crm_timeline')
        .insert({
          lead_id: selectedLead.id,
          title: eventTitle || `Logged ${eventType.replace('_', ' ')}`,
          description: eventDescription || null,
          event_type: eventType,
          logged_by: user.id
        });

      if (error) throw error;

      toast('Timeline event recorded!', 'success');
      setIsEventModalOpen(false);
      setEventTitle('');
      setEventDescription('');
      fetchLeadTimeline(selectedLead.id);
    } catch (err: any) {
      toast(err.message || 'Failed to add timeline event', 'error');
    }
  };

  // Create Opportunity from Lead
  const handleCreateOpportunity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId || !selectedLead) return;

    try {
      const payload = {
        org_id: orgId,
        lead_id: selectedLead.id,
        title: oppTitle || `${selectedLead.first_name}'s Solar Opportunity`,
        stage: oppStage,
        expected_value: parseFloat(expectedValue) || 0,
        probability_pct: parseInt(probability) || 50,
        close_date: closeDate || null
      };

      const { error } = await supabase
        .from('crm_opportunities')
        .insert(payload);

      if (error) throw error;

      toast('Pipeline Opportunity created for this client!', 'success');
      setIsOppModalOpen(false);
      setOppTitle('');
      setExpectedValue('');
      setCloseDate('');

      // Auto update lead status to negotiation
      handleUpdateStatus(selectedLead.id, 'negotiation');

      fetchData();
    } catch (err: any) {
      toast(err.message || 'Failed to create pipeline opportunity', 'error');
    }
  };

  // Filters leads
  const filteredLeads = useMemo(() => {
    return leads.filter(l => {
      const text = searchQuery.toLowerCase();
      const matchesSearch = 
        `${l.first_name} ${l.last_name || ''}`.toLowerCase().includes(text) ||
        (l.email || '').toLowerCase().includes(text) ||
        l.phone.toLowerCase().includes(text) ||
        l.lead_source.toLowerCase().includes(text);

      const matchesStatus = statusFilter === 'all' || l.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [leads, searchQuery, statusFilter]);

  // Filters opportunities
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

  // Statistics
  const crmStats = useMemo(() => {
    const totalLeads = leads.length;
    const activePipelineVal = opportunities.reduce((sum, o) => sum + Number(o.expected_value), 0);
    const conversionRate = totalLeads > 0 
      ? Math.round((leads.filter(l => l.status === 'won').length / totalLeads) * 100) 
      : 0;
    const openOpps = opportunities.filter(o => o.stage !== 'Closed Lost' && o.stage !== 'Closed Won').length;

    return { totalLeads, activePipelineVal, conversionRate, openOpps };
  }, [leads, opportunities]);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <main className="flex-1 p-4 md:p-6 max-w-7xl mx-auto w-full space-y-6">
        
        {/* Header section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-text-primary">CRM Client Workspace</h1>
            <p className="text-sm text-text-muted mt-0.5">Manage customer inquiries, project surveys, proposals, and pipeline conversions.</p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex bg-background border border-border rounded-xl p-1 shrink-0">
              <button
                onClick={() => { setActiveTab('leads'); setSelectedLead(null); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeTab === 'leads' ? 'bg-accent text-background shadow' : 'text-text-muted hover:text-text-primary'}`}
              >
                Lead Manager
              </button>
              <button
                onClick={() => { setActiveTab('opportunities'); setSelectedLead(null); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeTab === 'opportunities' ? 'bg-accent text-background shadow' : 'text-text-muted hover:text-text-primary'}`}
              >
                Opportunity Board
              </button>
            </div>

            <button
              onClick={() => setIsLeadModalOpen(true)}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-background text-xs font-bold transition-all shadow-md shadow-accent/15 cursor-pointer"
            >
              <Plus size={16} />
              Add Customer Lead
            </button>
          </div>
        </div>

        {/* Dashboard Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          <div className="bg-surface border border-border/40 rounded-2xl p-5 shadow-md card-hover flex items-center gap-4 relative overflow-hidden group">
            <div className="absolute right-0 top-0 w-24 h-24 bg-accent/5 rounded-full blur-2xl group-hover:bg-accent/10 transition-all duration-300" />
            <div className="w-12 h-12 rounded-xl bg-accent-dim text-accent flex items-center justify-center border border-accent/20 shrink-0">
              <Users size={22} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Total Leads</p>
              <h4 className="text-2xl font-black text-text-primary font-mono mt-1">{crmStats.totalLeads}</h4>
            </div>
          </div>

          <div className="bg-surface border border-border/40 rounded-2xl p-5 shadow-md card-hover flex items-center gap-4 relative overflow-hidden group">
            <div className="absolute right-0 top-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/10 transition-all duration-300" />
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center border border-blue-500/20 shrink-0">
              <ClipboardList size={22} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Open Opportunities</p>
              <h4 className="text-2xl font-black text-text-primary font-mono mt-1">{crmStats.openOpps}</h4>
            </div>
          </div>

          <div className="bg-surface border border-border/40 rounded-2xl p-5 shadow-md card-hover flex items-center gap-4 relative overflow-hidden group">
            <div className="absolute right-0 top-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-all duration-300" />
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center border border-emerald-500/20 shrink-0">
              <Landmark size={22} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Sales Pipeline Value</p>
              <h4 className="text-2xl font-black text-text-primary font-mono mt-1">{formatINR(crmStats.activePipelineVal)}</h4>
            </div>
          </div>

          <div className="bg-surface border border-border/40 rounded-2xl p-5 shadow-md card-hover flex items-center gap-4 relative overflow-hidden group">
            <div className="absolute right-0 top-0 w-24 h-24 bg-teal-500/5 rounded-full blur-2xl group-hover:bg-teal-500/10 transition-all duration-300" />
            <div className="w-12 h-12 rounded-xl bg-teal-500/10 text-teal-500 flex items-center justify-center border border-teal-500/20 shrink-0">
              <CheckCircle2 size={22} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Closed Wins Conversion</p>
              <h4 className="text-2xl font-black text-text-primary font-mono mt-1">{crmStats.conversionRate}%</h4>
            </div>
          </div>
        </div>

        {/* Ledger workspace split */}
        {activeTab === 'leads' ? (
          <div className="flex flex-col lg:flex-row gap-6">
            
            {/* Leads List (Left) */}
            <div className="w-full lg:w-96 shrink-0 bg-surface border border-border/40 rounded-2xl p-4 shadow-md space-y-4">
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
                    const isSelected = selectedLead?.id === l.id;
                    return (
                      <button
                        key={l.id}
                        onClick={() => setSelectedLead(l)}
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
                            <span className={`px-2 py-0.5 rounded-full text-[8px] font-semibold border shrink-0 ${LEAD_STATUS_STYLES[l.status]}`}>
                              {LEAD_STATUS_LABELS[l.status]}
                            </span>
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
            </div>

            {/* Lead Workspace Center/Right */}
            <div className="flex-1 min-w-0 bg-surface border border-border/40 rounded-2xl p-5 shadow-md min-h-[400px]">
              {selectedLead ? (
                <div className="space-y-6">
                  
                  {/* Lead Info Widget Header */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-5">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <h2 className="text-lg font-black text-text-primary">
                          {selectedLead.first_name} {selectedLead.last_name || ''}
                        </h2>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${LEAD_STATUS_STYLES[selectedLead.status]}`}>
                          {LEAD_STATUS_LABELS[selectedLead.status]}
                        </span>
                      </div>
                      <div className="text-xs text-text-muted flex flex-wrap gap-x-3 gap-y-1 font-mono">
                        <span>Source: {selectedLead.lead_source}</span>
                        <span>•</span>
                        <span>Logged: {new Date(selectedLead.created_at).toLocaleString('en-IN')}</span>
                      </div>
                    </div>

                    {/* Operational controls */}
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        onClick={() => setIsOppModalOpen(true)}
                        className="px-3 py-1.5 bg-accent-dim border border-accent/20 text-accent text-xs font-bold rounded-lg cursor-pointer hover:bg-accent/12 active:scale-95 transition-all"
                      >
                        Launch Pipeline Opportunity
                      </button>

                      <select
                        value={selectedLead.status}
                        onChange={(e) => handleUpdateStatus(selectedLead.id, e.target.value)}
                        className="bg-background border border-border text-xs font-semibold text-text-primary rounded-lg px-2.5 py-1.5 outline-none focus:border-accent"
                      >
                        <option value="new">New Lead</option>
                        <option value="site_survey_requested">Site Survey Requested</option>
                        <option value="qualified">Qualified</option>
                        <option value="quote_presented">Quote Presented</option>
                        <option value="negotiation">In Negotiation</option>
                        <option value="won">Closed Won</option>
                        <option value="lost">Closed Lost</option>
                      </select>
                    </div>
                  </div>

                  {/* Estimation Metrics grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
                    <div className="p-3 bg-background/50 border border-border/40 rounded-xl">
                      <span className="text-[10px] text-text-muted font-sans font-bold block uppercase tracking-wider">Estimated Roof Space</span>
                      <span className="text-text-primary font-bold text-sm mt-0.5 block">
                        {selectedLead.roof_area_estimate ? `${selectedLead.roof_area_estimate} Sqft` : 'Not Measured'}
                      </span>
                    </div>

                    <div className="p-3 bg-background/50 border border-border/40 rounded-xl">
                      <span className="text-[10px] text-text-muted font-sans font-bold block uppercase tracking-wider">Est. Monthly Power Bill</span>
                      <span className="text-text-primary font-bold text-sm mt-0.5 block">
                        {selectedLead.monthly_bill ? formatINR(selectedLead.monthly_bill) : 'Not Estimated'}
                      </span>
                    </div>

                    <div className="p-3 bg-background/50 border border-border/40 rounded-xl">
                      <span className="text-[10px] text-text-muted font-sans font-bold block uppercase tracking-wider">Contact Ledger</span>
                      <span className="text-text-primary font-bold text-[11px] mt-0.5 block truncate">
                        {selectedLead.phone} {selectedLead.email ? `· ${selectedLead.email}` : ''}
                      </span>
                    </div>
                  </div>

                  {/* Timeline Logs Ledger */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-border/30 pb-2">
                      <h3 className="text-xs font-black uppercase text-text-muted tracking-widest flex items-center gap-1.5">
                        <Activity size={14} className="text-accent" />
                        Engagement Timeline Event Logs
                      </h3>
                      <button
                        onClick={() => setIsEventModalOpen(true)}
                        className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-md border border-border text-text-secondary hover:border-accent hover:text-accent font-bold cursor-pointer transition-colors"
                      >
                        <Plus size={12} /> Log Activity
                      </button>
                    </div>

                    {/* Timeline logs */}
                    <div className="relative border-l border-border/60 pl-4 ml-2.5 space-y-4">
                      {timeline.length === 0 ? (
                        <div className="text-text-muted text-xs italic py-2">No timeline log files loaded for this lead context.</div>
                      ) : (
                        timeline.map((event) => (
                          <div key={event.id} className="relative space-y-1">
                            {/* Icon marker */}
                            <div className="absolute -left-[23px] top-0.5 w-4.5 h-4.5 rounded-full bg-background border border-border flex items-center justify-center shadow-sm">
                              {EVENT_TYPE_ICONS[event.event_type] || <MessageSquare size={10} className="text-text-muted" />}
                            </div>

                            <div className="flex items-center justify-between">
                              <h4 className="font-bold text-text-primary text-xs">{event.title}</h4>
                              <span className="text-[10px] text-text-muted font-mono">
                                {new Date(event.created_at).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
                              </span>
                            </div>
                            <p className="text-text-secondary text-xs leading-relaxed">{event.description}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center py-20 space-y-3">
                  <Users className="text-text-muted/30" size={48} />
                  <div>
                    <h4 className="font-bold text-text-primary text-sm">Customer Workspace Isolated</h4>
                    <p className="text-xs text-text-muted mt-1 max-w-sm">Select a client profile file from the left panel to review estimations, log site visits, and coordinate proposal revisions.</p>
                  </div>
                </div>
              )}
            </div>

          </div>
        ) : (
          /* Opportunities pipeline view */
          <div className="bg-surface border border-border/40 rounded-2xl p-4 shadow-md space-y-4">
            <div className="flex items-center justify-between border-b border-border/30 pb-3">
              <h3 className="font-bold text-text-primary text-sm">Operational Deal Pipeline</h3>
              <div className="relative w-64">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="text"
                  placeholder="Search deals, clients..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs border border-border rounded-lg bg-background text-text-primary focus:outline-none"
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
          </div>
        )}

      </main>

      {/* Log Lead Modal */}
      {isLeadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-lg shadow-2xl animate-fade-in overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-black text-text-primary text-sm uppercase tracking-widest flex items-center gap-1.5">
                <Users size={16} className="text-accent" />
                Setup Customer Lead Profile
              </h3>
              <button
                onClick={() => setIsLeadModalOpen(false)}
                className="p-1 rounded hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateLead} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-text-secondary font-bold">First Name *</label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. Ramesh"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-text-primary focus:outline-none focus:border-accent"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-text-secondary font-bold">Last Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Patel"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-text-primary focus:outline-none focus:border-accent"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-text-secondary font-bold">Phone Mobile *</label>
                  <input
                    required
                    type="text"
                    placeholder="10-digit number"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-text-primary focus:outline-none focus:border-accent"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-text-secondary font-bold">Email Address</label>
                  <input
                    type="email"
                    placeholder="e.g. client@domain.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-text-primary focus:outline-none focus:border-accent"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-text-secondary font-bold">Estimated Monthly Bill (INR)</label>
                  <input
                    type="number"
                    placeholder="₹ average monthly bill"
                    value={monthlyBill}
                    onChange={(e) => setMonthlyBill(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-text-primary focus:outline-none focus:border-accent font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-text-secondary font-bold">Estimated Usable Roof Area (Sqft)</label>
                  <input
                    type="number"
                    placeholder="e.g. 500"
                    value={roofArea}
                    onChange={(e) => setRoofArea(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-text-primary focus:outline-none focus:border-accent font-mono"
                  />
                </div>

                <div className="space-y-1.5 col-span-2">
                  <label className="text-text-secondary font-bold">Acquisition Channel / Source</label>
                  <select
                    value={leadSource}
                    onChange={(e) => setLeadSource(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-text-primary focus:outline-none focus:border-accent"
                  >
                    <option value="Website">Website Form</option>
                    <option value="Reference">Customer Referral</option>
                    <option value="Social Media">Social Marketing</option>
                    <option value="Cold Call">Cold Outreach</option>
                    <option value="Offline Campaign">Print/Offline Event</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-border/40">
                <button
                  type="button"
                  onClick={() => setIsLeadModalOpen(false)}
                  className="px-4 py-2 border border-border hover:bg-surface-hover rounded-lg font-bold text-text-secondary transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-accent hover:bg-accent-hover text-background font-bold rounded-lg transition-colors cursor-pointer"
                >
                  Log New Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Log Activity Modal */}
      {isEventModalOpen && selectedLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-md shadow-2xl animate-fade-in overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-black text-text-primary text-sm uppercase tracking-widest flex items-center gap-1.5">
                <Activity size={16} className="text-accent" />
                Log Customer Interaction
              </h3>
              <button
                onClick={() => setIsEventModalOpen(false)}
                className="p-1 rounded hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddEvent} className="p-5 space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="text-text-secondary font-bold">Activity Format</label>
                <select
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-text-primary focus:outline-none focus:border-accent"
                >
                  <option value="phone_call">Phone Call Dialed</option>
                  <option value="whatsapp_sent">WhatsApp Message Sent</option>
                  <option value="whatsapp_received">WhatsApp Message Received</option>
                  <option value="email_sent">Email Dispatched</option>
                  <option value="email_received">Email Received</option>
                  <option value="quote_generated">Custom Quote Sent</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-text-secondary font-bold">Event Title *</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Discussed pricing details"
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-text-primary focus:outline-none focus:border-accent"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-text-secondary font-bold">Detailed Interaction Log</label>
                <textarea
                  rows={4}
                  placeholder="Summarize client objections, design choices, schedule adjustments, etc."
                  value={eventDescription}
                  onChange={(e) => setEventDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-border/40">
                <button
                  type="button"
                  onClick={() => setIsEventModalOpen(false)}
                  className="px-4 py-2 border border-border hover:bg-surface-hover rounded-lg font-bold text-text-secondary transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-accent hover:bg-accent-hover text-background font-bold rounded-lg transition-colors cursor-pointer"
                >
                  Save Activity Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Launch Opportunity Modal */}
      {isOppModalOpen && selectedLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-md shadow-2xl animate-fade-in overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-black text-text-primary text-sm uppercase tracking-widest flex items-center gap-1.5">
                <DollarSign size={16} className="text-accent" />
                Launch Pipeline Opportunity
              </h3>
              <button
                onClick={() => setIsOppModalOpen(false)}
                className="p-1 rounded hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateOpportunity} className="p-5 space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="text-text-secondary font-bold">Deal / Project Title *</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. 5kW RCC Rooftop Proposal"
                  value={oppTitle}
                  onChange={(e) => setOppTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-text-primary focus:outline-none focus:border-accent"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-text-secondary font-bold">Deal Value Estimate (excl. GST) *</label>
                <input
                  required
                  type="number"
                  placeholder="₹ INR value"
                  value={expectedValue}
                  onChange={(e) => setExpectedValue(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-text-primary focus:outline-none focus:border-accent font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-text-secondary font-bold">Win Probability (%)</label>
                <select
                  value={probability}
                  onChange={(e) => setProbability(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-text-primary focus:outline-none focus:border-accent font-mono"
                >
                  <option value="10">10% - Cold Lead / Pitch</option>
                  <option value="30">30% - Survey Complete</option>
                  <option value="50">50% - Proposal Sent</option>
                  <option value="70">70% - Review / Negotiation</option>
                  <option value="90">90% - Verbal Confirmation</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-text-secondary font-bold">Deal Stage</label>
                <select
                  value={oppStage}
                  onChange={(e) => setOppStage(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-text-primary focus:outline-none"
                >
                  <option value="Lead Qualification">Lead Qualification</option>
                  <option value="Site Survey">Site Survey</option>
                  <option value="Proposal Drafted">Proposal Drafted</option>
                  <option value="Negotiation">Negotiation</option>
                  <option value="Verbal Commit">Verbal Commit</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-text-secondary font-bold">Estimated Close Target Date</label>
                <input
                  type="date"
                  value={closeDate}
                  onChange={(e) => setCloseDate(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-text-primary focus:outline-none focus:border-accent"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-border/40">
                <button
                  type="button"
                  onClick={() => setIsOppModalOpen(false)}
                  className="px-4 py-2 border border-border hover:bg-surface-hover rounded-lg font-bold text-text-secondary transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-accent hover:bg-accent-hover text-background font-bold rounded-lg transition-colors cursor-pointer"
                >
                  Launch Deal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
