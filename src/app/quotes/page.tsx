'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCalculatorStore } from '@/lib/store/calculatorStore';
import { formatINR } from '@/lib/engine/calculator';
import { SYSTEMS, type SolarSystem } from '@/lib/data/bom';
import { useSettings } from '@/lib/hooks/useSettings';
import type { Quote } from '@/lib/types/quote';
import {
  Search, Filter, FileText, Download, Trash2, Eye, X,
  ChevronDown, ArrowUpDown, Printer, PenSquare, Copy,
  Mail, MessageCircle,
} from 'lucide-react';

// ─── Status Config ──────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<Quote['status'], string> = {
  Draft: 'bg-white/5 text-text-secondary border-white/10',
  Sent: 'bg-info/12 text-info border-info/20',
  Won: 'bg-success/12 text-success border-success/20',
  Lost: 'bg-error/12 text-error border-error/20',
};

const STATUS_CYCLE: Record<Quote['status'], Quote['status'][]> = {
  Draft: ['Sent'],
  Sent: ['Won', 'Lost'],
  Won: ['Draft'],
  Lost: ['Draft'],
};

function getQuoteShareText(quote: Quote, companyName: string): string {
  const calc = quote.calculations;
  return [
    `${companyName} Solar Quote`,
    `Quote ID: ${quote.quoteId}`,
    `Customer: ${quote.customer.name}`,
    `System: ${quote.systemName}`,
    `Final Price: ${formatINR(calc.finalCustomerPrice)}`,
    `After Subsidy: ${formatINR(calc.beneficiaryContribution)}`,
  ].join('\n');
}

function toWhatsappNumber(phone: string): string {
  return phone.replace(/\D/g, '').replace(/^0+/, '');
}

// ─── Quote Detail Modal ─────────────────────────────────────────────────────────

function QuoteDetailModal({
  quote,
  companyName,
  onClose,
  onEdit,
  onDuplicate,
}: {
  quote: Quote;
  companyName: string;
  onClose: () => void;
  onEdit: (quoteId: string) => void;
  onDuplicate: (quoteId: string) => void;
}) {
  const { settings } = useSettings();
  const system = SYSTEMS.find((s) => s.id === quote.systemId) || settings.customSystems?.find((s) => s.id === quote.systemId);
  const calc = quote.calculations;

  const statusHistory = quote.statusHistory?.length
    ? quote.statusHistory
    : [{ status: quote.status, changedAt: quote.updatedAt || quote.createdAt }];

  const handlePrint = () => window.print();

  const handleEmailShare = () => {
    const subject = `Solar Quote ${quote.quoteId}`;
    const body = getQuoteShareText(quote, companyName);
    const mailto = `mailto:${quote.customer.email || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
  };

  const handleWhatsappShare = () => {
    const text = getQuoteShareText(quote, companyName);
    const rawPhone = quote.customer.whatsapp || quote.customer.phone;
    const phone = toWhatsappNumber(rawPhone);
    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/70 backdrop-blur-sm overflow-y-auto p-4 md:p-8 print:hidden">
      <div className="w-full max-w-4xl bg-surface border border-border rounded-2xl shadow-2xl animate-fade-in print-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border print:border-gray-300">
          <div>
            <h2 className="text-xl font-bold text-text-primary">{quote.quoteId}</h2>
            <p className="text-sm text-text-muted mt-1">{quote.date} · {quote.systemName}</p>
          </div>
          <div className="flex items-center gap-2 print:hidden flex-wrap justify-end">
            <button
              onClick={() => onEdit(quote.quoteId)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-text-primary text-sm font-medium hover:bg-surface-hover transition-colors"
            >
              <PenSquare size={16} /> Edit
            </button>
            <button
              onClick={() => onDuplicate(quote.quoteId)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-text-primary text-sm font-medium hover:bg-surface-hover transition-colors"
            >
              <Copy size={16} /> Duplicate
            </button>
            <button
              onClick={handleEmailShare}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-text-primary text-sm font-medium hover:bg-surface-hover transition-colors"
            >
              <Mail size={16} /> Email
            </button>
            <button
              onClick={handleWhatsappShare}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-text-primary text-sm font-medium hover:bg-surface-hover transition-colors"
            >
              <MessageCircle size={16} /> WhatsApp
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent/10 text-accent text-sm font-medium hover:bg-accent/20 transition-colors"
            >
              <Printer size={16} /> Download PDF
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Customer & Address */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <InfoSection title="Customer">
              <InfoRow label="Name" value={quote.customer.name} />
              <InfoRow label="Phone" value={quote.customer.phone} />
              <InfoRow label="WhatsApp" value={quote.customer.whatsapp} />
              <InfoRow label="Email" value={quote.customer.email} />
            </InfoSection>
            <InfoSection title="Address">
              <InfoRow label="Line 1" value={quote.address.line1} />
              <InfoRow label="Line 2" value={quote.address.line2} />
              <InfoRow label="City" value={quote.address.city} />
              <InfoRow label="State" value={quote.address.state} />
              <InfoRow label="PIN" value={quote.address.pin} />
            </InfoSection>
          </div>

          {/* Site & Sales */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <InfoSection title="Site Details">
              <InfoRow label="Meter No" value={quote.site.meterNo} />
              <InfoRow label="Sanctioned Load" value={quote.site.sanctionedLoad} />
              <InfoRow label="Monthly Bill" value={formatINR(quote.site.monthlyBill)} />
              <InfoRow label="Roof Type" value={quote.site.roofType} />
              <InfoRow label="Roof Area" value={`${quote.site.roofArea} sq ft`} />
            </InfoSection>
            <InfoSection title="Sales Info">
              <InfoRow label="Executive" value={quote.sales.execName} />
              <InfoRow label="Sale Type" value={quote.sales.saleType} />
              <InfoRow label="Notes" value={quote.sales.notes || '—'} />
            </InfoSection>
          </div>

          {/* System Summary */}
          <InfoSection title="System">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatBox label="System" value={quote.systemName} />
              <StatBox label="Capacity" value={`${system?.capacityKW ?? '—'} kW`} />
              <StatBox label="Panels" value={`${system?.panelQty ?? '—'} × ${system?.panelWattage ?? ''}W`} />
              <StatBox label="Category" value={quote.category} />
            </div>
          </InfoSection>

          {/* Pricing Breakdown */}
          <InfoSection title="Pricing Breakdown">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <StatBox label="Cost (excl GST)" value={formatINR(calc.costBeforeGST)} />
              <StatBox label="Input GST" value={formatINR(calc.totalInputGST)} />
              <StatBox label="Cost (incl GST)" value={formatINR(calc.totalIncGST)} />
              <StatBox label="Margin" value={`${(calc.effectiveMarginPct * 100).toFixed(1)}%`} />
              <StatBox label="MRP (excl GST)" value={formatINR(calc.mrpExclGST)} />
              <StatBox label="MRP (incl GST)" value={formatINR(calc.mrpInclGST)} highlight />
              <StatBox label="Discount" value={formatINR(calc.discountAmount)} />
              <StatBox label="Additional Costs" value={formatINR(calc.additionalCostTotal)} />
              <StatBox label="Final Price" value={formatINR(calc.finalCustomerPrice)} highlight />
              <StatBox label="Subsidy" value={formatINR(calc.subsidyAmount)} />
              <StatBox label="Customer Pays" value={formatINR(calc.beneficiaryContribution)} highlight />
              <StatBox label="₹/kW" value={formatINR(calc.perKWinclGST)} />
            </div>
          </InfoSection>

          {/* Energy Estimates */}
          <InfoSection title="Energy Estimates">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <StatBox label="Daily Generation" value={`${calc.dailyGenerationKWh.toFixed(1)} kWh`} />
              <StatBox label="Monthly Generation" value={`${calc.monthlyGenerationKWh.toFixed(0)} kWh`} />
              <StatBox label="Annual Generation" value={`${calc.annualGenerationKWh.toFixed(0)} kWh`} />
              <StatBox label="Monthly Savings" value={formatINR(calc.monthlySavingsINR)} />
              <StatBox label="Annual Savings" value={formatINR(calc.annualSavingsINR)} />
              <StatBox label="Payback" value={calc.paybackYears === Infinity ? '—' : `${calc.paybackYears.toFixed(1)} yrs`} highlight />
            </div>
          </InfoSection>

          <InfoSection title="Status History">
            <div className="space-y-2">
              {statusHistory.map((entry, index) => (
                <div key={`${entry.changedAt}-${entry.status}-${index}`} className="flex justify-between text-sm border-b border-border/50 last:border-0 pb-1.5 last:pb-0">
                  <span className="text-text-secondary">{entry.status}</span>
                  <span className="text-text-muted">{new Date(entry.changedAt).toLocaleString('en-IN')}</span>
                </div>
              ))}
            </div>
          </InfoSection>
        </div>
      </div>
      <QuotePrintView quote={quote} companyName={companyName} system={system} />
    </div>
  );
}

function InfoSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface-hover/50 rounded-xl border border-border p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-accent mb-3">{title}</h3>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1.5 text-sm border-b border-border/50 last:border-0">
      <span className="text-text-muted">{label}</span>
      <span className="text-text-primary font-medium">{value || '—'}</span>
    </div>
  );
}

function StatBox({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`p-3 rounded-lg border ${highlight ? 'border-accent/30 bg-accent-glow' : 'border-border bg-background/50'}`}>
      <p className="text-[10px] uppercase tracking-wider text-text-muted mb-1">{label}</p>
      <p className={`text-sm font-bold ${highlight ? 'text-accent' : 'text-text-primary'}`}>{value}</p>
    </div>
  );
}

// ─── Print View & Styles ────────────────────────────────────────────────────────

function PrintStyles() {
  return (
    <style>{`
      @media print {
        @page { size: A4 portrait; margin: 15mm; }
        html, body { 
          background: #ffffff !important; 
          color: #000000 !important; 
          -webkit-print-color-adjust: exact !important; 
          print-color-adjust: exact !important; 
        }
        body > *:not(.print-container) { display: none !important; }
        .print-container { 
          display: block !important; 
          position: absolute; 
          left: 0; top: 0; right: 0; 
          background: white !important;
          color: black !important;
        }
        .print-hidden { display: none !important; }
        .print-break-inside-avoid { break-inside: avoid; }
        * { text-shadow: none !important; box-shadow: none !important; }
      }
    `}</style>
  );
}

function QuotePrintView({ quote, companyName, system }: { quote: Quote; companyName: string; system?: SolarSystem }) {
  const calc = quote.calculations;

  return (
    <div className="hidden print:block print-container font-sans w-full max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-start border-b-2 border-gray-800 pb-6 mb-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-gray-900">{companyName.toUpperCase()}</h1>
          <p className="text-sm text-gray-600 mt-1 uppercase font-semibold tracking-widest">Solar Energy Proposal</p>
        </div>
        <div className="text-right">
          <h2 className="text-2xl font-bold text-gray-800">{quote.quoteId}</h2>
          <p className="text-sm text-gray-600 mt-1">{new Date(quote.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
      </div>

      {/* Two Column Details */}
      <div className="flex gap-8 mb-8">
        <div className="flex-1">
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2 border-b border-gray-200 pb-1">Prepared For</h3>
          <p className="font-bold text-gray-900 text-lg">{quote.customer.name}</p>
          <p className="text-sm text-gray-700 mt-1">{quote.address.line1}</p>
          {quote.address.line2 && <p className="text-sm text-gray-700">{quote.address.line2}</p>}
          <p className="text-sm text-gray-700">{quote.address.city}, {quote.address.state} - {quote.address.pin}</p>
          <div className="mt-2 text-sm text-gray-700">
            <p>Phone: {quote.customer.phone}</p>
            {quote.customer.email && <p>Email: {quote.customer.email}</p>}
          </div>
        </div>
        
        <div className="flex-1 bg-gray-50 p-4 rounded-xl border border-gray-200">
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3 border-b border-gray-200 pb-1">System Specifications</h3>
          <div className="space-y-2">
            <div className="flex justify-between"><span className="text-gray-600 text-sm">System Name</span><span className="font-bold text-sm text-gray-900">{quote.systemName}</span></div>
            <div className="flex justify-between"><span className="text-gray-600 text-sm">Capacity</span><span className="font-bold text-sm text-gray-900">{system?.capacityKW ?? '—'} kW</span></div>
            <div className="flex justify-between"><span className="text-gray-600 text-sm">Panels</span><span className="font-semibold text-sm text-gray-800">{system?.panelQty ?? '—'} × {system?.panelWattage ?? '—'}W</span></div>
            <div className="flex justify-between"><span className="text-gray-600 text-sm">Grid Type</span><span className="font-semibold text-sm text-gray-800 uppercase">{quote.category}</span></div>
            <div className="flex justify-between"><span className="text-gray-600 text-sm">Sanctioned Load</span><span className="font-semibold text-sm text-gray-800">{quote.site.sanctionedLoad} kW</span></div>
          </div>
        </div>
      </div>

      {/* Financials & ROI */}
      <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2 border-b border-gray-200 pb-1">Financial Investment</h3>
      <div className="border border-gray-300 rounded-lg overflow-hidden mb-8">
        <div className="flex justify-between p-3 border-b border-gray-200 bg-gray-50">
          <span className="text-sm text-gray-700 font-medium">System Price (Incl. GST)</span>
          <span className="text-sm text-gray-900 font-bold">{formatINR(calc.mrpInclGST)}</span>
        </div>
        {calc.discountAmount > 0 && (
          <div className="flex justify-between p-3 border-b border-gray-200">
            <span className="text-sm text-gray-700 font-medium">Special Discount</span>
            <span className="text-sm text-red-600 font-bold">-{formatINR(calc.discountAmount)}</span>
          </div>
        )}
        {calc.additionalCostTotal > 0 && (
          <div className="flex justify-between p-3 border-b border-gray-200">
            <span className="text-sm text-gray-700 font-medium">Additional Customizations</span>
            <span className="text-sm text-gray-900 font-bold">+{formatINR(calc.additionalCostTotal)}</span>
          </div>
        )}
        {calc.subsidyAmount > 0 && (
          <div className="flex justify-between p-3 border-b border-gray-200 bg-green-50">
            <span className="text-sm text-green-800 font-medium">Govt. Subsidy (Estimated)</span>
            <span className="text-sm text-green-800 font-bold">-{formatINR(calc.subsidyAmount)}</span>
          </div>
        )}
        <div className="flex justify-between p-4 bg-gray-900 text-white">
          <span className="text-lg font-bold">Net Payable Amount</span>
          <span className="text-2xl font-black">{formatINR(calc.beneficiaryContribution)}</span>
        </div>
      </div>

      {/* Performance Estimates */}
      <div className="grid grid-cols-3 gap-4 mb-8 print-break-inside-avoid">
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-center">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Daily Generation</p>
          <p className="text-xl font-bold text-gray-900">{calc.dailyGenerationKWh.toFixed(1)} <span className="text-sm font-normal text-gray-600">kWh</span></p>
        </div>
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-center">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Monthly Savings</p>
          <p className="text-xl font-bold text-green-700">{formatINR(calc.monthlySavingsINR)}</p>
        </div>
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-center">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Est. Payback Period</p>
          <p className="text-xl font-bold text-blue-700">{calc.paybackYears === Infinity ? '—' : `${calc.paybackYears.toFixed(1)} yrs`}</p>
        </div>
      </div>

      <div className="mt-12 text-center text-xs text-gray-400 pt-4 border-t border-gray-200">
        <p>This is a computer generated document and does not require a physical signature.</p>
        <p>Subsidy amounts and generation estimates are indicative and subject to site conditions and govt policies.</p>
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────────

export default function QuotesPage() {
  const router = useRouter();
  const quotes = useCalculatorStore((s) => s.quotes);
  const loadQuote = useCalculatorStore((s) => s.loadQuote);
  const duplicateQuote = useCalculatorStore((s) => s.duplicateQuote);
  const { settings } = useSettings();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<Quote['status'] | 'All'>('All');
  const [sortAsc, setSortAsc] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);

  const companyName = settings.company.name || 'ENERMASS Solar';

  const goToCalculatorForEdit = (quoteId: string) => {
    loadQuote(quoteId);
    router.push('/calculator');
  };

  const cloneQuoteAsTemplate = (quoteId: string) => {
    duplicateQuote(quoteId);
    router.push('/calculator');
  };

  // Cycle status
  const cycleStatus = (quoteId: string) => {
    const store = useCalculatorStore.getState();
    const updated = store.quotes.map((q) => {
      if (q.quoteId !== quoteId) return q;
      const nextOptions = STATUS_CYCLE[q.status];
      const next = nextOptions[0];
      const changedAt = new Date().toISOString();
      const existingHistory = q.statusHistory?.length
        ? q.statusHistory
        : [{ status: q.status, changedAt: q.createdAt }];

      return {
        ...q,
        status: next,
        statusHistory: [...existingHistory, { status: next, changedAt }],
        updatedAt: changedAt,
      };
    });
    useCalculatorStore.setState({ quotes: updated });
  };

  const deleteQuote = (quoteId: string) => {
    if (!confirm('Delete this quote permanently?')) return;
    const store = useCalculatorStore.getState();
    useCalculatorStore.setState({ quotes: store.quotes.filter((q) => q.quoteId !== quoteId) });
    if (selectedQuote?.quoteId === quoteId) {
      setSelectedQuote(null);
    }
  };

  const filtered = useMemo(() => {
    let result = [...quotes];

    if (search) {
      const q = search.toLowerCase();
      result = result.filter((quote) =>
        quote.customer.name.toLowerCase().includes(q) ||
        quote.quoteId.toLowerCase().includes(q) ||
        quote.customer.phone.toLowerCase().includes(q) ||
        quote.customer.whatsapp.toLowerCase().includes(q) ||
        quote.customer.email.toLowerCase().includes(q) ||
        quote.systemName.toLowerCase().includes(q) ||
        quote.systemId.toLowerCase().includes(q)
      );
    }

    if (statusFilter !== 'All') {
      result = result.filter((quote) => quote.status === statusFilter);
    }

    result.sort((a, b) => {
      const diff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return sortAsc ? -diff : diff;
    });

    return result;
  }, [quotes, search, statusFilter, sortAsc]);

  return (
    <>
      <PrintStyles />
      <div className="p-4 md:p-6 space-y-6 animate-fade-in">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Quote Management</h1>
            <p className="text-sm text-text-muted mt-1">{quotes.length} total quotes</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="Search by quote, customer, phone, email, or system..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-surface border border-border text-sm text-text-primary placeholder:text-text-muted focus:border-accent/50 focus:ring-1 focus:ring-accent/20 outline-none transition-all"
            />
          </div>
          <div className="relative">
            <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as Quote['status'] | 'All')}
              className="appearance-none pl-9 pr-8 py-2.5 rounded-lg bg-surface border border-border text-sm text-text-primary outline-none focus:border-accent/50 transition-all cursor-pointer"
            >
              <option value="All">All Status</option>
              <option value="Draft">Draft</option>
              <option value="Sent">Sent</option>
              <option value="Won">Won</option>
              <option value="Lost">Lost</option>
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
          </div>
          <button
            onClick={() => setSortAsc(!sortAsc)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-surface border border-border text-sm text-text-secondary hover:text-text-primary hover:border-border-light transition-all"
          >
            <ArrowUpDown size={14} /> {sortAsc ? 'Oldest' : 'Newest'}
          </button>
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <FileText size={48} className="text-text-muted/30 mb-4" />
            <p className="text-text-muted text-lg">No quotes found</p>
            <p className="text-text-muted/60 text-sm mt-1">Save a quote from the calculator to see it here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-hover/50 border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted">Quote ID</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted">Customer</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted hidden md:table-cell">System</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted hidden lg:table-cell">Capacity</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted">Final Price</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((quote) => {
                  const system = SYSTEMS.find((s) => s.id === quote.systemId) || settings.customSystems?.find((s) => s.id === quote.systemId);
                  return (
                    <tr key={quote.quoteId} className="border-b border-border/50 hover:bg-surface-hover/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-accent">{quote.quoteId}</td>
                      <td className="px-4 py-3 text-text-secondary">{quote.date}</td>
                      <td className="px-4 py-3 text-text-primary font-medium">{quote.customer.name}</td>
                      <td className="px-4 py-3 text-text-secondary hidden md:table-cell truncate max-w-[160px]">{quote.systemName}</td>
                      <td className="px-4 py-3 text-right text-text-secondary hidden lg:table-cell">{system?.capacityKW ?? '—'} kW</td>
                      <td className="px-4 py-3 text-right font-semibold text-text-primary font-mono">{formatINR(quote.calculations.finalCustomerPrice)}</td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => cycleStatus(quote.quoteId)}
                          className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border cursor-pointer transition-all hover:scale-105 ${STATUS_STYLES[quote.status]}`}
                        >
                          {quote.status}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setSelectedQuote(quote)}
                            title="View"
                            className="p-1.5 rounded-md hover:bg-accent/10 text-text-muted hover:text-accent transition-colors"
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            onClick={() => goToCalculatorForEdit(quote.quoteId)}
                            title="Edit Quote"
                            className="p-1.5 rounded-md hover:bg-accent/10 text-text-muted hover:text-accent transition-colors"
                          >
                            <PenSquare size={15} />
                          </button>
                          <button
                            onClick={() => cloneQuoteAsTemplate(quote.quoteId)}
                            title="Duplicate Quote"
                            className="p-1.5 rounded-md hover:bg-accent/10 text-text-muted hover:text-accent transition-colors"
                          >
                            <Copy size={15} />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedQuote(quote);
                              setTimeout(() => window.print(), 300);
                            }}
                            title="Download PDF"
                            className="p-1.5 rounded-md hover:bg-accent/10 text-text-muted hover:text-accent transition-colors"
                          >
                            <Download size={15} />
                          </button>
                          <button
                            onClick={() => deleteQuote(quote.quoteId)}
                            title="Delete"
                            className="p-1.5 rounded-md hover:bg-error/10 text-text-muted hover:text-error transition-colors"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedQuote && (
        <QuoteDetailModal
          quote={selectedQuote}
          companyName={companyName}
          onClose={() => setSelectedQuote(null)}
          onEdit={(quoteId) => {
            setSelectedQuote(null);
            goToCalculatorForEdit(quoteId);
          }}
          onDuplicate={(quoteId) => {
            setSelectedQuote(null);
            cloneQuoteAsTemplate(quoteId);
          }}
        />
      )}
    </>
  );
}
