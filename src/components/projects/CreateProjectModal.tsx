'use client';
import { useState, useEffect } from 'react';
import { X, Plus, AlertTriangle, Calendar, User, FileText } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/Toast';
import { useCreateProjectMutation } from '@/lib/hooks/useProjects';
import { Select } from '@/components/ui/Select';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  orgId: string;
  userId: string;
  profiles: any[];
  prefilledLeadId?: string | null;
  onCreated: (projectId: string) => void;
}

export function CreateProjectModal({
  isOpen,
  onClose,
  orgId,
  userId,
  profiles,
  prefilledLeadId,
  onCreated
}: CreateProjectModalProps) {
  const [isManual, setIsManual] = useState(false);
  const [availableQuotes, setAvailableQuotes] = useState<any[]>([]);
  const [loadingQuotes, setLoadingQuotes] = useState(false);

  // Form states
  const [projectNumber, setProjectNumber] = useState('');
  const [quoteId, setQuoteId] = useState('');
  const [plannedStart, setPlannedStart] = useState('');
  const [plannedEnd, setPlannedEnd] = useState('');
  const [assignedPmId, setAssignedPmId] = useState('');

  // Manual creation states
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [projectType, setProjectType] = useState('residential');
  const [capacityKw, setCapacityKw] = useState('5');

  const { toast } = useToast();
  const createProjectMutation = useCreateProjectMutation();

  // Prefill project number & dates when modal opens
  useEffect(() => {
    if (isOpen) {
      const year = new Date().getFullYear();
      const rand = Math.floor(1000 + Math.random() * 9000);
      setProjectNumber(`PRJ-${year}-${rand}`);

      const today = new Date().toISOString().split('T')[0];
      const future = new Date();
      future.setDate(future.getDate() + 60);
      const futureStr = future.toISOString().split('T')[0];

      setPlannedStart(today);
      setPlannedEnd(futureStr);

      // Reset other states
      setQuoteId('');
      setCustomerName('');
      setCustomerPhone('');
      setProjectType('residential');
      setCapacityKw('5');
      setAssignedPmId('');
      setIsManual(false);

      // Load quotes
      fetchAvailableQuotes();

      if (prefilledLeadId) {
        supabase
          .from('quotes')
          .select('id, customer_name, customer_phone, system_capacity_kw, project_type')
          .eq('lead_id', prefilledLeadId)
          .eq('status', 'won')
          .maybeSingle()
          .then(({ data: qData }) => {
            if (qData) {
              setQuoteId(qData.id);
              setIsManual(false);
            } else {
              supabase
                .from('crm_leads')
                .select('first_name, last_name, phone')
                .eq('id', prefilledLeadId)
                .single()
                .then(({ data: leadData }) => {
                  if (leadData) {
                    setCustomerName(`${leadData.first_name} ${leadData.last_name || ''}`.trim());
                    setCustomerPhone(leadData.phone || '');
                    setIsManual(true);
                  }
                });
            }
          });
      }
    }
  }, [isOpen, orgId, prefilledLeadId]);

  const fetchAvailableQuotes = async () => {
    if (!orgId) return;
    setLoadingQuotes(true);
    try {
      // 1. Fetch won quotes of this org
      const { data: quotesData, error: quotesErr } = await supabase
        .from('quotes')
        .select('id, quote_number, customer_name, system_capacity_kw, project_type')
        .eq('org_id', orgId)
        .eq('status', 'won');
      if (quotesErr) throw quotesErr;

      // 2. Fetch all linked project quote IDs
      const { data: projectsData, error: projErr } = await supabase
        .from('epc_projects')
        .select('quote_id')
        .eq('org_id', orgId);
      if (projErr) throw projErr;

      const linkedQuoteIds = new Set(
        (projectsData || [])
          .map((p) => p.quote_id)
          .filter(Boolean)
      );

      // 3. Filter available quotes
      const available = (quotesData || []).filter((q) => !linkedQuoteIds.has(q.id));
      setAvailableQuotes(available);
    } catch (err: any) {
      console.error('Error loading available quotes:', err);
      toast('Failed to load available proposals list', 'error');
    } finally {
      setLoadingQuotes(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectNumber.trim()) {
      toast('Project number is required', 'error');
      return;
    }

    if (!isManual && !quoteId) {
      toast('Please select an active proposal or choose manual creation', 'error');
      return;
    }

    if (isManual && !customerName.trim()) {
      toast('Client name is required for manual projects', 'error');
      return;
    }

    try {
      const result = await createProjectMutation.mutateAsync({
        orgId,
        userId,
        projectNumber,
        plannedStart,
        plannedEnd,
        quoteId: isManual ? null : quoteId,
        isManual,
        customerName: isManual ? customerName : undefined,
        customerPhone: isManual ? customerPhone : undefined,
        projectType: isManual ? projectType : undefined,
        capacityKw: isManual ? parseFloat(capacityKw) || 5 : undefined,
        assignedPmId: assignedPmId || null
      });

      toast(`Project ${projectNumber} created successfully!`, 'success');
      onCreated(result.id);
      onClose();
    } catch (err: any) {
      console.error('Failed to create project:', err);
      toast(err.message || 'Failed to instantiate project', 'error');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-lg bg-[#1a1a1a] border border-[#2a2a2a] shadow-2xl flex flex-col rounded-xl overflow-hidden max-h-[90vh] text-white">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a] shrink-0">
          <div className="flex items-center gap-2">
            <Plus className="text-[#f0a500]" size={18} />
            <h3 className="font-bold text-lg text-white">Create New Rooftop Project</h3>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="text-text-muted hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto px-6 py-4 space-y-4 flex-1">
          {/* Setup Type */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-[#555] uppercase tracking-wider">Project Source</label>
            <div className="flex bg-[#111] border border-[#222] rounded-lg p-0.5">
              <button
                type="button"
                onClick={() => setIsManual(false)}
                className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${!isManual ? 'bg-[#f0a500]/20 text-[#f0a500] border border-[#f0a500]/40' : 'text-[#666] hover:text-[#aaa]'}`}
              >
                From Won Proposal
              </button>
              <button
                type="button"
                onClick={() => setIsManual(true)}
                className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${isManual ? 'bg-[#f0a500]/20 text-[#f0a500] border border-[#f0a500]/40' : 'text-[#666] hover:text-[#aaa]'}`}
              >
                Manual EPC Contract
              </button>
            </div>
          </div>

          {/* Project Number */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-[#555] uppercase tracking-wider">Project Reference ID</label>
            <input
              type="text"
              required
              value={projectNumber}
              onChange={(e) => setProjectNumber(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-[#2a2a2a] rounded-lg bg-black text-white focus:outline-none focus:border-[#f0a500] transition-colors"
              placeholder="e.g. PRJ-2026-0001"
            />
          </div>

          {/* Conditional inputs */}
          {!isManual ? (
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-[#555] uppercase tracking-wider">Select Active Proposal</label>
              {loadingQuotes ? (
                <div className="text-xs text-[#555] py-2">Loading qualified contracts...</div>
              ) : availableQuotes.length === 0 ? (
                <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/10 flex gap-2 text-xs text-amber-500/80">
                  <AlertTriangle className="shrink-0" size={14} />
                  <span>No unlinked won quotes found. Try manual creation.</span>
                </div>
              ) : (
                <Select
                  value={quoteId}
                  onChange={(val) => setQuoteId(val)}
                  options={availableQuotes.map((q) => ({
                    value: q.id,
                    label: `${q.quote_number} - ${q.customer_name} (${q.system_capacity_kw} kW, ${q.project_type})`
                  }))}
                  placeholder="-- Choose proposal --"
                  size="sm"
                  triggerClassName="bg-black border-[#2a2a2a] text-xs py-2 text-white"
                />
              )}
            </div>
          ) : (
            <div className="space-y-3 p-3 border border-[#222] rounded-xl bg-[#111]">
              <div className="text-[10px] font-bold text-[#555] uppercase tracking-wider">Client Details</div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-[#888]">Client Name *</label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border border-[#2a2a2a] rounded-lg bg-black text-white focus:outline-none focus:border-[#f0a500] transition-colors"
                    placeholder="John Doe"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-[#888]">Phone Number</label>
                  <input
                    type="text"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border border-[#2a2a2a] rounded-lg bg-black text-white focus:outline-none focus:border-[#f0a500] transition-colors"
                    placeholder="9876543210"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-[#888]">Capacity (kW) *</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={capacityKw}
                    onChange={(e) => setCapacityKw(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border border-[#2a2a2a] rounded-lg bg-black text-white focus:outline-none focus:border-[#f0a500] transition-colors"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-[#888]">Sector *</label>
                  <Select
                    value={projectType}
                    onChange={(val) => setProjectType(val)}
                    options={[
                      { value: 'residential', label: 'Residential' },
                      { value: 'commercial', label: 'Commercial' },
                      { value: 'industrial', label: 'Industrial' }
                    ]}
                    size="sm"
                    triggerClassName="bg-black border-[#2a2a2a] text-xs py-1.5 text-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Date controls */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-[#555] uppercase tracking-wider">Planned Start Date</label>
              <input
                type="date"
                value={plannedStart}
                onChange={(e) => setPlannedStart(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-[#2a2a2a] rounded-lg bg-black text-white focus:outline-none focus:border-[#f0a500] transition-colors"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-[#555] uppercase tracking-wider">Planned End Date</label>
              <input
                type="date"
                value={plannedEnd}
                onChange={(e) => setPlannedEnd(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-[#2a2a2a] rounded-lg bg-black text-white focus:outline-none focus:border-[#f0a500] transition-colors"
              />
            </div>
          </div>

          {/* PM Assignment */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-[#555] uppercase tracking-wider">Assign Project PM</label>
            <Select
              value={assignedPmId}
              onChange={(val) => setAssignedPmId(val)}
              options={profiles.map((prof) => ({
                value: prof.id,
                label: prof.full_name
              }))}
              placeholder="-- No Project Manager assigned --"
              size="sm"
              triggerClassName="bg-black border-[#2a2a2a] text-xs py-2 text-white"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#2a2a2a] shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-[#333] hover:border-[#555] text-xs font-semibold rounded-lg text-text-muted hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createProjectMutation.isPending}
              className="px-4 py-2 bg-[#f0a500] hover:bg-[#d08f00] text-black font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              {createProjectMutation.isPending ? 'Creating...' : 'Initialize Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
