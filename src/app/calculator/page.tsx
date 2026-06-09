'use client';

import { useMemo, useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useCalculatorStore } from '@/lib/store/calculatorStore';
import { SYSTEMS } from '@/lib/data/bom';
import { SystemSelector } from '@/components/calculator/SystemSelector';
import { EquipmentSelector } from '@/components/calculator/EquipmentSelector';
import { BOMTable } from '@/components/calculator/BOMTable';
import { SummaryCard } from '@/components/calculator/SummaryCard';
import { EnergyCard } from '@/components/calculator/EnergyCard';
import { DiscountPanel } from '@/components/calculator/DiscountPanel';
import { AdditionalCostsPanel } from '@/components/calculator/AdditionalCostsPanel';
import { QuoteSaveModal } from '@/components/calculator/QuoteSaveModal';
import { QuotePDF } from '@/components/print/QuotePDF';
import { STATE_DATA } from '@/lib/data/masters';
import { formatINR } from '@/lib/engine/calculator';
import { useSettings } from '@/lib/hooks/useSettings';
import { useToast } from '@/components/ui/Toast';
import type { Quote } from '@/lib/types/quote';
import { Download, Share2, Save, ChevronDown, Search, MapPin, Settings, Trash2, Edit3, X } from 'lucide-react';

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
  
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredStates = states.filter(s => s.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div ref={containerRef} className="relative space-y-2">
      <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider">
        Installation State
      </label>
      
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between gap-2 px-3.5 py-3
          rounded-xl border transition-all duration-200 text-left
          ${isOpen
            ? 'border-accent/40 bg-surface-active shadow-lg shadow-accent/5'
            : 'border-border bg-surface hover:border-border-light hover:bg-surface-hover'
          }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <MapPin size={16} className="shrink-0 text-accent" />
          <span className="text-sm font-medium text-text-primary truncate">
            {selectedState || 'Select State'}
          </span>
        </div>
        <ChevronDown
          size={16}
          className={`shrink-0 text-text-muted transition-transform duration-200
            ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-2 rounded-xl border border-border
          bg-surface shadow-2xl shadow-black/40 overflow-hidden animate-fade-in">
          
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                autoFocus
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search states..."
                className="w-full pl-8 pr-3 py-2 rounded-lg bg-background border border-border
                  text-sm text-text-primary placeholder:text-text-muted
                  focus:outline-none focus:border-accent/40"
              />
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto py-1">
            {filteredStates.length === 0 ? (
              <div className="px-4 py-4 text-center text-sm text-text-muted">
                No states found
              </div>
            ) : (
              filteredStates.map((st) => {
                const isSelected = st === selectedState;
                return (
                  <button
                    key={st}
                    onClick={() => {
                      setState(st);
                      setIsOpen(false);
                      setSearchQuery('');
                    }}
                    className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left
                      transition-all duration-150
                      ${isSelected ? 'bg-accent-dim' : 'hover:bg-surface-hover'}`}
                  >
                    <span className={`text-sm flex-1 truncate ${isSelected ? 'text-accent font-semibold' : 'text-text-primary'}`}>
                      {st}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PresetManager() {
  const { settings, setSettings } = useSettings();
  const { toast } = useToast();
  const selectedSystemId = useCalculatorStore((s) => s.selectedSystemId);
  const selectSystem = useCalculatorStore((s) => s.selectSystem);
  const panelMix = useCalculatorStore((s) => s.panelMix);
  const selectedInverterMix = useCalculatorStore((s) => s.selectedInverterMix);
  const selectedBatteryMix = useCalculatorStore((s) => s.selectedBatteryMix);

  const handleSavePreset = () => {
    if (!selectedSystemId) return;
    const baseSystem = [...SYSTEMS, ...(settings.customSystems || [])].find(s => s.id === selectedSystemId);
    if (!baseSystem) return;

    const name = prompt('Enter a name for this preset (e.g. "5kW Deye + TOPCon"):');
    if (!name?.trim()) return;

    const newPreset = {
      ...baseSystem,
      id: `preset_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: name.trim(),
      category: 'custom' as any,
      defaultEquipment: {
        panelMix: { ...panelMix },
        inverterMix: { ...selectedInverterMix },
        batteryMix: { ...selectedBatteryMix },
      }
    };

    setSettings({
      customSystems: [...(settings.customSystems || []), newPreset]
    });
    
    // Wait for state to settle then select the new preset
    setTimeout(() => selectSystem(newPreset.id), 100);
    toast(`Preset "${newPreset.name}" saved!`, 'success');
  };

  return (
    <div className="flex flex-col gap-2 mt-4">
      <button
        onClick={handleSavePreset}
        disabled={!selectedSystemId}
        className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-lg border border-dashed border-accent/40 text-accent text-xs font-semibold hover:bg-accent/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="Save current equipment selection as a quick preset"
      >
        <Save size={14} />
        Save Configuration as Preset
      </button>
      <Link
        href="/presets"
        className="w-full flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg bg-surface hover:bg-surface-hover border border-border text-text-secondary text-xs font-medium transition-colors"
      >
        <Settings size={14} />
        Manage Presets
      </Link>
    </div>
  );
}


function ActionBar({ onSaveQuote, onCreateQuote }: { onSaveQuote: () => void; onCreateQuote: () => void }) {
  const selectedSystemId = useCalculatorStore((s) => s.selectedSystemId);
  const result = useCalculatorStore((s) => s.calcResult);
  const disabled = !selectedSystemId || !result;
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

export default function CalculatorPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalIntent, setModalIntent] = useState<'print' | 'draft'>('print');
  const [pendingQuote, setPendingQuote] = useState<Quote | null>(null);
  const { settings } = useSettings();
  const { toast } = useToast();

  const selectedSystemId = useCalculatorStore((s) => s.selectedSystemId);
  const selectSystem = useCalculatorStore((s) => s.selectSystem);
  
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

  const handleQuoteSaved = (quote: Quote) => {
    setIsModalOpen(false);
    if (modalIntent === 'print') {
      setPendingQuote(quote);
    } else {
      toast(`Quote ${quote.quoteId} saved as draft!`, 'success');
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-400 mx-auto animate-fade-in pb-32 md:pb-8">
      {/* Title */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Calculator</h1>
        <p className="text-sm text-text-muted mt-1">Configure system parameters and generate accurate quotes.</p>
      </div>

      {/* Main Layout Grid */}
      <div className="flex flex-col lg:flex-row gap-6">
        
        {/* Left Panel (Controls) */}
        <div className="w-full lg:w-[320px] shrink-0 space-y-6">
          <div className="p-5 rounded-xl border border-border bg-surface/50 space-y-6 shadow-sm">
            <SystemSelector value={selectedSystemId} onChange={selectSystem} />
            <div className="h-px bg-border/60" />
            <StateSelector />
            <PresetManager />
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

          {/* Actions */}
          <ActionBar
            onCreateQuote={() => handleOpenModal('print')}
            onSaveQuote={() => handleOpenModal('draft')}
          />
        </div>

      </div>

      {/* Modals */}
      <QuoteSaveModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSaved={handleQuoteSaved}
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

