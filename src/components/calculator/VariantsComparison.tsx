'use client';

import { useState } from 'react';
import { useCalculatorStore } from '@/lib/store/calculatorStore';
import { runCalculation, type Variant } from '@/lib/store/calculatorTypes';
import { formatINR } from '@/lib/engine/calculator';
import { Copy, Trash2, Check, ArrowUpRight, Plus } from 'lucide-react';
import { useToast } from '../ui/Toast';

export function VariantsComparison() {
  const store = useCalculatorStore();
  const { variants, activeVariantId, saveVariant, loadVariant, deleteVariant, duplicateVariant } = store;
  const { toast } = useToast();
  const [newVariantName, setNewVariantName] = useState('');

  // 1. Calculate outcomes for all variants
  const variantResults = variants.map((v) => {
    // Reconstruct a state representation of the variant to pass to runCalculation
    const mockState = {
      ...store,
      selectedSystemId: v.systemId,
      overrides: v.overrides,
      customItems: v.customItems,
      disabledItemIndices: v.disabledItemIndices || {},
      targetMarginPct: v.targetMarginPct ?? null,
      additionalCosts: v.additionalCosts,
      discountType: v.discountType,
      discountVal: v.discountVal,
      selectedPanelId: v.selectedPanelId,
      panelMix: v.panelMix,
      selectedInverterMix: v.selectedInverterMix,
      selectedBatteryMix: v.selectedBatteryMix,
      backupLoadW: v.backupLoadW,
      selectedState: v.selectedState,
      projectType: v.projectType,
      rateMaster: v.rateMaster,
      orientation: v.orientation || 'South',
      dcCableLengthM: v.dcCableLengthM || 0,
      acCableLengthM: v.acCableLengthM || 0,
      electricityInflationRate: v.electricityInflationRate || 0,
      applySubsidy: v.applySubsidy ?? true,
    };

    const { result, error } = runCalculation(mockState as any);
    return {
      variant: v,
      result,
      error,
    };
  });

  const handleSave = () => {
    if (!newVariantName.trim()) {
      toast('Please enter a name for the variant', 'error');
      return;
    }
    saveVariant(newVariantName.trim());
    setNewVariantName('');
    toast('Variant saved successfully!', 'success');
  };

  if (variants.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-xl p-6 shadow-md text-center space-y-4">
        <div className="max-w-md mx-auto space-y-2">
          <h3 className="text-lg font-bold text-text-primary">Quote Option Variants</h3>
          <p className="text-sm text-text-muted">
            Design multiple technology or sizing options (e.g. Premium vs. Standard, Hybrid vs. On-Grid) for side-by-side comparison in one proposal.
          </p>
        </div>
        <div className="flex justify-center max-w-sm mx-auto gap-2">
          <input
            type="text"
            placeholder="e.g., Option A: TOPCon Premium"
            value={newVariantName}
            onChange={(e) => setNewVariantName(e.target.value)}
            className="flex-1 px-3 py-2 border border-border rounded-lg bg-background text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
          />
          <button
            onClick={handleSave}
            className="flex items-center gap-1 px-4 py-2 bg-accent hover:bg-accent-hover text-background text-sm font-bold rounded-lg cursor-pointer transition-colors shrink-0"
          >
            <Plus size={16} />
            Save Option
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-5 shadow-md space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h3 className="text-lg font-bold text-text-primary">Sizing & Pricing Option Variants</h3>
          <p className="text-xs text-text-muted mt-0.5">Compare specifications, project costs, margins, and payback terms.</p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="New option name..."
            value={newVariantName}
            onChange={(e) => setNewVariantName(e.target.value)}
            className="w-full sm:w-56 px-3 py-2 border border-border rounded-lg bg-background text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
          />
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-2 bg-accent hover:bg-accent-hover text-background text-xs font-bold rounded-lg cursor-pointer transition-all shrink-0"
          >
            <Plus size={14} />
            Add Variant
          </button>
        </div>
      </div>

      {/* Side by Side Comparison Grid */}
      <div className="overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-border">
        <table className="w-full border-collapse text-left text-xs min-w-[600px]">
          <thead>
            <tr className="border-b border-border/80">
              <th className="py-2.5 font-bold text-text-muted uppercase tracking-wider w-1/4">Comparison Parameters</th>
              {variantResults.map(({ variant }) => {
                const isActive = variant.id === activeVariantId;
                return (
                  <th key={variant.id} className={`py-2.5 px-4 font-black text-sm text-center relative ${isActive ? 'bg-accent/5 text-accent' : 'text-text-primary'}`}>
                    <div className="flex flex-col items-center gap-1">
                      <span className="font-extrabold truncate max-w-[150px]">{variant.name}</span>
                      <span className="text-[10px] text-text-muted font-mono normal-case font-normal">
                        {new Date(variant.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40 font-mono">
            {/* System Type */}
            <tr>
              <td className="py-3 font-semibold text-text-secondary font-sans">System Capacity</td>
              {variantResults.map(({ variant }) => (
                <td key={variant.id} className="py-3 px-4 text-center text-text-primary font-bold">
                  {variant.systemId.replace('system_', '').replace('_', ' ')} kW
                </td>
              ))}
            </tr>

            {/* State & Project type */}
            <tr>
              <td className="py-3 font-semibold text-text-secondary font-sans">Geography / Project</td>
              {variantResults.map(({ variant }) => (
                <td key={variant.id} className="py-3 px-4 text-center text-text-secondary font-sans">
                  {variant.selectedState} ({variant.projectType})
                </td>
              ))}
            </tr>

            {/* Cost before GST */}
            <tr>
              <td className="py-3 font-semibold text-text-secondary font-sans">Raw Cost (Excl. GST)</td>
              {variantResults.map(({ variant, result }) => (
                <td key={variant.id} className="py-3 px-4 text-center text-text-secondary">
                  {result ? formatINR(result.costBeforeGST) : '—'}
                </td>
              ))}
            </tr>

            {/* Total Cost (Incl. GST) */}
            <tr className="bg-surface-active/30 font-bold">
              <td className="py-3 font-bold text-text-primary font-sans">Total Client Price (MRP)</td>
              {variantResults.map(({ variant, result }) => (
                <td key={variant.id} className="py-3 px-4 text-center text-text-primary text-sm font-black text-accent-glow">
                  {result ? formatINR(result.finalCustomerPrice) : '—'}
                </td>
              ))}
            </tr>

            {/* Profit Margin */}
            <tr>
              <td className="py-3 font-semibold text-text-secondary font-sans">Target Gross Margin</td>
              {variantResults.map(({ variant, result }) => (
                <td key={variant.id} className="py-3 px-4 text-center text-emerald-500 font-bold">
                  {result ? `${Math.round(result.effectiveMarginPct * 100)}%` : '—'} 
                  <span className="text-[10px] text-text-muted ml-1">
                    ({result ? formatINR(result.mrpExclGST - result.costBeforeGST) : ''})
                  </span>
                </td>
              ))}
            </tr>

            {/* Government Subsidy */}
            <tr>
              <td className="py-3 font-semibold text-text-secondary font-sans">Govt Subsidy Amount</td>
              {variantResults.map(({ variant, result }) => (
                <td key={variant.id} className="py-3 px-4 text-center text-sky-400 font-bold">
                  {result ? formatINR(result.subsidyAmount) : '—'}
                </td>
              ))}
            </tr>

            {/* Out of Pocket / Beneficiary Contribution */}
            <tr className="bg-accent-glow/10 font-bold">
              <td className="py-3 font-bold text-text-primary font-sans">Net Customer Contribution</td>
              {variantResults.map(({ variant, result }) => (
                <td key={variant.id} className="py-3 px-4 text-center text-accent font-black">
                  {result ? formatINR(result.beneficiaryContribution) : '—'}
                </td>
              ))}
            </tr>

            {/* Annual Generation ROI */}
            <tr>
              <td className="py-3 font-semibold text-text-secondary font-sans">Annual Generation ROI</td>
              {variantResults.map(({ variant, result }) => (
                <td key={variant.id} className="py-3 px-4 text-center text-text-primary">
                  {result ? `${Math.round(result.annualGenerationKWh)} kWh` : '—'}
                  <span className="text-[10px] text-text-muted block font-sans">
                    ({result ? formatINR(result.annualSavingsINR) : ''}/yr savings)
                  </span>
                </td>
              ))}
            </tr>

            {/* Payback period */}
            <tr>
              <td className="py-3 font-semibold text-text-secondary font-sans">Payback Period</td>
              {variantResults.map(({ variant, result }) => (
                <td key={variant.id} className="py-3 px-4 text-center text-text-primary font-bold">
                  {result ? `${result.paybackYears.toFixed(1)} Years` : '—'}
                </td>
              ))}
            </tr>

            {/* Action Row */}
            <tr className="border-t border-border/80">
              <td className="py-4 font-semibold text-text-secondary font-sans">Actions</td>
              {variantResults.map(({ variant }) => {
                const isActive = variant.id === activeVariantId;
                return (
                  <td key={variant.id} className={`py-4 px-4 text-center ${isActive ? 'bg-accent/5' : ''}`}>
                    <div className="flex justify-center items-center gap-2">
                      {isActive ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-accent text-background text-[10px] font-bold shadow-sm">
                          Active Primary
                        </span>
                      ) : (
                        <button
                          onClick={() => {
                            loadVariant(variant.id);
                            toast(`Promoted variant "${variant.name}" as active primary quote!`, 'info');
                          }}
                          className="flex items-center gap-1 px-2.5 py-1 border border-accent/20 hover:border-accent/40 text-accent bg-accent/5 hover:bg-accent/10 rounded-md text-[10px] font-bold cursor-pointer transition-all"
                          title="Load this variant into the active workspace"
                        >
                          Promote
                        </button>
                      )}
                      
                      <button
                        onClick={() => {
                          duplicateVariant(variant.id);
                          toast(`Duplicated variant "${variant.name}"`, 'success');
                        }}
                        className="p-1 border border-border hover:border-border-light bg-surface hover:bg-surface-hover text-text-muted hover:text-text-secondary rounded-md cursor-pointer transition-all"
                        title="Duplicate Variant"
                      >
                        <Copy size={12} />
                      </button>

                      <button
                        onClick={() => {
                          if (confirm(`Delete variant "${variant.name}"?`)) {
                            deleteVariant(variant.id);
                            toast('Variant deleted', 'info');
                          }
                        }}
                        className="p-1 border border-border hover:border-red-500/40 bg-surface hover:bg-red-500/10 text-text-muted hover:text-red-500 rounded-md cursor-pointer transition-all"
                        title="Delete Variant"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
