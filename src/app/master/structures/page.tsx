'use client';

import { useState, useMemo, Fragment } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Select } from '@/components/ui/Select';
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
  AlertTriangle,
} from 'lucide-react';
import { useConfirm } from '@/components/ui/Confirm';
import { useToast } from '@/components/ui/Toast';
import { ErpStructuresView } from '@/components/master/structures/ErpStructuresView';
import { HistoryDrawer } from '@/components/master/HistoryDrawer';
import { BulkEditModal, type FieldSchema } from '@/components/master/BulkEditModal';
import { exportToExcel, importFromExcel } from '@/lib/utils/ImportExportHelper';
import { formatINR } from '@/lib/engine/calculator';
import { gstRateToPercent, normalizeGstRate } from '@/lib/utils/gst';

interface Structure {
  id: string;
  source_global_id?: string | null;
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
  specification_details: string | null;
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

interface StructureImportConflict {
  row: any;
  existing?: Structure | null;
  reason: 'existing' | 'file_duplicate';
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
  const [duplicateConflicts, setDuplicateConflicts] = useState<StructureImportConflict[]>([]);
  const [pendingImportRows, setPendingImportRows] = useState<any[]>([]);
  const [showConflictsModal, setShowConflictsModal] = useState(false);

  // State for tabs
  const [mainTab, setMainTab] = useState<'erp' | 'legacy'>('erp');
  const [erpSubTab, setErpSubTab] = useState<'vendors' | 'templates' | 'addons'>('templates');

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

  const findImportMatch = (row: any) => {
    const ids = [row.__master_id, row.__source_global_id].filter(Boolean).map(String);
    const idMatch = structures?.find((item) => ids.includes(item.id) || (item.source_global_id ? ids.includes(item.source_global_id) : false));
    if (idMatch) return idMatch;

    return structures?.find((item) =>
      sameText(item.name, row.name) &&
      sameText(item.material, row.material) &&
      sameText(item.roof_mount_type, row.roof_mount_type)
    );
  };

  const structureNaturalKey = (row: any) =>
    [
      String(row.name ?? '').trim().toLowerCase(),
      String(row.material ?? '').trim().toLowerCase(),
      String(row.roof_mount_type ?? '').trim().toLowerCase(),
    ].join('|');

  const isDuplicateStructureError = (err: any) => {
    const message = String(err?.message || err?.details || '').toLowerCase();
    return err?.code === '23505' || message.includes('duplicate key') || message.includes('uq_eq_structures');
  };

  const mapStructureFromDb = (row: any): Structure => ({
    ...row,
    flat_rate: row.selling_price ?? row.flat_rate ?? null,
  });

  const findImportMatchFromDb = async (row: any): Promise<Structure | null> => {
    const localMatch = findImportMatch(row);
    if (localMatch) return localMatch;

    const { orgId } = await getOrgContext();
    let query = (supabase as any)
      .from('eq_mounting_structures')
      .select('*')
      .eq('name', row.name)
      .eq('material', row.material)
      .eq('roof_mount_type', row.roof_mount_type)
      .eq('is_active', true);

    query = orgId ? query.or(`org_id.eq.${orgId},org_id.is.null`) : query.is('org_id', null);

    const { data, error } = await query.limit(5);
    if (error) throw error;
    const rows = (data || []) as any[];
    const preferred = orgId ? rows.find((item) => item.org_id === orgId) || rows[0] : rows[0];
    return preferred ? mapStructureFromDb(preferred) : null;
  };

  const findStructureImportConflicts = async (rows: any[]) => {
    const seen = new Map<string, any>();
    const conflicts: StructureImportConflict[] = [];

    for (const row of rows) {
      const key = structureNaturalKey(row);
      if (seen.has(key)) {
        conflicts.push({ row, existing: null, reason: 'file_duplicate' });
        continue;
      }
      seen.set(key, row);

      const existing = await findImportMatchFromDb(row);
      if (existing) conflicts.push({ row, existing, reason: 'existing' });
    }

    return conflicts;
  };

  const structureRowChanged = (existing: Structure, row: any) =>
    !sameText(existing.name, row.name) ||
    !sameText(existing.material, row.material) ||
    !sameText(existing.roof_mount_type, row.roof_mount_type) ||
    !sameNumber(existing.elevation_height_mm, row.elevation_height_mm, 0) ||
    !sameNumber(existing.raw_material_rate, row.raw_material_rate, 2) ||
    !sameNumber(existing.fabrication_rate, row.fabrication_rate, 2) ||
    !sameNumber(existing.galvanizing_rate, row.galvanizing_rate, 2) ||
    !sameNumber(existing.wastage_pct, row.wastage_pct, 5) ||
    !sameNumber(existing.fastener_weight_pct, row.fastener_weight_pct, 5) ||
    !sameNumber(existing.base_weight_kg, row.base_weight_kg, 4) ||
    !sameNumber(existing.flat_rate, row.flat_rate, 2) ||
    !sameNumber(existing.per_watt_rate, row.per_watt_rate, 4) ||
    !sameNumber(normalizeGstRate(existing.gst_pct, 0.18), row.gst_pct, 5) ||
    !sameText(existing.description, row.description) ||
    !sameText(existing.specification_details, row.specification_details);

  // Fetch ERP Structure Data
  
  
  
  
  
  
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

  // Structure sub-component inline editor state
  const [editingCompId, setEditingCompId] = useState<string | null>(null);
  const [compPriceDraft, setCompPriceDraft] = useState<number>(0);
  const [compGstDraft, setCompGstDraft] = useState<number>(0.18);
  const [editingAddonId, setEditingAddonId] = useState<string | null>(null);
  const [addonRateDraft, setAddonRateDraft] = useState<number>(0);
  const [addonGstDraft, setAddonGstDraft] = useState<number>(0.18);

  // Mutation to update structure components
  const updateCompMutation = useMutation({
    mutationFn: async ({ id, selling_price, gst_pct }: { id: string; selling_price: number; gst_pct: number }) => {
      const { error } = await supabase
        .from('eq_structure_components')
        .update({ selling_price, gst_pct, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['structure-components', expandedId] });
      setEditingCompId(null);
      toast('Structure component updated ✓', 'success');
    },
    onError: (err: any) => {
      toast(err.message || 'Failed to update component', 'error');
    }
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
    specification_details: '',
  });

  const updateAddonMutation = useMutation({
    mutationFn: async ({ id, rate_per_unit, gst_pct }: { id: string; rate_per_unit: number; gst_pct: number }) => {
      const { error } = await (supabase as any)
        .from('eq_structure_addons')
        .update({ rate_per_unit, gst_pct, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['structure-addons'] });
      setEditingAddonId(null);
      toast('Structure add-on updated ✓', 'success');
    },
    onError: (err: any) => {
      toast(err.message || 'Failed to update add-on', 'error');
    }
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
    { name: 'gst_pct', label: 'GST Percentage', type: 'number' },
  ];

  const normalizeStructureMaterial = (value: unknown): Structure['material'] => {
    const normalized = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
    if (['hot_dip_galvanized', 'hot_dip_gi', 'hdg'].includes(normalized)) return 'hot_dip_galvanized';
    if (['aluminum', 'aluminium'].includes(normalized)) return 'aluminum';
    if (['stainless_steel', 'ss'].includes(normalized)) return 'stainless_steel';
    if (['custom'].includes(normalized)) return 'custom';
    return 'gi_galvanized';
  };

  const normalizeRoofMountType = (value: unknown): Structure['roof_mount_type'] => {
    const normalized = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
    if (['rcc_sloped', 'sloped_rcc', 'rcc_slope'].includes(normalized)) return 'rcc_sloped';
    if (['tin_shed', 'tinshed'].includes(normalized)) return 'tin_shed';
    if (['metal_sheet', 'sheet_metal'].includes(normalized)) return 'metal_sheet';
    if (['ground_mount', 'ground'].includes(normalized)) return 'ground_mount';
    if (['elevated'].includes(normalized)) return 'elevated';
    if (['custom'].includes(normalized)) return 'custom';
    return 'rcc_flat';
  };

  // ─── Filter & Search Logic ──────────────────────────────────────────────────
  
  const filteredStructures = useMemo(() => {
    if (!structures) return [];
    return structures.filter((s) =>
      (s.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.material || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.roof_mount_type || '').toLowerCase().includes(search.toLowerCase()) ||
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
      specification_details: '',
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
      specification_details: s.specification_details || '',
    });
    setEditorOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingItem) {
        const existing = await findImportMatchFromDb(draft);
        if (existing && existing.id !== editingItem.id) {
          toast('Another structure already uses this name, material, and mount type. Update that row instead of creating a duplicate key.', 'error');
          return;
        }

        await updateMutation.mutateAsync({ id: editingItem.id, updates: draft });
        toast('Mounting structure specification updated ✓', 'success');
      } else {
        const existing = await findImportMatchFromDb(draft);
        if (existing) {
          const updateExisting = await confirm({
            title: 'Duplicate Structure Found',
            message: `"${draft.name}" already exists for this material and mount type. Update the existing structure instead of creating a duplicate?`,
            confirmLabel: 'Update Existing',
            cancelLabel: 'Cancel',
            type: 'warning',
          });
          if (!updateExisting) return;

          await updateMutation.mutateAsync({ id: existing.id, updates: draft });
          toast('Existing mounting structure updated ✓', 'success');
          setEditorOpen(false);
          return;
        }

        await createMutation.mutateAsync(draft);
        toast('New mounting structure spec added ✓', 'success');
      }
      setEditorOpen(false);
    } catch (err: any) {
      if (isDuplicateStructureError(err)) {
        toast('A structure with the same name, material, and mount type already exists. Use edit/update instead of creating another copy.', 'error');
      } else {
        toast(err.message || 'Operation failed', 'error');
      }
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
      await bulkUpdateMutation.mutateAsync({
        ids: selectedIds,
        updates: updates.gst_pct !== undefined
          ? { ...updates, gst_pct: normalizeGstRate(updates.gst_pct, 0.18) }
          : updates,
      });
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
      'Master ID': s.id,
      'Source Global ID': s.source_global_id || '',
      Scope: s.org_id ? 'Org Override' : 'Global Baseline',
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
      'GST Percentage': gstRateToPercent(s.gst_pct, 0.18),
      Description: s.description || '',
      'Specification Details': s.specification_details || '',
    }));
    exportToExcel(dataToExport, 'Structures_Master', 'Structures');
    toast('Master list exported to Excel', 'success');
  };

  const runStructureImport = async (
    rows: any[],
    strategy: 'overwrite' | 'skip' | 'duplicate' = 'overwrite',
    conflicts: StructureImportConflict[] = [],
    askConfirm = true,
  ) => {
    if (askConfirm) {
      const confirmed = await confirm({
        title: `Import ${rows.length} Structures?`,
        message: `This will import ${rows.length} structure spec rows into the database. Existing rows with the same name, material, and mount type will be updated.`,
        confirmLabel: 'Import Now',
        cancelLabel: 'Cancel',
        type: 'warning',
      });

      if (!confirmed) return;
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;
    const conflictByKey = new Map(conflicts.map((conflict) => [structureNaturalKey(conflict.row), conflict]));
    const copySuffix = Date.now().toString().slice(-5);

    for (const [index, row] of rows.entries()) {
      try {
        const conflict = conflictByKey.get(structureNaturalKey(row));
        if (conflict && strategy === 'skip') {
          skipped += 1;
          continue;
        }

        const importRow = conflict && strategy === 'duplicate'
          ? { ...row, name: `${row.name} (Copy ${copySuffix}-${index + 1})` }
          : row;
        const { __master_id, __source_global_id, ...payload } = importRow;
        const existing = conflict && strategy === 'duplicate' ? null : await findImportMatchFromDb(importRow);

        if (existing) {
          if (structureRowChanged(existing, payload)) {
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
        console.error('[structures] import row failed', rowError);
        failed += 1;
      }
    }

    const message = `Import complete: ${created} created, ${updated} updated, ${skipped} unchanged/skipped${failed ? `, ${failed} failed` : ''}.`;
    toast(message, failed ? 'error' : 'success');
  };

  const resolveStructureImportConflicts = async (strategy: 'overwrite' | 'skip' | 'duplicate') => {
    const rows = pendingImportRows;
    const conflicts = duplicateConflicts;
    setShowConflictsModal(false);
    setPendingImportRows([]);
    setDuplicateConflicts([]);

    try {
      await runStructureImport(rows, strategy, conflicts, false);
    } catch (err: any) {
      toast(err.message || 'Import failed', 'error');
    }
  };

  const closeStructureImportConflicts = () => {
    setShowConflictsModal(false);
    setPendingImportRows([]);
    setDuplicateConflicts([]);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const rawData = await importFromExcel(file);
      
      const parsedRows = rawData.map((row: any) => ({
        __master_id: readImportCell(row, 'Master ID', 'master_id', 'id'),
        __source_global_id: readImportCell(row, 'Source Global ID', 'source_global_id'),
        name: readImportCell(row, 'Name', 'name'),
        material: normalizeStructureMaterial(readImportCell(row, 'Material', 'material')),
        roof_mount_type: normalizeRoofMountType(readImportCell(row, 'Roof Mount Type', 'roof_mount_type')),
        elevation_height_mm: parseInt(readImportCell(row, 'Elevation (mm)', 'elevation_height_mm') || 0, 10),
        raw_material_rate: parseFloat(readImportCell(row, 'Raw Rate (INR/kg)', 'raw_material_rate') || 0),
        fabrication_rate: parseFloat(readImportCell(row, 'Fab Rate (INR/kg)', 'fabrication_rate') || 0),
        galvanizing_rate: parseFloat(readImportCell(row, 'Galv Rate (INR/kg)', 'galvanizing_rate') || 0),
        wastage_pct: parseFloat(readImportCell(row, 'Wastage (%)', 'wastage_pct') || 0.05),
        fastener_weight_pct: parseFloat(readImportCell(row, 'Fasteners (%)', 'fastener_weight_pct') || 0.02),
        base_weight_kg: parseFloat(readImportCell(row, 'Base Weight (kg)', 'base_weight_kg') || 0),
        flat_rate: readImportCell(row, 'Flat Rate (INR)', 'flat_rate') ? parseFloat(readImportCell(row, 'Flat Rate (INR)', 'flat_rate')) : null,
        per_watt_rate: readImportCell(row, 'Per Watt Rate (INR)', 'per_watt_rate') ? parseFloat(readImportCell(row, 'Per Watt Rate (INR)', 'per_watt_rate')) : null,
        gst_pct: normalizeGstRate(readImportCell(row, 'GST Percentage', 'gst_pct'), 0.18),
        description: readImportCell(row, 'Description', 'description') || '',
        specification_details: readImportCell(row, 'Specification Details', 'specification_details', 'Specifications', 'specifications', 'Description', 'description') || '',
      })).filter((r) => r.name && !isNaN(r.raw_material_rate));

      if (parsedRows.length === 0) {
        toast('No valid rows found in Excel sheet. Check column headers.', 'error');
        return;
      }

      const conflicts = await findStructureImportConflicts(parsedRows);
      if (conflicts.length > 0) {
        setPendingImportRows(parsedRows);
        setDuplicateConflicts(conflicts);
        setShowConflictsModal(true);
        return;
      }

      await runStructureImport(parsedRows);
    } catch (err: any) {
      if (isDuplicateStructureError(err)) {
        toast('Duplicate structures were detected. Re-import and choose update, copy, or skip from the duplicate review dialog.', 'error');
      } else {
        toast(err.message || 'Import failed', 'error');
      }
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Main Mode Tabs */}
      <div className="flex rounded-lg border border-border bg-surface p-1">
        <button
          onClick={() => setMainTab('erp')}
          className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-200 ${
            mainTab === 'erp'
              ? 'bg-accent text-background shadow-md'
              : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
          }`}
        >
          Price Structure Templates (New Model)
        </button>
        <button
          onClick={() => setMainTab('legacy')}
          className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-200 ${
            mainTab === 'legacy'
              ? 'bg-accent text-background shadow-md'
              : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
          }`}
        >
          Legacy Structure Specs (Old Model)
        </button>
      </div>

      {mainTab === 'erp' ? (
        <ErpStructuresView erpSubTab={erpSubTab} setErpSubTab={setErpSubTab} />

      ) : (
        /* LEGACY MODE spec layout starts here */
        <>
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
                <th>Per Watt Rate</th>
                <th>Scope</th>
                <th className="w-20 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredStructures.map((s) => {
                const isSelected = selectedIds.includes(s.id);
                const isExpanded = expandedId === s.id;
                return (
                  <Fragment key={s.id}>
                    <tr className={isSelected ? 'bg-accent-glow/50' : ''}>
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
                      <td className="font-mono">{s.per_watt_rate ? `${formatINR(s.per_watt_rate)}/W` : '—'}</td>
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
                        <td colSpan={12} className="bg-surface-2 p-5 border-y border-border">
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
                                              <th className="p-2 text-right font-bold">Selling ₹</th>
                                              <th className="p-2 text-center">GST</th>
                                              <th className="p-2 text-right w-16">Actions</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {items.map((comp) => {
                                              const isEditing = editingCompId === comp.id;
                                              return (
                                                <tr key={comp.id} className="border-b border-border/40 hover:bg-surface-hover/20 transition-colors">
                                                  <td className="p-2 font-medium text-text-primary">{comp.name}</td>
                                                  <td className="p-2 text-center text-text-muted text-[10px]">{comp.unit}</td>
                                                  <td className="p-2 text-right">
                                                    {isEditing ? (
                                                      <input
                                                        type="number"
                                                        value={compPriceDraft}
                                                        onChange={(e) => setCompPriceDraft(parseFloat(e.target.value) || 0)}
                                                        className="w-20 px-1 py-0.5 border border-border bg-background text-xs font-mono text-right rounded outline-none focus:border-accent/40"
                                                      />
                                                    ) : (
                                                      <span className="font-mono font-bold text-accent">₹{comp.selling_price}</span>
                                                    )}
                                                  </td>
                                                  <td className="p-2 text-center text-text-muted text-[10px]">
                                                    {isEditing ? (
                                                      <input
                                                        type="number"
                                                        min={0}
                                                        step={0.01}
                                                        value={gstRateToPercent(compGstDraft, 0.18)}
                                                        onChange={(e) => setCompGstDraft(normalizeGstRate(e.target.value, 0.18))}
                                                        className="w-20 px-1 py-0.5 border border-border bg-background text-xs font-mono text-right rounded outline-none focus:border-accent/40"
                                                      />
                                                    ) : (
                                                      <span>{(comp.gst_pct * 100).toFixed(0)}%</span>
                                                    )}
                                                  </td>
                                                  <td className="p-2 text-right">
                                                    {isEditing ? (
                                                      <div className="flex justify-end gap-1">
                                                        <button
                                                          type="button"
                                                          onClick={() => updateCompMutation.mutate({ id: comp.id, selling_price: compPriceDraft, gst_pct: compGstDraft })}
                                                          className="p-0.5 rounded hover:bg-emerald-500/10 border border-border hover:border-emerald-500/30 text-emerald-400 cursor-pointer"
                                                        >
                                                          <Check size={11} />
                                                        </button>
                                                        <button
                                                          type="button"
                                                          onClick={() => setEditingCompId(null)}
                                                          className="p-0.5 rounded hover:bg-error/10 border border-border hover:border-error/30 text-error cursor-pointer"
                                                        >
                                                          <X size={11} />
                                                        </button>
                                                      </div>
                                                    ) : (
                                                      <button
                                                        type="button"
                                                        onClick={() => {
                                                          setEditingCompId(comp.id);
                                                          setCompPriceDraft(Number(comp.selling_price));
                                                          setCompGstDraft(normalizeGstRate(comp.gst_pct, 0.18));
                                                        }}
                                                        className="p-1 rounded bg-surface border border-border text-text-secondary hover:text-accent hover:border-accent/30 cursor-pointer"
                                                        title="Edit Rate"
                                                      >
                                                        <Edit2 size={11} />
                                                      </button>
                                                    )}
                                                  </td>
                                                </tr>
                                              );
                                            })}
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
                  </Fragment>
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
                <th className="p-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {structureAddons.map((addon) => {
                const isEditing = editingAddonId === addon.id;
                return (
                  <tr key={addon.id} className="border-b border-border/40 hover:bg-surface-hover/20 transition-colors">
                    <td className="p-2.5 font-semibold text-text-primary">{addon.name}</td>
                    <td className="p-2.5 text-text-muted">{addon.material}</td>
                    <td className="p-2.5 text-center text-text-muted">{addon.unit}</td>
                    <td className="p-2.5 text-right">
                      {isEditing ? (
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={addonRateDraft}
                          onChange={(e) => setAddonRateDraft(parseFloat(e.target.value) || 0)}
                          className="w-24 px-2 py-1 border border-border bg-background text-xs font-mono text-right rounded outline-none focus:border-accent/40"
                        />
                      ) : (
                        <span className="font-mono font-bold text-accent">₹{addon.rate_per_unit.toFixed(2)}</span>
                      )}
                    </td>
                    <td className="p-2.5 text-center text-text-muted">
                      {isEditing ? (
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={gstRateToPercent(addonGstDraft, 0.18)}
                          onChange={(e) => setAddonGstDraft(normalizeGstRate(e.target.value, 0.18))}
                          className="w-20 px-2 py-1 border border-border bg-background text-xs font-mono text-right rounded outline-none focus:border-accent/40"
                        />
                      ) : (
                        `${(addon.gst_pct * 100).toFixed(0)}%`
                      )}
                    </td>
                    <td className="p-2.5 text-text-muted text-[10px] max-w-xs truncate" title={addon.notes ?? ''}>{addon.notes ?? '—'}</td>
                    <td className="p-2.5 text-right">
                      {isEditing ? (
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => updateAddonMutation.mutate({ id: addon.id, rate_per_unit: addonRateDraft, gst_pct: addonGstDraft })}
                            className="p-1 rounded hover:bg-emerald-500/10 border border-border hover:border-emerald-500/30 text-emerald-400 cursor-pointer"
                            title="Save add-on rate and GST"
                          >
                            <Check size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingAddonId(null)}
                            className="p-1 rounded hover:bg-error/10 border border-border hover:border-error/30 text-error cursor-pointer"
                            title="Cancel"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingAddonId(addon.id);
                            setAddonRateDraft(Number(addon.rate_per_unit));
                            setAddonGstDraft(normalizeGstRate(addon.gst_pct, 0.18));
                          }}
                          className="p-1 rounded bg-surface border border-border text-text-secondary hover:text-accent hover:border-accent/30 cursor-pointer"
                          title="Edit add-on rate and GST"
                        >
                          <Edit2 size={12} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      </>
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
                  <Select
                    value={draft.material}
                    onChange={(val) => setDraft({ ...draft, material: val })}
                    options={[
                      { value: 'gi_galvanized', label: 'GI Galvanized' },
                      { value: 'hot_dip_galvanized', label: 'Hot Dip Galvanized' },
                      { value: 'aluminum', label: 'Aluminum' },
                      { value: 'stainless_steel', label: 'Stainless Steel' },
                      { value: 'custom', label: 'Custom' }
                    ]}
                    className="w-full"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Roof Mount Type *</label>
                  <Select
                    value={draft.roof_mount_type}
                    onChange={(val) => setDraft({ ...draft, roof_mount_type: val })}
                    options={[
                      { value: 'rcc_flat', label: 'RCC Flat Roof' },
                      { value: 'rcc_sloped', label: 'RCC Sloped Roof' },
                      { value: 'tin_shed', label: 'Tin Shed Mounting' },
                      { value: 'metal_sheet', label: 'Metal Sheet Profile' },
                      { value: 'ground_mount', label: 'Ground Mount Rack' },
                      { value: 'elevated', label: 'Elevated Structure' },
                      { value: 'custom', label: 'Custom' }
                    ]}
                    className="w-full"
                  />
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
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Per Watt Rate (₹/W)</label>
                  <input
                    type="number" min={0} step={0.01}
                    value={draft.per_watt_rate || ''}
                    onChange={(e) => setDraft({ ...draft, per_watt_rate: e.target.value ? parseFloat(e.target.value) : null })}
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
              </div>
              
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Quote Specification Details</label>
                <textarea
                  value={draft.specification_details}
                  onChange={(e) => setDraft({ ...draft, specification_details: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-text-primary focus:border-accent/40 outline-none resize-none"
                  placeholder="Material grade, coating/galvanizing, wind speed resistance, thickness, warranty..."
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

      {/* Duplicate Structure Import Modal */}
      {showConflictsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeStructureImportConflicts} />
          <div className="relative w-full max-w-lg bg-surface border border-border rounded-xl shadow-2xl overflow-hidden animate-scale-in">
            <div className="p-5 border-b border-border bg-surface-2 flex justify-between items-center">
              <h3 className="text-sm font-bold text-warning flex items-center gap-2">
                <AlertTriangle size={16} />
                Duplicate Structure Import
              </h3>
              <button onClick={closeStructureImportConflicts} className="text-text-muted hover:text-text-primary">
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <p className="text-text-secondary">
                We detected <strong>{duplicateConflicts.length}</strong> imported structure row(s) with the same name, material, and mount type as an existing row or another imported row. Choose how to continue:
              </p>

              <div className="border border-border rounded-lg bg-background p-3 max-h-40 overflow-y-auto space-y-1 font-mono">
                {duplicateConflicts.map((conflict, index) => (
                  <div key={`${structureNaturalKey(conflict.row)}-${index}`} className="text-text-muted">
                    <span className="font-bold text-text-primary">{conflict.row.name}</span>
                    <span> / {conflict.row.material} / {conflict.row.roof_mount_type}</span>
                    <span className="ml-2 text-warning">
                      {conflict.reason === 'file_duplicate' ? 'duplicate in file' : 'already exists'}
                    </span>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-2.5 pt-2">
                <button
                  onClick={() => resolveStructureImportConflicts('overwrite')}
                  className="p-3 border border-warning/30 bg-warning/5 text-warning font-semibold text-center rounded-lg hover:bg-warning/15 text-[10px] cursor-pointer"
                >
                  Update Existing
                </button>
                <button
                  onClick={() => resolveStructureImportConflicts('duplicate')}
                  className="p-3 border border-accent/30 bg-accent/5 text-accent font-semibold text-center rounded-lg hover:bg-accent/15 text-[10px] cursor-pointer"
                >
                  Import as Copies
                </button>
                <button
                  onClick={() => resolveStructureImportConflicts('skip')}
                  className="p-3 border border-border bg-surface text-text-secondary text-center rounded-lg hover:bg-surface-hover text-[10px] cursor-pointer"
                >
                  Skip Duplicates
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
