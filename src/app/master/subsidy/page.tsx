'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Select } from '@/components/ui/Select';
import {
  useSubsidySchemesQuery,
  useUpdateSubsidyMutation,
  useCreateSubsidyMutation,
} from '@/lib/hooks/useMasters';
import {
  Plus,
  Edit2,
  Trash2,
  X,
  Check,
  History,
  FileText,
  Sliders,
  DollarSign
} from 'lucide-react';
import { useConfirm } from '@/components/ui/Confirm';
import { useToast } from '@/components/ui/Toast';
import { HistoryDrawer } from '@/components/master/HistoryDrawer';
import { formatINR } from '@/lib/engine/calculator';

interface SchemeSlab {
  id?: string;
  slab_index: number;
  start_kw: number;
  end_kw: number | null;
  rate_per_kw: number;
  is_fixed_amount: boolean;
  fixed_amount: number | null;
}

interface Scheme {
  id: string;
  code: string;
  name: string;
  description: string | null;
  applies_to: 'residential' | 'commercial';
  max_capacity_kw: number;
  max_absolute_subsidy: number;
  is_active: boolean;
  scheme_slabs: SchemeSlab[];
}

export default function SubsidyMasterPage() {
  const { data: schemes, isLoading } = useSubsidySchemesQuery();
  const updateMutation = useUpdateSubsidyMutation();
  const createMutation = useCreateSubsidyMutation();

  const confirm = useConfirm();
  const { toast } = useToast();

  const [selectedSchemeId, setSelectedSchemeId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);

  // Scheme Form State
  const [schemeDraft, setSchemeDraft] = useState({
    code: '',
    name: '',
    description: '',
    applies_to: 'residential' as 'residential' | 'commercial',
    max_capacity_kw: 10,
    max_absolute_subsidy: 78000,
  });

  // Slabs editor state
  const [slabs, setSlabs] = useState<SchemeSlab[]>([]);

  const selectedScheme = schemes?.find((s: any) => s.id === selectedSchemeId) as Scheme | undefined;

  // ─── Slabs Editor Actions ──────────────────────────────────────────────────

  const handleOpenEdit = (scheme: Scheme) => {
    setSelectedSchemeId(scheme.id);
    setSchemeDraft({
      code: scheme.code,
      name: scheme.name,
      description: scheme.description || '',
      applies_to: scheme.applies_to,
      max_capacity_kw: scheme.max_capacity_kw,
      max_absolute_subsidy: scheme.max_absolute_subsidy,
    });
    // Sort slabs by index
    const sortedSlabs = [...(scheme.scheme_slabs || [])].sort((a, b) => a.slab_index - b.slab_index);
    setSlabs(sortedSlabs);
    setEditorOpen(true);
  };

  const handleOpenAdd = () => {
    setSelectedSchemeId(null);
    setSchemeDraft({
      code: '',
      name: '',
      description: '',
      applies_to: 'residential',
      max_capacity_kw: 10,
      max_absolute_subsidy: 78000,
    });
    setSlabs([]);
    setEditorOpen(true);
  };

  const handleAddSlab = () => {
    const lastSlab = slabs[slabs.length - 1];
    const newStart = lastSlab ? (lastSlab.end_kw ?? lastSlab.start_kw + 1) : 0;
    
    setSlabs([
      ...slabs,
      {
        slab_index: slabs.length + 1,
        start_kw: newStart,
        end_kw: null,
        rate_per_kw: 18000,
        is_fixed_amount: false,
        fixed_amount: null,
      },
    ]);
  };

  const handleRemoveSlab = (idx: number) => {
    setSlabs(slabs.filter((_, i) => i !== idx).map((s, i) => ({ ...s, slab_index: i + 1 })));
  };

  const handleSlabChange = (idx: number, field: keyof SchemeSlab, value: any) => {
    setSlabs(
      slabs.map((s, i) => {
        if (i !== idx) return s;
        return {
          ...s,
          [field]: value,
        };
      })
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSchemeId) return;

    // Slabs validation
    for (let i = 0; i < slabs.length; i++) {
      const slab = slabs[i];
      if (slab.end_kw !== null && slab.end_kw <= slab.start_kw) {
        toast(`Slab ${i + 1}: Max kW must be greater than Min kW`, 'error');
        return;
      }
    }

    try {
      if (selectedSchemeId) {
        await updateMutation.mutateAsync({
          schemeId: selectedSchemeId,
          updates: schemeDraft,
          slabs,
        });
      } else {
        await createMutation.mutateAsync({
          updates: schemeDraft,
          slabs,
        });
      }
      setEditorOpen(false);
      toast('Subsidy scheme and capacity slabs saved ✓', 'success');
    } catch (err: any) {
      toast(err.message || 'Failed to save subsidy scheme', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex items-center justify-between bg-surface p-4 rounded-xl border border-border">
        <div>
          <h2 className="text-sm font-bold text-text-primary">Subsidy Formulas & Schemes</h2>
          <p className="text-[11px] text-text-muted mt-0.5">PM Surya Ghar piecewise slab editor for solar residential incentives.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-4.5 py-2 rounded-lg bg-accent text-background text-xs font-semibold hover:bg-accent-hover transition-all cursor-pointer"
          >
            <Plus size={14} /> Create Scheme
          </button>
          <button
            onClick={() => setHistoryOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface border border-border text-xs text-text-secondary hover:text-text-primary transition-all cursor-pointer"
          >
            <History size={14} /> View History Logs
          </button>
        </div>
      </div>

      {/* Schemes Grid */}
      {isLoading ? (
        <div className="text-center text-xs text-text-muted py-12">Loading schemes catalog...</div>
      ) : !schemes || schemes.length === 0 ? (
        <div className="text-center text-xs text-text-muted py-16 italic border border-dashed border-border rounded-xl">No active schemes defined.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {schemes.map((scheme: Scheme) => (
            <div key={scheme.id} className="card bg-surface p-5 border border-border flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-accent font-mono block">
                      Code: {scheme.code}
                    </span>
                    <h3 className="text-sm font-bold text-text-primary mt-1">{scheme.name}</h3>
                  </div>
                  <span className={`badge-base capitalize ${
                    scheme.applies_to === 'commercial' ? 'badge-commercial' : 'badge-on-grid'
                  }`}>{scheme.applies_to}</span>
                </div>
                <p className="text-xs text-text-muted mt-2">{scheme.description || 'No description provided.'}</p>
                
                {/* Slabs summary list */}
                <div className="mt-4 pt-3 border-t border-border space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">Subsidy Slabs Structure</span>
                  <div className="space-y-1.5">
                    {scheme.scheme_slabs && scheme.scheme_slabs.length > 0 ? (
                      scheme.scheme_slabs.map((slab) => (
                        <div key={slab.id} className="text-xs font-mono flex justify-between text-text-secondary">
                          <span>
                            {slab.start_kw} kW - {slab.end_kw ? `${slab.end_kw} kW` : '∞'}
                          </span>
                          <span className="font-semibold text-accent">
                            {slab.is_fixed_amount 
                              ? `Fixed: ${formatINR(slab.fixed_amount || 0)}` 
                              : `${formatINR(slab.rate_per_kw)} / kW`
                            }
                          </span>
                        </div>
                      ))
                    ) : (
                      <span className="text-xs text-text-muted italic">No slabs added.</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="pt-4 border-t border-border flex justify-between items-center text-xs text-text-secondary">
                <div className="flex flex-col">
                  <span>Max Capacity: <strong>{scheme.max_capacity_kw} kW</strong></span>
                  <span>Max Incentive: <strong>{formatINR(scheme.max_absolute_subsidy)}</strong></span>
                </div>
                <button
                  onClick={() => handleOpenEdit(scheme)}
                  className="flex items-center gap-1 px-4 py-2 rounded-lg bg-surface border border-border text-xs font-semibold hover:border-accent/40 hover:text-accent transition-all cursor-pointer"
                >
                  <Edit2 size={13} /> Edit Scheme & Slabs
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Editor Modal */}
      {editorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setEditorOpen(false)} />
          <div className="relative w-full max-w-2xl bg-surface border border-border rounded-xl shadow-2xl overflow-hidden animate-scale-in flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-border flex justify-between items-center bg-surface-2 shrink-0">
              <h3 className="text-sm font-bold text-text-primary">
                {selectedSchemeId ? `Edit Subsidy Scheme Slabs (${selectedScheme?.code})` : 'Create New Subsidy Scheme'}
              </h3>
              <button onClick={() => setEditorOpen(false)} className="text-text-muted hover:text-text-primary">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Properties */}
              <div className="grid grid-cols-2 gap-4 border-b border-border pb-4">
                <div className="space-y-1 col-span-1">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Scheme Code *</label>
                  <input
                    type="text" required
                    value={schemeDraft.code}
                    onChange={(e) => setSchemeDraft({ ...schemeDraft, code: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-text-primary focus:border-accent/40 outline-none uppercase font-mono"
                    placeholder="e.g. SURYA-GHAR"
                    disabled={!!selectedSchemeId}
                  />
                </div>
                <div className="space-y-1 col-span-1">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Applies To *</label>
                  <Select
                    value={schemeDraft.applies_to}
                    onChange={(val) => setSchemeDraft({ ...schemeDraft, applies_to: val as any })}
                    options={[
                      { value: 'residential', label: 'Residential' },
                      { value: 'commercial', label: 'Commercial' }
                    ]}
                    className="w-full"
                  />
                </div>
                <div className="space-y-1 col-span-2">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Scheme Name *</label>
                  <input
                    type="text" required
                    value={schemeDraft.name}
                    onChange={(e) => setSchemeDraft({ ...schemeDraft, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-text-primary focus:border-accent/40 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Max Capacity (kW) *</label>
                  <input
                    type="number" required step={0.01}
                    value={schemeDraft.max_capacity_kw}
                    onChange={(e) => setSchemeDraft({ ...schemeDraft, max_capacity_kw: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-text-primary focus:border-accent/40 outline-none font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Max Subsidy Cap (INR) *</label>
                  <input
                    type="number" required step={100}
                    value={schemeDraft.max_absolute_subsidy}
                    onChange={(e) => setSchemeDraft({ ...schemeDraft, max_absolute_subsidy: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-text-primary focus:border-accent/40 outline-none font-mono"
                  />
                </div>
                <div className="space-y-1 col-span-2">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Description</label>
                  <textarea
                    value={schemeDraft.description}
                    onChange={(e) => setSchemeDraft({ ...schemeDraft, description: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-text-primary focus:border-accent/40 outline-none resize-none"
                  />
                </div>
              </div>

              {/* Slabs Grid */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-border pb-1">
                  <span className="text-xs font-bold text-text-secondary uppercase tracking-wider flex items-center gap-1.5">
                    <Sliders size={14} className="text-accent" />
                    Piecewise Slabs
                  </span>
                  <button
                    type="button"
                    onClick={handleAddSlab}
                    className="px-3 py-1 rounded bg-accent text-background text-[10px] font-bold hover:bg-accent-hover transition-colors"
                  >
                    + Add Slab Range
                  </button>
                </div>

                <div className="space-y-3">
                  {slabs.map((slab, index) => (
                    <div key={index} className="p-3.5 rounded-xl bg-background border border-border flex flex-wrap sm:flex-nowrap items-center gap-4 animate-fade-in relative">
                      <div className="flex items-center gap-3 w-full sm:w-auto">
                        <span className="w-5 h-5 rounded-full bg-surface border border-border text-[10px] font-bold text-text-secondary flex items-center justify-center shrink-0">
                          {slab.slab_index}
                        </span>
                        
                        {/* kW Range */}
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number" step={0.01} required
                            value={slab.start_kw}
                            onChange={(e) => handleSlabChange(index, 'start_kw', parseFloat(e.target.value))}
                            className="w-16 px-2 py-1 bg-surface border border-border text-xs rounded text-center font-mono"
                            placeholder="Min"
                          />
                          <span className="text-text-muted">to</span>
                          <input
                            type="number" step={0.01}
                            value={slab.end_kw || ''}
                            onChange={(e) => handleSlabChange(index, 'end_kw', e.target.value ? parseFloat(e.target.value) : null)}
                            className="w-16 px-2 py-1 bg-surface border border-border text-xs rounded text-center font-mono"
                            placeholder="∞"
                          />
                          <span className="text-[10px] text-text-muted font-bold">kW</span>
                        </div>
                      </div>

                      {/* Pricing Rule */}
                      <div className="flex items-center gap-3 w-full sm:w-auto flex-1 justify-end">
                        <Select
                          value={slab.is_fixed_amount ? 'fixed' : 'rate'}
                          onChange={(val) => {
                            const isFixed = val === 'fixed';
                            handleSlabChange(index, 'is_fixed_amount', isFixed);
                            if (isFixed) {
                              handleSlabChange(index, 'fixed_amount', 18000);
                              handleSlabChange(index, 'rate_per_kw', 0);
                            } else {
                              handleSlabChange(index, 'fixed_amount', null);
                              handleSlabChange(index, 'rate_per_kw', 18000);
                            }
                          }}
                          options={[
                            { value: 'rate', label: 'Rate / kW' },
                            { value: 'fixed', label: 'Fixed Amount' }
                          ]}
                          size="sm"
                          className="w-32"
                        />

                        {slab.is_fixed_amount ? (
                          <div className="relative max-w-[120px]">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted text-[10px]">₹</span>
                            <input
                              type="number" required min={0}
                              value={slab.fixed_amount || 0}
                              onChange={(e) => handleSlabChange(index, 'fixed_amount', parseFloat(e.target.value))}
                              className="w-full pl-6 pr-2 py-1 bg-surface border border-border text-xs rounded font-mono font-semibold text-accent"
                            />
                          </div>
                        ) : (
                          <div className="relative max-w-[120px]">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted text-[10px]">₹</span>
                            <input
                              type="number" required min={0}
                              value={slab.rate_per_kw}
                              onChange={(e) => handleSlabChange(index, 'rate_per_kw', parseFloat(e.target.value))}
                              className="w-full pl-6 pr-6 py-1 bg-surface border border-border text-xs rounded font-mono font-semibold text-accent"
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted text-[9px]">/W</span>
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => handleRemoveSlab(index)}
                          className="p-1 rounded bg-surface hover:bg-error/10 border border-border hover:border-error/20 text-text-secondary hover:text-error transition-all"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border mt-5 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditorOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-text-secondary bg-surface border border-border hover:bg-surface-hover rounded-lg transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold text-background bg-accent hover:bg-accent-hover rounded-lg transition-all"
                >
                  Save Scheme & Slabs
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History Slideout */}
      <HistoryDrawer
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        entityTable="calculation_schemes"
        title="Subsidy Schemes Master"
      />
    </div>
  );
}
