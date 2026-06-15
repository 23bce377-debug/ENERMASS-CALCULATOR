'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase/client';
import { 
  Users, Plus, Search, Filter, RefreshCw, X, MessageSquare, 
  Phone, Mail, DollarSign, Calendar, Landmark, ClipboardList,
  Activity, CheckCircle2, ChevronRight, MessageCircle, Clock,
  ArrowRight, FileText, MapPin, ShieldCheck, CheckCircle, AlertTriangle
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/Confirm';
import { Select } from '@/components/ui/Select';
import { formatINR } from '@/lib/engine/calculator';
import { LeadLedger } from '@/components/crm/LeadLedger';
import { LeadDetailView } from '@/components/crm/LeadDetailView';
import { OpportunityBoard } from '@/components/crm/OpportunityBoard';

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

  // Survey panel state
  const [showSurveyPanel, setShowSurveyPanel] = useState(false);
  const [leadSurvey, setLeadSurvey] = useState<any | null>(null);
  const [surveyLoading, setSurveyLoading] = useState(false);
  const [surveyDate, setSurveyDate] = useState('');
  const [surveyorId, setSurveyorId] = useState('');
  const [profiles, setProfiles] = useState<any[]>([]);
  // For mark-complete form
  const [showCompleteForm, setShowCompleteForm] = useState(false);
  const [surveyRoofArea, setSurveyRoofArea] = useState('');
  const [surveyRoofType, setSurveyRoofType] = useState('rcc_roof_elevated');
  const [surveyMeterPhase, setSurveyMeterPhase] = useState('single');
  const [surveyDCDist, setSurveyDCDist] = useState('');
  const [surveyACDist, setSurveyACDist] = useState('');
  const [surveySanctionedLoad, setSurveySanctionedLoad] = useState('');
  const [surveyDiscom, setSurveyDiscom] = useState('');
  const [surveyConsumerNo, setSurveyConsumerNo] = useState('');
  const [surveyNetMetering, setSurveyNetMetering] = useState(true);
  const [surveyNotes, setSurveyNotes] = useState('');

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
      fetchLeadSurvey(selectedLead.id);
      setShowSurveyPanel(false);
      setShowCompleteForm(false);
    } else {
      setTimeline([]);
      setLeadSurvey(null);
    }
  }, [selectedLead]);

  // Fetch survey for selected lead
  const fetchLeadSurvey = async (leadId: string) => {
    setSurveyLoading(true);
    try {
      const { data } = await supabase
        .from('crm_site_surveys')
        .select('*')
        .eq('lead_id', leadId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setLeadSurvey(data || null);
    } catch (err) {
      console.error(err);
    } finally {
      setSurveyLoading(false);
    }
  };

  // Load profiles for surveyor select
  useEffect(() => {
    if (!orgId) return;
    supabase.from('profiles').select('id, full_name').eq('org_id', orgId)
      .then(({ data }) => setProfiles(data || []));
  }, [orgId]);

  // Schedule survey
  const handleScheduleSurvey = async () => {
    if (!selectedLead || !orgId) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const payload: any = {
        org_id: orgId,
        lead_id: selectedLead.id,
        status: 'scheduled',
        conducted_by: surveyorId || null,
        conducted_at: surveyDate ? new Date(surveyDate).toISOString() : null,
        updated_at: new Date().toISOString(),
      };

      if (leadSurvey) {
        await supabase.from('crm_site_surveys').update(payload).eq('id', leadSurvey.id);
      } else {
        await supabase.from('crm_site_surveys').insert(payload);
      }

      // Update lead status
      await supabase.from('crm_leads').update({ status: 'site_survey_requested' as any }).eq('id', selectedLead.id);
      await supabase.from('crm_timeline').insert({
        lead_id: selectedLead.id,
        title: 'Site Survey Scheduled',
        description: `Site survey scheduled${surveyDate ? ` for ${surveyDate}` : ''}.`,
        event_type: 'status_changed',
        logged_by: user.id,
      });

      toast('Site survey scheduled!', 'success');
      setShowSurveyPanel(false);
      setSurveyDate('');
      setSurveyorId('');
      fetchLeadSurvey(selectedLead.id);
      fetchData();
    } catch (err: any) {
      toast(err.message || 'Failed to schedule survey', 'error');
    }
  };

  // Mark survey complete with measurements
  const handleCompleteSurvey = async () => {
    if (!selectedLead || !orgId) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const updates: any = {
        status: 'completed',
        conducted_at: surveyDate ? new Date(surveyDate).toISOString() : new Date().toISOString(),
        roof_area_sqft: parseFloat(surveyRoofArea) || null,
        roof_type: surveyRoofType || null,
        meter_phase: surveyMeterPhase,
        distance_panel_to_inverter_m: parseFloat(surveyDCDist) || null,
        distance_inverter_to_meter_m: parseFloat(surveyACDist) || null,
        sanctioned_load_kw: parseFloat(surveySanctionedLoad) || null,
        discom_name: surveyDiscom || null,
        consumer_number: surveyConsumerNo || null,
        net_metering_available: surveyNetMetering,
        survey_notes: surveyNotes || null,
        conducted_by: surveyorId || user.id,
        updated_at: new Date().toISOString(),
      };

      if (leadSurvey) {
        await supabase.from('crm_site_surveys').update(updates).eq('id', leadSurvey.id);
      } else {
        await supabase.from('crm_site_surveys').insert({ ...updates, org_id: orgId, lead_id: selectedLead.id });
      }

      await supabase.from('crm_timeline').insert({
        lead_id: selectedLead.id,
        title: 'Site Survey Completed',
        description: 'Site survey measurements recorded. Quote can now be sent.',
        event_type: 'status_changed',
        logged_by: user.id,
      });

      toast('Site survey marked as completed!', 'success');
      setShowCompleteForm(false);
      setShowSurveyPanel(false);
      fetchLeadSurvey(selectedLead.id);
    } catch (err: any) {
      toast(err.message || 'Failed to complete survey', 'error');
    }
  };

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
          event_type: eventType as any,
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
            <LeadLedger
              leads={leads}
              selectedLeadId={selectedLead?.id}
              onSelectLead={setSelectedLead}
              loading={loading}
            />
            <LeadDetailView
              selectedLead={selectedLead}
              timeline={timeline}
              leadSurvey={leadSurvey}
              profiles={profiles}
              onUpdateStatus={handleUpdateStatus}
              onLaunchOpportunity={() => setIsOppModalOpen(true)}
              onLogActivity={() => setIsEventModalOpen(true)}
              onScheduleSurvey={(data) => {
                setSurveyDate(data.surveyDate);
                setSurveyorId(data.surveyorId);
                setTimeout(handleScheduleSurvey, 0); // Hack to use existing state, ideally would refactor this too
              }}
              onCompleteSurvey={(data) => {
                // Similarly, this is a quick adapter to use existing state
                setSurveyRoofArea(data.roof_area_sqft);
                setSurveyRoofType(data.roof_type);
                setSurveyMeterPhase(data.meter_phase);
                setSurveySanctionedLoad(data.sanctioned_load_kw);
                setSurveyDCDist(data.distance_panel_to_inverter_m);
                setSurveyACDist(data.distance_inverter_to_meter_m);
                setSurveyDiscom(data.discom_name);
                setSurveyConsumerNo(data.consumer_number);
                setSurveyNetMetering(data.net_metering_available);
                setSurveyNotes(data.notes);
                setTimeout(handleCompleteSurvey, 0);
              }}
              onDeleteLead={async () => {
                if (!selectedLead) return;
                const confirmed = await confirm({
                  title: 'Delete Customer Lead?',
                  message: `Are you sure you want to permanently delete lead for "${selectedLead.first_name} ${selectedLead.last_name || ''}"? This will also purge all timeline history, survey documents, and open pipeline opportunities.`,
                  confirmLabel: 'Delete Permanently',
                  cancelLabel: 'Cancel',
                  type: 'danger'
                });
                if (confirmed) {
                  try {
                    const { LeadORM } = await import('@/backend/orm/crm');
                    await LeadORM.delete(selectedLead.id);
                    toast('Lead deleted successfully', 'success');
                    setSelectedLead(null);
                    fetchData();
                  } catch (err: any) {
                    toast(err.message || 'Failed to delete lead', 'error');
                  }
                }
              }}
            />
          </div>
        ) : (
          <OpportunityBoard opportunities={opportunities} loading={loading} />
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
