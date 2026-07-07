'use client';

import { useState } from 'react';
import { X, History, Clock } from 'lucide-react';
import { useAuditLogsQuery, useChangesLogQuery } from '@/lib/hooks/useMasters';

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  entityTable: string;
  title: string;
}

type RevisionValues = Record<string, unknown> | null | undefined;

const HIDDEN_CHANGE_FIELDS = new Set([
  'id',
  'org_id',
  'created_at',
  'updated_at',
  'deleted_at',
  'source_global_id',
  'category_id',
  'scope_global_id',
]);

const FIELD_LABELS: Record<string, string> = {
  brand: 'Brand',
  model: 'Model',
  description: 'Description',
  sku_code: 'SKU',
  unit: 'Unit',
  rate: 'Rate',
  default_rate: 'Default Rate',
  standard_rate: 'Standard Rate',
  selling_price: 'Selling Price',
  selling_rate: 'Selling Rate',
  unit_rate_min: 'Minimum Rate',
  unit_rate_max: 'Maximum Rate',
  gst_pct: 'GST',
  gst_rate: 'GST',
  qty_formula: 'Quantity Formula',
  notes: 'Notes',
  specification_details: 'Specification Details',
  is_active: 'Active',
  is_custom: 'Custom',
  civil_required_only: 'Civil Only',
  is_survey_dependent: 'Survey Dependent',
};

const IMPORTANT_FIELDS = [
  'description',
  'brand',
  'model',
  'sku_code',
  'rate',
  'default_rate',
  'selling_price',
  'gst_pct',
  'gst_rate',
  'unit',
  'qty_formula',
  'notes',
  'specification_details',
  'is_active',
];

function toRecord(value: RevisionValues): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function stableValue(value: unknown) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function formatFieldLabel(key: string) {
  return FIELD_LABELS[key] || key.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
}

function formatValue(key: string, value: unknown) {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') {
    const isMoney = /rate|price|cost|amount|mrp/i.test(key);
    const isPercent = /gst|pct|percent|margin/i.test(key);
    if (isMoney) return `INR ${value.toLocaleString('en-IN')}`;
    if (isPercent) return `${value}%`;
    return value.toLocaleString('en-IN');
  }
  if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? '' : 's'}`;
  if (typeof value === 'object') return 'Updated';

  const text = String(value).trim();
  return text.length > 140 ? `${text.slice(0, 137)}...` : text;
}

function getDisplayKeys(record: Record<string, unknown>) {
  const available = Object.keys(record).filter(key => !HIDDEN_CHANGE_FIELDS.has(key));
  const important = IMPORTANT_FIELDS.filter(key => key in record && !HIDDEN_CHANGE_FIELDS.has(key));
  const remaining = available.filter(key => !important.includes(key));
  return [...important, ...remaining].slice(0, 8);
}

function getChangedFields(oldValues: RevisionValues, newValues: RevisionValues) {
  const oldRecord = toRecord(oldValues);
  const newRecord = toRecord(newValues);
  const keys = Array.from(new Set([...Object.keys(oldRecord), ...Object.keys(newRecord)]))
    .filter(key => !HIDDEN_CHANGE_FIELDS.has(key))
    .filter(key => stableValue(oldRecord[key]) !== stableValue(newRecord[key]));

  const importantKeys = IMPORTANT_FIELDS.filter(key => keys.includes(key));
  const remainingKeys = keys.filter(key => !importantKeys.includes(key));

  return [...importantKeys, ...remainingKeys].map(key => ({
    key,
    label: formatFieldLabel(key),
    before: formatValue(key, oldRecord[key]),
    after: formatValue(key, newRecord[key]),
  }));
}

function RevisionSummary({ revision }: { revision: any }) {
  const changeType = String(revision.change_type || '').toLowerCase();
  const oldRecord = toRecord(revision.old_values);
  const newRecord = toRecord(revision.new_values);
  const changedFields = getChangedFields(revision.old_values, revision.new_values);
  const createdOrDeletedRecord = changeType === 'deleted' ? oldRecord : newRecord;
  const displayKeys = getDisplayKeys(createdOrDeletedRecord);

  if (changeType === 'updated' && changedFields.length > 0) {
    return (
      <div className="rounded-lg border border-border/60 overflow-hidden">
        <div className="px-3 py-2 bg-background text-[10px] uppercase tracking-wider text-text-muted font-bold">
          {changedFields.length} field{changedFields.length === 1 ? '' : 's'} changed
        </div>
        <div className="divide-y divide-border/50">
          {changedFields.map(field => (
            <div key={field.key} className="grid grid-cols-[120px_1fr] gap-3 px-3 py-2">
              <div className="text-text-muted font-semibold">{field.label}</div>
              <div className="space-y-1 min-w-0">
                <div className="text-error/90 line-through break-words">{field.before}</div>
                <div className="text-success break-words">{field.after}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if ((changeType === 'created' || changeType === 'deleted') && displayKeys.length > 0) {
    return (
      <div className="rounded-lg border border-border/60 overflow-hidden">
        <div className="px-3 py-2 bg-background text-[10px] uppercase tracking-wider text-text-muted font-bold">
          {changeType === 'deleted' ? 'Removed record details' : 'New record details'}
        </div>
        <div className="divide-y divide-border/50">
          {displayKeys.map(key => (
            <div key={key} className="grid grid-cols-[120px_1fr] gap-3 px-3 py-2">
              <div className="text-text-muted font-semibold">{formatFieldLabel(key)}</div>
              <div className="text-text-primary break-words min-w-0">{formatValue(key, createdOrDeletedRecord[key])}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border/60 bg-background px-3 py-3 text-text-muted">
      Only internal metadata changed.
    </div>
  );
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

                  {(rev.old_values || rev.new_values) && (
                    <RevisionSummary revision={rev} />
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
