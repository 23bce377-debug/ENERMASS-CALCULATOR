'use client';

import { useState } from 'react';
import { useCalculatorStore } from '@/lib/store/calculatorStore';
import { formatINR } from '@/lib/engine/calculator';
import { Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';

export function AdditionalCostsPanel() {
  const additionalCosts = useCalculatorStore((s) => s.additionalCosts);
  const addAdditionalCost = useCalculatorStore((s) => s.addAdditionalCost);
  const removeAdditionalCost = useCalculatorStore((s) => s.removeAdditionalCost);
  const calcResult = useCalculatorStore((s) => s.calcResult);

  const [expanded, setExpanded] = useState(true);
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');

  const total = calcResult ? calcResult.additionalCostTotal : 0;
  const disabled = !calcResult;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!desc.trim() || !amount) return;
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount < 0 || parsedAmount > 10000000) return;
    
    addAdditionalCost({
      description: desc.trim(),
      amount: parsedAmount
    });
    setDesc('');
    setAmount('');
  };

  return (
    <div className={`rounded-xl border border-border bg-surface overflow-hidden transition-opacity ${disabled ? 'opacity-50 pointer-events-none' : ''}`} id="additional-costs">
      {/* Header / Toggle */}
      <button 
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-surface-hover transition-colors"
      >
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown size={16} className="text-text-muted" /> : <ChevronRight size={16} className="text-text-muted" />}
          <h3 className="text-sm font-bold text-text-primary tracking-wide">Additional Costs</h3>
          <span className="px-2 py-0.5 rounded-full bg-background border border-border text-[10px] text-text-muted">
            {additionalCosts.length}
          </span>
        </div>
        {total > 0 && (
          <span className="text-sm font-mono font-bold text-text-primary">
            +{formatINR(total)}
          </span>
        )}
      </button>

      {/* Expanded Content */}
      {expanded && (
        <div className="p-4 pt-0 border-t border-border animate-fade-in">
          {/* List */}
          {additionalCosts.length > 0 && (
            <div className="mt-3 mb-4 space-y-2">
              {additionalCosts.map((cost) => (
                <div key={cost.id} className="flex items-center justify-between p-2 rounded bg-background border border-border/50 group">
                  <span className="text-xs text-text-secondary truncate pr-2">{cost.description}</span>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs font-mono font-medium text-text-primary">{formatINR(cost.amount)}</span>
                    <button 
                      onClick={() => removeAdditionalCost(cost.id)}
                      className="text-text-muted hover:text-error opacity-0 group-hover:opacity-100 transition-all p-1"
                      title="Remove"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add Form */}
          <form onSubmit={handleAdd} className="flex gap-2 items-start mt-3">
            <input
              type="text"
              placeholder="Description (e.g. Extra cable)"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              className="flex-[2] px-3 py-2 rounded-md bg-background border border-border text-xs text-text-primary focus:border-accent outline-none"
            />
            <div className="flex-1 relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted text-xs">₹</span>
              <input
                type="number"
                min="0"
                step="any"
                placeholder="Amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full pl-6 pr-2 py-2 rounded-md bg-background border border-border text-xs font-mono text-text-primary focus:border-accent outline-none"
              />
            </div>
            <button 
              type="submit"
              disabled={!desc.trim() || !amount}
              className="shrink-0 p-2 rounded-md bg-surface-active border border-border hover:bg-surface-hover text-text-primary disabled:opacity-50 transition-colors"
            >
              <Plus size={16} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
