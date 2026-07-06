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
import { Select } from '@/components/ui/Select';
import { gstRateToPercent, normalizeGstRate } from '@/lib/utils/gst';
import { TOP_CATEGORY_LABELS, type PresetTopCategory } from '@/lib/presetTaxonomy';

interface BomItem {
  id: string;
  source_global_id?: string | null;
  org_id: string | null;
  category_id: string;
  sku_code: string;
  description: string;
  specification_details: string | null;
  notes: string | null;
  unit: string;
  default_rate: number;
  gst_pct: number | null;
  civil_required_only: boolean;
  is_survey_dependent: boolean;
}

export default function AccessoriesMasterPage() {
  const { data: items, isLoading } = useMasterQuery<BomItem>('accessories');
  const { data: categories } = useMasterQuery<{id: string, name: string, top_category?: string | null, subcategory_name?: string | null}>('bom_categories');
  const createMutation = useMasterCreateMutation<BomItem>('accessories');
  const updateMutation = useMasterUpdateMutation<BomItem>('accessories');
  const deleteMutation = useMasterDeleteMutation('accessories');
  const bulkUpdateMutation = useMasterBulkUpdateMutation('accessories');
  const createCategoryMutation = useMasterCreateMutation('bom_categories');

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
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryTop, setNewCategoryTop] = useState<PresetTopCategory>('bom_item');

  // Accessories draft state
  const [draft, setDraft] = useState({
    category_id: 'electrical_protection' as any,
    sku_code: '',
    description: '',
    specification_details: '',
    notes: '',
    unit: 'Nos',
    default_rate: 1500,
    gst_pct: 0.18,
    is_survey_dependent: false,
    civil_required_only: false,
  });

  const sectionOptions = useMemo(() => {
    return (categories || []).map(c => ({
      value: c.id,
      label: c.subcategory_name || c.name,
    }));
  }, [categories]);

  // Bulk Edit Schema
  const bulkEditFields: FieldSchema[] = useMemo(() => [
    { name: 'category_id', label: 'BOM Category', type: 'select', options: sectionOptions },
    { name: 'unit', label: 'Standard Unit', type: 'select', options: [
      { value: 'Nos', label: 'Nos / Units' },
      { value: 'Mtr', label: 'Meters' },
      { value: 'kg', label: 'Kilograms' },
      { value: 'Set', label: 'Sets' },
      { value: 'Lump', label: 'Lump Sum' }
    ]},
    { name: 'default_rate', label: 'Cost Rate (₹)', type: 'number' },
    { name: 'gst_pct', label: 'GST Percentage', type: 'number' },
    { name: 'is_survey_dependent', label: 'Survey Dependent', type: 'select', options: [
      { value: 'true', label: 'Yes' },
      { value: 'false', label: 'No' }
    ]},
  ], [sectionOptions]);

  const readImportCell = (row: any, ...keys: string[]) => {
    for (const key of keys) {
      if (row[key] !== undefined && row[key] !== null && row[key] !== '') return row[key];
      const normalizedKey = Object.keys(row).find((candidate) => candidate.trim().toLowerCase() === key.trim().toLowerCase());
      if (normalizedKey && row[normalizedKey] !== undefined && row[normalizedKey] !== null && row[normalizedKey] !== '') {
        return row[normalizedKey];
      }
    }
    return '';
  };

  const sameText = (a: unknown, b: unknown) =>
    String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();

  const sameNumber = (a: unknown, b: unknown, precision = 4) => {
    const left = Number(a);
    const right = Number(b);
    if (!Number.isFinite(left) && !Number.isFinite(right)) return true;
    return Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) < Math.pow(10, -precision);
  };

  const isUuid = (value: unknown) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value ?? '').trim());

  const normalizeImportCategory = (value: unknown) =>
    String(value ?? '').trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');

  const resolveImportedCategoryId = (rawCategory: unknown) => {
    const rawValue = String(rawCategory ?? '').trim();
    const fallback = categories?.[0]?.id ?? 'electrical_protection';
    if (!rawValue) return fallback;
    if (isUuid(rawValue)) return rawValue;

    const normalized = normalizeImportCategory(rawValue);
    const match = categories?.find((category) => {
      const candidates = [
        category.id,
        category.name,
        category.subcategory_name,
        category.top_category,
      ];
      return candidates.some((candidate) => normalizeImportCategory(candidate) === normalized);
    });
    return match?.id ?? fallback;
  };

  const findImportMatch = (row: any) => {
    const ids = [row.__master_id, row.__source_global_id].filter(Boolean).map(String);
    const idMatch = items?.find((item) => ids.includes(item.id) || (item.source_global_id ? ids.includes(item.source_global_id) : false));
    if (idMatch) return idMatch;

    return items?.find((item) => sameText(item.sku_code, row.sku_code));
  };

  const accessoryRowChanged = (existing: BomItem, row: any) =>
    !sameText(existing.category_id, row.category_id) ||
    !sameText(existing.sku_code, row.sku_code) ||
    !sameText(existing.description, row.description) ||
    !sameText(existing.specification_details, row.specification_details) ||
    !sameText(existing.notes, row.notes) ||
    !sameText(existing.unit, row.unit) ||
    !sameNumber(existing.default_rate, row.default_rate, 2) ||
    !sameNumber(normalizeGstRate(existing.gst_pct, 0.18), row.gst_pct, 5);

  // ─── Filter & Search Logic ──────────────────────────────────────────────────
  
  const filteredItems = useMemo(() => {
    if (!items) return [];
    return items.filter((i) => {
      const matchSearch =
        (i.description || '').toLowerCase().includes(search.toLowerCase()) ||
        (i.sku_code || '').toLowerCase().includes(search.toLowerCase()) ||
        (i.notes || '').toLowerCase().includes(search.toLowerCase());
      
      const matchSection = sectionFilter ? i.category_id === sectionFilter : true;

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
      category_id: sectionOptions.length > 0 ? sectionOptions[0].value : '' as any,
      sku_code: '',
      description: '',
      specification_details: '',
      notes: '',
      unit: 'Nos',
      default_rate: 1500,
      gst_pct: 0.18,
      is_survey_dependent: false,
      civil_required_only: false,
    });
    setEditorOpen(true);
  };

  const handleOpenEdit = (item: BomItem) => {
    setEditingItem(item);
    setDraft({
      category_id: item.category_id,
      sku_code: item.sku_code,
      description: item.description,
      specification_details: item.specification_details || item.notes || '',
      notes: item.notes || '',
      unit: item.unit,
      default_rate: item.default_rate,
      gst_pct: normalizeGstRate(item.gst_pct, 0.18),
      is_survey_dependent: item.is_survey_dependent,
      civil_required_only: item.civil_required_only,
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

  const handleCreateCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) {
      toast('Enter a category or subcategory name first.', 'error');
      return;
    }
    try {
      const created: any = await createCategoryMutation.mutateAsync({
        name,
        top_category: newCategoryTop,
        subcategory_name: name,
        display_order: (categories?.length ?? 0) + 1,
        is_optional: true,
      });
      setDraft((current) => ({ ...current, category_id: created?.id ?? current.category_id }));
      setNewCategoryName('');
      toast('BOM category added', 'success');
    } catch (err: any) {
      toast(err.message || 'Failed to create BOM category', 'error');
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
      await bulkUpdateMutation.mutateAsync({
        ids: selectedIds,
        updates: updates.gst_pct !== undefined
          ? { ...updates, gst_pct: normalizeGstRate(updates.gst_pct, 0.18) }
          : updates,
      });
      setSelectedIds([]);
      toast(`Bulk updated ${selectedIds.length} accessory items`, 'success');
    } catch (err: any) {
      toast(err.message || 'Bulk edit failed', 'error');
    }
  };

  // ─── Import / Export ────────────────────────────────────────────────────────

  const handleExport = () => {
    const dataToExport = filteredItems.map((i) => ({
      'Master ID': i.id,
      'Source Global ID': i.source_global_id || '',
      Scope: i.org_id ? 'Org Override' : 'Global Baseline',
      Category: i.category_id,
      'SKU Code': i.sku_code,
      Description: i.description,
      'Specification Details': i.specification_details || i.notes || '',
      Notes: i.notes || '',
      Unit: i.unit,
      'Selling Rate (INR)': i.default_rate,
      'GST Percentage': gstRateToPercent(i.gst_pct, 0.18),
    }));
    exportToExcel(dataToExport, 'Accessories_Master', 'Accessories');
    toast('Master list exported to Excel', 'success');
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const rawData = await importFromExcel(file);
      
      const parsedRows = rawData.map((row: any) => {
        const importedCategory = readImportCell(row, 'Category', 'category_id', 'Section', 'section');
        return {
          __master_id: readImportCell(row, 'Master ID', 'master_id', 'id'),
          __source_global_id: readImportCell(row, 'Source Global ID', 'source_global_id'),
          category_id: resolveImportedCategoryId(importedCategory),
          sku_code: readImportCell(row, 'SKU Code', 'sku_code', 'Sub Type', 'sub_type') || 'ACCESSORY',
          description: readImportCell(row, 'Description', 'description'),
          specification_details: readImportCell(row, 'Specification Details', 'specification_details', 'Specifications', 'specifications', 'Notes', 'notes', 'Remarks', 'remarks') || '',
          notes: readImportCell(row, 'Notes', 'notes', 'Remarks', 'remarks') || '',
          unit: readImportCell(row, 'Unit', 'unit') || 'Nos',
          default_rate: parseFloat(readImportCell(row, 'Selling Rate (INR)', 'default_rate', 'rate') || 0),
          gst_pct: normalizeGstRate(readImportCell(row, 'GST Percentage', 'gst_pct'), 0.18),
          is_survey_dependent: false,
          civil_required_only: false,
        };
      }).filter((r) => r.description && !isNaN(r.default_rate));

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

      let created = 0;
      let updated = 0;
      let skipped = 0;

      for (const row of parsedRows) {
        const { __master_id, __source_global_id, ...payload } = row;
        const existing = findImportMatch(row);

        if (existing) {
          if (accessoryRowChanged(existing, payload)) {
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
              placeholder="Search sub type, description, specs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-surface border border-border text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-accent/40"
            />
          </div>

          <Select
            value={sectionFilter || 'all'}
            onChange={(val) => setSectionFilter(val === 'all' ? '' : val)}
            options={[
              { value: 'all', label: 'All BOM Sections' },
              ...sectionOptions
            ]}
            className="w-48 text-xs text-text-secondary"
          />
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
                      {(() => {
                        const category = categories?.find(c => c.id === item.category_id);
                        return category?.subcategory_name || category?.name || item.category_id.replace(/_/g, ' ');
                      })()}
                    </td>
                    <td className="font-mono text-xs">{item.sku_code}</td>
                    <td className="font-semibold text-text-primary">{item.description}</td>
                    <td className="text-text-muted italic text-xs">{item.specification_details || item.notes || '—'}</td>
                    <td>{item.unit}</td>
                    <td className="font-mono font-semibold text-text-primary">{formatINR(item.default_rate)}</td>
                    <td>{gstRateToPercent(item.gst_pct, 0.18).toFixed(2).replace(/\.00$/, '')}%</td>
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
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">BOM Category *</label>
                  <Select
                    value={draft.category_id}
                    onChange={(val) => setDraft({ ...draft, category_id: val as any })}
                    options={sectionOptions}
                    className="w-full"
                  />
                  <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
                    <input
                      type="text"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      className="min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-xs text-text-primary outline-none focus:border-accent/40"
                      placeholder="New subcategory"
                    />
                    <button
                      type="button"
                      onClick={handleCreateCategory}
                      className="rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-xs font-bold text-accent hover:bg-accent/20"
                    >
                      Add
                    </button>
                  </div>
                  <Select
                    value={newCategoryTop}
                    onChange={(val) => setNewCategoryTop(val as PresetTopCategory)}
                    options={(Object.keys(TOP_CATEGORY_LABELS) as PresetTopCategory[]).map((top) => ({
                      value: top,
                      label: TOP_CATEGORY_LABELS[top],
                    }))}
                    className="mt-2 w-full"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">SKU Code *</label>
                  <input
                    type="text" required
                    value={draft.sku_code}
                    onChange={(e) => setDraft({ ...draft, sku_code: e.target.value.toUpperCase() })}
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
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Quote Specification Details</label>
                  <textarea
                    value={draft.specification_details}
                    onChange={(e) => setDraft({ ...draft, specification_details: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-text-primary focus:border-accent/40 outline-none resize-none"
                    placeholder="Certifications, IP rating, conductor size, insulation, standards, warranty..."
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Standard billing Unit *</label>
                  <Select
                    value={draft.unit}
                    onChange={(val) => setDraft({ ...draft, unit: val })}
                    options={[
                      { value: 'Nos', label: 'Nos' },
                      { value: 'Mtr', label: 'Mtr (Meters)' },
                      { value: 'kg', label: 'kg (Kilograms)' },
                      { value: 'Set', label: 'Set' },
                      { value: 'Lump', label: 'Lump Sum' }
                    ]}
                    className="w-full"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Base Cost Rate (INR) *</label>
                  <input
                    type="number" required min={0} step={0.01}
                    value={draft.default_rate}
                    onChange={(e) => setDraft({ ...draft, default_rate: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-text-primary focus:border-accent/40 outline-none font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">GST Percentage *</label>
                  <input
                    type="number" required min={0} step={0.01}
                    value={gstRateToPercent(draft.gst_pct, 0.18)}
                    onChange={(e) => setDraft({ ...draft, gst_pct: normalizeGstRate(e.target.value, 0.18) })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-text-primary focus:border-accent/40 outline-none font-mono"
                    placeholder="18"
                  />
                </div>
                <div className="space-y-1 col-span-2">
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-xs font-semibold text-text-primary">
                      <input
                        type="checkbox"
                        checked={draft.is_survey_dependent}
                        onChange={(e) => setDraft({ ...draft, is_survey_dependent: e.target.checked })}
                        className="w-4 h-4"
                      />
                      Is Survey Dependent?
                    </label>
                    <label className="flex items-center gap-2 text-xs font-semibold text-text-primary">
                      <input
                        type="checkbox"
                        checked={draft.civil_required_only}
                        onChange={(e) => setDraft({ ...draft, civil_required_only: e.target.checked })}
                        className="w-4 h-4"
                      />
                      Civil Required Only?
                    </label>
                  </div>
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
        entityTable="bom_template_items"
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
