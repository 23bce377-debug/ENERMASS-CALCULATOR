'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

interface StateRule {
  id: string;
  state_code: string;
  state_name: string;
  discom_name: string | null;
}

interface TermsTemplate {
  id: string;
  state_id: string | null;
  clauses: string[];
  version: number;
  updated_at: string | null;
}

interface TermsPayload {
  states: StateRule[];
  templates: TermsTemplate[];
}

const EMPTY_CLAUSE = 'Add quotation term here.';

async function fetchTerms(): Promise<TermsPayload> {
  const res = await fetch('/api/erp/master/terms', {
    cache: 'no-store',
    credentials: 'include',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to load terms templates');
  return data;
}

async function saveTerms(payload: { stateId: string | null; clauses: string[] }): Promise<TermsPayload> {
  const res = await fetch('/api/erp/master/terms', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to save terms template');
  return data;
}

export default function TermsMasterPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedStateId, setSelectedStateId] = useState<string | null>(null);
  const [draft, setDraft] = useState<string[] | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['masters', 'terms'],
    queryFn: fetchTerms,
  });

  const templatesByState = useMemo(() => {
    const map = new Map<string | null, TermsTemplate>();
    for (const template of data?.templates ?? []) {
      map.set(template.state_id, template);
    }
    return map;
  }, [data?.templates]);

  const globalTemplate = templatesByState.get(null);
  const selectedState = data?.states.find((state) => state.id === selectedStateId) ?? null;
  const selectedTemplate = templatesByState.get(selectedStateId);
  const sourceTemplate = selectedTemplate ?? globalTemplate;
  const effectiveClauses = draft ?? sourceTemplate?.clauses ?? [EMPTY_CLAUSE];
  const isInherited = selectedStateId !== null && !selectedTemplate;

  const saveMutation = useMutation({
    mutationFn: saveTerms,
    onSuccess: (nextData) => {
      queryClient.setQueryData(['masters', 'terms'], nextData);
      queryClient.invalidateQueries({ queryKey: ['masters', 'dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['masters', 'terms'] });
      queryClient.invalidateQueries({ queryKey: ['erp-master-rules'] });
      setDraft(null);
      toast('Terms and conditions template saved', 'success');
    },
    onError: (err: any) => {
      toast(err.message || 'Failed to save terms template', 'error');
    },
  });

  const updateClause = (index: number, value: string) => {
    const next = [...effectiveClauses];
    next[index] = value;
    setDraft(next);
  };

  const addClause = () => {
    setDraft([...effectiveClauses, EMPTY_CLAUSE]);
  };

  const removeClause = (index: number) => {
    const next = effectiveClauses.filter((_, clauseIndex) => clauseIndex !== index);
    setDraft(next.length > 0 ? next : [EMPTY_CLAUSE]);
  };

  const resetToMaster = () => {
    setDraft(sourceTemplate?.clauses ?? [EMPTY_CLAUSE]);
  };

  const stateRows = data?.states ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-surface p-4 rounded-xl border border-border">
        <div>
          <h2 className="text-sm font-bold text-text-primary flex items-center gap-2">
            <FileText size={16} className="text-accent" />
            Terms & Conditions Master
          </h2>
          <p className="text-[11px] text-text-muted mt-0.5">
            Maintain the default quotation clauses and state-specific print terms used by the PDF generator.
          </p>
        </div>
        <button
          type="button"
          onClick={() => saveMutation.mutate({
            stateId: selectedStateId,
            clauses: effectiveClauses.map((clause) => clause.trim()).filter(Boolean),
          })}
          disabled={saveMutation.isPending}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent text-background text-xs font-semibold hover:bg-accent-hover transition-all disabled:opacity-50"
        >
          <Save size={14} />
          {saveMutation.isPending ? 'Saving...' : 'Save Template'}
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-error/30 bg-error/8 p-4 text-sm text-error">
          {error instanceof Error ? error.message : 'Failed to load terms master.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
          <aside className="bg-surface border border-border rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => {
                setSelectedStateId(null);
                setDraft(null);
              }}
              className={`w-full text-left px-4 py-3 border-b border-border transition-colors ${
                selectedStateId === null ? 'bg-accent-glow text-accent' : 'hover:bg-surface-hover text-text-primary'
              }`}
            >
              <span className="block text-xs font-bold">Global Default</span>
              <span className="text-[10px] text-text-muted">Fallback for states without their own terms</span>
            </button>

            <div className="max-h-[62vh] overflow-y-auto">
              {isLoading ? (
                <div className="p-4 text-xs text-text-muted">Loading states...</div>
              ) : stateRows.length === 0 ? (
                <div className="p-4 text-xs text-text-muted">
                  No active states found. Add state rules before creating state-specific terms.
                </div>
              ) : (
                stateRows.map((state) => {
                  const hasTemplate = templatesByState.has(state.id);
                  return (
                    <button
                      key={state.id}
                      type="button"
                      onClick={() => {
                        setSelectedStateId(state.id);
                        setDraft(null);
                      }}
                      className={`w-full text-left px-4 py-3 border-b border-border/60 transition-colors ${
                        selectedStateId === state.id ? 'bg-accent-glow text-accent' : 'hover:bg-surface-hover text-text-primary'
                      }`}
                    >
                      <span className="flex items-center justify-between gap-3">
                        <span className="text-xs font-bold">{state.state_name}</span>
                        <span className="text-[10px] font-mono text-text-muted">{state.state_code}</span>
                      </span>
                      <span className="mt-1 block text-[10px] text-text-muted">
                        {hasTemplate ? 'State-specific template' : 'Using global default'}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          <section className="bg-surface border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border bg-surface-2 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-text-primary">
                  {selectedState ? `${selectedState.state_name} Terms` : 'Global Default Terms'}
                </h3>
                <p className="text-[11px] text-text-muted mt-1">
                  {selectedState?.discom_name || (selectedState ? 'State-specific quotation terms' : 'Base quotation terms used as fallback')}
                </p>
                {isInherited && (
                  <p className="text-[11px] text-warning mt-2">
                    This state is currently inheriting the global default. Saving will create its own template.
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={resetToMaster}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-xs text-text-secondary hover:text-text-primary hover:bg-surface-hover"
                >
                  <RotateCcw size={13} />
                  Reset
                </button>
                <button
                  type="button"
                  onClick={addClause}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-accent/25 text-xs text-accent hover:bg-accent/10"
                >
                  <Plus size={13} />
                  Add Clause
                </button>
              </div>
            </div>

            <div className="p-5 space-y-3 max-h-[68vh] overflow-y-auto">
              {isLoading ? (
                <div className="rounded-xl border border-dashed border-border p-10 text-center text-xs text-text-muted">
                  Loading terms editor...
                </div>
              ) : effectiveClauses.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-10 text-center">
                  <p className="text-sm font-semibold text-text-primary">No clauses yet</p>
                  <p className="text-xs text-text-muted mt-1">Add a clause to create the quotation terms template.</p>
                </div>
              ) : (
                effectiveClauses.map((clause, index) => (
                  <div key={index} className="grid grid-cols-[36px_1fr_auto] gap-3 items-start">
                    <span className="mt-2 text-right text-xs font-mono text-text-muted">{index + 1}.</span>
                    <textarea
                      value={clause}
                      onChange={(event) => updateClause(index, event.target.value)}
                      className="w-full min-h-20 px-3 py-2 rounded-lg bg-background border border-border text-sm text-text-primary outline-none focus:border-accent resize-y"
                    />
                    <button
                      type="button"
                      onClick={() => removeClause(index)}
                      className="mt-1 p-2 rounded-lg border border-border text-text-muted hover:text-error hover:border-error/30"
                      aria-label={`Remove clause ${index + 1}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
