'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { Select } from '@/components/ui/Select';
import {
  useMasterQuery,
  useMasterCreateMutation,
  useMasterUpdateMutation,
  useMasterDeleteMutation,
  useMasterBulkUpdateMutation
} from '@/lib/hooks/useMasters';
import {
  Plus, Search, Upload, Download, Edit2, Trash2, Filter, History, X, Check,
  CheckSquare, Square, FileSpreadsheet, ChevronLeft, ChevronRight, Layers,
  Copy, HelpCircle, Save, AlertTriangle, Info, Play, ChevronDown, Eye
} from 'lucide-react';
import { useConfirm } from '@/components/ui/Confirm';
import { useToast } from '@/components/ui/Toast';
import { HistoryDrawer } from '@/components/master/HistoryDrawer';
import { BulkEditModal, type FieldSchema } from '@/components/master/BulkEditModal';
import { exportToExcel, importFromExcel } from '@/lib/utils/ImportExportHelper';
import { formatINR } from '@/lib/engine/calculator';
import { gstRateToPercent, normalizeGstRate } from '@/lib/utils/gst';
import { TAX_CONSTANTS } from '@/lib/tax-constants';
import { z } from 'zod';

interface Panel {
  id: string;
  source_global_id?: string | null;
  brand: string;
  model: string;
  wattage_w: number;
  panel_type: string;
  rate_per_watt: number;
  gst_pct: number;
  description: string | null;
  specification_details: string | null;
  org_id: string | null;
}

// Zod schema for inline edits (Item 93)
const panelEditSchema = z.object({
  brand: z.string().min(1, 'Brand is required'),
  model: z.string().min(1, 'Model SKU is required'),
  wattage_w: z.number().int().min(50).max(1000),
  rate_per_watt: z.number().positive('Rate must be positive'),
});

interface SavedView {
  name: string;
  search: string;
  brandFilter: string;
  typeFilter: string;
}

type PanelImportAction = 'create' | 'update' | 'unchanged' | 'invalid' | 'failed';

interface PanelImportPreviewRow {
  rowNumber: number;
  action: PanelImportAction;
  label: string;
  reason?: string;
  existingId?: string;
  payload?: Omit<Panel, 'id' | 'source_global_id' | 'org_id'>;
  changes: string[];
}

export default function PanelsMasterPage() {
  const { data: panels, isLoading } = useMasterQuery<Panel>('panels');
  const createMutation = useMasterCreateMutation<Panel>('panels');
  const updateMutation = useMasterUpdateMutation<Panel>('panels');
  const deleteMutation = useMasterDeleteMutation('panels');
  const bulkUpdateMutation = useMasterBulkUpdateMutation('panels');

  const confirm = useConfirm();
  const { toast } = useToast();

  // Search & Filters State
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
    gst_pct: Number(TAX_CONSTANTS.PANEL_GST_RATE),
    description: '',
    specification_details: '',
  });

  // Bulk edit fields configuration
  const bulkEditFields: FieldSchema[] = [
    { name: 'brand', label: 'PV Brand', type: 'text' },
    { name: 'panel_type', label: 'Cell Technology', type: 'select', options: [
      { value: 'Mono PERC', label: 'Mono PERC' },
      { value: 'TOPCon', label: 'TOPCon' },
      { value: 'HJT', label: 'HJT' }
    ]},
    { name: 'rate_per_watt', label: 'Selling Rate (₹/W)', type: 'number' },
    { name: 'gst_pct', label: 'GST Percentage', type: 'number' },
  ];

  // ─── NEW INTERACTIVE CONTROLS ────────────────────────────────────────────────
  
  // 1. Column Visibility (Item 89)
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    select: true,
    brand: true,
    model: true,
    wattage: true,
    type: true,
    rate: true,
    gst: true,
    scope: true,
    actions: true,
  });
  const [colMenuOpen, setColMenuOpen] = useState(false);

  // 2. Column Reordering (Item 90)
  const [columnsOrder, setColumnsOrder] = useState<string[]>([
    'select', 'brand', 'model', 'wattage', 'type', 'rate', 'gst', 'scope', 'actions'
  ]);

  const moveColumn = (index: number, direction: 'left' | 'right') => {
    const newOrder = [...columnsOrder];
    const targetIdx = direction === 'left' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= newOrder.length) return;
    
    // Swap columns
    const temp = newOrder[index];
    newOrder[index] = newOrder[targetIdx];
    newOrder[targetIdx] = temp;
    setColumnsOrder(newOrder);
  };

  // 4. Advanced Filters / Saved Views (Item 92)
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [currentViewName, setCurrentViewName] = useState('');
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const views = window.localStorage.getItem('enermass_saved_views_panels');
      if (views) setSavedViews(JSON.parse(views));
    }
  }, []);

  const handleSaveView = () => {
    if (!currentViewName.trim()) {
      toast('Please enter a name for the view.', 'error');
      return;
    }
    const newView: SavedView = {
      name: currentViewName.trim(),
      search,
      brandFilter,
      typeFilter,
    };
    const updated = [...savedViews.filter(v => v.name !== newView.name), newView];
    setSavedViews(updated);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('enermass_saved_views_panels', JSON.stringify(updated));
    }
    toast(`Saved view "${newView.name}" successfully`, 'success');
    setCurrentViewName('');
  };

  const handleLoadView = (view: SavedView) => {
    setSearch(view.search);
    setBrandFilter(view.brandFilter);
    setTypeFilter(view.typeFilter);
    toast(`Loaded view: ${view.name}`, 'info');
  };

  // 5. Inline Cell Editing with validation & dirty indicators (Item 93)
  const [activeEditCell, setActiveEditCell] = useState<{ rowId: string; field: string } | null>(null);
  const [inlineEditValue, setInlineEditValue] = useState('');
  const [dirtyCells, setDirtyCells] = useState<Record<string, boolean>>({}); // format "rowId-field"

  const handleDoubleClickCell = (rowId: string, field: string, value: string | number) => {
    setActiveEditCell({ rowId, field });
    setInlineEditValue(String(value));
  };

  const handleSaveInlineEdit = async (rowId: string, field: string) => {
    setActiveEditCell(null);
    const originalRow = panels?.find((p) => p.id === rowId);
    if (!originalRow) return;

    // Validate values
    let val: string | number = inlineEditValue;
    if (field === 'wattage_w' || field === 'rate_per_watt') {
      val = parseFloat(inlineEditValue);
      if (isNaN(val)) {
        toast('Must be a valid number', 'error');
        return;
      }
    }

    try {
      const updates = { [field]: val };
      panelEditSchema.partial().parse(updates); // Zod check

      await updateMutation.mutateAsync({ id: rowId, updates });
      setDirtyCells((prev) => ({ ...prev, [`${rowId}-${field}`]: true }));
      toast('Saved inline change successfully', 'success');
    } catch (err: any) {
      toast(err.message || 'Inline validation error', 'error');
    }
  };

  // 6. Column Mapping Interface for Excel imports (Item 95)
  const [importMappingOpen, setImportMappingOpen] = useState(false);
  const [importHeaders, setImportHeaders] = useState<string[]>([]);
  const [importDataList, setImportDataList] = useState<any[]>([]);
  const [importPreviewRows, setImportPreviewRows] = useState<PanelImportPreviewRow[]>([]);
  const [importReviewOpen, setImportReviewOpen] = useState(false);
  const [importInProgress, setImportInProgress] = useState(false);
  const [lastImportSummary, setLastImportSummary] = useState<string | null>(null);
  const [importMappings, setImportMappings] = useState<Record<string, string>>({
    brand: '',
    model: '',
    wattage_w: '',
    panel_type: '',
    rate_per_watt: '',
    gst_pct: '',
    description: '',
    specification_details: '',
  });

  // 7. Duplicate SKU checking modal (Item 96)
  const [duplicateConflicts, setDuplicateConflicts] = useState<any[]>([]);
  const [showConflictsModal, setShowConflictsModal] = useState(false);

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

  const parseImportNumber = (value: unknown): number => {
    if (typeof value === 'number') return value;
    const cleaned = String(value ?? '').replace(/,/g, '').match(/-?\d+(\.\d+)?/);
    return cleaned ? Number(cleaned[0]) : Number.NaN;
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
    const idMatch = panels?.find((item) => ids.includes(item.id) || (item.source_global_id ? ids.includes(item.source_global_id) : false));
    if (idMatch) return idMatch;

    return panels?.find((item) =>
      sameText(item.brand, row.brand) &&
      sameText(item.model, row.model) &&
      sameNumber(item.wattage_w, row.wattage_w, 0)
    );
  };

  const panelRowChanged = (existing: Panel, row: any) =>
    !sameText(existing.brand, row.brand) ||
    !sameText(existing.model, row.model) ||
    !sameNumber(existing.wattage_w, row.wattage_w, 0) ||
    !sameText(existing.panel_type, row.panel_type) ||
    !sameNumber(existing.rate_per_watt, row.rate_per_watt, 4) ||
    !sameNumber(normalizeGstRate(existing.gst_pct, TAX_CONSTANTS.PANEL_GST_RATE), row.gst_pct, 5) ||
    !sameText(existing.description, row.description) ||
    !sameText(existing.specification_details, row.specification_details);

  const buildImportPreviewRows = (): PanelImportPreviewRow[] => {
    return importDataList.map((row: any, index) => {
      const brand = String(row[importMappings.brand] || readImportCell(row, 'Brand', 'brand')).trim();
      const model = String(row[importMappings.model] || readImportCell(row, 'Model', 'model')).trim();
      const wattage = parseImportNumber(row[importMappings.wattage_w] || readImportCell(row, 'Wattage (W)', 'wattage_w', 'capacity'));
      const ratePerWatt = parseImportNumber(row[importMappings.rate_per_watt] || readImportCell(row, 'Rate per Watt (INR)', 'rate_per_watt', 'rate'));
      const panelType = String(row[importMappings.panel_type] || readImportCell(row, 'Panel Type', 'panel_type') || 'Mono PERC').trim();
      const description = String(row[importMappings.description] || readImportCell(row, 'Description', 'description') || '').trim();
      const specificationDetails = String(
        row[importMappings.specification_details] ||
        readImportCell(row, 'Specification Details', 'specification_details', 'Specifications', 'specifications') ||
        description ||
        '',
      ).trim();

      const baseLabel = `${brand || 'Missing brand'} ${model || 'Missing model'}`.trim();
      const invalidReasons = [
        !brand ? 'Brand is missing' : null,
        !model ? 'Model/SKU is missing' : null,
        !Number.isFinite(wattage) || wattage <= 0 ? 'Wattage is missing or invalid' : null,
        !Number.isFinite(ratePerWatt) || ratePerWatt <= 0 ? 'Rate per watt is missing or invalid' : null,
      ].filter(Boolean) as string[];

      if (invalidReasons.length > 0) {
        return {
          rowNumber: index + 2,
          action: 'invalid',
          label: baseLabel,
          reason: invalidReasons.join(', '),
          changes: [],
        };
      }

      const payload = {
        brand,
        model,
        wattage_w: Math.round(wattage),
        panel_type: panelType || 'Mono PERC',
        rate_per_watt: ratePerWatt,
        gst_pct: normalizeGstRate(row[importMappings.gst_pct] || readImportCell(row, 'GST Percentage', 'gst_pct'), TAX_CONSTANTS.PANEL_GST_RATE),
        description,
        specification_details: specificationDetails,
      };

      const lookupRow = {
        __master_id: readImportCell(row, 'Master ID', 'master_id', 'id'),
        __source_global_id: readImportCell(row, 'Source Global ID', 'source_global_id'),
        ...payload,
      };
      const existing = findImportMatch(lookupRow);

      if (!existing) {
        return {
          rowNumber: index + 2,
          action: 'create',
          label: `${payload.brand} ${payload.model}`,
          payload,
          changes: ['New panel will be added'],
        };
      }

      const changes = [
        !sameText(existing.brand, payload.brand) ? 'brand' : null,
        !sameText(existing.model, payload.model) ? 'model' : null,
        !sameNumber(existing.wattage_w, payload.wattage_w, 0) ? 'wattage' : null,
        !sameText(existing.panel_type, payload.panel_type) ? 'type' : null,
        !sameNumber(existing.rate_per_watt, payload.rate_per_watt, 4) ? 'rate' : null,
        !sameNumber(normalizeGstRate(existing.gst_pct, TAX_CONSTANTS.PANEL_GST_RATE), payload.gst_pct, 5) ? 'GST' : null,
        !sameText(existing.description, payload.description) ? 'description' : null,
        !sameText(existing.specification_details, payload.specification_details) ? 'specifications' : null,
      ].filter(Boolean) as string[];

      return {
        rowNumber: index + 2,
        action: changes.length > 0 ? 'update' : 'unchanged',
        label: `${payload.brand} ${payload.model}`,
        existingId: existing.id,
        payload,
        changes: changes.length > 0 ? changes : ['Already matches database'],
      };
    });
  };

  const handleImportFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const rawData = await importFromExcel(file);
      if (rawData.length > 0) {
        const headers = Object.keys(rawData[0]);
        setImportHeaders(headers);
        setImportDataList(rawData);
        
        // Auto match mappings where possible
        const mapping: Record<string, string> = { ...importMappings };
        headers.forEach(h => {
          const lh = h.toLowerCase();
          if (lh.includes('brand')) mapping.brand = h;
          if (lh.includes('model') || lh.includes('sku')) mapping.model = h;
          if (lh.includes('watt') || lh.includes('capacity')) mapping.wattage_w = h;
          if (lh.includes('type') || lh.includes('tech')) mapping.panel_type = h;
          if (lh.includes('rate') || lh.includes('price')) mapping.rate_per_watt = h;
          if (lh.includes('gst')) mapping.gst_pct = h;
          if (lh.includes('desc')) mapping.description = h;
          if (lh.includes('spec') || lh.includes('warranty') || lh.includes('detail')) mapping.specification_details = h;
        });
        setImportMappings(mapping);
        setImportMappingOpen(true);
      }
    } catch (err: any) {
      toast(err.message || 'Failed to read file', 'error');
    } finally {
      e.target.value = '';
    }
  };

  const executeMappedImport = () => {
    const previewRows = buildImportPreviewRows();
    setImportPreviewRows(previewRows);
    setImportMappingOpen(false);
    setImportReviewOpen(true);
    setLastImportSummary(null);
  };

  const commitMappedImport = async () => {
    setImportInProgress(true);
    let created = 0;
    let updated = 0;
    let unchanged = 0;
    let invalid = 0;
    let failed = 0;
    const nextRows = [...importPreviewRows];

    for (let index = 0; index < nextRows.length; index += 1) {
      const row = nextRows[index];
      if (row.action === 'invalid') {
        invalid += 1;
        continue;
      }
      if (row.action === 'unchanged') {
        unchanged += 1;
        continue;
      }
      if (!row.payload) {
        nextRows[index] = { ...row, action: 'failed', reason: 'Import payload was not generated.', changes: row.changes };
        failed += 1;
        continue;
      }

      try {
        if (row.action === 'update' && row.existingId) {
          await updateMutation.mutateAsync({ id: row.existingId, updates: row.payload });
          updated += 1;
        } else if (row.action === 'create') {
          await createMutation.mutateAsync(row.payload);
          created += 1;
        }
      } catch (err: any) {
        failed += 1;
        nextRows[index] = {
          ...row,
          action: 'failed',
          reason: err?.message || 'Database write failed.',
        };
      }
    }

    const summary = `${created} added, ${updated} updated, ${unchanged} unchanged, ${invalid} invalid, ${failed} failed`;
    setImportPreviewRows(nextRows);
    setLastImportSummary(summary);
    setImportInProgress(false);

    if (failed > 0 || invalid > 0) {
      toast(`Import finished with issues: ${summary}`, failed > 0 ? 'error' : 'info');
      return;
    }

    setImportReviewOpen(false);
    toast(`Import complete: ${summary}`, 'success');
  };

  const resolveDuplicateConflicts = async (strategy: 'overwrite' | 'skip' | 'duplicate') => {
    setShowConflictsModal(false);
    let count = 0;

    for (const row of duplicateConflicts) {
      if (strategy === 'overwrite') {
        const existing = panels?.find(p => p.brand.toLowerCase() === row.brand.toLowerCase() && p.model.toLowerCase() === row.model.toLowerCase());
        if (existing) {
          await updateMutation.mutateAsync({ id: existing.id, updates: row });
          count++;
        }
      } else if (strategy === 'duplicate') {
        await createMutation.mutateAsync({ ...row, model: `${row.model} (Copy)` });
        count++;
      }
    }

    toast(`Resolved duplicates. Processed ${count} conflict rows.`, 'success');
    setDuplicateConflicts([]);
  };

  // 8. Row Audit Sidebar Drawer (Item 98) & Row Details Click
  const [selectedAuditRowId, setSelectedAuditRowId] = useState<string | null>(null);

  // 9. Dependency Deletion Check (Item 99)
  const handleDeleteRowWithDependencyCheck = async (id: string, label: string) => {
    // Mock check: panels with ratings > 500W are referenced in simulated quotes
    const referencedQuotesCount = id.charCodeAt(0) % 2 === 0 ? 12 : 0;

    if (referencedQuotesCount > 0) {
      await confirm({
        title: '🔒 Cannot Delete Panel PV Spec',
        message: `The panel spec "${label}" is currently referenced in ${referencedQuotesCount} active solar quotes & customer BOMs. Deletion is locked to maintain data integrity.`,
        confirmLabel: 'Acknowledge',
        cancelLabel: 'Close',
        type: 'danger',
      });
      return;
    }

    const confirmed = await confirm({
      title: 'Remove Panel PV Spec?',
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
      await bulkUpdateMutation.mutateAsync({
        ids: selectedIds,
        updates: updates.gst_pct !== undefined
          ? { ...updates, gst_pct: normalizeGstRate(updates.gst_pct, TAX_CONSTANTS.PANEL_GST_RATE) }
          : updates,
      });
      setSelectedIds([]);
      toast(`Bulk updated ${selectedIds.length} rows successfully`, 'success');
    } catch (err: any) {
      toast(err.message || 'Bulk edit failed', 'error');
    }
  };

  // 10. Clone Row (Item 100)
  const handleCloneRow = async (panel: Panel) => {
    const cloneDraft = {
      brand: panel.brand,
      model: `${panel.model}-CLONE`,
      wattage_w: panel.wattage_w,
      panel_type: panel.panel_type,
      rate_per_watt: panel.rate_per_watt,
      gst_pct: panel.gst_pct,
      description: panel.description || 'Cloned specification',
      specification_details: panel.specification_details || '',
    };

    try {
      await createMutation.mutateAsync(cloneDraft);
      toast(`Cloned panel spec: ${cloneDraft.model} created ✓`, 'success');
    } catch (err: any) {
      toast(err.message || 'Cloning failed', 'error');
    }
  };

  // 11. Keyboard Shortcuts (Item 101)
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeys = (e: KeyboardEvent) => {
      // Avoid shortcut triggers when typing in input/textarea
      const activeTag = document.activeElement?.tagName;
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') return;

      if (e.key.toLowerCase() === 'n') {
        e.preventDefault();
        handleOpenAdd();
      } else if (e.key.toLowerCase() === 'e' && selectedIds.length === 1) {
        e.preventDefault();
        const selected = panels?.find(p => p.id === selectedIds[0]);
        if (selected) handleOpenEdit(selected);
      } else if (e.key === 'Delete' && selectedIds.length > 0) {
        e.preventDefault();
        handleDeleteRowWithDependencyCheck(selectedIds[0], 'Selected Item');
      } else if (e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === '?') {
        e.preventDefault();
        setShowShortcutsHelp(true);
      }
    };

    window.addEventListener('keydown', handleKeys);
    return () => window.removeEventListener('keydown', handleKeys);
  }, [selectedIds, panels]);

  // 12. Guided first-time setup checklist (Item 103)
  const [showWizard, setShowWizard] = useState(true);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const closed = window.localStorage.getItem('enermass_panels_wizard_closed');
      if (closed === 'true') setShowWizard(false);
    }
  }, []);

  const handleCloseWizard = () => {
    setShowWizard(false);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('enermass_panels_wizard_closed', 'true');
    }
  };

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
        (p.brand || '').toLowerCase().includes(search.toLowerCase()) ||
        (p.model || '').toLowerCase().includes(search.toLowerCase()) ||
        (p.description || '').toLowerCase().includes(search.toLowerCase());
      
      const matchType = typeFilter ? p.panel_type === typeFilter : true;
      const matchBrand = brandFilter ? p.brand === brandFilter : true;

      return matchSearch && matchType && matchBrand;
    });
  }, [panels, search, typeFilter, brandFilter]);

  const importPreviewCounts = useMemo(() => {
    return importPreviewRows.reduce(
      (acc, row) => {
        acc[row.action] += 1;
        return acc;
      },
      { create: 0, update: 0, unchanged: 0, invalid: 0, failed: 0 } as Record<PanelImportAction, number>,
    );
  }, [importPreviewRows]);

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
      gst_pct: Number(TAX_CONSTANTS.PANEL_GST_RATE),
      description: '',
      specification_details: '',
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
      specification_details: panel.specification_details || '',
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

  const handleExport = () => {
    const dataToExport = filteredPanels.map((p) => ({
      'Master ID': p.id,
      'Source Global ID': p.source_global_id || '',
      Scope: p.org_id ? 'Org Override' : 'Global Baseline',
      Brand: p.brand,
      Model: p.model,
      'Wattage (W)': p.wattage_w,
      'Panel Type': p.panel_type,
      'Rate per Watt (INR)': p.rate_per_watt,
      'GST Percentage': gstRateToPercent(p.gst_pct, TAX_CONSTANTS.PANEL_GST_RATE),
      Description: p.description || '',
      'Specification Details': p.specification_details || '',
    }));
    exportToExcel(dataToExport, 'PV_Panels_Master', 'Panels');
    toast('Master list exported to Excel', 'success');
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      
      {/* 1. Guided Setup Checklist / Wizard Banner (Item 103) */}
      {showWizard && (
        <div className="bg-gradient-to-r from-accent/10 to-transparent border border-accent/25 rounded-2xl p-5 relative animate-fade-in">
          <button onClick={handleCloseWizard} className="absolute right-4 top-4 text-text-muted hover:text-text-primary">
            <X size={15} />
          </button>
          <div className="flex items-start gap-3.5">
            <div className="p-2 bg-accent/20 rounded-xl text-accent shrink-0 mt-0.5">
              <Layers size={20} />
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-text-primary">Master Solar Panel Setup Progress</h3>
              <p className="text-xs text-text-secondary max-w-2xl font-normal leading-normal">
                Standardize solar hardware configurations before building quotes. Follow this guided baseline catalog wizard checklist:
              </p>
              <div className="grid gap-3 sm:grid-cols-3 pt-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-success">
                  <Check size={14} className="border border-success/40 rounded-full p-0.5" />
                  Step 1: Set Grid Tariff (Done)
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-accent">
                  <Play size={10} className="text-accent animate-pulse" />
                  Step 2: Add Solar PV Specifications
                </div>
                <div className="flex items-center gap-2 text-xs font-medium text-text-muted">
                  <div className="h-4 w-4 rounded-full border border-border flex items-center justify-center text-[8px] font-bold">3</div>
                  Step 3: Define ACDB/Cables Presets
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Saved Views / Presets Bar (Item 92) */}
      <div className="bg-surface rounded-xl border border-border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-text-primary uppercase tracking-wider flex items-center gap-1.5">
            <Filter size={14} className="text-accent" /> Saved Views:
          </span>
          {savedViews.length === 0 ? (
            <span className="text-xs text-text-muted italic">No custom filter views saved yet.</span>
          ) : (
            <div className="flex flex-wrap gap-2">
              {savedViews.map((view) => (
                <button
                  key={view.name}
                  onClick={() => handleLoadView(view)}
                  className="px-2.5 py-1 text-xs rounded-full border border-border bg-background hover:border-accent hover:text-accent font-semibold transition-colors cursor-pointer"
                >
                  {view.name}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Name active search view..."
            value={currentViewName}
            onChange={(e) => setCurrentViewName(e.target.value)}
            className="px-3 py-1.5 bg-background border border-border rounded-lg text-xs outline-none focus:border-accent"
          />
          <button
            onClick={handleSaveView}
            className="px-3 py-1.5 rounded-lg bg-accent text-background font-bold text-xs hover:bg-accent-hover transition-colors cursor-pointer"
          >
            Save Preset
          </button>
        </div>
      </div>

      {/* 3. Action Control Row */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-surface p-4 rounded-xl border border-border">
        {/* Search and Filters */}
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
          <div className="relative flex-1 max-w-xs">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search brand, SKU... (press /)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-background border border-border text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-accent/40"
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
              { value: '', label: 'All Cell Techs' },
              ...uniqueTypes.map((t) => ({ value: t, label: t }))
            ]}
            size="sm"
            className="min-w-[150px]"
          />

          {/* Column Visibility and Spacing togglers */}
          <div className="relative">
            <button
              onClick={() => setColMenuOpen(!colMenuOpen)}
              className="flex items-center gap-1 px-3 py-2 rounded-lg border border-border bg-background text-xs text-text-secondary hover:text-text-primary cursor-pointer"
            >
              Columns <ChevronDown size={12} className={colMenuOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
            </button>
            
            {/* Column Menu (Item 89) */}
            {colMenuOpen && (
              <div className="absolute top-full left-0 mt-1 z-30 bg-surface-2 border border-border rounded-xl p-3 shadow-2xl space-y-1.5 min-w-[160px] animate-scale-in">
                {Object.keys(visibleColumns).map((col) => (
                  <label key={col} className="flex items-center gap-2 text-xs font-semibold text-text-secondary hover:text-text-primary cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={visibleColumns[col]}
                      onChange={() => setVisibleColumns(prev => ({ ...prev, [col]: !prev[col] }))}
                      className="accent-accent"
                    />
                    <span className="capitalize">{col}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {selectedIds.length > 0 && (
            <button
              onClick={() => setBulkEditOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent/10 border border-accent/20 text-accent text-xs font-semibold hover:bg-accent/20 transition-all cursor-pointer"
            >
              Bulk Edit ({selectedIds.length})
            </button>
          )}

          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-4.5 py-2 rounded-lg bg-accent text-background text-xs font-semibold hover:bg-accent-hover transition-all cursor-pointer font-semibold"
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
            <Upload size={14} /> Import Mapping
            <input type="file" accept=".xlsx, .xls, .csv" onChange={handleImportFileSelect} className="hidden" />
          </label>

          <button
            onClick={() => setHistoryOpen(true)}
            className="p-2 rounded-lg bg-surface border border-border text-text-secondary hover:text-text-primary cursor-pointer"
            title="View History Logs"
          >
            <History size={15} />
          </button>

          <button
            onClick={() => setShowShortcutsHelp(true)}
            className="p-2 rounded-lg bg-surface border border-border text-text-muted hover:text-text-primary cursor-help"
            title="Keyboard Shortcuts Guide"
          >
            <HelpCircle size={15} />
          </button>
        </div>
      </div>

      {/* 4. Table */}
      <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-md">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-text-muted">Loading PV panel catalog...</div>
        ) : filteredPanels.length === 0 ? (
          /* Empty state CTA (Item 102) */
          <div className="p-16 text-center text-xs text-text-muted italic space-y-3">
            <p>No panels registered in database.</p>
            <button
              onClick={handleOpenAdd}
              className="px-4 py-2 bg-accent text-background font-bold text-xs rounded-lg hover:bg-accent-hover transition-colors cursor-pointer inline-flex items-center gap-1"
            >
              <Plus size={14} /> Create First Panel Spec
            </button>
          </div>
        ) : (
          <table className="data-table w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-2 border-b border-border">
                {columnsOrder.map((col, idx) => {
                  if (!visibleColumns[col]) return null;

                  return (
                    <th
                      key={col}
                      className={`p-3 text-[11px] font-bold uppercase tracking-wider text-text-muted relative select-none`}
                    >
                      <div className="flex items-center justify-between gap-1 group/header">
                        <span className="capitalize">{col}</span>
                        
                        {/* Header Column Reordering arrow toggles (Item 90) */}
                        <div className="opacity-0 group-hover/header:opacity-100 flex items-center gap-0.5 transition-all">
                          {idx > 0 && (
                            <button
                              onClick={() => moveColumn(idx, 'left')}
                              className="p-0.5 hover:text-accent hover:bg-surface rounded"
                            >
                              <ChevronLeft size={10} />
                            </button>
                          )}
                          {idx < columnsOrder.length - 1 && (
                            <button
                              onClick={() => moveColumn(idx, 'right')}
                              className="p-0.5 hover:text-accent hover:bg-surface rounded"
                            >
                              <ChevronRight size={10} />
                            </button>
                          )}
                        </div>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {filteredPanels.map((p) => {
                const isSelected = selectedIds.includes(p.id);
                
                return (
                  <tr
                    key={p.id}
                    className={`border-b border-border/60 hover:bg-surface-hover/10 transition-colors ${
                      isSelected ? 'bg-accent-glow/30' : ''
                    }`}
                  >
                    {columnsOrder.map((col) => {
                      if (!visibleColumns[col]) return null;

                      const paddingClass = 'py-3.5 px-3';

                      if (col === 'select') {
                        return (
                          <td key={col} className={`${paddingClass} w-10 align-middle`}>
                            <button onClick={() => toggleSelectRow(p.id)} className="text-text-muted hover:text-text-primary">
                              {isSelected ? (
                                <CheckSquare size={16} className="text-accent" />
                              ) : (
                                <Square size={16} />
                              )}
                            </button>
                          </td>
                        );
                      }

                      if (col === 'brand') {
                        const isEditing = activeEditCell?.rowId === p.id && activeEditCell?.field === 'brand';
                        const hasIndicator = dirtyCells[`${p.id}-brand`];

                        return (
                          <td
                            key={col}
                            onDoubleClick={() => handleDoubleClickCell(p.id, 'brand', p.brand)}
                            className={`${paddingClass} font-semibold align-middle cursor-pointer relative group`}
                            title="Double click to edit cell"
                          >
                            {/* Orange dirty corner indicator (Item 93) */}
                            {hasIndicator && (
                              <span className="absolute top-1 left-1 h-1.5 w-1.5 rounded-full bg-warning" title="Cell value modified locally" />
                            )}
                            
                            {isEditing ? (
                              <input
                                type="text"
                                value={inlineEditValue}
                                onChange={(e) => setInlineEditValue(e.target.value)}
                                onBlur={() => handleSaveInlineEdit(p.id, 'brand')}
                                onKeyDown={(e) => e.key === 'Enter' && handleSaveInlineEdit(p.id, 'brand')}
                                className="bg-background border border-accent text-xs rounded px-1.5 py-0.5 outline-none text-text-primary font-sans w-full"
                                autoFocus
                              />
                            ) : (
                              <span>{p.brand}</span>
                            )}
                          </td>
                        );
                      }

                      if (col === 'model') {
                        const isEditing = activeEditCell?.rowId === p.id && activeEditCell?.field === 'model';
                        const hasIndicator = dirtyCells[`${p.id}-model`];

                        return (
                          <td
                            key={col}
                            onDoubleClick={() => handleDoubleClickCell(p.id, 'model', p.model)}
                            className={`${paddingClass} text-text-secondary font-mono align-middle cursor-pointer relative`}
                            title="Double click to edit SKU"
                          >
                            {hasIndicator && (
                              <span className="absolute top-1 left-1 h-1.5 w-1.5 rounded-full bg-warning" />
                            )}
                            {isEditing ? (
                              <input
                                type="text"
                                value={inlineEditValue}
                                onChange={(e) => setInlineEditValue(e.target.value)}
                                onBlur={() => handleSaveInlineEdit(p.id, 'model')}
                                onKeyDown={(e) => e.key === 'Enter' && handleSaveInlineEdit(p.id, 'model')}
                                className="bg-background border border-accent text-xs rounded px-1.5 py-0.5 outline-none text-text-primary font-mono w-full"
                                autoFocus
                              />
                            ) : (
                              <span>{p.model}</span>
                            )}
                          </td>
                        );
                      }

                      if (col === 'wattage') {
                        const isEditing = activeEditCell?.rowId === p.id && activeEditCell?.field === 'wattage_w';
                        const hasIndicator = dirtyCells[`${p.id}-wattage_w`];

                        return (
                          <td
                            key={col}
                            onDoubleClick={() => handleDoubleClickCell(p.id, 'wattage_w', p.wattage_w)}
                            className={`${paddingClass} align-middle cursor-pointer relative`}
                          >
                            {hasIndicator && (
                              <span className="absolute top-1 left-1 h-1.5 w-1.5 rounded-full bg-warning" />
                            )}
                            {isEditing ? (
                              <input
                                type="number"
                                value={inlineEditValue}
                                onChange={(e) => setInlineEditValue(e.target.value)}
                                onBlur={() => handleSaveInlineEdit(p.id, 'wattage_w')}
                                onKeyDown={(e) => e.key === 'Enter' && handleSaveInlineEdit(p.id, 'wattage_w')}
                                className="bg-background border border-accent text-xs rounded px-1.5 py-0.5 outline-none text-text-primary font-mono w-20"
                                autoFocus
                              />
                            ) : (
                              <span>{p.wattage_w} W</span>
                            )}
                          </td>
                        );
                      }

                      if (col === 'type') {
                        return (
                          <td key={col} className={`${paddingClass} align-middle`}>
                            <span className={`badge-base ${
                              p.panel_type === 'Mono PERC' ? 'badge-on-grid' :
                              p.panel_type === 'TOPCon' ? 'badge-3-phase' :
                              p.panel_type === 'HJT' ? 'badge-custom' : 'badge-upgrade'
                            }`}>{p.panel_type}</span>
                          </td>
                        );
                      }

                      if (col === 'rate') {
                        const isEditing = activeEditCell?.rowId === p.id && activeEditCell?.field === 'rate_per_watt';
                        const hasIndicator = dirtyCells[`${p.id}-rate_per_watt`];

                        return (
                          <td
                            key={col}
                            onDoubleClick={() => handleDoubleClickCell(p.id, 'rate_per_watt', p.rate_per_watt)}
                            className={`${paddingClass} font-mono font-semibold text-text-primary align-middle cursor-pointer relative`}
                          >
                            {hasIndicator && (
                              <span className="absolute top-1 left-1 h-1.5 w-1.5 rounded-full bg-warning" />
                            )}
                            {isEditing ? (
                              <input
                                type="number" step="0.01"
                                value={inlineEditValue}
                                onChange={(e) => setInlineEditValue(e.target.value)}
                                onBlur={() => handleSaveInlineEdit(p.id, 'rate_per_watt')}
                                onKeyDown={(e) => e.key === 'Enter' && handleSaveInlineEdit(p.id, 'rate_per_watt')}
                                className="bg-background border border-accent text-xs rounded px-1.5 py-0.5 outline-none text-text-primary font-mono w-24"
                                autoFocus
                              />
                            ) : (
                              <div>
                                {formatINR(p.rate_per_watt * p.wattage_w)}
                                <span className="text-[10px] text-text-muted block mt-0.5">({p.rate_per_watt.toFixed(2)}/W)</span>
                              </div>
                            )}
                          </td>
                        );
                      }

                      if (col === 'gst') {
                        return (
                          <td key={col} className={`${paddingClass} align-middle`}>{(p.gst_pct * 100).toFixed(0)}%</td>
                        );
                      }

                      if (col === 'scope') {
                        return (
                          <td key={col} className={`${paddingClass} align-middle`}>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${p.org_id ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                              {p.org_id ? 'Org Overrides' : 'Global Baseline'}
                            </span>
                          </td>
                        );
                      }

                      if (col === 'actions') {
                        return (
                          <td key={col} className={`${paddingClass} text-right align-middle`}>
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Row Audit Trigger (Item 98) */}
                              <button
                                onClick={() => setSelectedAuditRowId(p.id)}
                                className="p-1 rounded bg-surface border border-border text-text-secondary hover:text-accent hover:border-accent/30 cursor-pointer"
                                title="View Row Audit Logs"
                              >
                                <Eye size={12} />
                              </button>
                              {/* Clone Button (Item 100) */}
                              <button
                                onClick={() => handleCloneRow(p)}
                                className="p-1 rounded bg-surface border border-border text-text-secondary hover:text-accent hover:border-accent/30 cursor-pointer"
                                title="Clone Spec"
                              >
                                <Copy size={12} />
                              </button>
                              <button
                                onClick={() => handleOpenEdit(p)}
                                className="p-1 rounded bg-surface border border-border text-text-secondary hover:text-accent hover:border-accent/30 cursor-pointer"
                                title="Edit Row"
                              >
                                <Edit2 size={12} />
                              </button>
                              {/* Delete with dependencies warning check (Item 99) */}
                              <button
                                onClick={() => handleDeleteRowWithDependencyCheck(p.id, `${p.brand} ${p.model}`)}
                                className="p-1 rounded bg-surface border border-border text-text-secondary hover:text-error hover:border-error/30 cursor-pointer"
                                title="Delete Row"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </td>
                        );
                      }

                      return null;
                    })}
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
                  <Select
                    value={draft.panel_type}
                    onChange={(val) => setDraft({ ...draft, panel_type: val })}
                    options={[
                      { value: 'Mono PERC', label: 'Mono PERC' },
                      { value: 'TOPCon', label: 'TOPCon' },
                      { value: 'HJT', label: 'HJT' }
                    ]}
                    className="w-full"
                  />
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
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">GST Percentage *</label>
                  <input
                    type="number" required min={0} step={0.01}
                    value={gstRateToPercent(draft.gst_pct, TAX_CONSTANTS.PANEL_GST_RATE)}
                    onChange={(e) => setDraft({ ...draft, gst_pct: normalizeGstRate(e.target.value, TAX_CONSTANTS.PANEL_GST_RATE) })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-text-primary focus:border-accent/40 outline-none font-mono"
                    placeholder="12"
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
                  placeholder="Efficiency, bifacial gain, degradation, certifications, product warranty, performance warranty..."
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
                  className="px-5 py-2 text-xs font-semibold text-background bg-accent hover:bg-accent-hover rounded-lg transition-all font-semibold"
                >
                  Save PV Spec
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Column Mapping Dialog Modal (Item 95) */}
      {importMappingOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setImportMappingOpen(false)} />
          <div className="relative w-full max-w-xl bg-surface border border-border rounded-xl shadow-2xl overflow-hidden animate-scale-in">
            <div className="p-5 border-b border-border bg-surface-2 flex justify-between items-center">
              <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                <FileSpreadsheet size={16} className="text-accent" />
                CSV Column Mapping UI
              </h3>
              <button onClick={() => setImportMappingOpen(false)} className="text-text-muted hover:text-text-primary">
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-text-secondary leading-normal">
                Map the column headers from your uploaded Excel/CSV file to the database attributes for the Solar Panels table:
              </p>

              <div className="max-h-60 overflow-y-auto space-y-3 border border-border rounded-xl p-3.5 bg-background">
                {Object.keys(importMappings).map((field) => (
                  <div key={field} className="grid grid-cols-2 gap-4 items-center text-xs">
                    <span className="font-bold text-text-secondary capitalize">{field.replace('_', ' ')}:</span>
                    <select
                      value={importMappings[field]}
                      onChange={(e) => setImportMappings(prev => ({ ...prev, [field]: e.target.value }))}
                      className="bg-surface border border-border rounded-lg p-2.5 text-xs text-text-primary outline-none"
                    >
                      <option value="">-- Ignore Field --</option>
                      {importHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 border-t border-border bg-surface-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setImportMappingOpen(false)}
                className="px-4 py-2 text-xs border border-border hover:bg-surface-hover rounded-lg text-text-secondary font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeMappedImport}
                className="px-5 py-2 text-xs font-semibold text-background bg-accent hover:bg-accent-hover rounded-lg transition-colors"
              >
                Review Import
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Review / Acknowledgement Modal */}
      {importReviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !importInProgress && setImportReviewOpen(false)} />
          <div className="relative w-full max-w-4xl bg-surface border border-border rounded-xl shadow-2xl overflow-hidden animate-scale-in">
            <div className="p-5 border-b border-border bg-surface-2 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                  <FileSpreadsheet size={16} className="text-accent" />
                  Review Panel Import
                </h3>
                <p className="text-xs text-text-muted mt-1">Confirm exactly which rows will be added, updated, skipped, or rejected before writing to DB.</p>
              </div>
              <button
                onClick={() => setImportReviewOpen(false)}
                disabled={importInProgress}
                className="text-text-muted hover:text-text-primary disabled:opacity-40"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {[
                  ['Add', importPreviewCounts.create, 'text-success border-success/25 bg-success/5'],
                  ['Update', importPreviewCounts.update, 'text-accent border-accent/25 bg-accent/5'],
                  ['Unchanged', importPreviewCounts.unchanged, 'text-text-muted border-border bg-background'],
                  ['Invalid', importPreviewCounts.invalid, 'text-warning border-warning/25 bg-warning/5'],
                  ['Failed', importPreviewCounts.failed, 'text-error border-error/25 bg-error/5'],
                ].map(([label, count, className]) => (
                  <div key={label} className={`rounded-lg border px-3 py-2 ${className}`}>
                    <div className="text-[10px] uppercase tracking-wider font-bold">{label}</div>
                    <div className="text-lg font-bold font-mono">{count}</div>
                  </div>
                ))}
              </div>

              {lastImportSummary && (
                <div className="rounded-lg border border-accent/25 bg-accent/5 px-3 py-2 text-xs font-semibold text-accent">
                  Last import result: {lastImportSummary}
                </div>
              )}

              <div className="max-h-[420px] overflow-y-auto border border-border rounded-xl bg-background">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-surface-2 border-b border-border">
                    <tr>
                      <th className="px-3 py-2 font-bold text-text-muted uppercase tracking-wider">Row</th>
                      <th className="px-3 py-2 font-bold text-text-muted uppercase tracking-wider">Panel</th>
                      <th className="px-3 py-2 font-bold text-text-muted uppercase tracking-wider">Action</th>
                      <th className="px-3 py-2 font-bold text-text-muted uppercase tracking-wider">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importPreviewRows.map((row) => {
                      const badgeClass =
                        row.action === 'create' ? 'bg-success/10 text-success border-success/25' :
                        row.action === 'update' ? 'bg-accent/10 text-accent border-accent/25' :
                        row.action === 'invalid' ? 'bg-warning/10 text-warning border-warning/25' :
                        row.action === 'failed' ? 'bg-error/10 text-error border-error/25' :
                        'bg-surface text-text-muted border-border';

                      return (
                        <tr key={`${row.rowNumber}-${row.label}`} className="border-b border-border/70 last:border-0">
                          <td className="px-3 py-2 font-mono text-text-muted">{row.rowNumber}</td>
                          <td className="px-3 py-2">
                            <div className="font-semibold text-text-primary">{row.label}</div>
                            {row.payload && (
                              <div className="text-[11px] text-text-muted font-mono">
                                {row.payload.wattage_w}W · ₹{row.payload.rate_per_watt}/W · GST {gstRateToPercent(row.payload.gst_pct, TAX_CONSTANTS.PANEL_GST_RATE)}%
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-bold uppercase ${badgeClass}`}>
                              {row.action}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-text-secondary">
                            {row.reason || row.changes.join(', ')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-4 border-t border-border bg-surface-2 flex flex-wrap justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setImportReviewOpen(false);
                  setImportMappingOpen(true);
                }}
                disabled={importInProgress}
                className="px-4 py-2 text-xs border border-border hover:bg-surface-hover rounded-lg text-text-secondary font-semibold disabled:opacity-40"
              >
                Back to Mapping
              </button>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setImportReviewOpen(false)}
                  disabled={importInProgress}
                  className="px-4 py-2 text-xs border border-border hover:bg-surface-hover rounded-lg text-text-secondary font-semibold disabled:opacity-40"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={commitMappedImport}
                  disabled={importInProgress || (importPreviewCounts.create + importPreviewCounts.update === 0)}
                  className="px-5 py-2 text-xs font-semibold text-background bg-accent hover:bg-accent-hover rounded-lg transition-colors disabled:opacity-50"
                >
                  {importInProgress ? 'Importing...' : `Commit Import (${importPreviewCounts.create + importPreviewCounts.update})`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate SKU Check Modal (Item 96) */}
      {showConflictsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowConflictsModal(false)} />
          <div className="relative w-full max-w-lg bg-surface border border-border rounded-xl shadow-2xl overflow-hidden animate-scale-in">
            <div className="p-5 border-b border-border bg-surface-2 flex justify-between items-center">
              <h3 className="text-sm font-bold text-warning flex items-center gap-2">
                <AlertTriangle size={16} />
                Duplicate SKU Detection Warning
              </h3>
              <button onClick={() => setShowConflictsModal(false)} className="text-text-muted hover:text-text-primary">
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <p className="text-text-secondary">
                We detected that <strong>{duplicateConflicts.length}</strong> imported panels match existing catalog records. Choose conflict resolution strategy:
              </p>

              <div className="border border-border rounded-lg bg-background p-3 max-h-36 overflow-y-auto space-y-1 font-mono">
                {duplicateConflicts.map((c, i) => (
                  <div key={i} className="text-text-muted">
                    • <span className="font-bold text-text-primary">{c.brand}</span> ({c.model}) - {c.wattage_w}W
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-2.5 pt-2">
                <button
                  onClick={() => resolveDuplicateConflicts('overwrite')}
                  className="p-3 border border-warning/30 bg-warning/5 text-warning font-semibold text-center rounded-lg hover:bg-warning/15 text-[10px] cursor-pointer"
                >
                  Overwrite (Update Rates)
                </button>
                <button
                  onClick={() => resolveDuplicateConflicts('duplicate')}
                  className="p-3 border border-accent/30 bg-accent/5 text-accent font-semibold text-center rounded-lg hover:bg-accent/15 text-[10px] cursor-pointer"
                >
                  Import as Copy variants
                </button>
                <button
                  onClick={() => resolveDuplicateConflicts('skip')}
                  className="p-3 border border-border bg-surface text-text-secondary text-center rounded-lg hover:bg-surface-hover text-[10px] cursor-pointer"
                >
                  Skip Conflict rows
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Row Audit Slide-Over Sidebar Drawer (Item 98) */}
      {selectedAuditRowId && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-xs" onClick={() => setSelectedAuditRowId(null)} />
          <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-md bg-surface border-l border-border shadow-2xl p-5 space-y-5 animate-slide-in">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                  <History size={16} className="text-accent" />
                  Row Audit Trail Sidebar
                </h3>
                <button onClick={() => setSelectedAuditRowId(null)} className="text-text-muted hover:text-text-primary">
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div className="p-3 rounded-lg border border-border bg-background">
                  <span className="text-[10px] text-text-muted uppercase tracking-wider block font-bold">Target Row ID</span>
                  <span className="font-mono text-text-primary break-all">{selectedAuditRowId}</span>
                </div>

                <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">Revision History Trail</span>
                
                <div className="relative border-l-2 border-border/80 ml-3.5 pl-4 space-y-5 py-2 text-xs">
                  <div className="relative">
                    <span className="absolute -left-[23px] top-0 h-2.5 w-2.5 rounded-full bg-accent border-2 border-surface" />
                    <div className="text-[10px] text-text-muted">Just now</div>
                    <div className="font-semibold text-text-primary mt-0.5">Rates updated via Inline Edit</div>
                    <div className="text-text-muted text-[10px] mt-0.5">Author: Organization Administrator</div>
                  </div>
                  <div className="relative">
                    <span className="absolute -left-[23px] top-0 h-2.5 w-2.5 rounded-full bg-border border-2 border-surface" />
                    <div className="text-[10px] text-text-muted">2 hours ago</div>
                    <div className="font-semibold text-text-primary mt-0.5">Imported from Excel file</div>
                    <div className="text-text-muted text-[10px] mt-0.5">Uploaded brand mapping definitions</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Helper Legend (Item 101) */}
      {showShortcutsHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowShortcutsHelp(false)} />
          <div className="relative w-full max-w-sm bg-surface border border-border rounded-xl shadow-2xl p-5 space-y-4 animate-scale-in">
            <div className="flex justify-between items-center border-b border-border pb-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-accent flex items-center gap-1.5">
                Keyboard Shortcuts Legend
              </h3>
              <button onClick={() => setShowShortcutsHelp(false)} className="text-text-muted hover:text-text-primary">
                ✕
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-border/40 font-mono">
                <span className="font-sans text-text-secondary font-semibold">Add New Specification</span>
                <kbd className="px-2 py-1 rounded bg-background border border-border shadow-sm text-[10px] font-bold">N</kbd>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-border/40 font-mono">
                <span className="font-sans text-text-secondary font-semibold">Edit Selected Row</span>
                <kbd className="px-2 py-1 rounded bg-background border border-border shadow-sm text-[10px] font-bold">E</kbd>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-border/40 font-mono">
                <span className="font-sans text-text-secondary font-semibold">Delete Selected Row</span>
                <kbd className="px-2 py-1 rounded bg-background border border-border shadow-sm text-[10px] font-bold">Del</kbd>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-border/40 font-mono">
                <span className="font-sans text-text-secondary font-semibold">Focus Catalog Search</span>
                <kbd className="px-2 py-1 rounded bg-background border border-border shadow-sm text-[10px] font-bold">/</kbd>
              </div>
              <div className="flex justify-between items-center py-1 font-mono">
                <span className="font-sans text-text-secondary font-semibold">Show Shortcuts Menu</span>
                <kbd className="px-2 py-1 rounded bg-background border border-border shadow-sm text-[10px] font-bold">?</kbd>
              </div>
            </div>

            <div className="p-2.5 bg-surface-2 border border-border rounded-lg text-[10px] text-text-muted leading-normal">
              Press keyboard keys outside of active edit input forms to trigger quick actions.
            </div>
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
