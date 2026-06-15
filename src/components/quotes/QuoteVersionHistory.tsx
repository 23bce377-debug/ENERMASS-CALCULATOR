'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { History, GitCommit, GitPullRequest, Search, FileText, CheckCircle, AlertTriangle, ArrowRight } from 'lucide-react';
import { formatINR } from '@/lib/engine/calculator';
import { QuoteCompareModal } from './QuoteCompareModal';

interface VersionHistoryProps {
  baseQuoteNumber: string;
  onCompare: (v1: any, v2: any) => void;
  onClose: () => void;
}

export function QuoteVersionHistory({ baseQuoteNumber, onCompare, onClose }: VersionHistoryProps) {
  const [versions, setVersions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [compareData, setCompareData] = useState<{v1: any, v2: any} | null>(null);

  useEffect(() => {
    async function loadVersions() {
      try {
        const baseQn = baseQuoteNumber.replace(/-v\d+$/, '');
        const { data, error } = await supabase
          .from('quotes')
          .select('id, quote_number, version, version_reason, status, created_at, final_customer_price, survey_id, quote_items(*)')
          .like('quote_number', `${baseQn}%`)
          .order('version', { ascending: true });

        if (error) throw error;
        setVersions(data || []);
      } catch (err) {
        console.error('Failed to load version history', err);
      } finally {
        setLoading(false);
      }
    }
    loadVersions();
  }, [baseQuoteNumber]);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-surface border border-border rounded-2xl shadow-xl overflow-hidden animate-fade-in flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between p-4 border-b border-border bg-surface-active">
          <h3 className="font-bold text-text-primary flex items-center gap-2">
            <History size={18} className="text-accent" /> Quote Version History
          </h3>
          <button onClick={onClose} className="p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-hover rounded-md transition-colors">
            ✕
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="py-12 text-center text-text-muted">Loading version history...</div>
          ) : (
            <div className="relative border-l border-border/50 ml-4 pl-6 space-y-8">
              {versions.map((v, i) => (
                <div key={v.id} className="relative">
                  <div className="absolute -left-[33px] top-1 w-5 h-5 rounded-full bg-surface border-2 border-accent flex items-center justify-center">
                    <GitCommit size={12} className="text-accent" />
                  </div>
                  
                  <div className="bg-background border border-border/60 rounded-xl p-4 shadow-sm hover:border-accent/40 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-text-primary text-sm flex items-center gap-1.5">
                            Version {v.version} 
                            <span className="text-text-muted font-normal text-xs">({v.quote_number})</span>
                            {v.version === 1 && !v.parent_quote_id && (
                              <span className="flex items-center gap-1 ml-1 px-1.5 py-0.5 bg-warning/10 text-warning border border-warning/20 rounded-md text-[10px] font-black uppercase tracking-wider">
                                🔒 Original
                              </span>
                            )}
                          </h4>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            v.status === 'won' ? 'bg-success/10 text-success border-success/20' :
                            v.status === 'sent' ? 'bg-info/10 text-info border-info/20' :
                            'bg-surface text-text-secondary border-border'
                          }`}>
                            {v.status.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-xs text-text-muted mt-1">
                          {new Date(v.created_at).toLocaleString('en-IN', {
                            dateStyle: 'medium',
                            timeStyle: 'short'
                          })}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-text-primary text-sm">
                          {formatINR(Number(v.final_customer_price))}
                        </span>
                      </div>
                    </div>

                    {v.version_reason && (
                      <div className="mt-3 p-2.5 bg-surface-hover rounded-lg border border-border/40 flex items-start gap-2">
                        <GitPullRequest size={14} className="text-text-muted mt-0.5" />
                        <p className="text-xs text-text-secondary italic">"{v.version_reason}"</p>
                      </div>
                    )}
                    
                    {v.survey_id && (
                      <div className="mt-2 flex items-center gap-1.5 text-[10px] font-bold text-success">
                        <CheckCircle size={12} /> Auto-revised using Site Survey Data
                      </div>
                    )}

                    {i > 0 && (
                      <div className="mt-4 pt-3 border-t border-border/40 flex justify-end">
                        <button
                          onClick={() => setCompareData({ v1: versions[i - 1], v2: v })}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold text-accent hover:bg-accent/10 transition-colors"
                        >
                          <Search size={14} /> Compare with v{versions[i - 1].version}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {compareData && (
        <QuoteCompareModal 
          v1={compareData.v1} 
          v2={compareData.v2} 
          onClose={() => setCompareData(null)} 
        />
      )}
    </div>
  );
}
