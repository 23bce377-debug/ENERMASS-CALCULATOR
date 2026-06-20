import React, { useState } from 'react';
import { X, ClipboardCheck, Building } from 'lucide-react';
import { useCreateSurveyMutation } from '@/lib/hooks/useSurveys';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { supabase } from '@/lib/supabase/client';

interface CreateSurveyModalProps {
  quoteNumber: string;
  leadId: string;
  orgId: string;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateSurveyModal({
  quoteNumber,
  leadId,
  orgId,
  onClose,
  onCreated,
}: CreateSurveyModalProps) {
  const [formData, setFormData] = useState({
    roof_area_sqft: '',
    roof_type: 'RCC',
    sanctioned_load_kw: '',
    discom_name: '',
    survey_notes: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const createMutation = useCreateSurveyMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      await createMutation.mutateAsync({
        lead_id: leadId,
        org_id: orgId,
        quote_id: quoteNumber,
        conducted_by: user.id,
        status: 'completed',
        roof_area_sqft: parseFloat(formData.roof_area_sqft) || 0,
        roof_type: formData.roof_type,
        sanctioned_load_kw: parseFloat(formData.sanctioned_load_kw) || 0,
        discom_name: formData.discom_name,
        survey_notes: formData.survey_notes,
      });

      toast('Site survey recorded successfully.', 'success');
      onCreated();
    } catch (err: any) {
      toast(err.message || 'Failed to create survey', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl bg-surface border border-border rounded-2xl shadow-2xl animate-fade-in overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-accent/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
              <ClipboardCheck size={18} className="text-accent" />
            </div>
            <div>
              <h3 className="font-black text-text-primary text-sm uppercase tracking-wider">Record Site Survey</h3>
              <p className="text-[10px] text-text-muted mt-0.5">Quick data entry for quote verification</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Roof Area (sq ft)</label>
              <input required type="number" value={formData.roof_area_sqft} onChange={e => setFormData({...formData, roof_area_sqft: e.target.value})} className="w-full px-3 py-2 border border-border rounded-xl bg-background text-sm text-text-primary focus:border-accent outline-none" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Roof Type</label>
              <Select
                value={formData.roof_type}
                onChange={(val) => setFormData({...formData, roof_type: val})}
                options={[
                  { value: 'RCC', label: 'RCC' },
                  { value: 'Metal Sheet', label: 'Metal Sheet' },
                  { value: 'Tin', label: 'Tin' },
                  { value: 'Other', label: 'Other' }
                ]}
                className="w-full"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Sanctioned Load (kW)</label>
              <input required type="number" step="0.1" value={formData.sanctioned_load_kw} onChange={e => setFormData({...formData, sanctioned_load_kw: e.target.value})} className="w-full px-3 py-2 border border-border rounded-xl bg-background text-sm text-text-primary focus:border-accent outline-none" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">DISCOM Name</label>
              <input type="text" value={formData.discom_name} onChange={e => setFormData({...formData, discom_name: e.target.value})} className="w-full px-3 py-2 border border-border rounded-xl bg-background text-sm text-text-primary focus:border-accent outline-none" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Survey Notes</label>
            <textarea rows={3} value={formData.survey_notes} onChange={e => setFormData({...formData, survey_notes: e.target.value})} className="w-full px-3 py-2 border border-border rounded-xl bg-background text-sm text-text-primary focus:border-accent outline-none resize-none" placeholder="Add any shadowing, access, or wiring notes..."></textarea>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-bold text-text-secondary hover:bg-surface-hover transition-colors">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="px-6 py-2 rounded-xl bg-accent hover:bg-accent-light text-white text-sm font-bold transition-all disabled:opacity-50">
              {isSubmitting ? 'Saving...' : 'Save Survey'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
