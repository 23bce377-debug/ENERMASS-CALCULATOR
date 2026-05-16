'use client';

import { useCalculatorStore } from '@/lib/store/calculatorStore';
import { SYSTEMS } from '@/lib/data/bom';
import { formatINR } from '@/lib/engine/calculator';
import { useSettings } from '@/lib/hooks/useSettings';

export function SummaryCard() {
  const calcResult = useCalculatorStore((s) => s.calcResult);
  const selectedSystemId = useCalculatorStore((s) => s.selectedSystemId);

  const { settings } = useSettings();

  if (!calcResult || !selectedSystemId) return null;

  const allSystems = [...SYSTEMS, ...(settings.customSystems ?? [])];
  const system = allSystems.find((s) => s.id === selectedSystemId);
  const systemName = system?.name || '';
  const capacityKW = system?.capacityKW || 0;

  // Subsidy eligibility based on capacity
  const showNoSubsidy = capacityKW > 10;
  const subsidyLabel = showNoSubsidy ? 'No Subsidy (>10 kW)' : 'PM Surya Ghar Subsidy';

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden shadow-lg shadow-black/20" id="summary-card">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border bg-surface-active flex items-center justify-between">
        <h3 className="text-xs font-bold text-text-primary tracking-widest uppercase">Pricing Summary</h3>
        <span className="text-xs font-semibold text-accent">{systemName}</span>
      </div>

      <div className="p-5 space-y-4">
        {/* Base Costs */}
        <div className="space-y-2">
          <Row label="Cost Before GST" value={formatINR(calcResult.costBeforeGST)} />
          <Row label="Total Input GST" value={formatINR(calcResult.totalInputGST)} muted />
          <Row label="Total (incl. GST)" value={formatINR(calcResult.totalIncGST)} bold />
        </div>

        <div className="border-t border-border/60" />

        {/* Margin & MRP */}
        <div className="space-y-2">
          <Row label="Margin" value={`${(calcResult.effectiveMarginPct * 100).toFixed(1)}%`} />
          <Row label="MRP (excl. GST)" value={formatINR(calcResult.mrpExclGST)} />
          <Row label={`Output GST (${(calcResult.gstOutputRate * 100).toFixed(1)}%)`} value={formatINR(calcResult.mrpInclGST - calcResult.mrpExclGST)} muted />
          
          <div className="mt-2 p-3 rounded-lg border border-accent/30 bg-accent-glow flex items-center justify-between">
            <span className="text-sm font-bold text-accent uppercase tracking-wider flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              MRP (incl. GST)
            </span>
            <span className="text-base font-mono font-bold text-accent">{formatINR(calcResult.mrpInclGST)}</span>
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
          <Row label={subsidyLabel} value={`-${formatINR(calcResult.subsidyAmount)}`} success={calcResult.subsidyAmount > 0} />
          
          <div className="p-4 rounded-xl gold-gradient flex flex-col sm:flex-row items-center justify-between shadow-lg shadow-accent/20">
            <span className="text-sm font-black text-background uppercase tracking-widest">
              You Pay
            </span>
            <span className="text-2xl font-mono font-black text-background">
              {formatINR(calcResult.beneficiaryContribution)}
            </span>
          </div>
        </div>
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
