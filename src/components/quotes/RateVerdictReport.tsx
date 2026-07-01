'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  X,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  BadgeIndianRupee,
  Percent,
  Link2Off,
} from 'lucide-react';
import { formatINR } from '@/lib/engine/calculator';
import { createPortal } from 'react-dom';

// Types

type RowItem = {
  id: string;
  sortOrder: number;
  description: string;
  section: string;
  sourceTable: string | null;
  sourceLabel: string | null;
  matchedBy: 'source' | 'description' | null;
  qty: number;
  unit: string;
  isIncluded: boolean;
  quotedRate: number;
  quotedGstPct: number;
  quotedSubtotal: number;
  quotedTotal: number;
  currentRate: number | null;
  currentGstPct: number | null;
  currentSubtotal: number | null;
  currentTotal: number | null;
  deltaRate: number | null;
  deltaGstPct: number | null;
  deltaTotal: number | null;
  status: 'same' | 'changed' | 'unlinked' | 'missing';
};

type TopMover = {
  description: string;
  sourceLabel: string | null;
  deltaTotal: number;
  direction: 'up' | 'down';
};

type SectionBreakdown = {
  section: string;
  sectionLabel: string;
  quotedTotal: number;
  currentTotal: number;
  deltaTotal: number;
};

type RateComparisonData = {
  quoteId: string;
  quoteDate: string;
  customerPrice: number;
  verdict: 'profit' | 'loss' | 'neutral';
  summary: {
    linkedCount: number;
    unlinkedCount: number;
    changedCount: number;
    quotedTotal: number;
    currentTotal: number;
    deltaTotal: number;
    deltaPct: number;
  };
  topMovers: TopMover[];
  sectionBreakdown: SectionBreakdown[];
  rows: RowItem[];
};

// Component

export function RateVerdictReport({
  quoteId,
  quoteNumber,
  onClose,
}: {
  quoteId: string;
  quoteNumber: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<RateComparisonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showItems, setShowItems] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/quotes/${encodeURIComponent(quoteId)}/rate-comparison`, { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error || 'Failed to load rate comparison');
        }
        return res.json();
      })
      .then((body) => {
        if (!cancelled) setData(body);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [quoteId]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const verdictConfig = {
    profit: {
      label: 'PROFIT',
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/12',
      border: 'border-emerald-500/30',
      badge: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
      desc: 'Material costs have dropped since this quote was generated. You save money on procurement.',
    },
    loss: {
      label: 'LOSS',
      color: 'text-red-400',
      bg: 'bg-red-500/12',
      border: 'border-red-500/30',
      badge: 'bg-red-500/20 text-red-400 border-red-500/40',
      desc: 'Material costs have increased since this quote was generated. Procurement will cost more.',
    },
    neutral: {
      label: 'NO CHANGE',
      color: 'text-text-muted',
      bg: 'bg-white/5',
      border: 'border-white/10',
      badge: 'bg-white/10 text-text-muted border-white/20',
      desc: 'Material costs are essentially the same as when this quote was generated.',
    },
  };

  const quoteDate = data ? new Date(data.quoteDate).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  }) : '';
  const today = new Date().toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

  const modal = (
    <div className="fixed inset-0 z-[110] flex items-start justify-center bg-black/75 backdrop-blur-sm overflow-y-auto p-3 md:p-6">
      <div className="w-full max-w-6xl bg-surface border border-border rounded-2xl shadow-2xl animate-fade-in my-2 md:my-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 p-5 border-b border-border">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-lg bg-accent/10 border border-accent/20 text-accent flex items-center justify-center shrink-0">
              <BarChart3 size={18} />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-text-primary">Rate Analysis</h2>
              <p className="text-xs text-text-muted mt-0.5 truncate">{quoteNumber} - GST-aware quote cost vs current catalog cost</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close rate analysis"
            className="p-2 rounded-lg hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5 max-h-[calc(100vh-200px)] overflow-y-auto">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-text-muted">Comparing rates...</p>
            </div>
          )}

          {error && (
            <div className="bg-error/10 border border-error/30 text-error rounded-lg p-4 text-sm">
              {error}
            </div>
          )}

          {data && (() => {
            const v = verdictConfig[data.verdict];
            const { summary } = data;

            return (
              <>
                {/* 1. Verdict Hero */}
                <div className={`rounded-xl border ${v.border} ${v.bg} p-5 md:p-6`}>
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-3 mb-3">
                        <VerdictIcon verdict={data.verdict} />
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-black tracking-widest border ${v.badge}`}>
                          {v.label}
                        </span>
                      </div>
                      <div className={`text-3xl md:text-4xl font-black tabular-nums ${v.color}`}>
                        {summary.deltaTotal < 0 ? '-' : summary.deltaTotal > 0 ? '+' : ''}{formatINR(Math.abs(summary.deltaTotal))}
                      </div>
                      <p className="text-xs text-text-muted/80 mt-3 max-w-xl">{v.desc}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 min-w-[220px]">
                      <TinyFact label="Quote Date" value={quoteDate} />
                      <TinyFact label="Current Rates" value={today} />
                      <TinyFact label="Movement" value={`${Math.abs(summary.deltaPct).toFixed(1)}%`} />
                      <TinyFact label="Tracked" value={`${summary.linkedCount}/${summary.linkedCount + summary.unlinkedCount}`} />
                    </div>
                  </div>
                </div>

                {/* 2. Summary Stats */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <MiniStat icon={<BadgeIndianRupee size={15} />} label="Quoted Input Cost" value={formatINR(summary.quotedTotal)} sub="locked with quote" />
                  <MiniStat icon={<BadgeIndianRupee size={15} />} label="Current Input Cost" value={formatINR(summary.currentTotal)} sub="latest catalog" />
                  <MiniStat
                    icon={<Percent size={15} />}
                    label="GST-aware Delta"
                    value={`${summary.deltaTotal < 0 ? '-' : summary.deltaTotal > 0 ? '+' : ''}${formatINR(Math.abs(summary.deltaTotal))}`}
                    sub={`${summary.changedCount} changed`}
                    tone={summary.deltaTotal > 0.5 ? 'bad' : summary.deltaTotal < -0.5 ? 'good' : 'neutral'}
                  />
                  <MiniStat
                    icon={<Link2Off size={15} />}
                    label="Unlinked Items"
                    value={`${summary.unlinkedCount}`}
                    sub={summary.unlinkedCount ? 'needs source tracking' : 'all tracked'}
                  />
                </div>

                {summary.unlinkedCount > 0 && (
                  <div className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-xs text-text-secondary">
                    {summary.unlinkedCount} included item{summary.unlinkedCount === 1 ? '' : 's'} could not be matched to a live catalog rate. New quotes saved after source tracking will compare more completely.
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.72fr)] gap-5">
                  {/* 3. Section Breakdown */}
                  {data.sectionBreakdown.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-2.5">
                        Category Impact
                      </h3>
                      <div className="space-y-2">
                        {data.sectionBreakdown.map((s) => (
                          <SectionImpact key={s.section} section={s} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 4. Top Movers */}
                  {data.topMovers.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-2.5">
                        Biggest Price Movers
                      </h3>
                      <div className="space-y-1.5">
                        {data.topMovers.map((m, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg bg-surface-hover/60 border border-border/50"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className={`shrink-0 ${m.direction === 'up' ? 'text-red-400' : 'text-emerald-400'}`}>
                                {m.direction === 'up' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                              </span>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-text-primary truncate">{m.description}</p>
                                {m.sourceLabel && (
                                  <p className="text-[10px] text-text-muted truncate">{m.sourceLabel}</p>
                                )}
                              </div>
                            </div>
                            <span className={`text-sm font-bold tabular-nums shrink-0 ${m.direction === 'up' ? 'text-red-400' : 'text-emerald-400'}`}>
                              {m.direction === 'up' ? '+' : '-'}{formatINR(Math.abs(m.deltaTotal))}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 5. Item-wise Detail (collapsible) */}
                <div className="border border-border/60 rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowItems(!showItems)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-surface-hover/60 transition-colors"
                  >
                    <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                      Item-wise Breakdown ({data.rows.length} items)
                    </span>
                    {showItems ? <ChevronDown size={14} className="text-text-muted" /> : <ChevronRight size={14} className="text-text-muted" />}
                  </button>
                  {showItems && (
                    <div className="border-t border-border/60 overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-background/60 text-text-muted">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium">Item</th>
                            <th className="px-3 py-2 text-right font-medium">Qty</th>
                            <th className="px-3 py-2 text-right font-medium">Quoted Rate</th>
                            <th className="px-3 py-2 text-right font-medium">Current Rate</th>
                            <th className="px-3 py-2 text-right font-medium">GST</th>
                            <th className="px-3 py-2 text-right font-medium">Delta Rate</th>
                            <th className="px-3 py-2 text-right font-medium">Delta Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40">
                          {data.rows
                            .slice()
                            .sort((a, b) => Math.abs(b.deltaTotal ?? 0) - Math.abs(a.deltaTotal ?? 0))
                            .map((row) => {
                              const isUp = (row.deltaTotal ?? 0) > 0.5;
                              const isDown = (row.deltaTotal ?? 0) < -0.5;
                              const isUnlinked = row.status === 'unlinked' || row.status === 'missing';
                              return (
                                <tr
                                  key={row.id}
                                  className={isUnlinked ? 'opacity-55' : ''}
                                >
                                  <td className="px-3 py-2 text-text-primary min-w-[220px]">
                                    <div className="font-medium">{row.description}</div>
                                    <div className="text-[10px] text-text-muted">
                                      {row.sourceLabel
                                        ? `${row.sourceLabel}${row.matchedBy === 'description' ? ' - matched by description' : ''}`
                                        : row.status === 'missing'
                                          ? 'Catalog source missing'
                                          : 'No catalog source'}
                                    </div>
                                  </td>
                                  <td className="px-3 py-2 text-right font-mono text-text-secondary whitespace-nowrap">
                                    {row.qty} {row.unit}
                                  </td>
                                  <td className="px-3 py-2 text-right font-mono text-text-secondary whitespace-nowrap">
                                    {formatINR(row.quotedRate)}
                                  </td>
                                  <td className="px-3 py-2 text-right font-mono text-text-secondary whitespace-nowrap">
                                    {row.currentRate === null ? '-' : formatINR(row.currentRate)}
                                  </td>
                                  <td className="px-3 py-2 text-right font-mono text-text-secondary whitespace-nowrap">
                                    {formatPercent(row.quotedGstPct)} to {row.currentGstPct === null ? '-' : formatPercent(row.currentGstPct)}
                                  </td>
                                  <td className={`px-3 py-2 text-right font-mono font-semibold whitespace-nowrap ${
                                    (row.deltaRate ?? 0) > 0 ? 'text-red-400' : (row.deltaRate ?? 0) < 0 ? 'text-emerald-400' : 'text-text-muted'
                                  }`}>
                                    {row.deltaRate === null ? '-' : signedMoney(row.deltaRate)}
                                  </td>
                                  <td className={`px-3 py-2 text-right font-mono font-semibold whitespace-nowrap ${
                                    isUp ? 'text-red-400' : isDown ? 'text-emerald-400' : 'text-text-muted'
                                  }`}>
                                    {row.deltaTotal === null ? '-' : signedMoney(row.deltaTotal)}
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

// Helper

function VerdictIcon({ verdict }: { verdict: 'profit' | 'loss' | 'neutral' }) {
  const className = verdict === 'profit' ? 'text-emerald-400' : verdict === 'loss' ? 'text-red-400' : 'text-text-muted';
  if (verdict === 'profit') return <TrendingUp size={24} className={className} />;
  if (verdict === 'loss') return <TrendingDown size={24} className={className} />;
  return <Minus size={24} className={className} />;
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(value * 100 % 1 === 0 ? 0 : 1)}%`;
}

function signedMoney(value: number) {
  if (Math.abs(value) < 0.005) return formatINR(0);
  return `${value > 0 ? '+' : '-'}${formatINR(Math.abs(value))}`;
}

function TinyFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-background/50 border border-border/40 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-text-muted">{label}</p>
      <p className="text-xs font-semibold text-text-primary mt-0.5 tabular-nums">{value}</p>
    </div>
  );
}

function MiniStat({
  icon,
  label,
  value,
  sub,
  tone = 'neutral',
}: {
  icon: ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone?: 'good' | 'bad' | 'neutral';
}) {
  const toneClass = tone === 'good' ? 'text-emerald-400' : tone === 'bad' ? 'text-red-400' : 'text-text-primary';
  return (
    <div className="rounded-lg bg-background/60 border border-border/40 px-3 py-2.5">
      <div className="flex items-center gap-2 text-text-muted">
        {icon}
        <p className="text-[10px] font-medium uppercase tracking-wider">{label}</p>
      </div>
      <p className={`text-sm font-bold mt-1 tabular-nums ${toneClass}`}>{value}</p>
      {sub && <p className="text-[10px] text-text-muted mt-0.5">{sub}</p>}
    </div>
  );
}

function SectionImpact({ section }: { section: SectionBreakdown }) {
  const isUp = section.deltaTotal > 0.5;
  const isDown = section.deltaTotal < -0.5;
  const denominator = Math.max(Math.abs(section.quotedTotal), Math.abs(section.currentTotal), 1);
  const width = Math.min(100, Math.max(4, (Math.abs(section.deltaTotal) / denominator) * 100));

  return (
    <div className="rounded-lg bg-background/60 border border-border/40 px-3.5 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-text-primary truncate">{section.sectionLabel}</p>
          <p className="text-[10px] text-text-muted mt-0.5">
            {formatINR(section.quotedTotal)} to {formatINR(section.currentTotal)}
          </p>
        </div>
        <span className={`text-sm font-bold tabular-nums shrink-0 ${isUp ? 'text-red-400' : isDown ? 'text-emerald-400' : 'text-text-muted'}`}>
          {signedMoney(section.deltaTotal)}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-surface-hover mt-3 overflow-hidden">
        <div
          className={`h-full rounded-full ${isUp ? 'bg-red-400' : isDown ? 'bg-emerald-400' : 'bg-text-muted/40'}`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}
