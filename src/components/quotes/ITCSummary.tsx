interface Props {
  systemCostExclGst: number;
  isCommercial: boolean;
  isGstRegistered: boolean;
}

export function ITCSummary({ systemCostExclGst, isCommercial, isGstRegistered }: Props) {
  if (!isCommercial || !isGstRegistered) return null;

  const gstAmount = Math.round(systemCostExclGst * 0.18);
  const totalInvoice = systemCostExclGst + gstAmount;
  const itcClaimable = gstAmount; // 100% claimable for eligible businesses
  const effectiveNetCost = systemCostExclGst; // GST cancels out

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;

  return (
    <div className="rounded border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm mt-6 print:hidden">
      <p className="font-semibold text-emerald-400 mb-3">
        Commercial ITC Benefit Analysis
      </p>
      <div className="space-y-1.5 text-slate-300">
        <div className="flex justify-between">
          <span>System Cost (excl. GST)</span>
          <span>{fmt(systemCostExclGst)}</span>
        </div>
        <div className="flex justify-between">
          <span>GST @18% (Payable)</span>
          <span>+{fmt(gstAmount)}</span>
        </div>
        <div className="flex justify-between border-t border-slate-700 pt-1.5">
          <span>Total Invoice</span>
          <span className="font-medium">{fmt(totalInvoice)}</span>
        </div>
        <div className="flex justify-between text-emerald-400">
          <span>ITC Claimable (via GSTR-2B)</span>
          <span>−{fmt(itcClaimable)}</span>
        </div>
        <div className="flex justify-between border-t border-slate-700 pt-1.5 font-semibold text-emerald-300">
          <span>Effective Net Cost</span>
          <span>{fmt(effectiveNetCost)} ✓</span>
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-500 leading-relaxed">
        ITC eligibility subject to vendor GST compliance (GSTR-1 filing).
        Consult your CA. ITC may be reversed if vendor defaults on filing.
      </p>
    </div>
  );
}
