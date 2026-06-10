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
  Square
} from 'lucide-react';
import { useConfirm } from '@/components/ui/Confirm';
import { useToast } from '@/components/ui/Toast';
import { HistoryDrawer } from '@/components/master/HistoryDrawer';
import { BulkEditModal, type FieldSchema } from '@/components/master/BulkEditModal';
import { exportToExcel, importFromExcel } from '@/lib/utils/ImportExportHelper';
import { formatINR } from '@/lib/engine/calculator';

interface BomItem {
  id: string;
  org_id: string | null;
  section: 'solar_panels' | 'power_electronics' | 'metering' | 'mounting_structure' | 'electrical_protection' | 'earthing' | 'cabling' | 'wiring' | 'services';
  sub_type: string;
  description: string;
  remarks: string | null;
  unit: string;
  rate: number;
  gst_pct: number;
  is_active: boolean;
}

const SECTION_OPTIONS = [
  { value: 'solar_panels', label: 'Solar Panels' },
  { value: 'power_electronics', label: 'Power Electronics' },
  { value: 'metering', label: 'Metering' },
  { value: 'mounting_structure', label: 'Mounting Structure' },
  { value: 'electrical_protection', label: 'Electrical Protection' },
  { value: 'earthing', label: 'Earthing Systems' },
  { value: 'cabling', label: 'Cabling' },
  { value: 'wiring', label: 'Wiring Devices' },
  { value: 'services', label: 'Installation & Services' },
];

export default function AccessoriesMasterPage() {
  const { data: items, isLoading } = useMasterQuery<BomItem>('accessories');
  const createMutation = useMasterCreateMutation<BomItem>('accessories');
  const updateMutation = useMasterUpdateMutation<BomItem>('accessories');
  const deleteMutation = useMasterDeleteMutation('accessories');
  const bulkUpdateMutation = useMasterBulkUpdateMutation('accessories');

  const confirm = useConfirm();
  const { toast } = useToast();

  // State controls
  const [search, setSearch] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  const [historyOpen, setHistoryOpen] = useState(false);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BomItem | null>(null);

  // Accessories draft state
  const [draft, setDraft] = useState({
    section: 'electrical_protection' as any,
    sub_type: '',
    description: '',
    remarks: '',
    unit: 'Nos',
    rate: 1500,
    gst_pct: 0.18,
  });

  // Bulk Edit Schema
  const bulkEditFields: FieldSchema[] = [
    { name: 'section', label: 'BOM Section', type: 'select', options: SECTION_OPTIONS },
    { name: 'unit', label: 'Standard Unit', type: 'select', options: [
      { value: 'Nos', label: 'Nos / Units' },
      { value: 'Mtr', label: 'Meters' },
      { value: 'kg', label: 'Kilograms' },
      { value: 'Set', label: 'Sets' },
      { value: 'Lump', label: 'Lump Sum' }
    ]},
    { name: 'rate', label: 'Cost Rate (₹)', type: 'number' },
    { name: 'gst_pct', label: 'GST Slabs', type: 'select', options: [
      { value: 0.18, label: '18% Standard' },
      { value: 0.12, label: '12% Special' },
      { value: 0.05, label: '5% Solar Panel slab' }
    ]},
  ];

  // ─── Filter & Search Logic ──────────────────────────────────────────────────
  
  const filteredItems = useMemo(() => {
    if (!items) return [];
    return items.filter((i) => {
      const matchSearch =
        i.description.toLowerCase().includes(search.toLowerCase()) ||
        i.sub_type.toLowerCase().includes(search.toLowerCase()) ||
        (i.remarks || '').toLowerCase().includes(search.toLowerCase());
      
      const matchSection = sectionFilter ? i.section === sectionFilter : true;

      return matchSearch && matchSection;
    });
  }, [items, search, sectionFilter]);

  // ─── Selection Logic ────────────────────────────────────────────────────────

  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredItems.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredItems.map((i) => i.id));
    }
  };

  // ─── CRUD Handlers ──────────────────────────────────────────────────────────

  const handleOpenAdd = () => {
    setEditingItem(null);
    setDraft({
      section: 'electrical_protection',
      sub_type: '',
      description: '',
      remarks: '',
      unit: 'Nos',
      rate: 1500,
      gst_pct: 0.18,
    });
    setEditorOpen(true);
  };

  const handleOpenEdit = (item: BomItem) => {
    setEditingItem(item);
    setDraft({
      section: item.section,
      sub_type: item.sub_type,
      description: item.description,
      remarks: item.remarks || '',
      unit: item.unit,
      rate: item.rate,
      gst_pct: item.gst_pct,
    });
    setEditorOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingItem) {
        await updateMutation.mutateAsync({ id: editingItem.id, updates: draft });
        toast('BOM accessory updated ✓', 'success');
      } else {
        await createMutation.mutateAsync(draft);
        toast('New BOM accessory added ✓', 'success');
      }
      setEditorOpen(false);
    } catch (err: any) {
      toast(err.message || 'Operation failed', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirm({
      title: 'Remove Accessory?',
      message: 'Are you sure you want to delete this accessory / BOM item from the catalog?',
      confirmLabel: 'Delete Item',
      cancelLabel: 'Cancel',
      type: 'danger',
    });
    if (!confirmed) return;
    try {
      await deleteMutation.mutateAsync(id);
      setSelectedIds((prev) => prev.filter((item) => item !== id));
      toast('Accessory catalog item deleted', 'success');
    } catch (err: any) {
      toast(err.message || 'Failed to delete accessory', 'error');
    }
  };

  const handleBulkEditSave = async (updates: Record<string, any>) => {
    try {
      await bulkUpdateMutation.mutateAsync({ ids: selectedIds, updates });
      setSelectedIds([]);
      toast(`Bulk updated ${selectedIds.length} accessory items`, 'success');
    } catch (err: any) {
      toast(err.message || 'Bulk edit failed', 'error');
    }
  };

  // ─── Import / Export ────────────────────────────────────────────────────────

  const handleExport = () => {
    const dataToExport = filteredItems.map((i) => ({
      Section: i.section,
      'Sub Type': i.sub_type,
      Description: i.description,
      Remarks: i.remarks || '',
      Unit: i.unit,
      'Selling Rate (INR)': i.rate,
      'GST Percentage': i.gst_pct,
    }));
    exportToExcel(dataToExport, 'Accessories_Master', 'Accessories');
    toast('Master list exported to Excel', 'success');
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const rawData = await importFromExcel(file);
      
      const parsedRows = rawData.map((row: any) => ({
        section: row.Section || row.section || 'electrical_protection',
        sub_type: row['Sub Type'] || row.sub_type || 'ACCESSORY',
        description: row.Description || row.description,
        remarks: row.Remarks || row.remarks || '',
        unit: row.Unit || row.unit || 'Nos',
        rate: parseFloat(row['Selling Rate (INR)'] || row.rate || 0),
        gst_pct: parseFloat(row['GST Percentage'] || row.gst_pct || 0.18),
      })).filter((r) => r.description && !isNaN(r.rate));

      if (parsedRows.length === 0) {
        toast('No valid rows found in Excel sheet. Check column headers.', 'error');
        return;
      }

      const confirmed = await confirm({
        title: `Import ${parsedRows.length} Accessories?`,
        message: `This will insert ${parsedRows.length} accessory spec rows into database. Continue?`,
        confirmLabel: 'Import Now',
        cancelLabel: 'Cancel',
        type: 'warning',
      });

      if (!confirmed) return;

      for (const row of parsedRows) {
        await createMutation.mutateAsync(row);
      }

      toast(`Successfully imported ${parsedRows.length} accessories`, 'success');
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
              placeholder="Search sub type, description, specs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-surface border border-border text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-accent/40"
            />
          </div>

          <select
            value={sectionFilter}
            onChange={(e) => setSectionFilter(e.target.value)}
            className="px-3 py-2 rounded-lg bg-surface border border-border text-xs text-text-secondary outline-none cursor-pointer hover:bg-surface-hover capitalize"
          >
            <option value="">All BOM Sections</option>
            {SECTION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Actions */}
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
            <Plus size={14} /> Add Accessory
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
          <div className="p-12 text-center text-xs text-text-muted">Loading accessories catalog...</div>
        ) : filteredItems.length === 0 ? (
          <div className="p-16 text-center text-xs text-text-muted italic">No accessories registered in catalog database.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-10">
                  <button onClick={toggleSelectAll} className="text-text-muted hover:text-text-primary">
                    {selectedIds.length === filteredItems.length ? (
                      <CheckSquare size={16} className="text-accent" />
                    ) : (
                      <Square size={16} />
                    )}
                  </button>
                </th>
                <th>BOM Section</th>
                <th>Sub-Type</th>
                <th>Description</th>
                <th>Specification Remarks</th>
                <th>Billing Unit</th>
                <th>Cost Rate</th>
                <th>GST Rate</th>
                <th>Scope</th>
                <th className="w-20 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => {
                const isSelected = selectedIds.includes(item.id);
                return (
                  <tr key={item.id} className={isSelected ? 'bg-accent-glow/50' : ''}>
                    <td>
                      <button onClick={() => toggleSelectRow(item.id)} className="text-text-muted hover:text-text-primary">
                        {isSelected ? (
                          <CheckSquare size={16} className="text-accent" />
                        ) : (
                          <Square size={16} />
                        )}
                      </button>
                    </td>
                    <td className="capitalize font-semibold text-text-secondary">
                      {item.section.replace(/_/g, ' ')}
                    </td>
                    <td className="font-mono text-xs">{item.sub_type}</td>
                    <td className="font-semibold text-text-primary">{item.description}</td>
                    <td className="text-text-muted italic text-xs">{item.remarks || '—'}</td>
                    <td>{item.unit}</td>
                    <td className="font-mono font-semibold text-text-primary">{formatINR(item.rate)}</td>
                    <td>{(item.gst_pct * 100).toFixed(0)}%</td>
                    <td>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${item.org_id ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                        {item.org_id ? 'Org' : 'Global'}
                      </span>
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenEdit(item)}
                          className="p-1 rounded bg-surface border border-border text-text-secondary hover:text-accent hover:border-accent/30 cursor-pointer"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
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
                {editingItem ? 'Edit BOM Item Accessory' : 'Add New BOM Accessory'}
              </h3>
              <button onClick={() => setEditorOpen(false)} className="text-text-muted hover:text-text-primary">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">BOM Section *</label>
                  <select
                    value={draft.section}
                    onChange={(e) => setDraft({ ...draft, section: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-text-primary focus:border-accent/40 outline-none"
                  >
                    {SECTION_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Sub Type Identifier *</label>
                  <input
                    type="text" required
                    value={draft.sub_type}
                    onChange={(e) => setDraft({ ...draft, sub_type: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-text-primary focus:border-accent/40 outline-none font-mono"
                    placeholder="e.g. ACDB, GI_STRIP"
                  />
                </div>
                <div className="space-y-1 col-span-2">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Description Label *</label>
                  <input
                    type="text" required
                    value={draft.description}
                    onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-text-primary focus:border-accent/40 outline-none"
                    placeholder="e.g. 4sqmm AC Cable (Polycab)"
                  />
                </div>
                <div className="space-y-1 col-span-2">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Technical Specifications Remarks</label>
                  <input
                    type="text"
                    value={draft.remarks}
                    onChange={(e) => setDraft({ ...draft, remarks: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-text-primary focus:border-accent/40 outline-none"
                    placeholder="e.g. 10SWG copper wire, 1kg compound rod"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Standard billing Unit *</label>
                  <select
                    value={draft.unit}
                    onChange={(e) => setDraft({ ...draft, unit: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-text-primary focus:border-accent/40 outline-none"
                  >
                    <option value="Nos">Nos</option>
                    <option value="Mtr">Mtr (Meters)</option>
                    <option value="kg">kg (Kilograms)</option>
                    <option value="Set">Set</option>
                    <option value="Lump">Lump Sum</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Base Cost Rate (INR) *</label>
                  <input
                    type="number" required min={0} step={0.01}
                    value={draft.rate}
                    onChange={(e) => setDraft({ ...draft, rate: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-text-primary focus:border-accent/40 outline-none font-mono"
                  />
                </div>
                <div className="space-y-1 col-span-2">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Standard GST Slabs *</label>
                  <select
                    value={draft.gst_pct}
                    onChange={(e) => setDraft({ ...draft, gst_pct: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-text-primary focus:border-accent/40 outline-none"
                  >
                    <option value={0.18}>18% GST (Cables, Protection, Earthing)</option>
                    <option value={0.12}>12% GST (Alternative slabs)</option>
                    <option value={0.05}>5% GST (Solar panels standard)</option>
                  </select>
                </div>
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
                  Save Accessory
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
        entityTable="eq_bom_items"
        title="Accessories Catalog"
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
