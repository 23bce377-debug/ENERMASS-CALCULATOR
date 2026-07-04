'use client';

import { useState, useMemo } from 'react';
import { Select } from '@/components/ui/Select';
import {
  useMasterQuery,
  useMasterCreateMutation,
  useMasterUpdateMutation,
  useMasterDeleteMutation,
  useMasterBulkUpdateMutation
} from '@/lib/hooks/useMasters';
import {
  Plus,
  Search,
  Upload,
  Download,
  Edit2,
  Trash2,
  Filter,
  History,
  X,
  Check,
  CheckSquare,
  Square
} from 'lucide-react';
import { useConfirm } from '@/components/ui/Confirm';
import { useToast } from '@/components/ui/Toast';
import { HistoryDrawer } from '@/components/master/HistoryDrawer';
import { BulkEditModal, type FieldSchema } from '@/components/master/BulkEditModal';
import { exportToExcel, importFromExcel } from '@/lib/utils/ImportExportHelper';
import { formatINR } from '@/lib/engine/calculator';
import { gstRateToPercent, normalizeGstRate } from '@/lib/utils/gst';
import { TAX_CONSTANTS } from '@/lib/tax-constants';

interface Inverter {
  id: string;
  brand: string;
  model: string;
  capacity_kw: number;
  inverter_type: 'on_grid' | 'hybrid' | 'micro' | '3_phase';
  phases: number;
  rate: number;
  gst_pct: number;
  description: string | null;
  specification_details: string | null;
  org_id: string | null;
  source_global_id?: string | null;
}

export default function InvertersMasterPage() {
  const { data: inverters, isLoading } = useMasterQuery<Inverter>('inverters');
  const createMutation = useMasterCreateMutation<Inverter>('inverters');
  const updateMutation = useMasterUpdateMutation<Inverter>('inverters');
  const deleteMutation = useMasterDeleteMutation('inverters');
  const bulkUpdateMutation = useMasterBulkUpdateMutation('inverters');

  const confirm = useConfirm();
  const { toast } = useToast();

  // State controls
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  const [historyOpen, setHistoryOpen] = useState(false);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Inverter | null>(null);
  
  // Inverter Draft values
  const [draft, setDraft] = useState({
    brand: '',
    model: '',
    capacity_kw: 5,
    inverter_type: 'on_grid',
    phases: 1,
    rate: 35000,
    gst_pct: Number(TAX_CONSTANTS.INVERTER_GST_RATE),
    description: '',
    specification_details: '',
  });

  // Bulk Edit Schema
const bulkEditFields: FieldSchema[] = [
    { name: 'brand', label: 'Inverter Brand', type: 'text' },
    { name: 'inverter_type', label: 'Inverter Type', type: 'select', options: [
      { value: 'on_grid', label: 'On-Grid' },
      { value: 'hybrid', label: 'Hybrid' },
      { value: 'micro', label: 'Micro Inverter' },
      { value: '3_phase', label: '3-Phase Grid' }
    ]},
    { name: 'phases', label: 'System Phase', type: 'select', options: [
      { value: 1, label: '1 Phase' },
      { value: 3, label: '3 Phase' }
    ]},
    { name: 'rate', label: 'Base Rate (₹)', type: 'number' },
    { name: 'gst_pct', label: 'GST Percentage', type: 'number' },
  ];

  const normalizeInverterType = (value: unknown): Inverter['inverter_type'] => {
    const normalized = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
    if (['hybrid'].includes(normalized)) return 'hybrid';
    if (['micro', 'micro_inverter', 'microinverter'].includes(normalized)) return 'micro';
    if (['3_phase', 'three_phase', '3ph', '3_ph'].includes(normalized)) return '3_phase';
    return 'on_grid';
  };

  const normalizePhases = (value: unknown) => {
    const parsed = parseInt(String(value || '').replace(/\D/g, ''), 10);
    return parsed === 3 ? 3 : 1;
  };

  const readImportCell = (row: any, ...keys: string[]) => {
    for (const key of keys) {
      if (row[key] !== undefined && row[key] !== null && row[key] !== '') return row[key];
    }
    return undefined;
  };

  const sameText = (a: unknown, b: unknown) =>
    String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();

  const sameNumber = (a: unknown, b: unknown, precision = 4) => {
    const left = Number(a);
    const right = Number(b);
    if (!Number.isFinite(left) && !Number.isFinite(right)) return true;
    return Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) < Math.pow(10, -precision);
  };

  const findImportMatch = (row: any) => {
    const ids = [row.__master_id, row.__source_global_id].filter(Boolean).map(String);
    const idMatch = inverters?.find((item) => ids.includes(item.id) || (item.source_global_id ? ids.includes(item.source_global_id) : false));
    if (idMatch) return idMatch;

    return inverters?.find((item) =>
      sameText(item.brand, row.brand) &&
      sameText(item.model, row.model) &&
      sameNumber(item.capacity_kw, row.capacity_kw) &&
      normalizeInverterType(item.inverter_type) === row.inverter_type
    );
  };

  const inverterRowChanged = (existing: Inverter, row: any) =>
    !sameText(existing.brand, row.brand) ||
    !sameText(existing.model, row.model) ||
    !sameNumber(existing.capacity_kw, row.capacity_kw) ||
    normalizeInverterType(existing.inverter_type) !== row.inverter_type ||
    normalizePhases(existing.phases) !== row.phases ||
    !sameNumber(existing.rate, row.rate, 2) ||
    !sameNumber(normalizeGstRate(existing.gst_pct, TAX_CONSTANTS.INVERTER_GST_RATE), row.gst_pct, 5) ||
    !sameText(existing.description, row.description) ||
    !sameText(existing.specification_details, row.specification_details);

  // ─── Filter & Search Logic ──────────────────────────────────────────────────
  
  const uniqueBrands = useMemo(() => {
    if (!inverters) return [];
    return Array.from(new Set(inverters.map((i) => i.brand).filter(Boolean)));
  }, [inverters]);

  const uniqueTypes = useMemo(() => {
    if (!inverters) return [];
    return Array.from(new Set(inverters.map((i) => i.inverter_type).filter(Boolean)));
  }, [inverters]);

  const filteredInverters = useMemo(() => {
    if (!inverters) return [];
    return inverters.filter((i) => {
      const matchSearch =
        (i.brand || '').toLowerCase().includes(search.toLowerCase()) ||
        (i.model || '').toLowerCase().includes(search.toLowerCase()) ||
        (i.description || '').toLowerCase().includes(search.toLowerCase());
      
      const matchType = typeFilter ? i.inverter_type === typeFilter : true;
      const matchBrand = brandFilter ? i.brand === brandFilter : true;

      return matchSearch && matchType && matchBrand;
    });
  }, [inverters, search, typeFilter, brandFilter]);

  // ─── Selection Logic ────────────────────────────────────────────────────────

  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredInverters.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredInverters.map((i) => i.id));
    }
  };

  // ─── Actions handlers ────────────────────────────────────────────────────────

  const handleOpenAdd = () => {
    setEditingItem(null);
    setDraft({
      brand: '',
      model: '',
      capacity_kw: 5,
      inverter_type: 'on_grid',
      phases: 1,
      rate: 35000,
      gst_pct: Number(TAX_CONSTANTS.INVERTER_GST_RATE),
      description: '',
      specification_details: '',
    });
    setEditorOpen(true);
  };

  const handleOpenEdit = (inverter: Inverter) => {
    setEditingItem(inverter);
    setDraft({
      brand: inverter.brand,
      model: inverter.model,
      capacity_kw: inverter.capacity_kw,
      inverter_type: inverter.inverter_type,
      phases: inverter.phases,
      rate: inverter.rate,
      gst_pct: inverter.gst_pct,
      description: inverter.description || '',
      specification_details: inverter.specification_details || '',
    });
    setEditorOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingItem) {
        await updateMutation.mutateAsync({ id: editingItem.id, updates: draft });
        toast('Inverter specifications updated ✓', 'success');
      } else {
        await createMutation.mutateAsync(draft);
        toast('New inverter specifications added ✓', 'success');
      }
      setEditorOpen(false);
    } catch (err: any) {
      toast(err.message || 'Operation failed', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirm({
      title: 'Remove Inverter?',
      message: 'Are you sure you want to delete this inverter specifications from masters?',
      confirmLabel: 'Delete Inverter',
      cancelLabel: 'Cancel',
      type: 'danger',
    });
    if (!confirmed) return;
    try {
      await deleteMutation.mutateAsync(id);
      setSelectedIds((prev) => prev.filter((item) => item !== id));
      toast('Inverter specification deleted', 'success');
    } catch (err: any) {
      toast(err.message || 'Failed to delete inverter', 'error');
    }
  };

  const handleBulkEditSave = async (updates: Record<string, any>) => {
    try {
      await bulkUpdateMutation.mutateAsync({
        ids: selectedIds,
        updates: updates.gst_pct !== undefined
          ? { ...updates, gst_pct: normalizeGstRate(updates.gst_pct, TAX_CONSTANTS.INVERTER_GST_RATE) }
          : updates,
      });
      setSelectedIds([]);
      toast(`Bulk updated ${selectedIds.length} rows successfully`, 'success');
    } catch (err: any) {
      toast(err.message || 'Bulk edit failed', 'error');
    }
  };

  // ─── Import / Export ────────────────────────────────────────────────────────

  const handleExport = () => {
    const dataToExport = filteredInverters.map((i) => ({
      'Master ID': i.id,
      'Source Global ID': i.source_global_id || '',
      Scope: i.org_id ? 'Org Override' : 'Global Baseline',
      Brand: i.brand,
      Model: i.model,
      'Capacity (kW)': i.capacity_kw,
      'Inverter Type': i.inverter_type,
      Phases: i.phases,
      'Selling Rate (INR)': i.rate,
      'GST Percentage': gstRateToPercent(i.gst_pct, TAX_CONSTANTS.INVERTER_GST_RATE),
      Description: i.description || '',
      'Specification Details': i.specification_details || '',
    }));
    exportToExcel(dataToExport, 'Inverters_Master', 'Inverters');
    toast('Master list exported to Excel', 'success');
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const rawData = await importFromExcel(file);
      
      const parsedRows = rawData.map((row: any) => ({
        __master_id: readImportCell(row, 'Master ID', 'master_id', 'id'),
        __source_global_id: readImportCell(row, 'Source Global ID', 'source_global_id'),
        brand: readImportCell(row, 'Brand', 'brand'),
        model: readImportCell(row, 'Model', 'model'),
        capacity_kw: parseFloat(readImportCell(row, 'Capacity (kW)', 'capacity_kw', 'capacity')),
        inverter_type: normalizeInverterType(readImportCell(row, 'Inverter Type', 'inverter_type')),
        phases: normalizePhases(readImportCell(row, 'Phases', 'phases')),
        rate: parseFloat(readImportCell(row, 'Selling Rate (INR)', 'rate') || 0),
        gst_pct: normalizeGstRate(readImportCell(row, 'GST Percentage', 'gst_pct'), TAX_CONSTANTS.INVERTER_GST_RATE),
        description: readImportCell(row, 'Description', 'description') || '',
        specification_details: readImportCell(row, 'Specification Details', 'specification_details', 'Specifications', 'specifications', 'Description', 'description') || '',
      })).filter((r) => r.brand && r.model && !isNaN(r.capacity_kw) && !isNaN(r.rate));

      if (parsedRows.length === 0) {
        toast('No valid rows found in Excel sheet. Check column headers.', 'error');
        return;
      }

      const confirmed = await confirm({
        title: `Import ${parsedRows.length} Inverters?`,
        message: `This will insert ${parsedRows.length} Inverters spec rows into database. Continue?`,
        confirmLabel: 'Import Now',
        cancelLabel: 'Cancel',
        type: 'warning',
      });

      if (!confirmed) return;

      let created = 0;
      let updated = 0;
      let skipped = 0;

      for (const row of parsedRows) {
        const { __master_id, __source_global_id, ...payload } = row;
        const existing = findImportMatch(row);

        if (existing) {
          if (inverterRowChanged(existing, payload)) {
            await updateMutation.mutateAsync({ id: existing.id, updates: payload });
            updated += 1;
          } else {
            skipped += 1;
          }
        } else {
          await createMutation.mutateAsync(payload);
          created += 1;
        }
      }

      toast(`Import complete: ${created} created, ${updated} updated, ${skipped} unchanged`, 'success');
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
        {/* Search and Filter */}
        <div className="flex items-center gap-3 flex-1 min-w-[280px]">
          <div className="relative flex-1 max-w-xs">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
            <input
              type="text"
              placeholder="Search brand, model, phase..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-surface border border-border text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-accent/40"
            />
          </div>

          <Select
            value={brandFilter}
            onChange={(val) => setBrandFilter(val)}
            options={[
              { value: '', label: 'All Brands' },
              ...uniqueBrands.map((b) => ({ value: b, label: b }))
            ]}
            size="sm"
            className="min-w-[130px]"
          />

          <Select
            value={typeFilter}
            onChange={(val) => setTypeFilter(val)}
            options={[
              { value: '', label: 'All Inverter Types' },
              ...uniqueTypes.map((t) => ({ value: t, label: t.replace('_', ' ') }))
            ]}
            size="sm"
            className="min-w-[170px]"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {selectedIds.length > 0 && (
            <button
              onClick={() => setBulkEditOpen(true)}
              className="flex items-center gap-1.5 px-4.5 py-2 rounded-lg bg-accent/10 border border-accent/20 text-accent text-xs font-semibold hover:bg-accent/20 transition-all cursor-pointer"
            >
              Bulk Edit ({selectedIds.length})
            </button>
          )}

          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-4.5 py-2 rounded-lg bg-accent text-background text-xs font-semibold hover:bg-accent-hover transition-all cursor-pointer"
          >
            <Plus size={14} /> Add Inverter
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
          <div className="p-12 text-center text-xs text-text-muted">Loading inverters...</div>
        ) : filteredInverters.length === 0 ? (
          <div className="p-16 text-center text-xs text-text-muted italic">No inverters registered. Click Add or Import.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-10">
                  <button onClick={toggleSelectAll} className="text-text-muted hover:text-text-primary">
                    {selectedIds.length === filteredInverters.length ? (
                      <CheckSquare size={16} className="text-accent" />
                    ) : (
                      <Square size={16} />
                    )}
                  </button>
                </th>
                <th>Brand</th>
                <th>Model</th>
                <th>Capacity (kW)</th>
                <th>Inverter Type</th>
                <th>Phases</th>
                <th>Selling Price</th>
                <th>GST Rate</th>
                <th>Scope</th>
                <th className="w-20 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredInverters.map((i) => {
                const isSelected = selectedIds.includes(i.id);
                return (
                  <tr key={i.id} className={isSelected ? 'bg-accent-glow/50' : ''}>
                    <td>
                      <button onClick={() => toggleSelectRow(i.id)} className="text-text-muted hover:text-text-primary">
                        {isSelected ? (
                          <CheckSquare size={16} className="text-accent" />
                        ) : (
                          <Square size={16} />
                        )}
                      </button>
                    </td>
                    <td className="font-semibold">{i.brand}</td>
                    <td className="text-text-secondary font-mono">{i.model}</td>
                    <td>{i.capacity_kw} kW</td>
                    <td className="capitalize">
                      <span className={`badge-base ${
                        i.inverter_type === 'on_grid' ? 'badge-on-grid' :
                        i.inverter_type === 'hybrid' ? 'badge-hybrid' :
                        i.inverter_type === 'micro' ? 'badge-micro-inverter' :
                        i.inverter_type === '3_phase' ? 'badge-3-phase' : 'badge-upgrade'
                      }`}>{i.inverter_type.replace('_', ' ')}</span>
                    </td>
                    <td>{i.phases} Ph</td>
                    <td className="font-mono font-semibold text-text-primary">{formatINR(i.rate)}</td>
                    <td>{(i.gst_pct * 100).toFixed(0)}%</td>
                    <td>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${i.org_id ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                        {i.org_id ? 'Org Overrides' : 'Global Baseline'}
                      </span>
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenEdit(i)}
                          className="p-1 rounded bg-surface border border-border text-text-secondary hover:text-accent hover:border-accent/30 cursor-pointer"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => handleDelete(i.id)}
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
          <div className="relative w-full max-w-lg bg-surface border border-border rounded-xl shadow-2xl overflow-hidden animate-scale-in">
            <div className="p-5 border-b border-border flex justify-between items-center bg-surface-2">
              <h3 className="text-sm font-bold text-text-primary">
                {editingItem ? 'Edit Inverter specifications' : 'Add New Inverter'}
              </h3>
              <button onClick={() => setEditorOpen(false)} className="text-text-muted hover:text-text-primary">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Brand Name *</label>
                  <input
                    type="text" required
                    value={draft.brand}
                    onChange={(e) => setDraft({ ...draft, brand: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-text-primary focus:border-accent/40 outline-none"
                    placeholder="e.g. Growatt, SMA"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Model SKU *</label>
                  <input
                    type="text" required
                    value={draft.model}
                    onChange={(e) => setDraft({ ...draft, model: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-text-primary focus:border-accent/40 outline-none"
                    placeholder="e.g. MIN-5000, SunnyBoy"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Inverter Capacity (kW) *</label>
                  <input
                    type="number" required min={0.1} step={0.01}
                    value={draft.capacity_kw}
                    onChange={(e) => setDraft({ ...draft, capacity_kw: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-text-primary focus:border-accent/40 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Inverter Type *</label>
                  <Select
                    value={draft.inverter_type}
                    onChange={(val) => setDraft({ ...draft, inverter_type: val as any })}
                    options={[
                      { value: 'on_grid', label: 'On-Grid' },
                      { value: 'hybrid', label: 'Hybrid' },
                      { value: 'micro', label: 'Micro Inverter' },
                      { value: '3_phase', label: '3-Phase' }
                    ]}
                    className="w-full"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">System Phases *</label>
                  <Select
                    value={String(draft.phases)}
                    onChange={(val) => setDraft({ ...draft, phases: parseInt(val, 10) })}
                    options={[
                      { value: '1', label: '1 Phase' },
                      { value: '3', label: '3 Phase' }
                    ]}
                    className="w-full"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Base Selling Rate (INR) *</label>
                  <input
                    type="number" required min={0} step={1}
                    value={draft.rate}
                    onChange={(e) => setDraft({ ...draft, rate: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-text-primary focus:border-accent/40 outline-none font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">GST Percentage *</label>
                  <input
                    type="number" required min={0} step={0.01}
                    value={gstRateToPercent(draft.gst_pct, TAX_CONSTANTS.INVERTER_GST_RATE)}
                    onChange={(e) => setDraft({ ...draft, gst_pct: normalizeGstRate(e.target.value, TAX_CONSTANTS.INVERTER_GST_RATE) })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-text-primary focus:border-accent/40 outline-none font-mono"
                    placeholder="18"
                  />
                </div>
              </div>
              
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Quote Specification Details</label>
                <textarea
                  value={draft.specification_details}
                  onChange={(e) => setDraft({ ...draft, specification_details: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-text-primary focus:border-accent/40 outline-none resize-none"
                  placeholder="Efficiency, THD, MPPT channels, protection class, warranty terms..."
                />
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
                  Save Inverter
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History Slide-out Drawer */}
      <HistoryDrawer
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        entityTable="eq_inverters"
        title="Power Inverters Master"
      />

      {/* Bulk Edit Modal */}
      <BulkEditModal
        isOpen={bulkEditOpen}
        onClose={() => setBulkEditOpen(false)}
        selectedCount={selectedIds.length}
        fields={bulkEditFields}
        onSave={handleBulkEditSave}
      />
    </div>
  );
}
