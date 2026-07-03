'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Select } from '@/components/ui/Select';
import { supabase } from '@/lib/supabase/client';
import {
  getOrgContext,
  useMasterUpdateMutation
} from '@/lib/hooks/useMasters';
import {
  Plus,
  Search,
  Upload,
  Download,
  Edit2,
  Trash2,
  History,
  X,
  Check,
  CheckSquare,
  Square,
  TrendingUp,
  Tag,
  DollarSign
} from 'lucide-react';
import { useConfirm } from '@/components/ui/Confirm';
import { useToast } from '@/components/ui/Toast';
import { HistoryDrawer } from '@/components/master/HistoryDrawer';
import { exportToExcel, importFromExcel } from '@/lib/utils/ImportExportHelper';
import { formatINR } from '@/lib/engine/calculator';
import { gstRateToPercent, normalizeGstRate } from '@/lib/utils/gst';

interface PricingRow {
  id: string;
  bom_item_id: string;
  item_name: string;
  rate_master_id?: string | null;
  override_rate: number;
  is_active: boolean;
  is_override?: boolean;
  bom_description?: string;
  bom_section?: string;
  bom_unit?: string;
  bom_default_rate?: number;
  gst_pct?: number | null;
}

interface BomMasterUpdate {
  gst_pct?: number;
}

function normalizeItemName(value: any) {
  return String(value || '').trim().toLowerCase();
}

function getBomItemName(item: any) {
  return String(item?.description || item?.sku_code || 'BOM Item').trim();
}

function uniqueBomItems(items: any[]) {
  const map = new Map<string, any>();
  for (const item of items || []) {
    const key = `${item.category_id}:${normalizeItemName(item.sku_code || item.description)}`;
    const existing = map.get(key);
    if (!existing || item.org_id) {
      map.set(key, item);
    }
  }
  return Array.from(map.values());
}

export default function PricingMasterPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const { toast } = useToast();
  const updateBomGstMutation = useMasterUpdateMutation<BomMasterUpdate>('accessories');

  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  const [historyOpen, setHistoryOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [markupOpen, setMarkupOpen] = useState(false);
  
  const [editingItem, setEditingItem] = useState<PricingRow | null>(null);

  // Markup modifier state
  const [markupType, setMarkupType] = useState<'percent' | 'flat'>('percent');
  const [markupValue, setMarkupValue] = useState<number>(5);

  const [draft, setDraft] = useState({
    bom_item_id: '',
    override_rate: 0,
    gst_pct: 0.18,
    is_active: true,
  });

  // 1. Fetch BOM Items to show standard baseline rates
  const { data: bomItems } = useQuery({
    queryKey: ['bom-items-pricing'],
    queryFn: async () => {
      const { orgId } = await getOrgContext();
      const { data, error } = await supabase
        .from('bom_template_items')
        .select('*')
        .or(`org_id.eq.${orgId},org_id.is.null`);
      if (error) throw error;
      return uniqueBomItems(data || []);
    }
  });

  // 2. Fetch Pricing Overrides joined with descriptions
  const { data: pricingRows, isLoading, refetch } = useQuery<PricingRow[]>({
    queryKey: ['masters', 'pricing'],
    queryFn: async () => {
      const { orgId } = await getOrgContext();
      
      const [bomResult, overrideResult] = await Promise.all([
        supabase
          .from('bom_template_items')
          .select('*')
          .or(`org_id.eq.${orgId},org_id.is.null`),
        supabase
          .from('rate_master')
          .select('*')
          .eq('org_id', orgId)
          .eq('is_active', true),
      ]);

      if (bomResult.error) throw bomResult.error;
      if (overrideResult.error) throw overrideResult.error;

      const uniqueBoms = uniqueBomItems(bomResult.data || []);
      const overrides = new Map<string, any>();
      for (const row of overrideResult.data || []) {
        overrides.set(normalizeItemName(row.item_name), row);
      }

      // Map fields directly to PricingRow format
      const rows: PricingRow[] = uniqueBoms.map((b) => {
        const itemName = getBomItemName(b);
        const override = overrides.get(normalizeItemName(itemName));
        return {
          id: override?.id ?? b.id,
          bom_item_id: b.id,
          item_name: itemName,
          rate_master_id: override?.id ?? null,
          override_rate: Number(override?.override_rate ?? b.default_rate ?? 0),
          is_active: override?.is_active ?? b.is_active,
          is_override: !!override,
          bom_description: b.description || 'BOM Item',
          bom_section: b.category_id || 'Accessories',
          bom_unit: b.unit || 'Nos',
          bom_default_rate: b.default_rate || 0,
          gst_pct: b.gst_pct ?? 0.18,
        } as any;
      });

      return rows;
    }
  });

  // 3. Mutations
  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const { orgId } = await getOrgContext();
      
      // Get the metadata of the target global BOM item
      const { data: targetItem, error: fetchError } = await supabase
        .from('bom_template_items')
        .select('*')
        .eq('id', payload.bom_item_id)
        .single();
      if (fetchError) throw fetchError;

      const itemName = getBomItemName(targetItem);
      const { data, error } = await supabase
        .from('rate_master')
        .upsert({
          org_id: orgId,
          item_name: itemName,
          override_rate: Number(payload.override_rate || 0),
          bom_item_id: null,
          is_active: payload.is_active ?? true,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'org_id,item_name' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['masters', 'pricing'] });
      toast('Pricing override created ✓', 'success');
      setEditorOpen(false);
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, override_rate, is_active }: { id: string; override_rate: number; gst_pct?: number; is_active?: boolean }) => {
      const { data, error } = await supabase
        .from('rate_master')
        .update({
          override_rate: Number(override_rate || 0),
          is_active: is_active ?? true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['masters', 'pricing'] });
      toast('Pricing override updated ✓', 'success');
      setEditorOpen(false);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { orgId } = await getOrgContext();
      const { error } = await supabase
        .from('rate_master')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('org_id', orgId);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['masters', 'pricing'] });
      toast('Pricing override removed', 'success');
    }
  });

  // ─── Filter & Search Logic ──────────────────────────────────────────────────

  const filteredRows = useMemo(() => {
    if (!pricingRows) return [];
    return pricingRows.filter((r) =>
      (r.bom_description || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.bom_section || '').toLowerCase().includes(search.toLowerCase())
    );
  }, [pricingRows, search]);

  // ─── Selection Logic ────────────────────────────────────────────────────────

  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredRows.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredRows.map((r) => r.id));
    }
  };

  // ─── Markup Adjuster ───────────────────────────────────────────────────────

  const handleApplyMarkup = async () => {
    try {
      const promises = selectedIds.map(async (id) => {
        const row = pricingRows?.find((r) => r.id === id);
        if (!row) return;

        let newRate = row.override_rate;
        if (markupType === 'percent') {
          newRate = row.override_rate * (1 + markupValue / 100);
        } else {
          newRate = row.override_rate + markupValue;
        }
        newRate = Math.round(newRate);

        if (!(row as any).is_override) {
          await createMutation.mutateAsync({ bom_item_id: row.bom_item_id, override_rate: newRate, gst_pct: row.gst_pct });
        } else {
          await updateMutation.mutateAsync({ id: row.id, override_rate: newRate });
        }
      });

      await Promise.all(promises);
      setSelectedIds([]);
      setMarkupOpen(false);
      refetch();
      toast(`Markup adjusted successfully across selected pricing profiles`, 'success');
    } catch (err: any) {
      toast(err.message || 'Failed to adjust markup', 'error');
    }
  };

  // ─── CRUD Handlers ──────────────────────────────────────────────────────────

  const handleOpenAdd = () => {
    setEditingItem(null);
    setDraft({
      bom_item_id: bomItems?.[0]?.id || '',
      override_rate: 0,
      gst_pct: normalizeGstRate((bomItems?.[0] as any)?.gst_pct, 0.18),
      is_active: true,
    });
    setEditorOpen(true);
  };

  const handleOpenEdit = (row: PricingRow) => {
    setEditingItem(row);
    setDraft({
      bom_item_id: row.bom_item_id,
      override_rate: row.override_rate,
      gst_pct: normalizeGstRate(row.gst_pct, 0.18),
      is_active: row.is_active,
    });
    setEditorOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const gst_pct = normalizeGstRate(draft.gst_pct, 0.18);
      if (draft.bom_item_id) {
        await updateBomGstMutation.mutateAsync({ id: draft.bom_item_id, updates: { gst_pct } });
      }

      if (editingItem) {
        if (!(editingItem as any).is_override) {
          await createMutation.mutateAsync({ bom_item_id: editingItem.bom_item_id, override_rate: draft.override_rate, gst_pct });
        } else {
          await updateMutation.mutateAsync({ id: editingItem.id, override_rate: draft.override_rate, gst_pct, is_active: draft.is_active });
        }
      } else {
        await createMutation.mutateAsync({ ...draft, gst_pct });
      }
    } catch (err: any) {
      toast(err.message || 'Operation failed', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirm({
      title: 'Remove Override?',
      message: 'Delete this pricing override and revert to baseline catalog rates?',
      confirmLabel: 'Revert to Default',
      cancelLabel: 'Keep Override',
      type: 'danger',
    });
    if (!confirmed) return;
    try {
      await deleteMutation.mutateAsync(id);
    } catch (err: any) {
      toast(err.message || 'Failed to delete override', 'error');
    }
  };

  // ─── Import / Export ────────────────────────────────────────────────────────

  const handleExport = () => {
    const dataToExport = filteredRows.map((r) => ({
      'BOM Component Description': r.bom_description,
      Section: r.bom_section,
      Unit: r.bom_unit,
      'Baseline Cost (INR)': r.bom_default_rate,
      'Selling Override Rate (INR)': r.override_rate,
      'GST Percentage': gstRateToPercent(r.gst_pct, 0.18),
    }));
    exportToExcel(dataToExport, 'Pricing_Master_Overrides', 'Overrides');
    toast('Overrides exported successfully', 'success');
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const rawData = await importFromExcel(file);
      const availableBomItems = bomItems || [];
      const parsedRows = rawData.map((row: any) => {
        const description = row['BOM Component Description'] || row.Description || row.description || row.item_name || '';
        const bomItem = availableBomItems.find((item: any) => normalizeItemName(getBomItemName(item)) === normalizeItemName(description));
        return {
          bom_item_id: bomItem?.id,
          override_rate: parseFloat(row['Selling Override Rate (INR)'] || row.override_rate || row.rate || 0),
          gst_pct: normalizeGstRate(row['GST Percentage'] || row.gst_pct || bomItem?.gst_pct, 0.18),
        };
      }).filter((row) => row.bom_item_id && !isNaN(row.override_rate));

      if (parsedRows.length === 0) {
        toast('No matching pricing rows found. Import requires exported BOM Component Description values.', 'error');
        return;
      }

      const confirmed = await confirm({
        title: `Import ${parsedRows.length} Pricing Overrides?`,
        message: 'Existing overrides with the same BOM description will be updated.',
        confirmLabel: 'Import Now',
        cancelLabel: 'Cancel',
        type: 'warning',
      });
      if (!confirmed) return;

      for (const row of parsedRows) {
        await updateBomGstMutation.mutateAsync({ id: row.bom_item_id, updates: { gst_pct: row.gst_pct } });
        await createMutation.mutateAsync(row);
      }
      toast(`Successfully imported ${parsedRows.length} pricing overrides`, 'success');
    } catch (err: any) {
      toast(err.message || 'Import failed', 'error');
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Action Row */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-surface p-4 rounded-xl border border-border">
        {/* Search */}
        <div className="flex items-center gap-3 flex-1 min-w-[280px]">
          <div className="relative flex-1 max-w-xs">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
            <input
              type="text"
              placeholder="Search components or categories..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-surface border border-border text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-accent/40"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {selectedIds.length > 0 && (
            <button
              onClick={() => setMarkupOpen(true)}
              className="flex items-center gap-1.5 px-4.5 py-2 rounded-lg bg-accent/10 border border-accent/20 text-accent text-xs font-semibold hover:bg-accent/20 transition-all cursor-pointer"
            >
              <TrendingUp size={14} /> Bulk Markup Adjust ({selectedIds.length})
            </button>
          )}

          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-4.5 py-2 rounded-lg bg-accent text-background text-xs font-semibold hover:bg-accent-hover transition-all cursor-pointer"
          >
            <Plus size={14} /> Create Override
          </button>

          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface border border-border text-xs text-text-secondary hover:text-text-primary hover:border-border-light transition-all cursor-pointer"
          >
            <Download size={14} /> Export
          </button>

          <label className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface border border-border text-xs text-text-secondary hover:text-text-primary hover:border-border-light transition-all cursor-pointer">
            <Upload size={14} /> Import
            <input type="file" accept=".xlsx, .xls, .csv" onChange={handleImport} className="hidden" />
          </label>

          <button
            onClick={() => setHistoryOpen(true)}
            className="p-2 rounded-lg bg-surface border border-border text-text-secondary hover:text-text-primary cursor-pointer"
          >
            <History size={15} />
          </button>
        </div>
      </div>

      {/* Database Table */}
      <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-md">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-text-muted">Loading pricing configurations...</div>
        ) : filteredRows.length === 0 ? (
          <div className="p-16 text-center text-xs text-text-muted italic">No pricing overrides active for your organisation. Click Create Override above to set billing costs.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-10">
                  <button onClick={toggleSelectAll} className="text-text-muted hover:text-text-primary">
                    {selectedIds.length === filteredRows.length ? (
                      <CheckSquare size={16} className="text-accent" />
                    ) : (
                      <Square size={16} />
                    )}
                  </button>
                </th>
                <th>BOM Component Description</th>
                <th>Category Section</th>
                <th>Baseline Standard Cost</th>
                <th>Master Overridden Selling Price</th>
                <th>GST Rate</th>
                <th>Unit</th>
                <th className="w-20 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r) => {
                const isSelected = selectedIds.includes(r.id);
                return (
                  <tr key={r.id} className={isSelected ? 'bg-accent-glow/50' : ''}>
                    <td>
                      <button onClick={() => toggleSelectRow(r.id)} className="text-text-muted hover:text-text-primary">
                        {isSelected ? (
                          <CheckSquare size={16} className="text-accent" />
                        ) : (
                          <Square size={16} />
                        )}
                      </button>
                    </td>
                    <td className="font-semibold text-text-primary flex items-center gap-2">
                      <Tag size={13} className="text-accent" />
                      {r.bom_description}
                    </td>
                    <td className="capitalize text-xs text-text-secondary">{r.bom_section?.replace(/_/g, ' ')}</td>
                    <td className="font-mono text-text-secondary">{formatINR(r.bom_default_rate || 0)}</td>
                    <td className="font-mono font-bold text-accent text-sm">{formatINR(r.override_rate)}</td>
                    <td className="font-mono text-text-secondary">{gstRateToPercent(r.gst_pct, 0.18).toFixed(2).replace(/\.00$/, '')}%</td>
                    <td>{r.bom_unit}</td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenEdit(r)}
                          className="p-1 rounded bg-surface border border-border text-text-secondary hover:text-accent hover:border-accent/30 cursor-pointer"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => (r as any).is_override ? handleDelete(r.id) : toast('This row is already using the baseline catalog rate.', 'error')}
                          className="p-1 rounded bg-surface border border-border text-text-secondary hover:text-error hover:border-error/30 cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Editor Modal */}
      {editorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setEditorOpen(false)} />
          <div className="relative z-10 w-full max-w-md bg-surface border border-border rounded-xl shadow-2xl overflow-hidden animate-scale-in">
            <div className="p-5 border-b border-border flex justify-between items-center bg-surface-2">
              <h3 className="text-sm font-bold text-text-primary">
                {editingItem ? 'Edit Pricing Override Rate' : 'Create Pricing Override'}
              </h3>
              <button onClick={() => setEditorOpen(false)} className="text-text-muted hover:text-text-primary">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Target BOM Component *</label>
                {editingItem ? (
                  <div className="p-3 rounded-lg bg-surface-2 border border-border text-xs text-text-secondary font-semibold">
                    {editingItem.bom_description} ({editingItem.bom_unit})
                  </div>
                ) : (
                <Select
                  value={draft.bom_item_id}
                  onChange={(val) => {
                    const selectedBom = (bomItems || []).find((item: any) => item.id === val);
                    setDraft({
                      ...draft,
                      bom_item_id: val,
                      gst_pct: normalizeGstRate((selectedBom as any)?.gst_pct, draft.gst_pct),
                    });
                  }}
                  placeholder="Select a component..."
                  options={[
                    { value: '', label: 'Select a component...', disabled: true },
                    ...(bomItems || []).map((item: any) => ({
                      value: item.id,
                      label: `${item.description} (${item.unit}) — Baseline: ₹${item.default_rate}`
                    }))
                  ]}
                  className="w-full"
                />
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Custom Override Selling Rate (INR) *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-xs">₹</span>
                  <input
                    type="number" required min={0}
                    value={draft.override_rate === 0 ? '' : draft.override_rate}
                    onChange={(e) => setDraft({ ...draft, override_rate: parseFloat(e.target.value) || 0 })}
                    className="w-full pl-8 pr-4 py-2.5 rounded-lg bg-background border border-border text-sm text-text-primary focus:border-accent/40 outline-none font-mono"
                    placeholder="Enter Custom Price Rate"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">GST Percentage *</label>
                <input
                  type="number" required min={0} step={0.01}
                  value={gstRateToPercent(draft.gst_pct, 0.18)}
                  onChange={(e) => setDraft({ ...draft, gst_pct: normalizeGstRate(e.target.value, 0.18) })}
                  className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-sm text-text-primary focus:border-accent/40 outline-none font-mono"
                  placeholder="18"
                />
              </div>

              <div className="flex items-center gap-3 mt-2">
                <input
                  type="checkbox"
                  id="isActiveToggle"
                  checked={draft.is_active}
                  onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })}
                  className="w-4 h-4 rounded border-border text-accent focus:ring-accent/40 cursor-pointer"
                />
                <label htmlFor="isActiveToggle" className="text-xs font-semibold text-text-primary cursor-pointer select-none">
                  Active Override
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border mt-5">
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
                  Save Price Override
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Markup Modal */}
      {markupOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMarkupOpen(false)} />
          <div className="relative z-10 w-full max-w-sm bg-surface border border-border rounded-xl shadow-2xl overflow-hidden animate-scale-in">
            <div className="p-5 border-b border-border flex justify-between items-center bg-surface-2">
              <div>
                <h3 className="text-sm font-bold text-text-primary">Bulk Markup Adjustment</h3>
                <p className="text-[10px] text-text-muted mt-0.5">Apply pricing modifier to {selectedIds.length} items</p>
              </div>
              <button onClick={() => setMarkupOpen(false)} className="text-text-muted hover:text-text-primary">
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Adjustment Type</label>
                <div className="flex p-1 rounded-lg bg-surface border border-border">
                  <button
                    onClick={() => setMarkupType('percent')}
                    className={`flex-1 py-1.5 rounded text-xs font-semibold ${markupType === 'percent' ? 'bg-accent text-background' : 'text-text-secondary'}`}
                  >
                    Percentage (%)
                  </button>
                  <button
                    onClick={() => setMarkupType('flat')}
                    className={`flex-1 py-1.5 rounded text-xs font-semibold ${markupType === 'flat' ? 'bg-accent text-background' : 'text-text-secondary'}`}
                  >
                    Flat Override (₹)
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Adjustment Value (Increments or Decrements)</label>
                <input
                  type="number"
                  value={markupValue}
                  onChange={(e) => setMarkupValue(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-text-primary outline-none focus:border-accent/40 font-mono"
                  placeholder="e.g. 5, -10, 500"
                />
                <span className="text-[10px] text-text-muted block mt-1">
                  Use negative numbers (e.g. -5) to markdown prices.
                </span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border mt-5">
                <button
                  onClick={() => setMarkupOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-text-secondary bg-surface border border-border hover:bg-surface-hover rounded-lg transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApplyMarkup}
                  className="px-5 py-2 text-xs font-semibold text-background bg-accent hover:bg-accent-hover rounded-lg transition-all"
                >
                  Apply Modifiers
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History Slide-out Drawer */}
      <HistoryDrawer
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        entityTable="bom_template_items"
        title="Rate Master Pricing"
      />
    </div>
  );
}
