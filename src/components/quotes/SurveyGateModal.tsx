'use client';

import React, { useState } from 'react';
import { X, AlertTriangle, MapPin, ShieldAlert, CheckCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { useWaiveSurveyMutation } from '@/lib/hooks/useSurveys';
import { useToast } from '@/components/ui/Toast';
import { CreateSurveyModal } from './CreateSurveyModal';

interface SurveyGateModalProps {
  quoteNumber: string;
  leadId: string | null;
  orgId: string;
  onClose: () => void;
  /** Called when waiver is successfully committed — parent can retry the status change */
  onWaived: () => void;
}

export function SurveyGateModal({
  quoteNumber,
  leadId,
  orgId,
  onClose,
  onWaived,
}: SurveyGateModalProps) {
  const [showWaiverForm, setShowWaiverForm] = useState(false);
  const [showSurveyForm, setShowSurveyForm] = useState(false);
  const [waiveReason, setWaiveReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const waiveMutation = useWaiveSurveyMutation();

  const reasonValid = waiveReason.trim().length >= 20;

  const handleWaive = async () => {
    if (!leadId) {
      toast('This quote has no linked lead. Attach a lead to enable survey waiver.', 'error');
      return;
    }
    if (!reasonValid) return;

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      await waiveMutation.mutateAsync({
        leadId,
        orgId,
        waivedById: user.id,
        reason: waiveReason.trim(),
        quoteId: undefined, // resolved server-side by quote_number lookup
      });

      toast('Survey waived. Quote can now be sent.', 'success');
      onWaived();
    } catch (err: any) {
      toast(err.message || 'Failed to waive survey', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-surface border border-border rounded-2xl shadow-2xl animate-fade-in overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-error/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-error/15 border border-error/25 flex items-center justify-center shrink-0">
              <AlertTriangle size={18} className="text-error" />
            </div>
            <div>
              <h3 className="font-black text-text-primary text-sm uppercase tracking-wider">Site Survey Required</h3>
              <p className="text-[10px] text-text-muted mt-0.5">Quote cannot be sent without a verified field survey.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          <p className="text-sm text-text-secondary leading-relaxed">
            In Solar EPC, cable lengths and structure types vary <strong className="text-text-primary">20–30%</strong> based on site conditions.
            A quote sent without a site survey is an estimate — not a commitment.
          </p>

          {/* No waiver form: show two action buttons */}
          {!showWaiverForm ? (
            <div className="space-y-3">
              <button
                onClick={() => setShowSurveyForm(true)}
                className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl bg-accent hover:bg-accent-hover text-background text-sm font-bold transition-all shadow-md shadow-accent/15 cursor-pointer"
              >
                <MapPin size={16} />
                Record Site Survey
              </button>

              <button
                onClick={() => setShowWaiverForm(true)}
                className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl border border-warning/40 bg-warning/5 text-warning text-sm font-bold hover:bg-warning/10 transition-all cursor-pointer"
              >
                <ShieldAlert size={16} />
                Manager Override — Waive Survey
              </button>
            </div>
          ) : (
            /* Waiver form */
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-warning/8 border border-warning/25 flex items-start gap-2.5">
                <ShieldAlert size={15} className="text-warning shrink-0 mt-0.5" />
                <p className="text-xs text-warning leading-relaxed">
                  This override is logged against your user account and auditable. Provide a substantive business reason (min. 20 characters).
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                  Waiver Reason <span className="text-error">*</span>
                </label>
                <textarea
                  rows={4}
                  value={waiveReason}
                  onChange={(e) => setWaiveReason(e.target.value)}
                  placeholder="e.g. Customer is a repeat client, site matches previous survey from 6 months ago. PM has confirmed measurements are still valid."
                  className={`w-full px-3 py-2.5 border rounded-xl bg-background text-sm text-text-primary placeholder:text-text-muted focus:outline-none transition-colors resize-none ${
                    waiveReason.length > 0 && !reasonValid
                      ? 'border-error focus:border-error'
                      : 'border-border focus:border-accent'
                  }`}
                />
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-mono ${
                    reasonValid ? 'text-success' : waiveReason.length > 0 ? 'text-error' : 'text-text-muted'
                  }`}>
                    {waiveReason.trim().length}/20 characters minimum
                  </span>
                  {reasonValid && (
                    <span className="flex items-center gap-1 text-[10px] text-success">
                      <CheckCircle size={10} /> Valid
                    </span>
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowWaiverForm(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm font-bold text-text-secondary hover:text-text-primary hover:border-border-light transition-colors cursor-pointer"
                >
                  Back
                </button>
                <button
                  onClick={handleWaive}
                  disabled={!reasonValid || isSubmitting}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-warning hover:bg-warning/90 text-background text-sm font-bold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-warning/15"
                >
                  {isSubmitting ? 'Committing waiver…' : 'Confirm Waiver & Send Quote'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      {showSurveyForm && leadId && (
        <CreateSurveyModal
          quoteNumber={quoteNumber}
          leadId={leadId}
          orgId={orgId}
          onClose={() => setShowSurveyForm(false)}
          onCreated={() => {
            setShowSurveyForm(false);
            onWaived(); // This acts as a success callback to retry the status update
          }}
        />
      )}
    </div>
  );
}
