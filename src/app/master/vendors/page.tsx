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
  History,
  X,
  Check,
  CheckSquare,
  Square,
  User,
  Mail,
  Phone,
  MapPin,
  FileText,
  Truck
} from 'lucide-react';
import { useConfirm } from '@/components/ui/Confirm';
import { useToast } from '@/components/ui/Toast';
import { HistoryDrawer } from '@/components/master/HistoryDrawer';
import { BulkEditModal, type FieldSchema } from '@/components/master/BulkEditModal';
import { exportToExcel, importFromExcel } from '@/lib/utils/ImportExportHelper';

interface Vendor {
  id: string;
  org_id: string;
  name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  gst_number: string | null;
  address: string | null;
  quality_score?: number | null;
  rates_url?: string | null;
  created_at: string;
}

export default function VendorsMasterPage() {
  const { data: vendors, isLoading } = useMasterQuery<Vendor>('vendors');
  const createMutation = useMasterCreateMutation<Vendor>('vendors');
  const updateMutation = useMasterUpdateMutation<Vendor>('vendors');
  const deleteMutation = useMasterDeleteMutation('vendors');
  const bulkUpdateMutation = useMasterBulkUpdateMutation('vendors');

  const confirm = useConfirm();
  const { toast } = useToast();

  // State controls
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  const [historyOpen, setHistoryOpen] = useState(false);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Vendor | null>(null);

  // Vendor draft state
  const [draft, setDraft] = useState({
    name: '',
    contact_person: '',
    email: '',
    phone: '',
    gst_number: '',
    address: '',
    quality_score: '',
    rates_url: '',
  });

  // Bulk Edit Fields Schema
  const bulkEditFields: FieldSchema[] = [
    { name: 'contact_person', label: 'Contact Person Name', type: 'text' },
    { name: 'email', label: 'Corporate Email Address', type: 'text' },
    { name: 'phone', label: 'Contact Phone Number', type: 'text' },
    { name: 'address', label: 'Office/Billing Address', type: 'text' },
  ];

  // ─── Filter & Search Logic ──────────────────────────────────────────────────
  
  const filteredVendors = useMemo(() => {
    if (!vendors) return [];
    return vendors.filter((v) =>
      (v.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (v.contact_person || '').toLowerCase().includes(search.toLowerCase()) ||
      (v.email || '').toLowerCase().includes(search.toLowerCase()) ||
      (v.phone || '').toLowerCase().includes(search.toLowerCase()) ||
      (v.gst_number || '').toLowerCase().includes(search.toLowerCase()) ||
      (v.address || '').toLowerCase().includes(search.toLowerCase())
    );
  }, [vendors, search]);

  // ─── Selection Logic ────────────────────────────────────────────────────────

  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredVendors.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredVendors.map((v) => v.id));
    }
  };

  // ─── CRUD Handlers ──────────────────────────────────────────────────────────

  const handleOpenAdd = () => {
    setEditingItem(null);
    setDraft({
      name: '',
      contact_person: '',
      email: '',
      phone: '',
      gst_number: '',
      address: '',
      quality_score: '',
      rates_url: '',
    });
    setEditorOpen(true);
  };

  const handleOpenEdit = (v: Vendor) => {
    setEditingItem(v);
    setDraft({
      name: v.name,
      contact_person: v.contact_person || '',
      email: v.email || '',
      phone: v.phone || '',
      gst_number: v.gst_number || '',
      address: v.address || '',
      quality_score: v.quality_score?.toString() || '',
      rates_url: v.rates_url || '',
    });
    setEditorOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingItem) {
        await updateMutation.mutateAsync({ id: editingItem.id, updates: draft });
        toast('Vendor files updated ✓', 'success');
      } else {
        await createMutation.mutateAsync(draft);
        toast('New vendor profile created ✓', 'success');
      }
      setEditorOpen(false);
    } catch (err: any) {
      toast(err.message || 'Operation failed', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirm({
      title: 'Remove Vendor?',
      message: 'Are you sure you want to delete this vendor from active master directory? Doing so will dissociate them from historical purchase/acquisitions logs.',
      confirmLabel: 'Delete Vendor',
      cancelLabel: 'Cancel',
      type: 'danger',
    });
    if (!confirmed) return;
    try {
      await deleteMutation.mutateAsync(id);
      setSelectedIds((prev) => prev.filter((item) => item !== id));
      toast('Vendor deleted successfully', 'success');
    } catch (err: any) {
      toast(err.message || 'Failed to delete vendor', 'error');
    }
  };

  const handleBulkEditSave = async (updates: Record<string, any>) => {
    try {
      await bulkUpdateMutation.mutateAsync({ ids: selectedIds, updates });
      setSelectedIds([]);
      toast(`Bulk updated ${selectedIds.length} vendors`, 'success');
    } catch (err: any) {
      toast(err.message || 'Bulk edit failed', 'error');
    }
  };

  // ─── Import / Export ────────────────────────────────────────────────────────

  const handleExport = () => {
    const dataToExport = filteredVendors.map((v) => ({
      Name: v.name,
      'Contact Person': v.contact_person || '',
      Email: v.email || '',
      Phone: v.phone || '',
      'GST Number': v.gst_number || '',
      Address: v.address || '',
    }));
    exportToExcel(dataToExport, 'Vendors_Master', 'Vendors');
    toast('Vendor master list exported', 'success');
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const rawData = await importFromExcel(file);
      
      const parsedRows = rawData.map((row: any) => ({
        name: row.Name || row.name,
        contact_person: row['Contact Person'] || row.contact_person || '',
        email: row.Email || row.email || '',
        phone: String(row.Phone || row.phone || ''),
        gst_number: row['GST Number'] || row.gst_number || '',
        address: row.Address || row.address || '',
      })).filter((r) => r.name);

      if (parsedRows.length === 0) {
        toast('No valid rows found in Excel sheet. Check column headers.', 'error');
        return;
      }

      const confirmed = await confirm({
        title: `Import ${parsedRows.length} Vendors?`,
        message: `This will insert ${parsedRows.length} Vendor profile rows into database. Continue?`,
        confirmLabel: 'Import Now',
        cancelLabel: 'Cancel',
        type: 'warning',
      });

      if (!confirmed) return;

      for (const row of parsedRows) {
        await createMutation.mutateAsync(row);
      }

      toast(`Successfully imported ${parsedRows.length} vendors`, 'success');
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
              placeholder="Search vendor name, GST, contact..."
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
            <Plus size={14} /> Add Vendor
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
          <div className="p-12 text-center text-xs text-text-muted">Loading vendor directory...</div>
        ) : filteredVendors.length === 0 ? (
          <div className="p-16 text-center text-xs text-text-muted italic">No vendors registered in your organisation. Click Add or Import.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-10">
                  <button onClick={toggleSelectAll} className="text-text-muted hover:text-text-primary">
                    {selectedIds.length === filteredVendors.length ? (
                      <CheckSquare size={16} className="text-accent" />
                    ) : (
                      <Square size={16} />
                    )}
                  </button>
                </th>
                <th>Vendor Name</th>
                <th>Contact Person</th>
                <th>Email Address</th>
                <th>Phone Number</th>
                <th>GST Number</th>
                <th>Quality Score</th>
                <th>Vendor Rates</th>
                <th>Billing Address</th>
                <th className="w-20 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredVendors.map((v) => {
                const isSelected = selectedIds.includes(v.id);
                return (
                  <tr key={v.id} className={isSelected ? 'bg-accent-glow/50' : ''}>
                    <td>
                      <button onClick={() => toggleSelectRow(v.id)} className="text-text-muted hover:text-text-primary">
                        {isSelected ? (
                          <CheckSquare size={16} className="text-accent" />
                        ) : (
                          <Square size={16} />
                        )}
                      </button>
                    </td>
                    <td className="font-semibold text-text-primary flex items-center gap-2">
                      <Truck size={14} className="text-accent" />
                      {v.name}
                    </td>
                    <td className="text-text-secondary font-medium">
                      {v.contact_person ? (
                        <span className="flex items-center gap-1">
                          <User size={12} className="text-text-muted" />
                          {v.contact_person}
                        </span>
                      ) : '—'}
                    </td>
                    <td>
                      {v.email ? (
                        <a href={`mailto:${v.email}`} className="flex items-center gap-1 hover:text-accent font-mono text-xs">
                          <Mail size={12} className="text-text-muted" />
                          {v.email}
                        </a>
                      ) : '—'}
                    </td>
                    <td className="font-mono text-xs">
                      {v.phone ? (
                        <span className="flex items-center gap-1">
                          <Phone size={12} className="text-text-muted" />
                          {v.phone}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="font-mono uppercase text-xs">
                      {v.gst_number ? (
                        <span className="flex items-center gap-1 font-bold text-text-secondary">
                          <FileText size={12} className="text-text-muted" />
                          {v.gst_number}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="text-xs">
                      {v.quality_score ? (
                        <span className={`px-2 py-1 rounded text-[10px] font-bold ${Number(v.quality_score) >= 8 ? 'bg-success/10 text-success' : Number(v.quality_score) >= 5 ? 'bg-warning/10 text-warning' : 'bg-error/10 text-error'}`}>
                          {v.quality_score} / 10
                        </span>
                      ) : '—'}
                    </td>
                    <td className="text-xs">
                      {v.rates_url ? (
                        <a href={v.rates_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-info hover:underline">
                          <FileText size={12} /> View Rates
                        </a>
                      ) : '—'}
                    </td>
                    <td className="text-xs text-text-secondary max-w-[200px] truncate">
                      {v.address ? (
                        <span className="flex items-center gap-1" title={v.address}>
                          <MapPin size={12} className="text-text-muted shrink-0" />
                          {v.address}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenEdit(v)}
                          className="p-1 rounded bg-surface border border-border text-text-secondary hover:text-accent hover:border-accent/30 cursor-pointer"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => handleDelete(v.id)}
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
                {editingItem ? 'Edit Vendor Profile' : 'Add New Vendor'}
              </h3>
              <button onClick={() => setEditorOpen(false)} className="text-text-muted hover:text-text-primary">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1 col-span-2">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Vendor Company Name *</label>
                  <input
                    type="text" required
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-text-primary focus:border-accent/40 outline-none"
                    placeholder="e.g. Tata Solar Power, Vikram Solar"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Contact Person</label>
                  <input
                    type="text"
                    value={draft.contact_person}
                    onChange={(e) => setDraft({ ...draft, contact_person: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-text-primary focus:border-accent/40 outline-none"
                    placeholder="e.g. Rajesh Kumar"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">GSTIN Number</label>
                  <input
                    type="text"
                    value={draft.gst_number}
                    onChange={(e) => setDraft({ ...draft, gst_number: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-text-primary focus:border-accent/40 outline-none font-mono"
                    placeholder="24AAAAA1111A1Z1"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Email Address</label>
                  <input
                    type="email"
                    value={draft.email}
                    onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-text-primary focus:border-accent/40 outline-none font-mono"
                    placeholder="sales@tatasolar.com"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Phone / Mobile</label>
                  <input
                    type="text"
                    value={draft.phone}
                    onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-text-primary focus:border-accent/40 outline-none font-mono"
                    placeholder="+91 9988776655"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Quality Score (1-10)</label>
                  <input
                    type="number" min="1" max="10"
                    value={draft.quality_score}
                    onChange={(e) => setDraft({ ...draft, quality_score: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-text-primary focus:border-accent/40 outline-none font-mono"
                    placeholder="e.g. 8"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Rates Document URL</label>
                  <input
                    type="url"
                    value={draft.rates_url}
                    onChange={(e) => setDraft({ ...draft, rates_url: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-text-primary focus:border-accent/40 outline-none font-mono"
                    placeholder="https://..."
                  />
                </div>
              </div>
              
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Registered Corporate Address</label>
                <textarea
                  value={draft.address}
                  onChange={(e) => setDraft({ ...draft, address: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-text-primary focus:border-accent/40 outline-none resize-none"
                  placeholder="Street, City, State, ZIP..."
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
                  Save Vendor Profile
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
        entityTable="vendors"
        title="Vendors Directory"
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
