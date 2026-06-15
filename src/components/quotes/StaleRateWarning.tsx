import { TAX_CONSTANTS } from '@/lib/tax-constants';

interface Props { gstRate: number | null; quoteId: string; }

export function StaleRateWarning({ gstRate, quoteId }: Props) {
  if (!gstRate || gstRate >= 0.12) return null;
  return (
    <div className="flex items-start gap-3 rounded border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
      <span className="mt-0.5 text-amber-400">⚠</span>
      <div>
        <p className="font-medium">Outdated GST Rate Detected</p>
        <p className="text-amber-300/70 mt-1">
          This quote was generated with a pre-October 2021 GST rate ({(gstRate * 100).toFixed(1)}%).
          Current composite rate is {TAX_CONSTANTS.COMPOSITE_GST_RATE * 100}%.
          Recalculate before sending to customer.
        </p>
      </div>
    </div>
  );
}
