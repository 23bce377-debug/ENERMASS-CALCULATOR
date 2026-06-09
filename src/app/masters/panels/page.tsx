'use client';

import { useState, useMemo } from 'react';
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
  Square,
  FileSpreadsheet
} from 'lucide-react';
import { useConfirm } from '@/components/ui/Confirm';
import { useToast } from '@/components/ui/Toast';
import { HistoryDrawer } from '@/components/masters/HistoryDrawer';
import { BulkEditModal, type FieldSchema } from '@/components/masters/BulkEditModal';
import { exportToExcel, importFromExcel } from '@/lib/utils/ImportExportHelper';
import { formatINR } from '@/lib/engine/calculator';

interface Panel {
  id: string;
  brand: string;
  model: string;
  wattage_w: number;
  panel_type: string;
  rate_per_watt: number;
  gst_pct: number;
  description: string | null;
  org_id: string | null;
}

export default function PanelsMasterPage() {
  const { data: panels, isLoading } = useMasterQuery<Panel>('panels');
  const createMutation = useMasterCreateMutation<Panel>('panels');
  const updateMutation = useMasterUpdateMutation<Panel>('panels');
  const deleteMutation = useMasterDeleteMutation('panels');
  const bulkUpdateMutation = useMasterBulkUpdateMutation('panels');

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
  const [editingItem, setEditingItem] = useState<Panel | null>(null);
  
  // Panel Draft values
  const [draft, setDraft] = useState({
    brand: '',
    model: '',
    wattage_w: 550,
    panel_type: 'Mono PERC',
    rate_per_watt: 22,
    gst_pct: 0.05,
    description: '',
  });

  // Table Configuration for Bulk Edit
  const bulkEditFields: FieldSchema[] = [
    { name: 'brand', label: 'PV Brand', type: 'text' },
    { name: 'panel_type', label: 'Cell Technology', type: 'select', options: [
      { value: 'Mono PERC', label: 'Mono PERC' },
      { value: 'TOPCon', label: 'TOPCon' },
      { value: 'HJT', label: 'HJT' }
    ]},
    { name: 'rate_per_watt', label: 'Selling Rate (₹/W)', type: 'number' },
    { name: 'gst_pct', label: 'GST Percentage', type: 'select', options: [
      { value: 0.05, label: '5%' },
      { value: 0.12, label: '12%' },
      { value: 0.18, label: '18%' }
    ]},
  ];

  // ─── Filter & Search Logic ──────────────────────────────────────────────────
  
  const uniqueBrands = useMemo(() => {
    if (!panels) return [];
    return Array.from(new Set(panels.map((p) => p.brand).filter(Boolean)));
  }, [panels]);

  const uniqueTypes = useMemo(() => {
    if (!panels) return [];
    return Array.from(new Set(panels.map((p) => p.panel_type).filter(Boolean)));
  }, [panels]);

  const filteredPanels = useMemo(() => {
    if (!panels) return [];
    return panels.filter((p) => {
      const matchSearch =
        p.brand.toLowerCase().includes(search.toLowerCase()) ||
        p.model.toLowerCase().includes(search.toLowerCase()) ||
        (p.description || '').toLowerCase().includes(search.toLowerCase());
      
      const matchType = typeFilter ? p.panel_type === typeFilter : true;
      const matchBrand = brandFilter ? p.brand === brandFilter : true;

      return matchSearch && matchType && matchBrand;
    });
  }, [panels, search, typeFilter, brandFilter]);

  // ─── Selection Logic ────────────────────────────────────────────────────────

  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredPanels.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredPanels.map((p) => p.id));
    }
  };

  // ─── Actions handlers ────────────────────────────────────────────────────────

  const handleOpenAdd = () => {
    setEditingItem(null);
    setDraft({
      brand: '',
      model: '',
      wattage_w: 550,
      panel_type: 'Mono PERC',
      rate_per_watt: 22,
      gst_pct: 0.05,
      description: '',
    });
    setEditorOpen(true);
  };

  const handleOpenEdit = (panel: Panel) => {
    setEditingItem(panel);
    setDraft({
      brand: panel.brand,
      model: panel.model,
      wattage_w: panel.wattage_w,
      panel_type: panel.panel_type,
      rate_per_watt: panel.rate_per_watt,
      gst_pct: panel.gst_pct,
      description: panel.description || '',
    });
    setEditorOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingItem) {
        await updateMutation.mutateAsync({ id: editingItem.id, updates: draft });
        toast('Panel PV specification updated ✓', 'success');
      } else {
        await createMutation.mutateAsync(draft);
        toast('New panel PV spec added ✓', 'success');
      }
      setEditorOpen(false);
    } catch (err: any) {
      toast(err.message || 'Operation failed', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirm({
      title: 'Remove PanelPV Spec?',
      message: 'Are you sure you want to delete this panel from the active master directory?',
      confirmLabel: 'Delete Panel',
      cancelLabel: 'Cancel',
      type: 'danger',
    });
    if (!confirmed) return;
    try {
      await deleteMutation.mutateAsync(id);
      setSelectedIds((prev) => prev.filter((item) => item !== id));
      toast('Panel specification deleted', 'success');
    } catch (err: any) {
      toast(err.message || 'Failed to delete panel', 'error');
    }
  };

  const handleBulkEditSave = async (updates: Record<string, any>) => {
    try {
      await bulkUpdateMutation.mutateAsync({ ids: selectedIds, updates });
      setSelectedIds([]);
      toast(`Bulk updated ${selectedIds.length} rows successfully`, 'success');
    } catch (err: any) {
      toast(err.message || 'Bulk edit failed', 'error');
    }
  };

  // ─── Import / Export ────────────────────────────────────────────────────────

  const handleExport = () => {
    const dataToExport = filteredPanels.map((p) => ({
      Brand: p.brand,
      Model: p.model,
      'Wattage (W)': p.wattage_w,
      'Panel Type': p.panel_type,
      'Rate per Watt (INR)': p.rate_per_watt,
      'GST Percentage': p.gst_pct,
      Description: p.description || '',
    }));
    exportToExcel(dataToExport, 'PV_Panels_Master', 'Panels');
    toast('Master list exported to Excel', 'success');
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const rawData = await importFromExcel(file);
      
      // Validation & Insert Mapper
      const parsedRows = rawData.map((row: any) => ({
        brand: row.Brand || row.brand,
        model: row.Model || row.model,
        wattage_w: parseInt(row['Wattage (W)'] || row.wattage_w || row.wattage, 10),
        panel_type: row['Panel Type'] || row.panel_type || 'Mono PERC',
        rate_per_watt: parseFloat(row['Rate per Watt (INR)'] || row.rate_per_watt || row.rate),
        gst_pct: parseFloat(row['GST Percentage'] || row.gst_pct || 0.05),
        description: row.Description || row.description || '',
      })).filter((r) => r.brand && r.model && !isNaN(r.wattage_w) && !isNaN(r.rate_per_watt));

      if (parsedRows.length === 0) {
        toast('No valid rows found in Excel sheet. Check column headers.', 'error');
        return;
      }

      const confirmed = await confirm({
        title: `Import ${parsedRows.length} Panels?`,
        message: `This will insert ${parsedRows.length} PV panels spec rows into your masters database. Continue?`,
        confirmLabel: 'Import Now',
        cancelLabel: 'Cancel',
        type: 'warning',
      });

      if (!confirmed) return;

      // Programmatic batch upload
      for (const row of parsedRows) {
        await createMutation.mutateAsync(row);
      }

      toast(`Successfully imported ${parsedRows.length} panels`, 'success');
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
              placeholder="Search brand, model, specs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-surface border border-border text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-accent/40"
            />
          </div>

          <select
            value={brandFilter}
            onChange={(e) => setBrandFilter(e.target.value)}
            className="px-3 py-2 rounded-lg bg-surface border border-border text-xs text-text-secondary outline-none cursor-pointer hover:bg-surface-hover"
          >
            <option value="">All Brands</option>
            {uniqueBrands.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 rounded-lg bg-surface border border-border text-xs text-text-secondary outline-none cursor-pointer hover:bg-surface-hover"
          >
            <option value="">All Cell Techs</option>
            {uniqueTypes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
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
            <Plus size={14} /> Add Panel Spec
          </button>

          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface border border-border text-xs text-text-secondary hover:text-text-primary hover:border-border-light transition-all cursor-pointer"
            title="Export to Excel"
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
            title="View History Logs"
          >
            <History size={15} />
          </button>
        </div>
      </div>

      {/* Database Table */}
      <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-md">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-text-muted">Loading PV panel catalog...</div>
        ) : filteredPanels.length === 0 ? (
          <div className="p-16 text-center text-xs text-text-muted italic">No panels registered in database. Create one or upload Excel above.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-10">
                  <button onClick={toggleSelectAll} className="text-text-muted hover:text-text-primary">
                    {selectedIds.length === filteredPanels.length ? (
                      <CheckSquare size={16} className="text-accent" />
                    ) : (
                      <Square size={16} />
                    )}
                  </button>
                </th>
                <th>Brand</th>
                <th>Model</th>
                <th>Wattage (W)</th>
                <th>Cell Tech</th>
                <th>Selling Rate</th>
                <th>GST Rate</th>
                <th>Tenant Scope</th>
                <th className="w-20 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPanels.map((p) => {
                const isSelected = selectedIds.includes(p.id);
                return (
                  <tr key={p.id} className={isSelected ? 'bg-accent-glow/50' : ''}>
                    <td>
                      <button onClick={() => toggleSelectRow(p.id)} className="text-text-muted hover:text-text-primary">
                        {isSelected ? (
                          <CheckSquare size={16} className="text-accent" />
                        ) : (
                          <Square size={16} />
                        )}
                      </button>
                    </td>
                    <td className="font-semibold">{p.brand}</td>
                    <td className="text-text-secondary font-mono">{p.model}</td>
                    <td>{p.wattage_w} W</td>
                    <td>
                      <span className={`badge-base ${
                        p.panel_type === 'Mono PERC' ? 'badge-on-grid' :
                        p.panel_type === 'TOPCon' ? 'badge-3-phase' :
                        p.panel_type === 'HJT' ? 'badge-custom' : 'badge-upgrade'
                      }`}>{p.panel_type}</span>
                    </td>
                    <td className="font-mono font-semibold text-text-primary">
                      {formatINR(p.rate_per_watt * p.wattage_w)}
                      <span className="text-[10px] text-text-muted block mt-0.5">({p.rate_per_watt.toFixed(2)}/W)</span>
                    </td>
                    <td>{(p.gst_pct * 100).toFixed(0)}%</td>
                    <td>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${p.org_id ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                        {p.org_id ? 'Org Overrides' : 'Global Baseline'}
                      </span>
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenEdit(p)}
                          className="p-1 rounded bg-surface border border-border text-text-secondary hover:text-accent hover:border-accent/30 cursor-pointer"
                          title="Edit Row"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="p-1 rounded bg-surface border border-border text-text-secondary hover:text-error hover:border-error/30 cursor-pointer"
                          title="Delete Row"
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
                {editingItem ? 'Edit PV Panel Specification' : 'Add New Solar PV Panel'}
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
                    placeholder="e.g. Waaree, Adani"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Model SKU *</label>
                  <input
                    type="text" required
                    value={draft.model}
                    onChange={(e) => setDraft({ ...draft, model: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-text-primary focus:border-accent/40 outline-none"
                    placeholder="e.g. BIPL550, NEOMAX"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">PV Capacity Rating (Watts) *</label>
                  <input
                    type="number" required min={50} max={1000}
                    value={draft.wattage_w}
                    onChange={(e) => setDraft({ ...draft, wattage_w: parseInt(e.target.value, 10) })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-text-primary focus:border-accent/40 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Cell Technology *</label>
                  <select
                    value={draft.panel_type}
                    onChange={(e) => setDraft({ ...draft, panel_type: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-text-primary focus:border-accent/40 outline-none"
                  >
                    <option value="Mono PERC">Mono PERC</option>
                    <option value="TOPCon">TOPCon</option>
                    <option value="HJT">HJT</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Base Cost Rate (INR / Watt) *</label>
                  <input
                    type="number" required min={0} step={0.01}
                    value={draft.rate_per_watt}
                    onChange={(e) => setDraft({ ...draft, rate_per_watt: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-text-primary focus:border-accent/40 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Standard GST Slabs *</label>
                  <select
                    value={draft.gst_pct}
                    onChange={(e) => setDraft({ ...draft, gst_pct: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-text-primary focus:border-accent/40 outline-none"
                  >
                    <option value={0.05}>5% GST</option>
                    <option value={0.12}>12% GST</option>
                    <option value={0.18}>18% GST</option>
                  </select>
                </div>
              </div>
              
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Product Remarks / Details</label>
                <textarea
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-text-primary focus:border-accent/40 outline-none resize-none"
                  placeholder="Module features, certifications, weight details..."
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
                  Save PV Spec
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
        entityTable="eq_panels"
        title="Solar Panels Directory"
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
