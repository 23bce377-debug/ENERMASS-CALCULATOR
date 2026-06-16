'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { QuoteORM, type QuoteRow, type QuoteItemRow, type QuoteVariantRow } from '@/backend/orm/quote';
import { 
  FileText, IndianRupee, Sun, Settings, Box, Calendar, 
  MapPin, Clock, ArrowRight, Download, Copy, Play, CheckCircle2
} from 'lucide-react';
import Link from 'next/link';
import { formatINR } from '@/lib/engine/calculator';

type FullQuote = QuoteRow & {
  quote_items: QuoteItemRow[];
  quote_variants: QuoteVariantRow[];
};

export default function QuoteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [quote, setQuote] = useState<FullQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeVersion, setActiveVersion] = useState<number | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const data = await QuoteORM.getById(id);
        if (!data) throw new Error('Quote not found');
        setQuote(data);
        setActiveVersion(data.version || 1);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id]);

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
                Quote #{quote.id.substring(0, 8).toUpperCase()}
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
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2">
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2a2a2a] text-white hover:bg-[#333] transition-colors text-sm font-medium border border-[#444]">
            <Copy size={16} /> Duplicate
          </button>
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2a2a2a] text-white hover:bg-[#333] transition-colors text-sm font-medium border border-[#444]">
            <Download size={16} /> PDF
          </button>
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#f0a500] text-black hover:bg-[#f0a500]/90 transition-colors text-sm font-bold shadow-[0_0_15px_rgba(240,165,0,0.3)]">
            <Play size={16} /> Convert to Project
          </button>
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
              {Array.from({ length: quote.version || 1 }).map((_, i) => {
                const v = i + 1;
                const isActive = v === activeVersion;
                return (
                  <button 
                    key={v}
                    onClick={() => setActiveVersion(v)}
                    className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${
                      isActive 
                        ? 'bg-[#f0a500]/10 border-[#f0a500]/30 text-white' 
                        : 'bg-[#111] border-[#222] text-[#888] hover:border-[#444] hover:text-white'
                    }`}
                  >
                    <span className="font-medium">Version {v}</span>
                    {isActive && <CheckCircle2 size={16} className="text-[#f0a500]" />}
                  </button>
                );
              })}
              <button className="w-full mt-2 py-2 text-xs font-semibold text-[#f0a500] border border-dashed border-[#f0a500]/30 rounded-lg hover:bg-[#f0a500]/10 transition-colors">
                + Create New Version
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
              <p className="text-xl font-bold text-green-400">{formatINR(quote.discount_val || 0)}</p>
            </div>
            <div className="bg-[#f0a500]/10 p-4 rounded-xl border border-[#f0a500]/30 shadow-lg relative overflow-hidden">
              <div className="absolute right-0 top-0 bottom-0 w-1 bg-[#f0a500]"></div>
              <p className="text-xs text-[#f0a500] uppercase tracking-wider mb-1 font-semibold flex items-center gap-1.5"><IndianRupee size={14}/> Net Price</p>
              <p className="text-xl font-bold text-[#f0a500]">{formatINR(quote.total_incl_gst || 0)}</p>
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
                    <th className="px-5 py-3 font-medium border-b border-[#2a2a2a] text-center">Quantity</th>
                    <th className="px-5 py-3 font-medium border-b border-[#2a2a2a] text-right">Unit Rate</th>
                    <th className="px-5 py-3 font-medium border-b border-[#2a2a2a] text-right">Total (excl. GST)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2a2a2a]">
                  {quote.quote_items && quote.quote_items.length > 0 ? (
                    quote.quote_items.map((item) => (
                      <tr key={item.id} className="hover:bg-[#1a1a1a]/50 transition-colors">
                        <td className="px-5 py-3.5 text-white">{item.description}</td>
                        <td className="px-5 py-3.5 text-center text-[#888]">{item.qty} {item.unit}</td>
                        <td className="px-5 py-3.5 text-right font-mono text-[#888]">{formatINR(item.rate_per_unit)}</td>
                        <td className="px-5 py-3.5 text-right font-mono font-medium text-white">
                          {formatINR(item.qty * item.rate_per_unit)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-5 py-8 text-center text-[#555]">
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
