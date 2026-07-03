'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { useCalculatorStore } from '@/lib/store/calculatorStore';
import { formatINR } from '@/lib/engine/calculator';
import { SYSTEMS } from '@/lib/data/bom';
import { useSettings } from '@/lib/hooks/useSettings';
import type { Quote } from '@/lib/types/quote';
import {
  Search, FileText, Download, Trash2, Eye, X,
  ArrowUpDown, PenSquare, Copy, BarChart3,
  Mail, MessageCircle, GitPullRequest, History, UploadCloud
} from 'lucide-react';
import { useConfirm } from '@/components/ui/Confirm';
import { Select } from '@/components/ui/Select';
import { useQuotesQuery, useDeleteQuoteMutation, useUpdateQuoteStatusMutation } from '@/lib/hooks/useQuotes';
import { SurveyGateModal } from '@/components/quotes/SurveyGateModal';
import { SurveySummaryCard } from '@/components/quotes/SurveySummaryCard';
import { QuoteVersionHistory } from '@/components/quotes/QuoteVersionHistory';
import { QuoteReviseModal } from '@/components/quotes/QuoteReviseModal';
import { StaleRateWarning } from '@/components/quotes/StaleRateWarning';
import { ITCSummary } from '@/components/quotes/ITCSummary';
import { RateVerdictReport } from '@/components/quotes/RateVerdictReport';

// ─── Status Config ──────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<Quote['status'], string> = {
  Draft: 'bg-white/5 text-text-secondary border-white/10',
  Sent: 'bg-accent/10 text-accent border-accent/20',
  Won: 'bg-success/12 text-success border-success/20',
  Lost: 'bg-error/12 text-error border-error/20',
};

const STATUS_CYCLE: Record<Quote['status'], Quote['status'][]> = {
  Draft: ['Sent'],
  Sent: ['Won'],
  Won: ['Draft'],
  Lost: ['Draft'],
};

function getQuoteShareText(quote: Quote, companyName: string): string {
  const calc = quote.calculations;
  return [
    `${companyName} Solar Quote`,
    `Quote ID: ${quote.quoteId}`,
    `Project: ${quote.sales.projectTitle || quote.systemName}`,
    `Customer: ${quote.customer.name}`,
    `System: ${quote.systemName}`,
    `Final Price: ${formatINR(calc.finalCustomerPrice)}`,
    `After Subsidy: ${formatINR(calc.beneficiaryContribution)}`,
  ].join('\n');
}

function toWhatsappNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '').replace(/^0+/, '');
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

// ─── Quote Detail Modal ─────────────────────────────────────────────────────────

function QuoteDetailModal({
  quote,
  companyName,
  onClose,
  onEdit,
  onDuplicate,
  onRateAnalysis,
}: {
  quote: Quote;
  companyName: string;
  onClose: () => void;
  onEdit: (quoteId: string) => void;
  onDuplicate: (quoteId: string) => void;
  onRateAnalysis: (quote: Quote) => void;
}) {
  const { settings } = useSettings();
  const system = SYSTEMS.find((s) => s.id === quote.systemId) || settings.customSystems?.find((s) => s.id === quote.systemId);
  const calc = quote.calculations;
  
  const [showHistory, setShowHistory] = useState(false);
  const [showRevise, setShowRevise] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const statusHistory = quote.statusHistory?.length
    ? quote.statusHistory
    : [{ status: quote.status, changedAt: quote.updatedAt || quote.createdAt }];

  const handleDownloadPdf = async () => {
    setIsGeneratingPdf(true);
    try {
      const response = await fetch('/api/quotes/generate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          quoteId: quote.quoteId,
          download: true,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${quote.quoteId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading PDF:', err);
      alert(err instanceof Error ? err.message : 'Failed to generate PDF.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleEmailShare = () => {
    const subject = `Solar Quote ${quote.quoteId}`;
    const bodyText = getQuoteShareText(quote, companyName);
    // Standard mailto newlines
    const body = encodeURIComponent(bodyText).replace(/%0A/g, '%0D%0A');
    const mailto = `mailto:${quote.customer.email || ''}?subject=${encodeURIComponent(subject)}&body=${body}`;
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
    <>
      <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/70 backdrop-blur-sm overflow-y-auto p-4 md:p-8 print:hidden">
        <div className="w-full max-w-4xl bg-surface border border-border rounded-2xl shadow-2xl animate-fade-in">
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
            {quote.status === 'Sent' && (
              <button
                onClick={() => setShowRevise(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-light transition-colors"
              >
                <GitPullRequest size={16} /> Revise Quote
              </button>
            )}
            <button
              onClick={() => setShowHistory(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-text-primary text-sm font-medium hover:bg-surface-hover transition-colors"
            >
              <History size={16} /> History
            </button>
            <button
              onClick={() => onDuplicate(quote.quoteId)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-text-primary text-sm font-medium hover:bg-surface-hover transition-colors"
            >
              <Copy size={16} /> Duplicate
            </button>
            <button
              onClick={() => onRateAnalysis(quote)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-accent/30 text-accent text-sm font-medium hover:bg-accent/10 transition-colors"
            >
              <BarChart3 size={16} /> Rate Analysis
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
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent/10 text-accent text-sm font-medium hover:bg-accent/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGeneratingPdf ? (
                <>
                  <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Download size={16} /> Download PDF
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="mx-6 mt-4 print:hidden">
          <StaleRateWarning gstRate={calc.gstOutputRate} quoteId={quote.quoteId} />
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
              <InfoRow label="Project" value={quote.sales.projectTitle} />
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
              <StatBox label="Capacity" value={`${quote.systemCapacityKW ?? system?.capacityKW ?? '—'} kW`} />
              <StatBox label="Panels" value={quote.panelQty ? `${quote.panelQty} Nos` : `${system?.panelQty ?? '—'} × ${system?.panelWattage ?? ''}W`} />
              <StatBox label="Category" value={quote.category} />
            </div>
          </InfoSection>

          {/* Pricing Breakdown */}
          <InfoSection title="Pricing Breakdown">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <StatBox label="Cost (excl GST)" value={formatINR(calc.costBeforeGST)} />
              <StatBox label="Input GST" value={formatINR(calc.totalInputGST)} />
              <StatBox label="Cost (incl GST)" value={formatINR(calc.totalIncGST)} />
              <StatBox label="Discount" value={formatINR(calc.discountAmount)} />
              <StatBox label="Additional Costs" value={formatINR(calc.additionalCostTotal)} />
              <StatBox label="Final Price" value={formatINR(calc.finalCustomerPrice)} highlight />
              <StatBox label="Subsidy" value={formatINR(calc.subsidyAmount)} />
              <StatBox label="Customer Pays" value={formatINR(calc.beneficiaryContribution)} highlight />
              <StatBox label="₹/kW" value={formatINR(calc.perKWinclGST)} />
            </div>
            <ITCSummary 
              systemCostExclGst={calc.costBeforeGST} 
              gstRate={calc.gstOutputRate}
              isCommercial={quote.category === 'commercial' || quote.category.includes('commercial')} 
              isGstRegistered={!!quote.customer.isGstRegistered} 
            />
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

          {/* File Attachments */}
          <InfoSection title="File Attachments">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-background/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-accent/10 text-accent rounded-lg">
                    <FileText size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text-primary">Site_Survey_Report.pdf</p>
                    <p className="text-[10px] text-text-muted">2.4 MB • Uploaded on {quote.date}</p>
                  </div>
                </div>
                <button className="p-1.5 text-text-muted hover:text-text-primary">
                  <Download size={14} />
                </button>
              </div>
              <button className="flex items-center justify-center gap-2 w-full py-3 border border-dashed border-border rounded-lg text-sm text-text-secondary hover:text-accent hover:border-accent hover:bg-accent/5 transition-all">
                <UploadCloud size={16} />
                <span>Upload New Attachment</span>
              </button>
            </div>
          </InfoSection>

          {/* Site Survey Summary */}
          <SurveySummaryCard quoteNumber={quote.quoteId} />
        </div>
      </div>
      
      {showHistory && (
        <QuoteVersionHistory
          baseQuoteNumber={quote.quoteId}
          onCompare={(v1, v2) => {}}
          onClose={() => setShowHistory(false)}
        />
      )}
      
      {showRevise && (
        <QuoteReviseModal
          quoteId={quote.quoteId}
          leadId={(quote as any).lead_id || quote.customer.phone}
          onClose={() => setShowRevise(false)}
          onSuccess={(newId) => {
            setShowRevise(false);
            onClose(); 
          }}
        />
      )}
      </div>
    </>
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

// ─── Main Page ──────────────────────────────────────────────────────────────────

export default function QuotesPage() {
  const router = useRouter();
  const { data: quotes = [], isLoading } = useQuotesQuery();
  const deleteMutation = useDeleteQuoteMutation();
  const updateStatusMutation = useUpdateQuoteStatusMutation();
  const loadQuote = useCalculatorStore((s) => s.loadQuote);
  const duplicateQuote = useCalculatorStore((s) => s.duplicateQuote);
  const { settings } = useSettings();
  const confirm = useConfirm();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<Quote['status'] | 'All'>('All');
  const [sortAsc, setSortAsc] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [rateAnalysisQuote, setRateAnalysisQuote] = useState<Quote | null>(null);
  const [generatingPdfQuoteId, setGeneratingPdfQuoteId] = useState<string | null>(null);

  const handleDownloadPdf = async (quoteId: string) => {
    setGeneratingPdfQuoteId(quoteId);
    try {
      const response = await fetch('/api/quotes/generate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ quoteId, download: true }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${quoteId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading PDF:', err);
      alert(err instanceof Error ? err.message : 'Failed to generate PDF.');
    } finally {
      setGeneratingPdfQuoteId(null);
    }
  };

  // Survey gate state
  const [surveyGate, setSurveyGate] = useState<{
    quoteId: string;
    leadId: string | null;
    orgId: string;
  } | null>(null);

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
  const cycleStatus = async (quoteId: string) => {
    const quote = quotes.find((q) => q.quoteId === quoteId);
    if (!quote) return;
    const nextOptions = STATUS_CYCLE[quote.status];
    const next = nextOptions[0];

    try {
      await updateStatusMutation.mutateAsync({ quoteId, newStatus: next });
    } catch (err: any) {
      if (err?.code === 'SURVEY_GATE_BLOCKED') {
        setSurveyGate({ quoteId, leadId: err.leadId ?? null, orgId: err.orgId ?? '' });
        return;
      }
      console.error(err);
      alert(err instanceof Error ? err.message : 'Failed to update quote status in database.');
    }
  };

  const deleteQuote = async (quoteId: string) => {
    const confirmed = await confirm({
      title: 'Delete Quote Permanently?',
      message: 'Are you sure you want to delete this quote? This action is permanent and cannot be undone.',
      confirmLabel: 'Delete Quote',
      cancelLabel: 'Keep Quote',
      type: 'danger',
    });
    if (!confirmed) return;

    try {
      await deleteMutation.mutateAsync(quoteId);
      if (selectedQuote?.quoteId === quoteId) {
        setSelectedQuote(null);
      }
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Failed to delete quote from database.');
    }
  };

  // Synchronize selectedQuote details with updated query data if active
  const activeSelectedQuote = useMemo(() => {
    if (!selectedQuote) return null;
    return quotes.find((q) => q.quoteId === selectedQuote.quoteId) || selectedQuote;
  }, [quotes, selectedQuote]);

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
          <Select
            value={statusFilter}
            onChange={(v) => setStatusFilter(v as Quote['status'] | 'All')}
            options={[
              { value: 'All', label: 'All Status' },
              { value: 'Draft', label: 'Draft' },
              { value: 'Sent', label: 'Sent' },
              { value: 'Won', label: 'Won' },
              { value: 'Lost', label: 'Lost' },
            ]}
            className="min-w-[140px]"
          />
          <button
            onClick={() => setSortAsc(!sortAsc)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-surface border border-border text-sm text-text-secondary hover:text-text-primary hover:border-border-light transition-all"
          >
            <ArrowUpDown size={14} /> {sortAsc ? 'Oldest' : 'Newest'}
          </button>
        </div>

        {/* Table View */}
        {isLoading ? (
          <div className="flex justify-center items-center py-20 text-text-muted">
            <span className="text-sm font-semibold animate-pulse font-mono uppercase tracking-wider">Loading quotes...</span>
          </div>
        ) : filtered.length === 0 ? (
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
                      <td className="px-4 py-3 font-mono text-xs">
                        {quote.dbId ? (
                          <Link href={`/quotes/${quote.dbId}`} className="text-accent hover:underline underline-offset-4">
                            {quote.quoteId}
                          </Link>
                        ) : (
                          <span className="text-accent">{quote.quoteId}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">{quote.date}</td>
                      <td className="px-4 py-3 text-text-primary font-medium">{quote.customer.name}</td>
                      <td className="px-4 py-3 text-text-secondary hidden md:table-cell truncate max-w-40">{quote.systemName}</td>
                      <td className="px-4 py-3 text-right text-text-secondary hidden lg:table-cell">{quote.systemCapacityKW ?? system?.capacityKW ?? '—'} kW</td>
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
                            onClick={() => setRateAnalysisQuote(quote)}
                            title="Rate Analysis"
                            className="p-1.5 rounded-md hover:bg-accent/10 text-text-muted hover:text-accent transition-colors"
                          >
                            <BarChart3 size={15} />
                          </button>
                          <button
                            onClick={() => handleDownloadPdf(quote.quoteId)}
                            disabled={generatingPdfQuoteId !== null}
                            title="Download Quote (PDF)"
                            className="p-1.5 rounded-md hover:bg-accent/10 text-text-muted hover:text-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {generatingPdfQuoteId === quote.quoteId ? (
                              <div className="w-3.5 h-3.5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Download size={15} />
                            )}
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
      {activeSelectedQuote && (
        <QuoteDetailModal
          quote={activeSelectedQuote}
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
          onRateAnalysis={(quote) => setRateAnalysisQuote(quote)}
        />
      )}

      {rateAnalysisQuote && (
        <RateVerdictReport
          quoteId={rateAnalysisQuote.quoteId}
          quoteNumber={rateAnalysisQuote.quoteId}
          onClose={() => setRateAnalysisQuote(null)}
        />
      )}

      {/* Survey Gate Modal */}
      {surveyGate && (
        <SurveyGateModal
          quoteNumber={surveyGate.quoteId}
          leadId={surveyGate.leadId}
          orgId={surveyGate.orgId}
          onClose={() => setSurveyGate(null)}
          onWaived={async () => {
            setSurveyGate(null);
            // Retry the status transition now that survey is waived
            await cycleStatus(surveyGate.quoteId);
          }}
        />
      )}
    </>
  );
}
