'use client';

import { useCalculatorStore } from '@/lib/store/calculatorStore';
import { formatINR, type DiscountType } from '@/lib/engine/calculator';
import { Percent, IndianRupee, Ban } from 'lucide-react';

export function DiscountPanel() {
  const discountType = useCalculatorStore((s) => s.discountType);
  const discountVal = useCalculatorStore((s) => s.discountVal);
  const setDiscount = useCalculatorStore((s) => s.setDiscount);
  const calcResult = useCalculatorStore((s) => s.calcResult);

  const disabled = !calcResult;

  const handleTypeChange = (type: DiscountType) => {
    setDiscount(type, 0); // Reset value when switching type
  };

  return (
    <div className={`p-4 rounded-xl border border-border bg-surface space-y-4 transition-opacity ${disabled ? 'opacity-50 pointer-events-none' : ''}`} id="discount-panel">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <h3 className="text-sm font-bold text-text-primary tracking-wide">Customer Discount</h3>
        {calcResult && discountType !== 'none' && (
          <span className="text-sm font-mono font-bold text-error">
            -{formatINR(calcResult.discountAmount)}
          </span>
        )}
      </div>

      <div className="space-y-4">
        {/* Radio Group */}
        <div className="flex gap-2 p-1 rounded-lg bg-background border border-border">
          <TypeButton type="none" active={discountType === 'none'} onClick={() => handleTypeChange('none')} icon={<Ban size={14} />} label="None" />
          <TypeButton type="flat" active={discountType === 'flat'} onClick={() => handleTypeChange('flat')} icon={<IndianRupee size={14} />} label="Flat Amt" />
          <TypeButton type="percent" active={discountType === 'percent'} onClick={() => handleTypeChange('percent')} icon={<Percent size={14} />} label="Percent" />
        </div>

        {/* Inputs */}
        {discountType === 'flat' && (
          <div className="flex items-center gap-2 animate-fade-in">
            <span className="text-xs text-text-muted whitespace-nowrap">Amount (₹):</span>
            <input
              type="number"
              min="0"
              value={discountVal || ''}
              onChange={(e) => {
                let v = parseFloat(e.target.value) || 0;
                if (v < 0) v = 0;
                if (calcResult && v > calcResult.mrpInclGST) v = calcResult.mrpInclGST;
                setDiscount('flat', v);
              }}
              className="flex-1 px-3 py-2 rounded-md bg-background border border-border text-sm font-mono text-text-primary focus:border-accent outline-none"
              placeholder="0.00"
            />
          </div>
        )}

        {discountType === 'percent' && (
          <div className="flex flex-col gap-3 animate-fade-in">
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs text-text-muted whitespace-nowrap w-20">Rate (%):</span>
              <input
                type="range"
                min="0"
                max="50"
                step="0.5"
                value={discountVal}
                onChange={(e) => setDiscount('percent', parseFloat(e.target.value))}
                className="flex-1 h-1.5 rounded-full appearance-none bg-border [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent cursor-pointer"
              />
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={discountVal || ''}
                onChange={(e) => {
                  let v = parseFloat(e.target.value) || 0;
                  if (v < 0) v = 0;
                  if (v > 100) v = 100;
                  setDiscount('percent', v);
                }}
                className="w-20 px-2 py-1.5 rounded-md bg-background border border-border text-sm font-mono text-right text-text-primary focus:border-accent outline-none"
                placeholder="0"
              />
            </div>
            {calcResult && (
              <div className="text-[10px] text-text-muted text-right">
                Calculated on MRP Incl. GST ({formatINR(calcResult.mrpInclGST)})
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TypeButton({ active, onClick, icon, label, type }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; type: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
        active ? 'bg-surface-active text-text-primary shadow-sm border border-border/50' : 'text-text-muted hover:text-text-secondary hover:bg-surface-hover border border-transparent'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
