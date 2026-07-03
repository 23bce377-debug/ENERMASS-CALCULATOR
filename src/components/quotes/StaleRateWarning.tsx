import { TAX_CONSTANTS } from '@/lib/tax-constants';

interface Props { gstRate: number | null; quoteId: string; }

export function StaleRateWarning({ gstRate, quoteId }: Props) {
  if (!gstRate || Math.abs(gstRate - TAX_CONSTANTS.PROJECT_COMPOSITE_GST_RATE) < 0.0001) return null;
  return (
    <div className="flex items-start gap-3 rounded border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
      <span className="mt-0.5 text-amber-400">⚠</span>
      <div>
        <p className="font-medium">Non-default GST Rate Detected</p>
        <p className="text-amber-300/70 mt-1">
          This quote uses {(gstRate * 100).toFixed(1)}% GST. The current default composite project rate is{' '}
          {(TAX_CONSTANTS.PROJECT_COMPOSITE_GST_RATE * 100).toFixed(1)}%.
          Verify the selected state/master GST before sending to customer.
        </p>
      </div>
    </div>
  );
}
