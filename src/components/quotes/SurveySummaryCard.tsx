'use client';

import React from 'react';
import { MapPin, AlertTriangle, CheckCircle2, Clock, Image, Zap } from 'lucide-react';
import { useSurveyByQuoteId } from '@/lib/hooks/useSurveys';

interface SurveySummaryCardProps {
  quoteNumber: string;
}

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="p-3 bg-background/50 border border-border/40 rounded-xl">
      <span className="text-[10px] text-text-muted font-bold block uppercase tracking-wider">{label}</span>
      <span className="text-text-primary font-bold text-xs mt-0.5 block">
        {value !== null && value !== undefined && value !== '' ? String(value) : '—'}
      </span>
    </div>
  );
}

export function SurveySummaryCard({ quoteNumber }: SurveySummaryCardProps) {
  const { data: survey, isLoading } = useSurveyByQuoteId(quoteNumber);

  if (isLoading) {
    return (
      <div className="bg-surface border border-border/40 rounded-2xl p-5 shadow-md">
        <div className="animate-pulse h-4 w-48 bg-surface-hover rounded" />
      </div>
    );
  }

  const statusBadge = () => {
    if (!survey) {
      return (
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border bg-error/10 border-error/25 text-error">
          <AlertTriangle size={10} /> No Survey on File
        </span>
      );
    }
    if (survey.status === 'waived') {
      return (
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border bg-warning/10 border-warning/25 text-warning">
          <AlertTriangle size={10} /> Waived
        </span>
      );
    }
    if (survey.status === 'completed') {
      return (
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border bg-success/10 border-success/25 text-success">
          <CheckCircle2 size={10} /> Completed
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border bg-info/10 border-info/25 text-info">
        <Clock size={10} /> {survey.status === 'in_progress' ? 'In Progress' : 'Scheduled'}
      </span>
    );
  };

  const photoCount = Array.isArray(survey?.photo_urls) ? survey.photo_urls.length : 0;

  return (
    <div className="bg-surface border border-border/40 rounded-2xl overflow-hidden shadow-md">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-surface-active">
        <h3 className="text-xs font-black uppercase text-text-muted tracking-widest flex items-center gap-1.5">
          <MapPin size={14} className="text-accent" />
          Site Survey Report
        </h3>
        {statusBadge()}
      </div>

      {/* Waiver Banner */}
      {survey?.status === 'waived' && (
        <div className="mx-4 mt-4 p-3 rounded-xl bg-warning/8 border border-warning/25 flex items-start gap-2.5">
          <AlertTriangle size={14} className="text-warning shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-bold text-warning mb-0.5">Survey Waived by Manager</p>
            <p className="text-text-secondary leading-relaxed">
              "{survey.waive_reason}"
            </p>
            {(survey as any).profiles?.full_name && (
              <p className="text-text-muted mt-1 font-mono text-[10px]">
                — {(survey as any).profiles.full_name}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="p-4 space-y-4">
        {!survey ? (
          <div className="text-center py-6 space-y-2">
            <MapPin size={32} className="mx-auto text-text-muted/30" />
            <p className="text-xs text-text-muted">No site survey on record for this lead.</p>
            <span className="text-[11px] text-text-muted mt-1 italic block">
              Contact administrator to schedule a site survey.
            </span>
          </div>
        ) : (
          <>
            {/* Physical data */}
            <div>
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2">Physical Measurements</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                <Field label="Roof Area" value={survey.roof_area_sqft ? `${survey.roof_area_sqft} sqft` : null} />
                <Field label="Roof Type" value={survey.roof_type} />
                <Field label="Roof Height" value={survey.roof_height_ft ? `${survey.roof_height_ft} ft` : null} />
              </div>
            </div>

            {/* Electrical data */}
            <div>
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <Zap size={11} /> Electrical Measurements
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                <Field label="Meter Phase" value={survey.meter_phase ? (survey.meter_phase === 'single' ? '1Φ Single Phase' : '3Φ Three Phase') : null} />
                <Field label="Sanctioned Load" value={survey.sanctioned_load_kw ? `${survey.sanctioned_load_kw} kW` : null} />
                <Field label="Existing Load" value={survey.existing_load_kw ? `${survey.existing_load_kw} kW` : null} />
                <Field
                  label="Panel → Inverter"
                  value={survey.distance_panel_to_inverter_m ? `${survey.distance_panel_to_inverter_m} m` : null}
                />
                <Field
                  label="Inverter → Meter"
                  value={survey.distance_inverter_to_meter_m ? `${survey.distance_inverter_to_meter_m} m` : null}
                />
                <Field
                  label="Net Metering"
                  value={survey.net_metering_available === null ? null : survey.net_metering_available ? 'Available' : 'Not Available'}
                />
              </div>
            </div>

            {/* DISCOM */}
            <div className="grid grid-cols-2 gap-2">
              <Field label="DISCOM Name" value={survey.discom_name} />
              <Field label="Consumer No." value={survey.consumer_number} />
            </div>

            {/* Photos & Notes */}
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-text-muted">
                <Image size={13} />
                <span className="font-mono font-bold text-text-primary">{photoCount}</span> photo{photoCount !== 1 ? 's' : ''} attached
              </span>
              {survey.conducted_at && (
                <span className="text-text-muted font-mono text-[10px]">
                  Conducted: {new Date(survey.conducted_at).toLocaleDateString('en-IN', {
                    day: 'numeric', month: 'short', year: 'numeric'
                  })}
                </span>
              )}
            </div>

            {survey.survey_notes && (
              <div className="p-3 bg-background/50 border border-border/40 rounded-xl text-xs text-text-secondary leading-relaxed">
                <span className="font-bold text-text-muted block mb-1 text-[10px] uppercase tracking-wider">Field Notes</span>
                {survey.survey_notes}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
