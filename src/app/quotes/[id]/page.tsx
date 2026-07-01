'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { QuoteORM, QuoteStatusHistoryORM, type QuoteRow, type QuoteItemRow, type QuoteVariantRow } from '@/backend/orm/quote';
import { 
  FileText, IndianRupee, Sun, Settings, Box, Calendar, 
  MapPin, Clock, Download, Copy, CheckCircle2, Loader2, PlusCircle
} from 'lucide-react';
import { formatINR } from '@/lib/engine/calculator';
import { supabase } from '@/lib/supabase/client';
import { reviseQuote } from '@/lib/quotes/reviseQuote';

type FullQuote = QuoteRow & {
  quote_items: QuoteItemRow[];
  quote_variants: QuoteVariantRow[];
  quote_additional_costs?: any[];
};

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
] as const;

type VersionSummary = Pick<QuoteRow, 'id' | 'quote_number' | 'version' | 'status' | 'created_at' | 'version_reason' | 'final_customer_price'>;

function titleCaseStatus(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function quoteFamilyRootId(quote: FullQuote) {
  return quote.parent_quote_id || quote.id;
}

function itemModelLabel(item: QuoteItemRow, quote: FullQuote) {
  const desc = item.description.toUpperCase();
  if (desc === 'PANEL') return quote.panel_brand_model || item.source_label || 'Solar panel model not saved';
  if (desc === 'INVERTER') return quote.inverter_brand_model || item.source_label || 'Inverter model not saved';
  if (desc === 'BATTERY') return quote.battery_brand_model || item.source_label || 'Battery model not saved';
  return item.source_label || item.remarks || 'Catalog item';
}

function itemSpecification(item: QuoteItemRow) {
  const details = [item.remarks, item.source_table ? `Source: ${item.source_table}` : null]
    .filter(Boolean)
    .join(' · ');
  return details || 'Specification not saved';
}

export default function QuoteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [quote, setQuote] = useState<FullQuote | null>(null);
  const [versions, setVersions] = useState<VersionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeVersion, setActiveVersion] = useState<number | null>(null);
  const [statusDraft, setStatusDraft] = useState<QuoteRow['status']>('draft');
  const [statusSaving, setStatusSaving] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [duplicateLoading, setDuplicateLoading] = useState(false);
  const [versionLoading, setVersionLoading] = useState(false);

  const loadVersions = async (loadedQuote: FullQuote) => {
    const rootId = quoteFamilyRootId(loadedQuote);
    const { data, error: versionsError } = await supabase
      .from('quotes')
      .select('id, quote_number, version, status, created_at, version_reason, final_customer_price')
      .or(`id.eq.${rootId},parent_quote_id.eq.${rootId}`)
      .order('version', { ascending: true });

    if (versionsError) throw versionsError;
    setVersions((data || []) as VersionSummary[]);
  };

  useEffect(() => {
    async function loadData() {
      try {
        const data = await QuoteORM.getById(id);
        if (!data) throw new Error('Quote not found');
        setQuote(data);
        setStatusDraft(data.status);
        setActiveVersion(data.version || 1);
        await loadVersions(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id]);

  const handleStatusUpdate = async () => {
    if (!quote || statusDraft === quote.status) return;

    setStatusSaving(true);
    setError(null);
    try {
      const previousStatus = quote.status;
      const now = new Date().toISOString();
      const updated = await QuoteORM.update(quote.id, {
        status: statusDraft,
        updated_at: now,
      }, quote.version);

      const { data: sessionData } = await supabase.auth.getSession();
      try {
        await QuoteStatusHistoryORM.create({
          quote_id: quote.id,
          old_status: previousStatus,
          new_status: statusDraft,
          changed_at: now,
          changed_by: sessionData.session?.user?.id ?? null,
          notes: 'Status updated from quote detail page',
        });
      } catch (historyErr) {
        console.error('Failed to write quote status history:', historyErr);
      }

      setQuote({
        ...quote,
        ...updated,
        quote_items: quote.quote_items,
        quote_variants: quote.quote_variants,
        quote_additional_costs: quote.quote_additional_costs,
      });
      await loadVersions({ ...quote, ...updated } as FullQuote);
    } catch (err: any) {
      setError(err.message || 'Failed to update quote status.');
      setStatusDraft(quote.status);
    } finally {
      setStatusSaving(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!quote) return;
    setPdfLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/quotes/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quoteId: quote.quote_number, download: true }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message || payload?.error || 'Failed to generate PDF.');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${quote.quote_number}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message || 'Failed to download PDF.');
    } finally {
      setPdfLoading(false);
    }
  };

  const handleCreateVersion = async () => {
    if (!quote) return;
    setVersionLoading(true);
    setError(null);
    try {
      const newQuoteNumber = await reviseQuote(quote.id, 'Manual version created from quote detail');
      const { data: newQuote, error: lookupError } = await supabase
        .from('quotes')
        .select('id')
        .eq('quote_number', newQuoteNumber)
        .single();
      if (lookupError || !newQuote) throw lookupError || new Error('New quote version was created but could not be opened.');
      router.push(`/quotes/${newQuote.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create quote version.');
    } finally {
      setVersionLoading(false);
    }
  };

  const handleDuplicate = async () => {
    if (!quote) return;
    setDuplicateLoading(true);
    setError(null);
    try {
      const {
        id: _id,
        quote_number: originalQuoteNumber,
        created_at: _createdAt,
        updated_at: _updatedAt,
        parent_quote_id: _parentQuoteId,
        version_reason: _versionReason,
        quote_items: originalItems,
        quote_variants: originalVariants,
        quote_additional_costs: originalCosts = [],
        ...copyableQuote
      } = quote as any;
      const now = new Date().toISOString();
      const copyNumber = `${originalQuoteNumber}-COPY-${now.replace(/\D/g, '').slice(8, 14)}`;

      const { data: newQuote, error: quoteError } = await supabase
        .from('quotes')
        .insert({
          ...copyableQuote,
          quote_number: copyNumber,
          status: 'draft',
          version: 1,
          parent_quote_id: null,
          version_reason: null,
          created_at: now,
          updated_at: now,
        })
        .select('id')
        .single();
      if (quoteError || !newQuote) throw quoteError || new Error('Failed to duplicate quote.');

      const clonedItems = (originalItems || []).map((item: any) => {
        const { id: _itemId, quote_id: _quoteId, created_at: _itemCreated, updated_at: _itemUpdated, ...itemData } = item;
        return { ...itemData, quote_id: newQuote.id, created_at: now, updated_at: now };
      });
      if (clonedItems.length) {
        const { error: itemsError } = await supabase.from('quote_items').insert(clonedItems);
        if (itemsError) throw itemsError;
      }

      const clonedCosts = (originalCosts || []).map((cost: any) => {
        const { id: _costId, quote_id: _quoteId, created_at: _costCreated, ...costData } = cost;
        return { ...costData, quote_id: newQuote.id, created_at: now };
      });
      if (clonedCosts.length) {
        const { error: costsError } = await supabase.from('quote_additional_costs').insert(clonedCosts);
        if (costsError) throw costsError;
      }

      const clonedVariants = (originalVariants || []).map((variant: any) => {
        const { id: _variantId, quote_id: _quoteId, created_at: _variantCreated, updated_at: _variantUpdated, ...variantData } = variant;
        return { ...variantData, quote_id: newQuote.id, created_at: now, updated_at: now };
      });
      if (clonedVariants.length) {
        const { error: variantsError } = await supabase.from('quote_variants').insert(clonedVariants);
        if (variantsError) throw variantsError;
      }

      router.push(`/quotes/${newQuote.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to duplicate quote.');
    } finally {
      setDuplicateLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#f0a500]"></div>
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="bg-red-500/10 border border-red-500/30 text-red-500 p-4 rounded-lg">
          Error: {error || 'Quote not found'}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 bg-[#1a1a1a] p-6 rounded-xl border border-[#2a2a2a] shadow-lg">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-lg bg-[#f0a500]/20 flex items-center justify-center text-[#f0a500]">
              <FileText size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                Quote #{quote.quote_number}
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-[#333] text-white">
                  v{activeVersion}
                </span>
              </h1>
              <p className="text-sm text-[#888] mt-1">For {quote.customer_name}</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-4 text-sm text-[#888]">
            {quote.project_type && (
              <div className="flex items-center gap-1.5 capitalize">
                <Box size={14} /> {quote.project_type.replace('_', ' ')}
              </div>
            )}
            {quote.state_name && (
              <div className="flex items-center gap-1.5">
                <MapPin size={14} /> {quote.state_name}
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Calendar size={14} /> Created {new Date(quote.created_at).toLocaleDateString()}
            </div>
            <div className="flex items-center gap-1.5 capitalize">
              <CheckCircle2 size={14} /> {titleCaseStatus(quote.status)}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleDuplicate}
            disabled={duplicateLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2a2a2a] text-white hover:bg-[#333] transition-colors text-sm font-medium border border-[#444] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {duplicateLoading ? <Loader2 size={16} className="animate-spin" /> : <Copy size={16} />}
            Duplicate
          </button>
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={pdfLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2a2a2a] text-white hover:bg-[#333] transition-colors text-sm font-medium border border-[#444] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {pdfLoading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            PDF
          </button>
          <div className="flex items-center gap-2 rounded-lg border border-[#444] bg-[#2a2a2a] px-2 py-1.5">
            <span className="px-2 text-xs font-semibold uppercase tracking-wider text-[#888]">Status</span>
            <select
              value={statusDraft}
              onChange={(event) => setStatusDraft(event.target.value as QuoteRow['status'])}
              disabled={statusSaving}
              className="min-w-28 rounded-md border border-[#444] bg-[#111] px-2 py-1.5 text-sm font-semibold capitalize text-white outline-none focus:border-[#f0a500]"
            >
              {STATUS_OPTIONS.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleStatusUpdate}
              disabled={statusSaving || statusDraft === quote.status}
              className="rounded-md bg-[#f0a500] px-3 py-1.5 text-sm font-bold text-black transition-colors hover:bg-[#f0a500]/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {statusSaving ? 'Updating...' : 'Update'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Version History Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-[#1a1a1a] p-5 rounded-xl border border-[#2a2a2a] shadow-lg">
            <h2 className="text-sm font-semibold text-[#888] uppercase tracking-wider mb-4 border-b border-[#2a2a2a] pb-2 flex items-center gap-2">
              <Clock size={16} /> Version History
            </h2>
            <div className="space-y-2">
              {(versions.length ? versions : [quote]).map((version) => {
                const v = version.version || 1;
                const isActive = version.id === quote.id || v === activeVersion;
                return (
                  <button 
                    key={version.id}
                    onClick={() => {
                      setActiveVersion(v);
                      if (version.id !== quote.id) router.push(`/quotes/${version.id}`);
                    }}
                    className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${
                      isActive 
                        ? 'bg-[#f0a500]/10 border-[#f0a500]/30 text-white' 
                        : 'bg-[#111] border-[#222] text-[#888] hover:border-[#444] hover:text-white'
                      }`}
                  >
                    <span className="min-w-0 text-left">
                      <span className="block font-medium">Version {v}</span>
                      <span className="block truncate text-[10px] text-[#888]">{version.quote_number}</span>
                      <span className="block text-[10px] text-[#666]">{formatINR(version.final_customer_price || 0)}</span>
                    </span>
                    {isActive && <CheckCircle2 size={16} className="text-[#f0a500]" />}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={handleCreateVersion}
                disabled={versionLoading}
                className="w-full mt-2 py-2 text-xs font-semibold text-[#f0a500] border border-dashed border-[#f0a500]/30 rounded-lg hover:bg-[#f0a500]/10 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {versionLoading ? <Loader2 size={14} className="animate-spin" /> : <PlusCircle size={14} />}
                Create New Version
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3 space-y-6">
          
          {/* Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[#1a1a1a] p-4 rounded-xl border border-[#2a2a2a] shadow-lg">
              <p className="text-xs text-[#888] uppercase tracking-wider mb-1 flex items-center gap-1.5"><Sun size={14}/> Capacity</p>
              <p className="text-xl font-bold text-white">{quote.system_capacity_kw} kW</p>
            </div>
            <div className="bg-[#1a1a1a] p-4 rounded-xl border border-[#2a2a2a] shadow-lg">
              <p className="text-xs text-[#888] uppercase tracking-wider mb-1 flex items-center gap-1.5"><IndianRupee size={14}/> Gross Price</p>
              <p className="text-xl font-bold text-white">{formatINR(quote.mrp_incl_gst || 0)}</p>
            </div>
            <div className="bg-[#1a1a1a] p-4 rounded-xl border border-[#2a2a2a] shadow-lg">
              <p className="text-xs text-[#888] uppercase tracking-wider mb-1 flex items-center gap-1.5 text-green-400"><IndianRupee size={14}/> Subsidy</p>
              <p className="text-xl font-bold text-green-400">{formatINR(quote.subsidy_amount || 0)}</p>
            </div>
            <div className="bg-[#f0a500]/10 p-4 rounded-xl border border-[#f0a500]/30 shadow-lg relative overflow-hidden">
              <div className="absolute right-0 top-0 bottom-0 w-1 bg-[#f0a500]"></div>
              <p className="text-xs text-[#f0a500] uppercase tracking-wider mb-1 font-semibold flex items-center gap-1.5"><IndianRupee size={14}/> Net Price</p>
              <p className="text-xl font-bold text-[#f0a500]">{formatINR(quote.beneficiary_contribution || quote.final_customer_price || 0)}</p>
            </div>
          </div>

          {/* Line Items */}
          <div className="bg-[#1a1a1a] rounded-xl border border-[#2a2a2a] shadow-lg overflow-hidden">
            <div className="p-5 border-b border-[#2a2a2a] bg-[#111]">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Settings size={16} className="text-[#888]"/> System Configuration
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-[#151515] text-[#888]">
                    <th className="px-5 py-3 font-medium border-b border-[#2a2a2a]">Component</th>
                    <th className="px-5 py-3 font-medium border-b border-[#2a2a2a]">Model / Specification</th>
                    <th className="px-5 py-3 font-medium border-b border-[#2a2a2a] text-center">Quantity</th>
                    <th className="px-5 py-3 font-medium border-b border-[#2a2a2a] text-right">Unit Rate</th>
                    <th className="px-5 py-3 font-medium border-b border-[#2a2a2a] text-right">GST</th>
                    <th className="px-5 py-3 font-medium border-b border-[#2a2a2a] text-right">Quoted Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2a2a2a]">
                  {quote.quote_items && quote.quote_items.length > 0 ? (
                    quote.quote_items.map((item) => (
                      <tr key={item.id} className="hover:bg-[#1a1a1a]/50 transition-colors">
                        <td className="px-5 py-3.5 text-white">
                          <div className="font-semibold">{item.description}</div>
                          <div className="mt-1 text-[10px] uppercase tracking-wider text-[#666]">{item.section.replaceAll('_', ' ')}</div>
                        </td>
                        <td className="px-5 py-3.5 text-[#cfcfcf] min-w-72">
                          <div className="font-medium">{itemModelLabel(item, quote)}</div>
                          <div className="mt-1 text-xs text-[#888] leading-relaxed">{itemSpecification(item)}</div>
                        </td>
                        <td className="px-5 py-3.5 text-center text-[#888]">{item.qty} {item.unit}</td>
                        <td className="px-5 py-3.5 text-right font-mono text-[#888]">{formatINR(item.rate_per_unit)}</td>
                        <td className="px-5 py-3.5 text-right font-mono text-[#888]">
                          {(Number(item.gst_pct || 0) * 100).toFixed(2)}%
                          <div className="text-[10px] text-[#666]">{formatINR(item.line_gst || 0)}</div>
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono font-medium text-white">
                          {formatINR(item.line_subtotal || item.line_total || item.qty * item.rate_per_unit)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-[#555]">
                        No detailed line items found for this quote version.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
