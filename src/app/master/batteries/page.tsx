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
import { getBatteryGstRate, TAX_CONSTANTS } from '@/lib/tax-constants';

interface Battery {
  id: string;
  brand: string;
  model: string;
  capacity_kwh: number;
  voltage_v: number | null;
  chemistry: 'LFP' | 'Li-Ion' | 'Lead-Acid' | 'NMC';
  dod_pct: number;
  rate: number;
  gst_pct: number;
  description: string | null;
  specification_details: string | null;
  org_id: string | null;
  source_global_id?: string | null;
}

export default function BatteriesMasterPage() {
  const { data: batteries, isLoading } = useMasterQuery<Battery>('batteries');
  const createMutation = useMasterCreateMutation<Battery>('batteries');
  const updateMutation = useMasterUpdateMutation<Battery>('batteries');
  const deleteMutation = useMasterDeleteMutation('batteries');
  const bulkUpdateMutation = useMasterBulkUpdateMutation('batteries');

  const confirm = useConfirm();
  const { toast } = useToast();

  // State controls
  const [search, setSearch] = useState('');
  const [chemFilter, setChemFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  const [historyOpen, setHistoryOpen] = useState(false);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Battery | null>(null);
  
  // Battery Draft values
  const [draft, setDraft] = useState({
    brand: '',
    model: '',
    capacity_kwh: 5,
    voltage_v: 48,
    chemistry: 'LFP',
    dod_pct: 0.8,
    rate: 90000,
    gst_pct: Number(TAX_CONSTANTS.BATTERY_GST_RATE),
    description: '',
    specification_details: '',
  });

  // Bulk Edit Schema
  const bulkEditFields: FieldSchema[] = [
    { name: 'brand', label: 'Battery Brand', type: 'text' },
    { name: 'chemistry', label: 'Battery Chemistry', type: 'select', options: [
      { value: 'LFP', label: 'LFP (Lithium Iron Phosphate)' },
      { value: 'Li-Ion', label: 'Li-Ion (Lithium Ion)' },
      { value: 'Lead-Acid', label: 'Lead Acid / AGM' },
      { value: 'NMC', label: 'NMC / Ternary Lithium' }
    ]},
    { name: 'dod_pct', label: 'Depth of Discharge (%)', type: 'number' },
    { name: 'rate', label: 'Selling Rate (₹)', type: 'number' },
    { name: 'gst_pct', label: 'GST Percentage', type: 'number' },
  ];

  const normalizeBatteryChemistry = (value: unknown): Battery['chemistry'] => {
    const normalized = String(value || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
    if (['liion', 'lithiumion', 'lithium'].includes(normalized)) return 'Li-Ion';
    if (['leadacid', 'agm', 'lead'].includes(normalized)) return 'Lead-Acid';
    if (['nmc', 'ternarylithium'].includes(normalized)) return 'NMC';
    return 'LFP';
  };

  const normalizeDodPct = (value: unknown) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 0.8;
    const fraction = parsed > 1 ? parsed / 100 : parsed;
    return Math.min(1, Math.max(0, fraction));
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
    const idMatch = batteries?.find((item) => ids.includes(item.id) || (item.source_global_id ? ids.includes(item.source_global_id) : false));
    if (idMatch) return idMatch;

    return batteries?.find((item) =>
      sameText(item.brand, row.brand) &&
      sameText(item.model, row.model) &&
      sameNumber(item.capacity_kwh, row.capacity_kwh)
    );
  };

  const batteryRowChanged = (existing: Battery, row: any) =>
    !sameText(existing.brand, row.brand) ||
    !sameText(existing.model, row.model) ||
    !sameNumber(existing.capacity_kwh, row.capacity_kwh) ||
    !sameNumber(existing.voltage_v, row.voltage_v) ||
    normalizeBatteryChemistry(existing.chemistry) !== row.chemistry ||
    !sameNumber(normalizeDodPct(existing.dod_pct), row.dod_pct, 5) ||
    !sameNumber(existing.rate, row.rate, 2) ||
    !sameNumber(normalizeGstRate(existing.gst_pct, getBatteryGstRate(existing)), row.gst_pct, 5) ||
    !sameText(existing.description, row.description) ||
    !sameText(existing.specification_details, row.specification_details);

  // ─── Filter & Search Logic ──────────────────────────────────────────────────
  
  const uniqueBrands = useMemo(() => {
    if (!batteries) return [];
    return Array.from(new Set(batteries.map((b) => b.brand).filter(Boolean)));
  }, [batteries]);

  const uniqueChems = useMemo(() => {
    if (!batteries) return [];
    return Array.from(new Set(batteries.map((b) => b.chemistry).filter(Boolean)));
  }, [batteries]);

  const filteredBatteries = useMemo(() => {
    if (!batteries) return [];
    return batteries.filter((b) => {
      const matchSearch =
        (b.brand || '').toLowerCase().includes(search.toLowerCase()) ||
        (b.model || '').toLowerCase().includes(search.toLowerCase()) ||
        (b.description || '').toLowerCase().includes(search.toLowerCase());
      
      const matchChem = chemFilter ? b.chemistry === chemFilter : true;
      const matchBrand = brandFilter ? b.brand === brandFilter : true;

      return matchSearch && matchChem && matchBrand;
    });
  }, [batteries, search, chemFilter, brandFilter]);

  // ─── Selection Logic ────────────────────────────────────────────────────────

  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredBatteries.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredBatteries.map((b) => b.id));
    }
  };

  // ─── Actions handlers ────────────────────────────────────────────────────────

  const handleOpenAdd = () => {
    setEditingItem(null);
    setDraft({
      brand: '',
      model: '',
      capacity_kwh: 5,
      voltage_v: 48,
      chemistry: 'LFP',
      dod_pct: 0.8,
      rate: 90000,
      gst_pct: Number(TAX_CONSTANTS.BATTERY_GST_RATE),
      description: '',
      specification_details: '',
    });
    setEditorOpen(true);
  };

  const handleOpenEdit = (battery: Battery) => {
    setEditingItem(battery);
    setDraft({
      brand: battery.brand,
      model: battery.model,
      capacity_kwh: battery.capacity_kwh,
      voltage_v: battery.voltage_v || 48,
      chemistry: battery.chemistry,
      dod_pct: battery.dod_pct,
      rate: battery.rate,
      gst_pct: battery.gst_pct,
      description: battery.description || '',
      specification_details: battery.specification_details || '',
    });
    setEditorOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingItem) {
        await updateMutation.mutateAsync({ id: editingItem.id, updates: { ...draft, dod_pct: normalizeDodPct(draft.dod_pct) } });
        toast('Battery storage spec updated ✓', 'success');
      } else {
        await createMutation.mutateAsync({ ...draft, dod_pct: normalizeDodPct(draft.dod_pct) });
        toast('New battery specifications added ✓', 'success');
      }
      setEditorOpen(false);
    } catch (err: any) {
      toast(err.message || 'Operation failed', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirm({
      title: 'Remove Battery Model?',
      message: 'Are you sure you want to delete this battery model from the active directory?',
      confirmLabel: 'Delete Battery',
      cancelLabel: 'Cancel',
      type: 'danger',
    });
    if (!confirmed) return;
    try {
      await deleteMutation.mutateAsync(id);
      setSelectedIds((prev) => prev.filter((item) => item !== id));
      toast('Battery model deleted', 'success');
    } catch (err: any) {
      toast(err.message || 'Failed to delete battery', 'error');
    }
  };

  const handleBulkEditSave = async (updates: Record<string, any>) => {
    try {
      await bulkUpdateMutation.mutateAsync({
        ids: selectedIds,
        updates: updates.gst_pct !== undefined
          ? {
              ...updates,
              gst_pct: normalizeGstRate(updates.gst_pct, TAX_CONSTANTS.BATTERY_GST_RATE),
              ...(updates.dod_pct !== undefined ? { dod_pct: normalizeDodPct(updates.dod_pct) } : {}),
            }
          : updates.dod_pct !== undefined
            ? { ...updates, dod_pct: normalizeDodPct(updates.dod_pct) }
            : updates,
      });
      setSelectedIds([]);
      toast(`Bulk updated ${selectedIds.length} battery items`, 'success');
    } catch (err: any) {
      toast(err.message || 'Bulk edit failed', 'error');
    }
  };

  // ─── Import / Export ────────────────────────────────────────────────────────

  const handleExport = () => {
    const dataToExport = filteredBatteries.map((b) => ({
      'Master ID': b.id,
      'Source Global ID': b.source_global_id || '',
      Scope: b.org_id ? 'Org Override' : 'Global Baseline',
      Brand: b.brand,
      Model: b.model,
      'Capacity (kWh)': b.capacity_kwh,
      Chemistry: b.chemistry,
      'Voltage (V)': b.voltage_v || '',
      'DoD Percentage': Math.round(Number(b.dod_pct || 0) * 100),
      'Selling Rate (INR)': b.rate,
      'GST Percentage': gstRateToPercent(b.gst_pct, getBatteryGstRate(b)),
      Description: b.description || '',
      'Specification Details': b.specification_details || '',
    }));
    exportToExcel(dataToExport, 'Batteries_Master', 'Batteries');
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
        capacity_kwh: parseFloat(readImportCell(row, 'Capacity (kWh)', 'capacity_kwh', 'capacity')),
        chemistry: normalizeBatteryChemistry(readImportCell(row, 'Chemistry', 'chemistry')),
        voltage_v: readImportCell(row, 'Voltage (V)', 'voltage_v') ? parseInt(readImportCell(row, 'Voltage (V)', 'voltage_v'), 10) : null,
        dod_pct: normalizeDodPct(readImportCell(row, 'DoD Percentage', 'dod_pct') || 80),
        rate: parseFloat(readImportCell(row, 'Selling Rate (INR)', 'rate') || 0),
        gst_pct: normalizeGstRate(readImportCell(row, 'GST Percentage', 'gst_pct'), getBatteryGstRate(row)),
        description: readImportCell(row, 'Description', 'description') || '',
        specification_details: readImportCell(row, 'Specification Details', 'specification_details', 'Specifications', 'specifications', 'Description', 'description') || '',
      })).filter((r) => r.brand && r.model && !isNaN(r.capacity_kwh) && !isNaN(r.rate));

      if (parsedRows.length === 0) {
        toast('No valid rows found in Excel sheet. Check column headers.', 'error');
        return;
      }

      const confirmed = await confirm({
        title: `Import ${parsedRows.length} Battery Specs?`,
        message: `This will insert ${parsedRows.length} Battery specification rows into masters database. Continue?`,
        confirmLabel: 'Import Now',
        cancelLabel: 'Cancel',
        type: 'warning',
      });

      if (!confirmed) return;

      let created = 0;
      let updated = 0;
      let skipped = 0;
      let failed = 0;

      for (const row of parsedRows) {
        try {
          const { __master_id, __source_global_id, ...payload } = row;
          const existing = findImportMatch(row);

          if (existing) {
            if (batteryRowChanged(existing, payload)) {
              await updateMutation.mutateAsync({ id: existing.id, updates: payload });
              updated += 1;
            } else {
              skipped += 1;
            }
          } else {
            await createMutation.mutateAsync(payload);
            created += 1;
          }
        } catch (rowError) {
          console.error('[batteries] import row failed', rowError);
          failed += 1;
        }
      }

      const message = `Import complete: ${created} created, ${updated} updated, ${skipped} skipped${failed ? `, ${failed} failed` : ''}.`;
      toast(message, failed ? 'error' : 'success');
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
              placeholder="Search brand, model, chemistry..."
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
            value={chemFilter}
            onChange={(val) => setChemFilter(val)}
            options={[
              { value: '', label: 'All Chemistry Types' },
              ...uniqueChems.map((c) => ({ value: c, label: c }))
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
            <Plus size={14} /> Add Battery
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
          <div className="p-12 text-center text-xs text-text-muted">Loading batteries...</div>
        ) : filteredBatteries.length === 0 ? (
          <div className="p-16 text-center text-xs text-text-muted italic">No batteries registered. Click Add or Import.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-10">
                  <button onClick={toggleSelectAll} className="text-text-muted hover:text-text-primary">
                    {selectedIds.length === filteredBatteries.length ? (
                      <CheckSquare size={16} className="text-accent" />
                    ) : (
                      <Square size={16} />
                    )}
                  </button>
                </th>
                <th>Brand</th>
                <th>Model</th>
                <th>Capacity (kWh)</th>
                <th>Chemistry</th>
                <th>Voltage (V)</th>
                <th>DoD (%)</th>
                <th>Selling Price</th>
                <th>GST Rate</th>
                <th>Scope</th>
                <th className="w-20 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBatteries.map((b) => {
                const isSelected = selectedIds.includes(b.id);
                return (
                  <tr key={b.id} className={isSelected ? 'bg-accent-glow/50' : ''}>
                    <td>
                      <button onClick={() => toggleSelectRow(b.id)} className="text-text-muted hover:text-text-primary">
                        {isSelected ? (
                          <CheckSquare size={16} className="text-accent" />
                        ) : (
                          <Square size={16} />
                        )}
                      </button>
                    </td>
                    <td className="font-semibold">{b.brand}</td>
                    <td className="text-text-secondary font-mono">{b.model}</td>
                    <td>{b.capacity_kwh} kWh</td>
                    <td>
                      <span className={`badge-base ${
                        b.chemistry === 'LFP' ? 'badge-on-grid' :
                        b.chemistry === 'Li-Ion' ? 'badge-micro-inverter' :
                        b.chemistry === 'NMC' ? 'badge-3-phase' :
                        b.chemistry === 'Lead-Acid' ? 'badge-upgrade' : 'badge-custom'
                      }`}>{b.chemistry}</span>
                    </td>
                    <td>{b.voltage_v ? `${b.voltage_v} V` : '—'}</td>
                    <td>{(b.dod_pct * 100).toFixed(0)}%</td>
                    <td className="font-mono font-semibold text-text-primary">{formatINR(b.rate)}</td>
                    <td>{(b.gst_pct * 100).toFixed(0)}%</td>
                    <td>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${b.org_id ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                        {b.org_id ? 'Org Overrides' : 'Global Baseline'}
                      </span>
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenEdit(b)}
                          className="p-1 rounded bg-surface border border-border text-text-secondary hover:text-accent hover:border-accent/30 cursor-pointer"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => handleDelete(b.id)}
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
                {editingItem ? 'Edit Battery Storage specifications' : 'Add New Battery storage'}
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
                    placeholder="e.g. Luminous, Tesla"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Model SKU *</label>
                  <input
                    type="text" required
                    value={draft.model}
                    onChange={(e) => setDraft({ ...draft, model: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-text-primary focus:border-accent/40 outline-none"
                    placeholder="e.g. Powerwall, LFP-5K"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Battery Capacity (kWh) *</label>
                  <input
                    type="number" required min={0.1} step={0.01}
                    value={draft.capacity_kwh}
                    onChange={(e) => setDraft({ ...draft, capacity_kwh: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-text-primary focus:border-accent/40 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Battery Chemistry *</label>
                  <Select
                    value={draft.chemistry}
                    onChange={(val) => {
                      const chemistry = val as Battery['chemistry'];
                      setDraft({
                        ...draft,
                        chemistry,
                        gst_pct: getBatteryGstRate({ ...draft, chemistry }),
                      });
                    }}
                    options={[
                      { value: 'LFP', label: 'LFP (Lithium Iron Phosphate)' },
                      { value: 'Li-Ion', label: 'Li-Ion (Lithium Ion)' },
                      { value: 'Lead-Acid', label: 'Lead-Acid' },
                      { value: 'NMC', label: 'NMC' }
                    ]}
                    className="w-full"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Voltage (V)</label>
                  <input
                    type="number" min={1} max={1000}
                    value={draft.voltage_v || ''}
                    onChange={(e) => setDraft({ ...draft, voltage_v: e.target.value ? parseInt(e.target.value, 10) : 48 })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-text-primary focus:border-accent/40 outline-none"
                    placeholder="e.g. 48, 51.2"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Depth of Discharge (DoD %) *</label>
                  <input
                    type="number" required min={0} max={100} step={1}
                    value={Math.round(Number(draft.dod_pct || 0) * 100)}
                    onChange={(e) => setDraft({ ...draft, dod_pct: normalizeDodPct(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-text-primary focus:border-accent/40 outline-none font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Base Selling Rate (INR) *</label>
                  <input
                    type="number" required min={0} step={100}
                    value={draft.rate}
                    onChange={(e) => setDraft({ ...draft, rate: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-text-primary focus:border-accent/40 outline-none font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">GST Percentage *</label>
                  <input
                    type="number" required min={0} step={0.01}
                    value={gstRateToPercent(draft.gst_pct, getBatteryGstRate(draft))}
                    onChange={(e) => setDraft({ ...draft, gst_pct: normalizeGstRate(e.target.value, getBatteryGstRate(draft)) })}
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
                  placeholder="Cycle life, DoD details, BMS protections, communication protocol, warranty terms..."
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
                  Save Battery Specs
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
        entityTable="eq_batteries"
        title="Batteries Storage Master"
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
