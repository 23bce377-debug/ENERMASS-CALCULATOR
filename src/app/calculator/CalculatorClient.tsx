'use client';

import { useMemo, useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useCalculatorStore } from '@/lib/store/calculatorStore';
import { SYSTEMS } from '@/lib/data/bom';
import { PresetManagerModal } from '@/components/calculator/PresetManagerModal';
import { SavePresetModal } from '@/components/calculator/SavePresetModal';
import { STATE_DATA } from '@/lib/data/masters';
import { useToast } from '@/components/ui/Toast';
import { formatINR } from '@/lib/engine/calculator';
import type { Quote } from '@/lib/types/quote';
import { useSettings } from '@/lib/hooks/useSettings';
import { useCalculatorAutoSave } from '@/lib/hooks/useCalculatorAutoSave';
import { supabase } from '@/lib/supabase/client';
import { type SystemConfig, validateSystemConfig } from '@/lib/validation/systemValidation';
import { EquipmentSelector } from '@/components/calculator/EquipmentSelector';
import { ValidationPanel } from '@/components/calculator/ValidationPanel';
import { BOMTable } from '@/components/calculator/BOMTable';
import { DiscountPanel } from '@/components/calculator/DiscountPanel';
import { AdditionalCostsPanel } from '@/components/calculator/AdditionalCostsPanel';
import { SummaryCard } from '@/components/calculator/SummaryCard';
import { EnergyCard } from '@/components/calculator/EnergyCard';
import { ConnectedROIDisplay } from '@/components/calculator/ROIDisplay';
import { QuoteSaveModal } from '@/components/calculator/QuoteSaveModal';
import { QuotePDF } from '@/components/print/QuotePDF';
import { Select } from '@/components/ui/Select';
import { BOMTableSkeleton, SummaryCardSkeleton, CardSkeleton } from '@/components/ui/Skeletons';

// ─── Left Panel Components ────────────────────────────────────────────────────────

function StateSelector() {
  const selectedState = useCalculatorStore((s) => s.selectedState);
  const setState = useCalculatorStore((s) => s.setState);
  const dbStateData = useCalculatorStore((s) => s.dbStateData);
  const states = useMemo(() => {
    const keys = Object.keys(dbStateData);
    if (keys.length > 0) return keys.sort();
    return Object.keys(STATE_DATA).sort();
  }, [dbStateData]);

  const selectOptions = useMemo(() => {
    return states.map((stateName) => ({
      value: stateName,
      label: stateName,
    }));
  }, [states]);

  return (
    <div className="space-y-2">
      <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider">
        Installation State
      </label>
      <Select
        value={selectedState || ''}
        onChange={(val) => setState(val)}
        options={selectOptions}
        placeholder="Select State"
        renderTrigger={(selected) => (
          <div className="flex items-center gap-2.5 min-w-0">
            <MapPin size={16} className="shrink-0 text-accent" />
            <span className="text-sm font-medium text-text-primary truncate">
              {selected?.label || 'Select State'}
            </span>
          </div>
        )}
      />
    </div>
  );
}

import { SystemPresetDropdown } from '@/components/calculator/SystemPresetDropdown';


function ActionBar({ onSaveQuote, onCreateQuote, hasBlockingErrors }: { onSaveQuote: () => void; onCreateQuote: () => void; hasBlockingErrors?: boolean }) {
  const selectedSystemId = useCalculatorStore((s) => s.selectedSystemId);
  const result = useCalculatorStore((s) => s.calcResult);
  const disabled = !selectedSystemId || !result || hasBlockingErrors;
  const { toast } = useToast();

  const handleShare = async () => {
    if (!result) return;
    const text = `EnerMass Solar Quote\nSystem: ${selectedSystemId}\nPrice: ${formatINR(result.finalCustomerPrice)}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Solar Quote', text });
      } catch (e) {}
    } else {
      navigator.clipboard.writeText(text);
      toast('Quote summary copied to clipboard!', 'success');
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3 p-4 bg-surface border border-border rounded-xl shadow-lg shadow-black/20">
      <button
        onClick={onCreateQuote}
        disabled={disabled}
        className="flex-1 min-w-35 flex items-center justify-center gap-2 py-3 px-4 rounded-lg
          bg-accent hover:bg-accent-hover text-background font-bold text-sm transition-colors
          disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-accent/20"
      >
        <Download size={18} />
        Create Quote PDF
      </button>
      <button
        onClick={onSaveQuote}
        disabled={disabled}
        className="flex-1 min-w-30 flex items-center justify-center gap-2 py-3 px-4 rounded-lg
          border border-border hover:bg-surface-hover text-text-primary font-medium text-sm transition-colors
          disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Save size={18} />
        Save Draft
      </button>
      <button
        onClick={handleShare}
        disabled={disabled}
        className="flex-1 min-w-30 flex items-center justify-center gap-2 py-3 px-4 rounded-lg
          border border-border hover:bg-surface-hover text-text-primary font-medium text-sm transition-colors
          disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Share2 size={18} />
        Share
      </button>
    </div>
  );
}


// ─── Main Page ──────────────────────────────────────────────────────────────────

import { Download, Share2, Save, ChevronDown, Search, MapPin, Settings, Trash2, Edit3, X, Loader2, AlertCircle } from 'lucide-react';

export default function CalculatorClient({
  initialEquipment,
  initialRules,
  deferredStructures,
  deferredOrgContext,
}: {
  initialEquipment: any;
  initialRules: any;
  deferredStructures: Promise<any>;
  deferredOrgContext: Promise<any>;
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalIntent, setModalIntent] = useState<'print' | 'draft'>('print');
  const [isPresetManagerOpen, setIsPresetManagerOpen] = useState(false);
  const [isSavePresetOpen, setIsSavePresetOpen] = useState(false);
  const [presetPayload, setPresetPayload] = useState<any>(null);
  const [pendingQuote, setPendingQuote] = useState<Quote | null>(null);
  const { settings } = useSettings();
  const { toast } = useToast();

  const [initialDraftId, setInitialDraftId] = useState<string | null>(null);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [restoredDate, setRestoredDate] = useState<Date | null>(null);

  // 1. Hydrate critical data on mount/initial load (immediate render capability)
  useEffect(() => {
    if (initialEquipment && initialRules) {
      useCalculatorStore.getState().setOfflineData({
        ...initialEquipment,
        ...initialRules,
      });
    }
  }, [initialEquipment, initialRules]);

  // 2. Hydrate deferred structures progressively
  useEffect(() => {
    if (!deferredStructures) return;
    Promise.resolve(deferredStructures)
      .then((structures) => {
        if (structures) {
          useCalculatorStore.getState().setOfflineData({
            ...structures,
          });
        }
      })
      .catch((err) => {
        console.error('[Deferred structures load failed]', err);
      });
  }, [deferredStructures]);

  // 3. Hydrate deferred org context progressively
  useEffect(() => {
    if (!deferredOrgContext) return;
    Promise.resolve(deferredOrgContext)
      .then((orgContext) => {
        if (orgContext) {
          useCalculatorStore.getState().setOfflineData({
            ...orgContext,
          });
        }
      })
      .catch((err) => {
        console.error('[Deferred org context load failed]', err);
      });
  }, [deferredOrgContext]);

  useEffect(() => {
    async function loadDraft() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setDraftLoaded(true); return; }

      const { data, error } = await supabase
        .from('draft_quotes')
        .select('*')
        .eq('user_id', session.user.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle(); // Use maybeSingle to prevent PGRST116 single row error if not found
      
      if (data && !error && data.state_json) {
        setInitialDraftId(data.id);
        setRestoredDate(new Date(data.updated_at));
        const store = useCalculatorStore as any;
        store.setState(data.state_json);
        store.getState().recalculate();
      }
      setDraftLoaded(true);
    }
    loadDraft();
  }, []);

  const { syncState, forceSave, draftId } = useCalculatorAutoSave(initialDraftId);

  const handleDismissDraft = () => {
    // Just hide the banner — do NOT reset the store or the draft
    setRestoredDate(null);
  };

  const selectedSystemId = useCalculatorStore((s) => s.selectedSystemId);
  const selectSystem = useCalculatorStore((s) => s.selectSystem);

  const handleSelectPreset = (stateOrId: any) => {
    if (typeof stateOrId === 'string') {
      selectSystem(stateOrId);
    } else if (stateOrId && typeof stateOrId === 'object') {
      const store = useCalculatorStore as any;
      store.setState(stateOrId);
      store.getState().recalculate();
    }
  };

  const handleSaveModalOpen = () => {
    const store = useCalculatorStore as any;
    const payload = JSON.parse(JSON.stringify(store.getState()));
    setPresetPayload(payload);
    setIsSavePresetOpen(true);
  };
  
  const selectedPanelId = useCalculatorStore((s) => s.selectedPanelId);
  const panelMix = useCalculatorStore((s) => s.panelMix);
  const selectedInverterMix = useCalculatorStore((s) => s.selectedInverterMix);
  const selectedBatteryMix = useCalculatorStore((s) => s.selectedBatteryMix);
  const selectPanel = useCalculatorStore((s) => s.selectPanel);
  const setPanelMixQty = useCalculatorStore((s) => s.setPanelMixQty);
  const clearPanelMix = useCalculatorStore((s) => s.clearPanelMix);
  const setInverterMixQty = useCalculatorStore((s) => s.setInverterMixQty);
  const clearInverterMix = useCalculatorStore((s) => s.clearInverterMix);
  const setBatteryMixQty = useCalculatorStore((s) => s.setBatteryMixQty);
  const clearBatteryMix = useCalculatorStore((s) => s.clearBatteryMix);
  const dbSystems = useCalculatorStore((s) => s.dbSystems);
  const dbLoaded = useCalculatorStore((s) => s.dbLoaded);
  
  const itcEligible = useCalculatorStore((s) => s.itcEligible);
  const setItcEligible = useCalculatorStore((s) => s.setItcEligible);
  const projectType = useCalculatorStore((s) => s.projectType);
  const dbInverters = useCalculatorStore((s) => s.dbInverters);
  
  const [acknowledgedGuards, setAcknowledgedGuards] = useState<string[]>([]);
  const [leadId, setLeadId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const lid = params.get('leadId');
      if (lid) {
        setLeadId(lid);
      }
    }
  }, []);

  const requiredPanelQty = useMemo(() => {
    if (!selectedSystemId) return null;
    const allSystems = dbLoaded && dbSystems.length > 0
      ? [...dbSystems, ...(settings.customSystems ?? [])]
      : [...SYSTEMS, ...(settings.customSystems ?? [])];
    const system = allSystems.find((s) => s.id === selectedSystemId);
    if (!system) return null;
    const panelLine = system.items.find((item) => item.description.toUpperCase() === 'PANEL');
    return panelLine?.qty ?? system.panelQty;
  }, [selectedSystemId, settings.customSystems, dbSystems, dbLoaded]);

  const requiredPanelWattage = useMemo(() => {
    if (!selectedSystemId) return null;
    const allSystems = dbLoaded && dbSystems.length > 0
      ? [...dbSystems, ...(settings.customSystems ?? [])]
      : [...SYSTEMS, ...(settings.customSystems ?? [])];
    const system = allSystems.find((s) => s.id === selectedSystemId);
    return system?.panelWattage ?? null;
  }, [selectedSystemId, settings.customSystems, dbSystems, dbLoaded]);

  const validationConfig = useMemo<SystemConfig>(() => {
    const currentSystem = dbSystems.find((sys) => sys.id === selectedSystemId);
    const capacityKW = currentSystem?.capacityKW || 0;

    let inverterPhases = 1;
    let inverterAcKw = 0;
    
    const selectedInverterId = Object.keys(selectedInverterMix)[0];
    if (selectedInverterId && dbInverters) {
      const inv = dbInverters.find((i: any) => i.id === selectedInverterId);
      if (inv) {
        inverterPhases = inv.phases || 1;
        inverterAcKw = inv.capacity_kw || 0;
      }
    }

    return {
      systemKw: capacityKW,
      inverterMaxVdc: 600,
      inverterPhases,
      inverterAcKw,
      dcCapacityKw: capacityKW,
      panelVoc: 45,
      leadCategory: projectType,
    };
  }, [selectedSystemId, dbSystems, selectedInverterMix, dbInverters, projectType]);

  const validationResults = useMemo(() => validateSystemConfig(validationConfig), [validationConfig]);
  const hasBlockingErrors = validationResults.some(r => r.severity === 'blocking');

  useEffect(() => {
    if (!pendingQuote) return;

    const timer = window.setTimeout(() => window.print(), 200);
    const handleAfterPrint = () => setPendingQuote(null);

    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, [pendingQuote]);

  const handleOpenModal = (intent: 'print' | 'draft') => {
    setModalIntent(intent);
    setIsModalOpen(true);
  };

  const handleQuoteSaved = async (quote: Quote) => {
    setIsModalOpen(false);
    if (modalIntent === 'print') {
      setPendingQuote(quote);
    } else {
      toast(`Quote ${quote.quoteId} saved as draft!`, 'success');
    }

    if (draftId) {
      const { data: quoteRow } = await supabase
        .from('quotes')
        .select('id')
        .eq('quote_number', quote.quoteId)
        .single();
      if (quoteRow?.id) {
        await supabase.from('draft_quotes').delete().eq('id', draftId);
      }
    }
  };

  if (!dbLoaded) {
    return (
      <div className="p-4 md:p-6 lg:p-8 max-w-400 mx-auto space-y-6 pb-32 md:pb-8">
        {/* Title */}
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-text-primary">Calculator</h1>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface border border-border text-[10px] font-bold uppercase tracking-wider">
              <Loader2 size={12} className="animate-spin text-accent" />
              <span className="text-text-muted">Loading master data...</span>
            </div>
          </div>
          <p className="text-sm text-text-muted mt-1">Configure system parameters and generate accurate quotes.</p>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          <div className="w-full lg:w-[320px] shrink-0 space-y-6">
            <CardSkeleton />
          </div>
          <div className="flex-1 min-w-0 space-y-6">
            <BOMTableSkeleton />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <CardSkeleton />
              <CardSkeleton />
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <SummaryCardSkeleton />
              <CardSkeleton />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-400 mx-auto animate-fade-in pb-32 md:pb-8">
      {/* Title */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-text-primary">Calculator</h1>
          {draftLoaded && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface border border-border text-[10px] font-bold uppercase tracking-wider">
              {syncState === 'saving' && (
                <><Loader2 size={12} className="animate-spin text-accent" /> <span className="text-text-muted">Saving...</span></>
              )}
              {syncState === 'saved' && (
                <><div className="w-1.5 h-1.5 rounded-full bg-success" /> <span className="text-text-muted">Saved</span></>
              )}
              {syncState === 'error' && (
                <><AlertCircle size={12} className="text-error" /> <span className="text-error cursor-pointer hover:underline" onClick={() => forceSave()}>Failed — Retry</span></>
              )}
            </div>
          )}
        </div>
        <p className="text-sm text-text-muted mt-1">Configure system parameters and generate accurate quotes.</p>
      </div>

      {restoredDate && (
        <div className="mb-6 flex items-center justify-between px-4 py-3 rounded-xl bg-accent/10 border border-accent/20">
          <span className="text-sm font-medium text-accent">
            Restored your last session from {restoredDate.toLocaleString()}
          </span>
          <button type="button" onClick={handleDismissDraft} className="p-1 rounded-md hover:bg-accent/20 text-accent transition-colors cursor-pointer" title="Dismiss notification">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Main Layout Grid */}
      <div className="flex flex-col lg:flex-row gap-6">
        
        {/* Left Panel (Controls) */}
        <div className="w-full lg:w-[320px] shrink-0 lg:sticky lg:top-20 lg:self-start space-y-6">
          <div className="p-5 rounded-xl border border-border bg-surface/50 space-y-6 shadow-sm">
            <SystemPresetDropdown onSaveConfig={handleSaveModalOpen} />
            <div className="h-px bg-border/60" />
            <StateSelector />
            {((projectType as string) === 'commercial' || (projectType as string) === 'industrial') && (
              <>
                <div className="h-px bg-border/60" />
                <div className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-surface hover:border-border-light transition-all duration-200">
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-semibold text-text-primary">ITC Eligible</span>
                    <span className="text-[10px] text-text-muted truncate">GST Registered Customer</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setItcEligible(!itcEligible)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      itcEligible ? 'bg-accent' : 'bg-border-light'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-background shadow ring-0 transition duration-200 ease-in-out ${
                        itcEligible ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </>
            )}

          </div>
          
          <div className="hidden lg:block text-xs text-text-muted text-center px-4">
            Calculation updates automatically when parameters change.
          </div>
        </div>

        {/* Right Panel (Content) */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Equipment Tab Selector */}
          <div className={!selectedSystemId ? 'opacity-50 pointer-events-none' : ''}>
            <EquipmentSelector
              selectedPanelId={selectedPanelId}
              panelMix={panelMix}
              requiredPanelQty={requiredPanelQty}
              requiredPanelWattage={requiredPanelWattage}
              selectedInverterMix={selectedInverterMix}
              selectedBatteryMix={selectedBatteryMix}
              onSelectPanel={selectPanel}
              onSetPanelMixQty={setPanelMixQty}
              onClearPanelMix={clearPanelMix}
              onSetInverterMixQty={setInverterMixQty}
              onClearInverterMix={clearInverterMix}
              onSetBatteryMixQty={setBatteryMixQty}
              onClearBatteryMix={clearBatteryMix}
            />
            <ValidationPanel 
              results={validationResults} 
              acknowledgedGuards={acknowledgedGuards}
              onAcknowledge={(id) => setAcknowledgedGuards([...acknowledgedGuards, id])}
            />
          </div>

          {/* BOM Table */}
          <BOMTable />

          {/* Adjustments */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DiscountPanel />
            <AdditionalCostsPanel />
          </div>

          {/* Summaries */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <SummaryCard />
            <EnergyCard />
          </div>

          <div className="mt-8">
            <ConnectedROIDisplay />
          </div>

          {/* Actions */}
          <div className="h-px bg-border/60 my-6" />
          <ActionBar
            onCreateQuote={() => handleOpenModal('print')}
            onSaveQuote={() => handleOpenModal('draft')}
            hasBlockingErrors={hasBlockingErrors}
          />
        </div>

      </div>

      {/* Modals */}
      <PresetManagerModal isOpen={isPresetManagerOpen} onClose={() => setIsPresetManagerOpen(false)} onSelectPreset={handleSelectPreset} />
      <SavePresetModal isOpen={isSavePresetOpen} onClose={() => setIsSavePresetOpen(false)} statePayload={presetPayload} />
      
      <QuoteSaveModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSaved={handleQuoteSaved}
        acknowledgedGuards={acknowledgedGuards}
        leadId={leadId}
      />

      {pendingQuote && (
        <QuotePDF
          quote={pendingQuote}
          companyName={settings.company.name || 'ENERMASS Solar'}
          companyAddress={settings.company.address || ''}
        />
      )}
    </div>
  );
}

