import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useReviseQuoteMutation } from '@/lib/hooks/useQuotes';
import { X, CheckCircle, AlertTriangle } from 'lucide-react';
import { Select } from '@/components/ui/Select';

export function QuoteReviseModal({ quoteId, leadId, onClose, onSuccess }: { quoteId: string, leadId: string | null, onClose: () => void, onSuccess: (newQuoteNumber: string) => void }) {
  const [reason, setReason] = useState('');
  const [surveyId, setSurveyId] = useState<string>('');
  const [surveys, setSurveys] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  const reviseMutation = useReviseQuoteMutation();

  useEffect(() => {
    if (!leadId) return;
    async function loadSurveys() {
      const { data } = await supabase
        .from('crm_site_surveys')
        .select('id, created_at, status')
        .eq('lead_id', leadId!)
        .eq('status', 'completed')
        .order('created_at', { ascending: false });
      if (data) setSurveys(data);
    }
    loadSurveys();
  }, [leadId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;
    
    setLoading(true);
    try {
      const newId = await reviseMutation.mutateAsync({
        originalQuoteId: quoteId,
        revisionReason: reason,
        surveyId: surveyId || undefined,
      });
      onSuccess(newId);
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Failed to revise quote');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-surface border border-border rounded-xl shadow-xl overflow-hidden animate-fade-in">
        <div className="flex items-center justify-between p-4 border-b border-border bg-surface-active">
          <h3 className="font-bold text-text-primary">Revise Quote</h3>
          <button onClick={onClose} className="p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-hover rounded-md transition-colors">
            <X size={18} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wider">
              Revision Reason *
            </label>
            <input
              autoFocus
              required
              placeholder="e.g. Post-survey BOM update, Customer requested changes"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wider">
              Link Site Survey (Optional)
            </label>
            <Select
              value={surveyId}
              onChange={(val) => setSurveyId(val as string)}
              options={[
                { value: '', label: 'None (Manual revision)' },
                ...surveys.map(s => ({
                  value: s.id,
                  label: `Survey from ${new Date(s.created_at).toLocaleDateString()}`
                }))
              ]}
              placeholder="Select a survey to auto-update BOM..."
            />
            {surveyId && (
              <p className="text-xs text-success mt-2 flex items-center gap-1.5">
                <CheckCircle size={14} /> Will auto-calculate cables & structures
              </p>
            )}
            {!surveyId && (
              <p className="text-xs text-text-muted mt-2 flex items-center gap-1.5">
                <AlertTriangle size={14} /> BOM items will be copied exactly as-is
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border/50">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !reason.trim()}
              className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Revising...' : 'Revise Quote'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
