'use client';

import { useState } from 'react';
import { X, Check } from 'lucide-react';
import { Select } from '@/components/ui/Select';

export interface FieldSchema {
  name: string;
  label: string;
  type: 'text' | 'number' | 'select';
  options?: Array<{ value: string | number; label: string }>;
}

interface BulkEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCount: number;
  fields: FieldSchema[];
  onSave: (values: Record<string, any>) => void;
}

export function BulkEditModal({ isOpen, onClose, selectedCount, fields, onSave }: BulkEditModalProps) {
  const [formValues, setFormValues] = useState<Record<string, any>>({});

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Filter out undefined values (only save what the user actively edited!)
    const activeUpdates: Record<string, any> = {};
    for (const [key, value] of Object.entries(formValues)) {
      if (value !== undefined && value !== '') {
        activeUpdates[key] = value;
      }
    }
    onSave(activeUpdates);
    setFormValues({});
    onClose();
  };

  const handleFieldChange = (name: string, value: any) => {
    setFormValues((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal Box */}
      <div className="relative w-full max-w-md bg-surface border border-border rounded-xl shadow-2xl overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="p-5 border-b border-border flex items-center justify-between bg-surface-2">
          <div>
            <h3 className="text-sm font-bold text-text-primary">
              Bulk Edit {selectedCount} Selected Rows
            </h3>
            <p className="text-[11px] text-text-muted mt-0.5">
              Only fields with active values will be updated across all selection items.
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded bg-surface hover:bg-surface-hover text-text-muted hover:text-text-primary">
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="max-h-[300px] overflow-y-auto space-y-4 pr-1">
            {fields.map((field) => (
              <div key={field.name} className="space-y-1.5">
                <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                  {field.label}
                </label>
                {field.type === 'select' ? (
                  <Select
                    value={String(formValues[field.name] ?? '')}
                    onChange={(v) => {
                      const originalOption = field.options?.find(o => String(o.value) === v);
                      const parsedValue = originalOption && typeof originalOption.value === 'number' ? Number(v) : v;
                      handleFieldChange(field.name, parsedValue === '' ? undefined : parsedValue);
                    }}
                    options={[
                      { value: '', label: '-- Select / No Change --' },
                      ...(field.options || []).map(o => ({ value: String(o.value), label: o.label }))
                    ]}
                    className="w-full"
                  />
                ) : (
                  <input
                    type={field.type}
                    value={formValues[field.name] ?? ''}
                    onChange={(e) => {
                      const val = field.type === 'number' ? parseFloat(e.target.value) : e.target.value;
                      handleFieldChange(field.name, isNaN(val as number) ? undefined : val);
                    }}
                    placeholder="-- Leave empty for no change --"
                    className="w-full px-3 py-2.5 rounded-lg bg-surface border border-border text-sm text-text-primary outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all font-mono"
                  />
                )}
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border mt-5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-text-secondary bg-surface border border-border hover:bg-surface-hover rounded-lg transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={Object.keys(formValues).length === 0}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-background bg-accent hover:bg-accent-hover rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check size={14} />
              Apply Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
