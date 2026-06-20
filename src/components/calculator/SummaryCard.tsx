  'use client';

import React from 'react';
import { useCalculatorStore } from '@/lib/store/calculatorStore';
import { Select } from '@/components/ui/Select';
import { SYSTEMS } from '@/lib/data/bom';
import { formatINR } from '@/lib/engine/calculator';
import { useSettings } from '@/lib/hooks/useSettings';

export function SummaryCard() {
  const calcResult = useCalculatorStore((s) => s.calcResult);
  const selectedSystemId = useCalculatorStore((s) => s.selectedSystemId);
  const dbSystems = useCalculatorStore((s) => s.dbSystems);
  const dbLoaded = useCalculatorStore((s) => s.dbLoaded);
  const projectType = useCalculatorStore((s) => s.projectType);
  const itcEligible = useCalculatorStore((s) => s.itcEligible);
  const selectedGoalWattage = useCalculatorStore((s) => s.selectedGoalWattage);
  const selectedScheme = useCalculatorStore((s) => s.selectedScheme);

  const { settings } = useSettings();

  const setMarginOverride = useCalculatorStore((s) => s.setMarginOverride);
  const setGSTOnOutputOverride = useCalculatorStore((s) => s.setGSTOnOutputOverride);
  const setTargetMRP = useCalculatorStore((s) => s.setTargetMRP);

  const panelMix = useCalculatorStore((s) => s.panelMix);
  const selectedPanelId = useCalculatorStore((s) => s.selectedPanelId);
  const dbPanels = useCalculatorStore((s) => s.dbPanels);
  
  const selectedInverterMix = useCalculatorStore((s) => s.selectedInverterMix);
  const dbInverters = useCalculatorStore((s) => s.dbInverters);
  const selectedBatteryMix = useCalculatorStore((s) => s.selectedBatteryMix);
  const dbBatteries = useCalculatorStore((s) => s.dbBatteries);

  if (!calcResult || !selectedSystemId) return null;

  const allSystems = dbLoaded && dbSystems.length > 0
    ? [...dbSystems, ...(settings.customSystems ?? [])]
    : [...SYSTEMS, ...(settings.customSystems ?? [])];
  const system = allSystems.find((s) => s.id === selectedSystemId);
  const systemName = system?.name || '';

  const capacityKW = calcResult.capacityKW;

  const capacityWatts = capacityKW * 1000;

  // Compute active components
  const activeComponents = [];
  Object.entries(panelMix).forEach(([id, qty]) => {
    if (qty > 0) {
      const p = dbPanels.find(x => x.id === id);
      if (p) activeComponents.push(`${qty}x ${p.brand} ${p.wattage}W Panel`);
    }
  });
  if (Object.keys(panelMix).length === 0 && selectedPanelId) {
    const p = dbPanels.find(x => x.id === selectedPanelId);
    if (p) activeComponents.push(`Panels: ${p.brand} ${p.wattage}W`);
  }
  Object.entries(selectedInverterMix).forEach(([id, qty]) => {
    if (qty > 0) {
      const inv = dbInverters.find(x => x.id === id);
      if (inv) activeComponents.push(`${qty}x ${inv.brand} ${inv.capacityKW}kW Inverter`);
    }
  });
  Object.entries(selectedBatteryMix).forEach(([id, qty]) => {
    if (qty > 0) {
      const bat = dbBatteries.find(x => x.id === id);
      if (bat) activeComponents.push(`${qty}x ${bat.brand} ${bat.capacityAh}Ah Battery`);
    }
  });

  // Subsidy eligibility based on capacity
  const showNoSubsidy = selectedScheme === 'state' && capacityKW > 10;
  const subsidyLabel = showNoSubsidy ? 'No Subsidy (>10 kW)' : (selectedScheme === 'state' ? 'State Subsidy' : 'PM Surya Ghar Subsidy');

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden shadow-lg shadow-black/20" id="summary-card">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border bg-surface-active flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-text-primary tracking-widest uppercase">Pricing Summary</h3>
          <span className="text-xs font-semibold text-accent">{systemName}</span>
        </div>
        {activeComponents.length > 0 && (
          <div className="flex flex-col gap-1 mt-1">
            {activeComponents.map((c, i) => (
              <span key={i} className="text-[10px] font-medium text-text-secondary bg-background/50 px-2 py-0.5 rounded-sm border border-border/40 inline-block w-fit">
                {c}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="p-5 space-y-4">
        {/* Base Costs */}
        <div className="space-y-2">
          <Row label="Procurement Cost (Base)" value={formatINR(calcResult.costBeforeGST)} />
          {calcResult.civilLogisticsCost > 0 && (
            <Row label="Civil & Logistics (Base)" value={formatINR(calcResult.civilLogisticsCost)} muted />
          )}
          <Row label="Input GST (ITC)" value={formatINR(calcResult.totalInputGST)} muted />
          <Row label="Total Procurement Cost" value={formatINR(calcResult.totalIncGST)} bold />
        </div>

        <div className="border-t border-border/60" />

        {/* Margin & MRP */}
        <div className="space-y-2">
          <EditableRow 
            label="Margin" 
            value={calcResult.effectiveMarginPct * 100} 
            suffix="%" 
            onCommit={(v) => setMarginOverride(v / 100)} 
          />
          <Row label="MRP (excl. GST)" value={formatINR(calcResult.mrpExclGST)} />
          <div title="Composite rate applicable under GST Works Contract scheme. Subject to revision. Verify with CA before final invoicing.">
            <EditableRow 
              label={projectType === 'commercial' 
                ? `GST @ ${(calcResult.gstOutputRate * 100).toFixed(1)}% (Commercial — ITC Eligible)` 
                : `GST @ ${(calcResult.gstOutputRate * 100).toFixed(1)}% (Composite Rate)`} 
              value={calcResult.gstOutputRate * 100} 
              suffix="%" 
              muted 
              onCommit={(v) => setGSTOnOutputOverride(v / 100)} 
            />
          </div>
          
          <div className="space-y-1 mt-2">
            <EditableRow 
              label="MRP Per Watt" 
              value={calcResult.mrpInclGST / capacityWatts} 
              prefix="₹" 
              bold 
              onCommit={(v) => setTargetMRP(v, 'per_watt')} 
            />
            
            <div className="p-3 rounded-lg border border-accent/30 bg-accent-glow flex items-center justify-between">
              <span className="text-sm font-bold text-accent uppercase tracking-wider flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                MRP (incl. GST)
              </span>
              <EditableInline 
                value={calcResult.mrpInclGST} 
                onCommit={(v) => setTargetMRP(v, 'total')} 
                className="text-base font-mono font-bold text-accent" 
                isCurrency
              />
            </div>
          </div>
        </div>

        <div className="border-t border-border/60" />

        {/* Adjustments */}
        <div className="space-y-2">
          <Row label="Discount" value={`-${formatINR(calcResult.discountAmount)}`} error={calcResult.discountAmount > 0} />
          <Row label="Additional Costs" value={`+${formatINR(calcResult.additionalCostTotal)}`} />
          <Row label="Final Price" value={formatINR(calcResult.finalCustomerPrice)} bold />
        </div>

        <div className="border-t border-border/60" />

        {/* Final You Pay */}
        <div className="space-y-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-secondary">Subsidy Scheme</span>
              <Select
                value={selectedScheme}
                onChange={(val) => useCalculatorStore.getState().setSelectedScheme(val as any)}
                options={[
                  { value: 'none', label: 'No Subsidy' },
                  { value: 'pm_suryaghar', label: 'PM Surya Ghar' },
                  { value: 'state', label: 'State Scheme' }
                ]}
                size="sm"
                className="w-40"
              />
            </div>
            {selectedScheme !== 'none' && (
              <>
                <div title={calcResult.subsidyResult?.breakdown} className="mt-2">
                  <Row label={subsidyLabel} value={`-${formatINR(calcResult.subsidyAmount)}`} success={calcResult.subsidyAmount > 0} />
                </div>
                {calcResult.subsidyResult?.schemeNote && (
                  <span className="text-[10px] text-text-muted leading-tight block">
                    {calcResult.subsidyResult.schemeNote}
                  </span>
                )}
              </>
            )}
          </div>
          
          <div className="p-4 rounded-xl gold-gradient flex flex-col items-stretch justify-center shadow-lg shadow-accent/20 gap-2">
            <span className="text-[10px] font-medium text-background/80 uppercase tracking-wider text-center">
              Net Customer Cost = System Cost − Subsidy
            </span>
            <div className="flex flex-col sm:flex-row items-center justify-between">
              <span className="text-sm font-black text-background uppercase tracking-widest">
                You Pay
              </span>
              <span className="text-2xl font-mono font-black text-background">
                {formatINR(calcResult.beneficiaryContribution)}
              </span>
            </div>
          </div>
        </div>

        {/* ITC Benefit Analysis */}
        {itcEligible && (() => {
          const gstAmount = calcResult.finalCustomerPrice - (calcResult.finalCustomerPrice / (1 + calcResult.gstOutputRate));
          const netCost = calcResult.finalCustomerPrice - gstAmount;
          return (
            <>
              <div className="border-t border-border/60" />
              <div className="p-4 rounded-xl border border-success/30 bg-success/5 space-y-2">
                <h4 className="text-xs font-bold text-success uppercase tracking-widest mb-3">Commercial ITC Benefit Analysis</h4>
                <Row label="System Cost (excl. GST)" value={formatINR(netCost)} />
                <Row label="GST @18% (Payable)" value={`+${formatINR(gstAmount)}`} />
                <Row label="Total Invoice" value={formatINR(calcResult.finalCustomerPrice)} bold />
                <div className="border-t border-success/20 my-2" />
                <Row label="ITC Claimable (GSTR-2B)" value={`-${formatINR(gstAmount)}`} error />
                <Row label="Effective Net Cost" value={formatINR(netCost)} success bold />
                <p className="text-[10px] text-text-muted mt-2 leading-tight">
                  ITC effectively reduces your cost by {Math.round((gstAmount / calcResult.finalCustomerPrice) * 100)}%.<br/>
                  ITC eligibility subject to vendor GST compliance (GSTR-1 filing). Consult your CA. ITC may be reversed if vendor defaults.
                </p>
              </div>
            </>
          );
        })()}
      </div>
    </div>
  );
}

function Row({ label, value, bold, muted, error, success }: { label: string; value: string; bold?: boolean; muted?: boolean; error?: boolean; success?: boolean }) {
  return (
    <div className="flex items-center justify-between group">
      <span className={`text-xs transition-colors duration-200 ${
        muted ? 'text-text-muted group-hover:text-text-secondary' : 'text-text-secondary group-hover:text-text-primary'
      }`}>
        {label}
      </span>
      <span className={`text-sm font-mono transition-colors duration-200 animate-fade-in ${
        bold ? 'font-bold text-text-primary' :
        error ? 'font-medium text-error' :
        success ? 'font-medium text-success' :
        muted ? 'text-text-muted' : 'font-medium text-text-primary'
      }`}>
        {value}
      </span>
    </div>
  );
}

function EditableRow({ label, value, onCommit, prefix, suffix, bold, muted }: { label: string; value: number; onCommit: (v: number) => void; prefix?: string; suffix?: string; bold?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between group">
      <span className={`text-xs transition-colors duration-200 ${
        muted ? 'text-text-muted group-hover:text-text-secondary' : 'text-text-secondary group-hover:text-text-primary'
      }`}>
        {label}
      </span>
      <EditableInline 
        value={value} 
        onCommit={onCommit} 
        prefix={prefix} 
        suffix={suffix} 
        bold={bold} 
        muted={muted} 
      />
    </div>
  );
}

function EditableInline({ value, onCommit, prefix, suffix, bold, muted, isCurrency, className }: { value: number; onCommit: (v: number) => void; prefix?: string; suffix?: string; bold?: boolean; muted?: boolean; isCurrency?: boolean; className?: string }) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const startEdit = () => {
    setDraft(value.toFixed(2));
    setEditing(true);
  };

  const commit = () => {
    const parsed = parseFloat(draft);
    if (!isNaN(parsed) && parsed >= 0) {
      onCommit(parsed);
    }
    setEditing(false);
  };

  const cancel = () => setEditing(false);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') commit();
    if (e.key === 'Escape') cancel();
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        step="any"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        className="w-24 px-1 py-0.5 rounded bg-background border border-accent text-right text-sm font-mono focus:outline-none"
      />
    );
  }

  let display = isCurrency ? formatINR(value) : `${prefix ?? ''}${value.toFixed(2)}${suffix ?? ''}`;

  return (
    <button
      onClick={startEdit}
      className={`text-sm font-mono transition-colors duration-200 cursor-text hover:text-accent rounded px-1 hover:bg-accent-glow/30 ${
        className ?? (bold ? 'font-bold text-text-primary' : muted ? 'text-text-muted' : 'text-text-primary')
      }`}
    >
      {display}
    </button>
  );
}

