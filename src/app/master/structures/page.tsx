'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import {
  useMasterQuery,
  useMasterCreateMutation,
  useMasterUpdateMutation,
  useMasterDeleteMutation,
  useMasterBulkUpdateMutation,
  getOrgContext
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
  ChevronDown,
  ChevronUp,
  Scale,
  Package2,
  Wrench,
  Layers,
  Bolt,
  Droplets,
  Construction,
  Milestone,
} from 'lucide-react';
import { useConfirm } from '@/components/ui/Confirm';
import { useToast } from '@/components/ui/Toast';
import { HistoryDrawer } from '@/components/master/HistoryDrawer';
import { BulkEditModal, type FieldSchema } from '@/components/master/BulkEditModal';
import { exportToExcel, importFromExcel } from '@/lib/utils/ImportExportHelper';
import { formatINR } from '@/lib/engine/calculator';

interface Structure {
  id: string;
  name: string;
  material: string;
  roof_mount_type: string;
  elevation_height_mm: number;
  raw_material_rate: number;
  fabrication_rate: number;
  galvanizing_rate: number;
  rate_per_kg: number | null;
  wastage_pct: number;
  fastener_weight_pct: number;
  base_weight_kg: number;
  flat_rate: number | null;
  per_watt_rate: number | null;
  gst_pct: number;
  description: string | null;
  org_id: string | null;
}

interface WeightLookup {
  id: string;
  structure_id: string;
  capacity_kw_min: number;
  capacity_kw_max: number;
  panel_qty: number;
  weight_per_panel_kg: number;
  bracket_fixed_weight: number;
  total_weight_kg: number | null;
  notes: string | null;
}

interface StructureComponent {
  id: string;
  structure_id: string;
  category: 'steel_section' | 'hardware' | 'finishing' | 'civil' | 'fabrication' | 'addon';
  name: string;
  unit: string;
  rate_appolo: number;
  rate_tata: number;
  rate_deemac: number;
  selling_price: number;
  gst_pct: number;
  is_active: boolean;
}

interface StructureAddon {
  id: string;
  name: string;
  material: string;
  unit: string;
  rate_per_unit: number;
  gst_pct: number;
  notes: string | null;
}

const CATEGORY_META: Record<string, { label: string; color: string; bg: string }> = {
  steel_section: { label: 'Steel Sections',  color: '#6366f1', bg: 'rgba(99,102,241,0.10)' },
  hardware:      { label: 'Hardware',         color: '#0ea5e9', bg: 'rgba(14,165,233,0.10)' },
  finishing:     { label: 'Finishing',         color: '#a855f7', bg: 'rgba(168,85,247,0.10)' },
  civil:         { label: 'Civil / Foundation', color: '#f97316', bg: 'rgba(249,115,22,0.10)' },
  fabrication:   { label: 'Fabrication',       color: '#C6973F', bg: 'rgba(198,151,63,0.10)' },
  addon:         { label: 'Add-ons',           color: '#22c55e', bg: 'rgba(34,197,94,0.10)' },
};

export default function StructuresMasterPage() {
  const { data: structures, isLoading } = useMasterQuery<Structure>('structures');
  const createMutation = useMasterCreateMutation<Structure>('structures');
  const updateMutation = useMasterUpdateMutation<Structure>('structures');
  const deleteMutation = useMasterDeleteMutation('structures');
  const bulkUpdateMutation = useMasterBulkUpdateMutation('structures');

  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const { toast } = useToast();

  // State controls
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  const [historyOpen, setHistoryOpen] = useState(false);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Structure | null>(null);

  // Structure BOM Components query (fires when a row is expanded)
  const { data: structureComponents } = useQuery<StructureComponent[]>({
    queryKey: ['structure-components', expandedId],
    queryFn: async () => {
      if (!expandedId) return [];
      const { data, error } = await (supabase as any)
        .from('eq_structure_components')
        .select('*')
        .eq('structure_id', expandedId)
        .eq('is_active', true)
        .order('category')
        .order('name');
      if (error) throw error;
      return (data || []) as StructureComponent[];
    },
    enabled: !!expandedId,
  });

  // Global structure add-ons (walkway, ladder)
  const { data: structureAddons } = useQuery<StructureAddon[]>({
    queryKey: ['structure-addons'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('eq_structure_addons')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return (data || []) as StructureAddon[];
    },
  });

  // Weight Lookup sub-form state
  const [lookupFormOpen, setLookupFormOpen] = useState(false);
  const [lookupDraft, setLookupDraft] = useState({
    capacity_kw_min: 0,
    capacity_kw_max: 999,
    panel_qty: 10,
    weight_per_panel_kg: 5.5,
    bracket_fixed_weight: 12,
    notes: '',
  });

  // Structure Draft values
  const [draft, setDraft] = useState({
    name: '',
    material: 'gi_galvanized',
    roof_mount_type: 'rcc_flat',
    elevation_height_mm: 0,
    raw_material_rate: 65,
    fabrication_rate: 15,
    galvanizing_rate: 20,
    wastage_pct: 0.05,
    fastener_weight_pct: 0.02,
    base_weight_kg: 0,
    flat_rate: null as number | null,
    per_watt_rate: null as number | null,
    gst_pct: 0.18,
    description: '',
  });

  // Bulk Edit Schema
  const bulkEditFields: FieldSchema[] = [
    { name: 'material', label: 'Material', type: 'select', options: [
      { value: 'gi_galvanized', label: 'GI Galvanized' },
      { value: 'hot_dip_galvanized', label: 'Hot Dip Galvanized' },
      { value: 'aluminum', label: 'Aluminum' },
      { value: 'stainless_steel', label: 'Stainless Steel' },
      { value: 'custom', label: 'Custom Specification' }
    ]},
    { name: 'raw_material_rate', label: 'Raw Metal cost (₹/kg)', type: 'number' },
    { name: 'fabrication_rate', label: 'Fabrication Cost (₹/kg)', type: 'number' },
    { name: 'galvanizing_rate', label: 'Galvanizing Cost (₹/kg)', type: 'number' },
    { name: 'gst_pct', label: 'GST Percentage', type: 'select', options: [
      { value: 0.18, label: '18% Standard' },
      { value: 0.12, label: '12% Special' }
    ]},
  ];

  // ─── Filter & Search Logic ──────────────────────────────────────────────────
  
  const filteredStructures = useMemo(() => {
    if (!structures) return [];
    return structures.filter((s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.material.toLowerCase().includes(search.toLowerCase()) ||
      s.roof_mount_type.toLowerCase().includes(search.toLowerCase()) ||
      (s.description || '').toLowerCase().includes(search.toLowerCase())
    );
  }, [structures, search]);

  // ─── Selection Logic ────────────────────────────────────────────────────────

  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredStructures.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredStructures.map((s) => s.id));
    }
  };

  // ─── Structure CRUD Handlers ────────────────────────────────────────────────

  const handleOpenAdd = () => {
    setEditingItem(null);
    setDraft({
      name: '',
      material: 'gi_galvanized',
      roof_mount_type: 'rcc_flat',
      elevation_height_mm: 0,
      raw_material_rate: 65,
      fabrication_rate: 15,
      galvanizing_rate: 20,
      wastage_pct: 0.05,
      fastener_weight_pct: 0.02,
      base_weight_kg: 0,
      flat_rate: null,
      per_watt_rate: null,
      gst_pct: 0.18,
      description: '',
    });
    setEditorOpen(true);
  };

  const handleOpenEdit = (s: Structure) => {
    setEditingItem(s);
    setDraft({
      name: s.name,
      material: s.material,
      roof_mount_type: s.roof_mount_type,
      elevation_height_mm: s.elevation_height_mm,
      raw_material_rate: s.raw_material_rate,
      fabrication_rate: s.fabrication_rate,
      galvanizing_rate: s.galvanizing_rate,
      wastage_pct: s.wastage_pct,
      fastener_weight_pct: s.fastener_weight_pct,
      base_weight_kg: s.base_weight_kg,
      flat_rate: s.flat_rate,
      per_watt_rate: s.per_watt_rate,
      gst_pct: s.gst_pct,
      description: s.description || '',
    });
    setEditorOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingItem) {
        await updateMutation.mutateAsync({ id: editingItem.id, updates: draft });
        toast('Mounting structure specification updated ✓', 'success');
      } else {
        await createMutation.mutateAsync(draft);
        toast('New mounting structure spec added ✓', 'success');
      }
      setEditorOpen(false);
    } catch (err: any) {
      toast(err.message || 'Operation failed', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirm({
      title: 'Remove Structure PV Spec?',
      message: 'This will delete this structure and all its associated capacity weight lookup rules. Continue?',
      confirmLabel: 'Delete Structure',
      cancelLabel: 'Cancel',
      type: 'danger',
    });
    if (!confirmed) return;
    try {
      await deleteMutation.mutateAsync(id);
      setSelectedIds((prev) => prev.filter((item) => item !== id));
      if (expandedId === id) setExpandedId(null);
      toast('Structure specification deleted', 'success');
    } catch (err: any) {
      toast(err.message || 'Failed to delete structure', 'error');
    }
  };

  const handleBulkEditSave = async (updates: Record<string, any>) => {
    try {
      await bulkUpdateMutation.mutateAsync({ ids: selectedIds, updates });
      setSelectedIds([]);
      toast(`Bulk updated ${selectedIds.length} structure specifications`, 'success');
    } catch (err: any) {
      toast(err.message || 'Bulk edit failed', 'error');
    }
  };

  // ─── Weight Lookup Mutations ───────────────────────────────────────────────

  const { data: lookups, refetch: refetchLookups } = useQuery<WeightLookup[]>({
    queryKey: ['structure-lookups', expandedId],
    queryFn: async () => {
      if (!expandedId) return [];
      const { data, error } = await supabase
        .from('structure_weight_lookup')
        .select('*')
        .eq('structure_id', expandedId)
        .order('capacity_kw_min', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!expandedId
  });

  const addLookupMutation = useMutation({
    mutationFn: async (newLookup: any) => {
      const { data, error } = await supabase
        .from('structure_weight_lookup')
        .insert({
          ...newLookup,
          structure_id: expandedId,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      try {
        const { revalidateMasterCache } = await import('@/app/actions/revalidateMasters');
        await revalidateMasterCache();
      } catch (err) {
        console.error('Failed to revalidate master cache:', err);
      }
      refetchLookups();
      toast('Weight lookup range added ✓', 'success');
      setLookupFormOpen(false);
    },
    onError: (err: any) => {
      toast(err.message || 'Failed to add lookup range', 'error');
    }
  });

  const deleteLookupMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('structure_weight_lookup')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: async () => {
      try {
        const { revalidateMasterCache } = await import('@/app/actions/revalidateMasters');
        await revalidateMasterCache();
      } catch (err) {
        console.error('Failed to revalidate master cache:', err);
      }
      refetchLookups();
      toast('Weight lookup range deleted', 'success');
    },
    onError: (err: any) => {
      toast(err.message || 'Failed to delete range', 'error');
    }
  });

  // ─── Import / Export ────────────────────────────────────────────────────────

  const handleExport = () => {
    const dataToExport = filteredStructures.map((s) => ({
      Name: s.name,
      Material: s.material,
      'Roof Mount Type': s.roof_mount_type,
      'Elevation (mm)': s.elevation_height_mm,
      'Raw Rate (INR/kg)': s.raw_material_rate,
      'Fab Rate (INR/kg)': s.fabrication_rate,
      'Galv Rate (INR/kg)': s.galvanizing_rate,
      'Wastage (%)': s.wastage_pct,
      'Fasteners (%)': s.fastener_weight_pct,
      'Base Weight (kg)': s.base_weight_kg,
      'Flat Rate (INR)': s.flat_rate || '',
      'Per Watt Rate (INR)': s.per_watt_rate || '',
      'GST Percentage': s.gst_pct,
      Description: s.description || '',
    }));
    exportToExcel(dataToExport, 'Structures_Master', 'Structures');
    toast('Master list exported to Excel', 'success');
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const rawData = await importFromExcel(file);
      
      const parsedRows = rawData.map((row: any) => ({
        name: row.Name || row.name,
        material: row.Material || row.material || 'gi_galvanized',
        roof_mount_type: row['Roof Mount Type'] || row.roof_mount_type || 'rcc_flat',
        elevation_height_mm: parseInt(row['Elevation (mm)'] || row.elevation_height_mm || 0, 10),
        raw_material_rate: parseFloat(row['Raw Rate (INR/kg)'] || row.raw_material_rate || 0),
        fabrication_rate: parseFloat(row['Fab Rate (INR/kg)'] || row.fabrication_rate || 0),
        galvanizing_rate: parseFloat(row['Galv Rate (INR/kg)'] || row.galvanizing_rate || 0),
        wastage_pct: parseFloat(row['Wastage (%)'] || row.wastage_pct || 0.05),
        fastener_weight_pct: parseFloat(row['Fasteners (%)'] || row.fastener_weight_pct || 0.02),
        base_weight_kg: parseFloat(row['Base Weight (kg)'] || row.base_weight_kg || 0),
        flat_rate: row['Flat Rate (INR)'] || row.flat_rate ? parseFloat(row['Flat Rate (INR)'] || row.flat_rate) : null,
        per_watt_rate: row['Per Watt Rate (INR)'] || row.per_watt_rate ? parseFloat(row['Per Watt Rate (INR)'] || row.per_watt_rate) : null,
        gst_pct: parseFloat(row['GST Percentage'] || row.gst_pct || 0.18),
        description: row.Description || row.description || '',
      })).filter((r) => r.name && !isNaN(r.raw_material_rate));

      if (parsedRows.length === 0) {
        toast('No valid rows found in Excel sheet. Check column headers.', 'error');
        return;
      }

      const confirmed = await confirm({
        title: `Import ${parsedRows.length} Structures?`,
        message: `This will insert ${parsedRows.length} structure spec rows into database. Continue?`,
        confirmLabel: 'Import Now',
        cancelLabel: 'Cancel',
        type: 'warning',
      });

      if (!confirmed) return;

      for (const row of parsedRows) {
        await createMutation.mutateAsync(row);
      }

      toast(`Successfully imported ${parsedRows.length} structure specs`, 'success');
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
              placeholder="Search structure name, material type..."
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
            <Plus size={14} /> Add Structure
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

      {/* Table grid */}
      <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-md">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-text-muted">Loading structures...</div>
        ) : filteredStructures.length === 0 ? (
          <div className="p-16 text-center text-xs text-text-muted italic">No mounting structures registered.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-10">
                  <button onClick={toggleSelectAll} className="text-text-muted hover:text-text-primary">
                    {selectedIds.length === filteredStructures.length ? (
                      <CheckSquare size={16} className="text-accent" />
                    ) : (
                      <Square size={16} />
                    )}
                  </button>
                </th>
                <th className="w-10"></th>
                <th>Name</th>
                <th>Material</th>
                <th>Mount Type</th>
                <th>Elevation</th>
                <th>Weight Pricing</th>
                <th>Base Weight</th>
                <th>Flat Override</th>
                <th>Scope</th>
                <th className="w-20 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredStructures.map((s) => {
                const isSelected = selectedIds.includes(s.id);
                const isExpanded = expandedId === s.id;
                return (
                  <>
                    <tr key={s.id} className={isSelected ? 'bg-accent-glow/50' : ''}>
                      <td>
                        <button onClick={() => toggleSelectRow(s.id)} className="text-text-muted hover:text-text-primary">
                          {isSelected ? (
                            <CheckSquare size={16} className="text-accent" />
                          ) : (
                            <Square size={16} />
                          )}
                        </button>
                      </td>
                      <td>
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : s.id)}
                          className="text-text-secondary hover:text-text-primary"
                        >
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </td>
                      <td className="font-semibold">{s.name}</td>
                      <td className="capitalize">{s.material.replace(/_/g, ' ')}</td>
                      <td className="capitalize">{s.roof_mount_type.replace(/_/g, ' ')}</td>
                      <td>{s.elevation_height_mm} mm</td>
                      <td className="font-mono font-semibold">
                        {s.rate_per_kg ? `${formatINR(s.rate_per_kg)} / kg` : '—'}
                        <span className="text-[10px] text-text-muted block mt-0.5">
                          ({s.raw_material_rate}+{s.fabrication_rate}+{s.galvanizing_rate})
                        </span>
                      </td>
                      <td>{s.base_weight_kg} kg</td>
                      <td className="font-mono">{s.flat_rate ? formatINR(s.flat_rate) : '—'}</td>
                      <td>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${s.org_id ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                          {s.org_id ? 'Org' : 'Global'}
                        </span>
                      </td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenEdit(s)}
                            className="p-1 rounded bg-surface border border-border text-text-secondary hover:text-accent hover:border-accent/30 cursor-pointer"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => handleDelete(s.id)}
                            className="p-1 rounded bg-surface border border-border text-text-secondary hover:text-error hover:border-error/30 cursor-pointer"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expandable row: weight lookups + BOM components */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={11} className="bg-surface-2 p-5 border-y border-border">
                          <div className="space-y-6">

                            {/* ── Weight Lookup Slabs ────────────────── */}
                            <div className="space-y-3">
                              <div className="flex items-center justify-between border-b border-border pb-2">
                                <h4 className="text-xs font-bold text-accent uppercase tracking-wider flex items-center gap-1.5">
                                  <Scale size={14} />
                                  Capacity Weight Lookup ({s.name})
                                </h4>
                                <button
                                  onClick={() => {
                                    setLookupDraft({ capacity_kw_min: 0, capacity_kw_max: 999, panel_qty: 10, weight_per_panel_kg: 5.5, bracket_fixed_weight: 12, notes: '' });
                                    setLookupFormOpen(true);
                                  }}
                                  className="px-3 py-1 rounded bg-accent text-background text-[10px] font-bold hover:bg-accent-hover transition-colors"
                                >
                                  + Add Weight Slab
                                </button>
                              </div>

                              {lookupFormOpen && (
                                <div className="p-4 rounded-lg bg-background border border-accent/20 grid grid-cols-2 sm:grid-cols-5 gap-3 items-end animate-fade-in">
                                  <div className="space-y-1">
                                    <label className="text-[9px] font-bold text-text-muted uppercase tracking-wider">Min KW *</label>
                                    <input type="number" step={0.01} value={lookupDraft.capacity_kw_min} onChange={(e) => setLookupDraft({ ...lookupDraft, capacity_kw_min: parseFloat(e.target.value) })} className="w-full px-2 py-1.5 rounded bg-surface border border-border text-xs text-text-primary outline-none" />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[9px] font-bold text-text-muted uppercase tracking-wider">Max KW *</label>
                                    <input type="number" step={0.01} value={lookupDraft.capacity_kw_max} onChange={(e) => setLookupDraft({ ...lookupDraft, capacity_kw_max: parseFloat(e.target.value) })} className="w-full px-2 py-1.5 rounded bg-surface border border-border text-xs text-text-primary outline-none" />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[9px] font-bold text-text-muted uppercase tracking-wider">Panel Qty *</label>
                                    <input type="number" value={lookupDraft.panel_qty} onChange={(e) => setLookupDraft({ ...lookupDraft, panel_qty: parseInt(e.target.value, 10) })} className="w-full px-2 py-1.5 rounded bg-surface border border-border text-xs text-text-primary outline-none" />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[9px] font-bold text-text-muted uppercase tracking-wider">kg / Panel *</label>
                                    <input type="number" step={0.01} value={lookupDraft.weight_per_panel_kg} onChange={(e) => setLookupDraft({ ...lookupDraft, weight_per_panel_kg: parseFloat(e.target.value) })} className="w-full px-2 py-1.5 rounded bg-surface border border-border text-xs text-text-primary outline-none" />
                                  </div>
                                  <div className="flex gap-2">
                                    <button type="button" onClick={() => addLookupMutation.mutate(lookupDraft)} className="flex-1 px-3 py-1.5 rounded bg-accent text-background text-xs font-bold hover:bg-accent-hover transition-colors">Add</button>
                                    <button type="button" onClick={() => setLookupFormOpen(false)} className="px-2 py-1.5 rounded bg-surface border border-border text-xs text-text-muted hover:text-text-primary"><X size={15} /></button>
                                  </div>
                                </div>
                              )}

                              {!lookups || lookups.length === 0 ? (
                                <p className="text-[11px] text-text-muted italic py-2">No weight slabs configured.</p>
                              ) : (
                                <table className="w-full border-collapse text-xs text-left bg-background border border-border rounded-lg overflow-hidden">
                                  <thead>
                                    <tr className="bg-surface-hover text-text-muted border-b border-border text-[9px] uppercase font-bold tracking-wider">
                                      <th className="p-2">kW Range</th>
                                      <th className="p-2">Panels</th>
                                      <th className="p-2">kg/Panel</th>
                                      <th className="p-2">Bracket kg</th>
                                      <th className="p-2">Total kg</th>
                                      <th className="p-2 text-right"></th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {lookups.map((lu) => (
                                      <tr key={lu.id} className="border-b border-border/40 hover:bg-surface-hover/30 transition-colors">
                                        <td className="p-2 font-mono">{lu.capacity_kw_min}–{lu.capacity_kw_max} kW</td>
                                        <td className="p-2 font-mono">{lu.panel_qty}</td>
                                        <td className="p-2 font-mono">{lu.weight_per_panel_kg} kg</td>
                                        <td className="p-2 font-mono">{lu.bracket_fixed_weight} kg</td>
                                        <td className="p-2 font-mono font-bold text-accent">{lu.total_weight_kg ?? '—'} kg</td>
                                        <td className="p-2 text-right">
                                          <button onClick={() => deleteLookupMutation.mutate(lu.id)} className="text-text-secondary hover:text-error"><Trash2 size={13} /></button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </div>

                            {/* ── BOM Components by Category ─────────── */}
                            <div className="space-y-3">
                              <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider flex items-center gap-1.5 border-b border-border pb-2">
                                <Package2 size={14} />
                                BOM Components — {s.name}
                              </h4>

                              {!structureComponents || structureComponents.length === 0 ? (
                                <p className="text-[11px] text-text-muted italic py-2">
                                  No BOM components imported yet. Run <code className="text-accent text-[10px] bg-accent/10 px-1 rounded">importStructureComponents.ts</code> to seed from Excel.
                                </p>
                              ) : (
                                <div className="space-y-4">
                                  {Object.entries(CATEGORY_META).map(([cat, meta]) => {
                                    const items = structureComponents.filter((c) => c.category === cat);
                                    if (items.length === 0) return null;
                                    return (
                                      <div key={cat}>
                                        <div
                                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider mb-2"
                                          style={{ color: meta.color, background: meta.bg }}
                                        >
                                          {cat === 'steel_section' && <Layers size={10} />}
                                          {cat === 'hardware' && <Bolt size={10} />}
                                          {cat === 'finishing' && <Droplets size={10} />}
                                          {cat === 'civil' && <Construction size={10} />}
                                          {cat === 'fabrication' && <Wrench size={10} />}
                                          {cat === 'addon' && <Milestone size={10} />}
                                          {meta.label}
                                        </div>
                                        <table className="w-full border-collapse text-xs bg-background border border-border rounded-lg overflow-hidden">
                                          <thead>
                                            <tr className="text-[9px] uppercase tracking-wider text-text-muted font-bold bg-surface-hover border-b border-border">
                                              <th className="p-2 text-left">Component</th>
                                              <th className="p-2 text-center">Unit</th>
                                              <th className="p-2 text-right">₹ Appolo</th>
                                              <th className="p-2 text-right">₹ Tata</th>
                                              <th className="p-2 text-right">₹ Deemac</th>
                                              <th className="p-2 text-right font-bold">Selling ₹</th>
                                              <th className="p-2 text-center">GST</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {items.map((comp) => (
                                              <tr key={comp.id} className="border-b border-border/40 hover:bg-surface-hover/20 transition-colors">
                                                <td className="p-2 font-medium text-text-primary">{comp.name}</td>
                                                <td className="p-2 text-center text-text-muted text-[10px]">{comp.unit}</td>
                                                <td className="p-2 text-right font-mono">{comp.rate_appolo > 0 ? `₹${comp.rate_appolo}` : '—'}</td>
                                                <td className="p-2 text-right font-mono">{comp.rate_tata > 0 ? `₹${comp.rate_tata}` : '—'}</td>
                                                <td className="p-2 text-right font-mono">{comp.rate_deemac > 0 ? `₹${comp.rate_deemac}` : '—'}</td>
                                                <td className="p-2 text-right font-mono font-bold text-accent">₹{comp.selling_price}</td>
                                                <td className="p-2 text-center text-text-muted text-[10px]">{(comp.gst_pct * 100).toFixed(0)}%</td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>

                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Add-ons Panel: Walkway & Ladder */}
      {structureAddons && structureAddons.length > 0 && (
        <div className="rounded-xl border border-border bg-surface p-5 space-y-3">
          <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider flex items-center gap-2">
            <Milestone size={14} className="text-accent" />
            Structure Add-ons (Walkway & Ladder)
          </h3>
          <table className="w-full border-collapse text-xs bg-background border border-border rounded-lg overflow-hidden">
            <thead>
              <tr className="text-[9px] uppercase tracking-wider text-text-muted font-bold bg-surface-hover border-b border-border">
                <th className="p-2.5 text-left">Add-on</th>
                <th className="p-2.5 text-left">Material</th>
                <th className="p-2.5 text-center">Unit</th>
                <th className="p-2.5 text-right">Rate / Unit</th>
                <th className="p-2.5 text-center">GST</th>
                <th className="p-2.5 text-left">Notes</th>
              </tr>
            </thead>
            <tbody>
              {structureAddons.map((addon) => (
                <tr key={addon.id} className="border-b border-border/40 hover:bg-surface-hover/20 transition-colors">
                  <td className="p-2.5 font-semibold text-text-primary">{addon.name}</td>
                  <td className="p-2.5 text-text-muted">{addon.material}</td>
                  <td className="p-2.5 text-center text-text-muted">{addon.unit}</td>
                  <td className="p-2.5 text-right font-mono font-bold text-accent">₹{addon.rate_per_unit.toFixed(2)}</td>
                  <td className="p-2.5 text-center text-text-muted">{(addon.gst_pct * 100).toFixed(0)}%</td>
                  <td className="p-2.5 text-text-muted text-[10px] max-w-xs truncate" title={addon.notes ?? ''}>{addon.notes ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Editor Modal */}
      {editorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setEditorOpen(false)} />
          <div className="relative w-full max-w-lg bg-surface border border-border rounded-xl shadow-2xl overflow-hidden animate-scale-in">
            <div className="p-5 border-b border-border flex justify-between items-center bg-surface-2">
              <h3 className="text-sm font-bold text-text-primary">
                {editingItem ? 'Edit Structure specification' : 'Add New Structure Type'}
              </h3>
              <button onClick={() => setEditorOpen(false)} className="text-text-muted hover:text-text-primary">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1 col-span-2">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Structure Name *</label>
                  <input
                    type="text" required
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-text-primary focus:border-accent/40 outline-none"
                    placeholder="e.g. RCC High-Rise Standard Purlin"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Metal Material *</label>
                  <select
                    value={draft.material}
                    onChange={(e) => setDraft({ ...draft, material: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-text-primary focus:border-accent/40 outline-none"
                  >
                    <option value="gi_galvanized">GI Galvanized</option>
                    <option value="hot_dip_galvanized">Hot Dip Galvanized</option>
                    <option value="aluminum">Aluminum</option>
                    <option value="stainless_steel">Stainless Steel</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Roof Mount Type *</label>
                  <select
                    value={draft.roof_mount_type}
                    onChange={(e) => setDraft({ ...draft, roof_mount_type: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-text-primary focus:border-accent/40 outline-none animate-fade-in"
                  >
                    <option value="rcc_flat">RCC Flat Roof</option>
                    <option value="rcc_sloped">RCC Sloped Roof</option>
                    <option value="tin_shed">Tin Shed Mounting</option>
                    <option value="metal_sheet">Metal Sheet Profile</option>
                    <option value="ground_mount">Ground Mount Rack</option>
                    <option value="elevated">Elevated Structure</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Elevation Height (mm) *</label>
                  <input
                    type="number" required min={0}
                    value={draft.elevation_height_mm}
                    onChange={(e) => setDraft({ ...draft, elevation_height_mm: parseInt(e.target.value, 10) })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-text-primary focus:border-accent/40 outline-none font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Raw Material Cost (₹/kg) *</label>
                  <input
                    type="number" required min={0}
                    value={draft.raw_material_rate}
                    onChange={(e) => setDraft({ ...draft, raw_material_rate: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-text-primary focus:border-accent/40 outline-none font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Fabrication Rate (₹/kg) *</label>
                  <input
                    type="number" required min={0}
                    value={draft.fabrication_rate}
                    onChange={(e) => setDraft({ ...draft, fabrication_rate: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-text-primary focus:border-accent/40 outline-none font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Galvanizing Rate (₹/kg) *</label>
                  <input
                    type="number" required min={0}
                    value={draft.galvanizing_rate}
                    onChange={(e) => setDraft({ ...draft, galvanizing_rate: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-text-primary focus:border-accent/40 outline-none font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Wastage Factor (%) *</label>
                  <input
                    type="number" required min={0} max={1} step={0.01}
                    value={draft.wastage_pct}
                    onChange={(e) => setDraft({ ...draft, wastage_pct: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-text-primary focus:border-accent/40 outline-none font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Fastener weight Factor (%) *</label>
                  <input
                    type="number" required min={0} max={1} step={0.01}
                    value={draft.fastener_weight_pct}
                    onChange={(e) => setDraft({ ...draft, fastener_weight_pct: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-text-primary focus:border-accent/40 outline-none font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Base Weight Min (kg) *</label>
                  <input
                    type="number" required min={0}
                    value={draft.base_weight_kg}
                    onChange={(e) => setDraft({ ...draft, base_weight_kg: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-text-primary focus:border-accent/40 outline-none font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Flat rate Override (INR)</label>
                  <input
                    type="number" min={0}
                    value={draft.flat_rate || ''}
                    onChange={(e) => setDraft({ ...draft, flat_rate: e.target.value ? parseFloat(e.target.value) : null })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-text-primary focus:border-accent/40 outline-none font-mono"
                  />
                </div>
              </div>
              
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Remarks / Technical Specifications</label>
                <textarea
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-text-primary focus:border-accent/40 outline-none resize-none"
                  placeholder="Wind speed resistance rating, column thickness details..."
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
                  Save Structure
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
        entityTable="eq_mounting_structures"
        title="Mounting Structures Master"
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
