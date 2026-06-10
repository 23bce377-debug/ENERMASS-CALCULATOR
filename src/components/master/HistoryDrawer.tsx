'use client';

import { useState } from 'react';
import { X, History, Clock, FileText, ChevronRight } from 'lucide-react';
import { useAuditLogsQuery, useChangesLogQuery } from '@/lib/hooks/useMasters';

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  entityTable: string;
  title: string;
}

export function HistoryDrawer({ isOpen, onClose, entityTable, title }: HistoryDrawerProps) {
  const [activeTab, setActiveTab] = useState<'revisions' | 'audits'>('revisions');

  // Fetch changes & audits
  const { data: revisions, isLoading: revLoading } = useChangesLogQuery(entityTable);
  const { data: audits, isLoading: audLoading } = useAuditLogsQuery(entityTable);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose} />

      {/* Slide-out container */}
      <div className="relative w-full max-w-xl h-full bg-surface border-l border-border flex flex-col shadow-2xl animate-slide-in">
        {/* Header */}
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
              <History size={16} className="text-accent" />
              {title} History
            </h3>
            <p className="text-[11px] text-text-muted mt-0.5">Database revisions and user interaction audits</p>
          </div>
          <button onClick={onClose} className="p-1 rounded bg-surface-hover text-text-muted hover:text-text-primary">
            <X size={16} />
          </button>
        </div>

        {/* Tab Menu */}
        <div className="flex border-b border-border bg-surface-2">
          <button
            onClick={() => setActiveTab('revisions')}
            className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wider transition-colors border-b-2
              ${activeTab === 'revisions'
                ? 'text-accent border-accent bg-accent-glow'
                : 'text-text-muted border-transparent hover:text-text-primary'
              }`}
          >
            <History size={13} className="inline mr-1.5" />
            Revision Log
          </button>
          <button
            onClick={() => setActiveTab('audits')}
            className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wider transition-colors border-b-2
              ${activeTab === 'audits'
                ? 'text-accent border-accent bg-accent-glow'
                : 'text-text-muted border-transparent hover:text-text-primary'
              }`}
          >
            <Clock size={13} className="inline mr-1.5" />
            Platform Audit
          </button>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {activeTab === 'revisions' ? (
            revLoading ? (
              <div className="text-xs text-text-muted text-center py-12">Loading revisions...</div>
            ) : revisions && revisions.length > 0 ? (
              revisions.map((rev: any) => (
                <div key={rev.id} className="p-4 rounded-xl bg-surface-2 border border-border/40 text-xs space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-bold text-text-primary capitalize text-xs">
                        Change: {rev.change_type}
                      </span>
                      <span className="text-[10px] text-text-muted block mt-0.5">
                        ID: {rev.entity_id.split('-')[0]}...
                      </span>
                    </div>
                    <span className="text-[10px] text-text-muted text-right">
                      {new Date(rev.logged_at).toLocaleDateString()}
                      <span className="block text-[9px]">{new Date(rev.logged_at).toLocaleTimeString()}</span>
                    </span>
                  </div>

                  {/* Diff Inspector */}
                  {(rev.old_values || rev.new_values) && (
                    <div className="p-2.5 rounded-lg bg-background border border-border/60 font-mono text-[10px] space-y-1.5 overflow-x-auto">
                      {rev.old_values && (
                        <div className="text-error flex items-start gap-1">
                          <span className="font-bold shrink-0">- BEFORE:</span>
                          <span className="whitespace-pre-wrap">{JSON.stringify(rev.old_values, null, 2)}</span>
                        </div>
                      )}
                      {rev.new_values && (
                        <div className="text-success flex items-start gap-1">
                          <span className="font-bold shrink-0">+ AFTER:</span>
                          <span className="whitespace-pre-wrap">{JSON.stringify(rev.new_values, null, 2)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <p className="text-xs text-text-muted text-center py-12 italic">No revisions recorded for this master.</p>
            )
          ) : (
            audLoading ? (
              <div className="text-xs text-text-muted text-center py-12">Loading audits...</div>
            ) : audits && audits.length > 0 ? (
              audits.map((aud: any) => (
                <div key={aud.id} className="p-4 rounded-xl bg-surface-2 border border-border/40 text-xs space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-bold text-text-primary capitalize text-xs">
                        {aud.action.replace('_', ' ')}
                      </span>
                      <span className="text-[10px] text-text-muted block mt-0.5">
                        Actor: {aud.actor?.full_name || 'Admin'}
                      </span>
                    </div>
                    <span className="text-[10px] text-text-muted text-right">
                      {new Date(aud.created_at).toLocaleDateString()}
                      <span className="block text-[9px]">{new Date(aud.created_at).toLocaleTimeString()}</span>
                    </span>
                  </div>

                  {/* Details */}
                  <div className="text-[10px] text-text-secondary border-t border-border/40 pt-2 flex flex-col gap-1">
                    <div><span className="font-semibold text-text-muted uppercase tracking-wider text-[8px] mr-1">Module:</span> {aud.module}</div>
                    {aud.ip_address && <div><span className="font-semibold text-text-muted uppercase tracking-wider text-[8px] mr-1">IP:</span> {aud.ip_address}</div>}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-text-muted text-center py-12 italic">No platform audit logs for this master.</p>
            )
          )}
        </div>
      </div>
    </div>
  );
}
