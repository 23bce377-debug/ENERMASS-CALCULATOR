'use client';

import { useState } from 'react';
import { X, Save, Loader2 } from 'lucide-react';
import { VendorORM, type Vendor } from '@/backend/orm/acquisition';
import { useToast } from '@/components/ui/Toast';

interface VendorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  orgId: string;
  vendor?: Vendor;
}

export default function VendorModal({ isOpen, onClose, onSuccess, orgId, vendor }: VendorModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<Vendor>>(vendor || {
    name: '',
    contact_person: '',
    email: '',
    phone: '',
    gst_number: '',
    address: '',
    org_id: orgId
  });
  const { toast } = useToast();

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name) return toast('Vendor name is required', 'error');

    setLoading(true);
    try {
      if (vendor?.id) {
        await VendorORM.update(vendor.id, formData);
        toast('Vendor updated successfully', 'success');
      } else {
        await VendorORM.create({ ...formData, org_id: orgId });
        toast('Vendor added successfully', 'success');
      }
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error saving vendor:', err);
      toast('Failed to save vendor', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-slide-up">
        <div className="flex justify-between items-center px-6 py-4 border-b border-border">
          <h2 className="text-lg font-bold text-text-primary">
            {vendor ? 'Edit Vendor' : 'Add New Vendor'}
          </h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Vendor Name *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg bg-background border border-border text-sm text-text-primary outline-none focus:border-accent/50 transition-all"
                placeholder="e.g. Waaree Energies Ltd"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Contact Person</label>
              <input
                type="text"
                value={formData.contact_person ?? ''}
                onChange={e => setFormData({ ...formData, contact_person: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg bg-background border border-border text-sm text-text-primary outline-none focus:border-accent/50 transition-all"
                placeholder="John Doe"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-muted uppercase tracking-wider">GST Number</label>
              <input
                type="text"
                value={formData.gst_number ?? ''}
                onChange={e => setFormData({ ...formData, gst_number: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg bg-background border border-border text-sm text-text-primary outline-none focus:border-accent/50 transition-all"
                placeholder="24AAAAA0000A1Z5"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Email</label>
              <input
                type="email"
                value={formData.email ?? ''}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg bg-background border border-border text-sm text-text-primary outline-none focus:border-accent/50 transition-all"
                placeholder="vendor@example.com"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Phone</label>
              <input
                type="text"
                value={formData.phone ?? ''}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg bg-background border border-border text-sm text-text-primary outline-none focus:border-accent/50 transition-all"
                placeholder="+91 9876543210"
              />
            </div>

            <div className="col-span-2 space-y-1.5">
              <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Address</label>
              <textarea
                value={formData.address ?? ''}
                onChange={e => setFormData({ ...formData, address: e.target.value })}
                rows={3}
                className="w-full px-4 py-2.5 rounded-lg bg-background border border-border text-sm text-text-primary outline-none focus:border-accent/50 transition-all resize-none"
                placeholder="Full office address..."
              />
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm font-bold text-text-secondary hover:bg-surface-hover transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-accent text-black text-sm font-bold hover:bg-accent-hover transition-all disabled:opacity-50"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              {vendor ? 'Update Vendor' : 'Save Vendor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
