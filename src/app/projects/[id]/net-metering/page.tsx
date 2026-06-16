'use client';

import { useState, useEffect, use } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Activity, Upload, CheckCircle, ChevronRight, AlertTriangle, FileText } from 'lucide-react';

const STAGES = ['feasibility', 'registration', 'inspection', 'meter_change', 'approved'];
const STAGE_LABELS = {
  'feasibility': 'Feasibility',
  'registration': 'Registration',
  'inspection': 'Inspection',
  'meter_change': 'Meter Change',
  'approved': 'Approved'
};
const STAGE_SLAS = {
  'feasibility': 15,
  'registration': 30,
  'inspection': 21,
  'meter_change': 15,
  'approved': 0
};
const STAGE_DOCS = {
  'feasibility': ['Application Form', 'Existing Bill', 'Load Sanction Letter', 'Site Plan'],
  'registration': ['Feasibility Letter', 'Installer License', 'Equipment Specs', 'CA Certificate'],
  'inspection': [],
  'meter_change': ['Inspection Report'],
  'approved': ['Commissioning Certificate']
};

export default function NetMeteringTracker({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [app, setApp] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null); // track which doc is uploading
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    fetchApplication();
  }, [id]);

  async function fetchApplication() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('net_metering_applications')
        .select('*')
        .eq('project_id', id)
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116') throw error;
      setApp(data);
    } catch (err) {
      console.error("Failed to load net metering app", err);
    } finally {
      setLoading(false);
    }
  }

  const handleAdvanceStage = async () => {
    if (!app) return;
    const currentIndex = STAGES.indexOf(app.current_stage);
    if (currentIndex >= STAGES.length - 1) return;
    
    const nextStage = STAGES[currentIndex + 1];
    const updates: any = { 
      current_stage: nextStage,
      updated_at: new Date().toISOString()
    };
    
    if (nextStage === 'approved') {
      updates.estimated_completion_date = new Date().toISOString().split('T')[0];
    }
    
    try {
      await supabase
        .from('net_metering_applications')
        .update(updates)
        .eq('id', app.id);
      await fetchApplication();
    } catch (err) {
      console.error(err);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, docName: string) => {
    if (!e.target.files || e.target.files.length === 0 || !app) return;
    const file = e.target.files[0];
    
    // Guard: 10 MB max
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('File too large. Maximum size is 10 MB.');
      e.target.value = '';
      return;
    }

    setUploading(docName);
    setUploadError(null);
    
    try {
      const ext = file.name.split('.').pop();
      const safeName = docName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
      const fileName = `projects/${id}/${app.current_stage}/${safeName}_${Date.now()}.${ext}`;
      
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, file, { upsert: true });
        
      if (uploadError) throw uploadError;
      
      const { data: urlData } = supabase.storage.from('documents').getPublicUrl(fileName);
      
      const updatedDocs = { ...(app.document_urls || {}) };
      updatedDocs[docName] = urlData.publicUrl;
      
      await supabase
        .from('net_metering_applications')
        .update({ document_urls: updatedDocs })
        .eq('id', app.id);
        
      await fetchApplication();
    } catch (err: any) {
      console.error(err);
      setUploadError(err.message || 'Failed to upload document. Please try again.');
    } finally {
      setUploading(null);
      e.target.value = '';
    }
  };

  if (loading) return <div className="p-8 text-center text-text-muted">Loading Application Tracker...</div>;

  if (!app) {
    return (
      <div className="p-8 max-w-4xl mx-auto text-center">
        <div className="w-16 h-16 bg-surface-hover rounded-full flex items-center justify-center mx-auto mb-4">
          <Activity className="text-text-muted" size={24} />
        </div>
        <h2 className="text-xl font-bold text-text-primary">No Application Found</h2>
        <p className="text-text-muted mt-2">The net metering application for this project has not been initiated yet.</p>
        <button 
          disabled={!!uploading}
          onClick={async () => {
            try {
              setUploading('initiating');
              const { data, error: projErr } = await supabase.from('epc_projects').select('quote_id, org_id').eq('id', id).single();
              if (projErr && projErr.code !== 'PGRST116') throw projErr;
              
              let surveyData = null;
              if (data?.quote_id) {
                const { data: sData } = await supabase.from('crm_site_surveys').select('discom_name, consumer_number').eq('quote_id', data.quote_id).order('created_at', { ascending: false }).limit(1).maybeSingle();
                surveyData = sData;
              }
              
              const { error: insertErr } = await supabase.from('net_metering_applications').insert({
                project_id: id,
                discom_name: surveyData?.discom_name || 'Pending DISCOM',
                consumer_number: surveyData?.consumer_number || 'Pending Consumer No',
                current_stage: 'feasibility'
              });
              if (insertErr) throw insertErr;
              await fetchApplication();
            } catch (err: any) {
              console.error(err);
              alert("Failed to initiate application: " + (err.message || "Unknown error"));
            } finally {
              setUploading(null);
            }
          }}
          className={`mt-6 px-4 py-2 bg-accent text-white rounded-lg transition-colors ${!!uploading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-accent-hover'}`}
        >
          {uploading === 'initiating' ? 'Initiating...' : 'Initiate Application Now'}
        </button>
      </div>
    );
  }

  const currentIdx = STAGES.indexOf(app.current_stage);
  const sla = STAGE_SLAS[app.current_stage as keyof typeof STAGE_SLAS];
  const daysInStage = Math.floor((new Date().getTime() - new Date(app.updated_at).getTime()) / (1000 * 3600 * 24));
  const isBreached = sla > 0 && daysInStage > sla;

  return (
    <div className="p-6 max-w-6xl mx-auto animate-fade-in space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
            <Activity size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Net Metering Tracker</h1>
            <p className="text-sm text-text-muted">DISCOM: <span className="font-medium text-text-primary">{app.discom_name}</span> &bull; Consumer No: <span className="font-medium text-text-primary">{app.consumer_number}</span></p>
          </div>
        </div>
        {isBreached && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-error/10 text-error rounded-lg text-sm font-semibold">
            <AlertTriangle size={16} />
            SLA Breached ({daysInStage} / {sla} days)
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div className="bg-surface border border-border p-6 rounded-2xl">
        <div className="flex items-center justify-between relative">
          <div className="absolute left-0 right-0 top-1/2 h-1 bg-border -z-10 -translate-y-1/2"></div>
          {STAGES.map((stage, idx) => {
            const isCompleted = idx < currentIdx;
            const isCurrent = idx === currentIdx;
            return (
              <div key={stage} className="flex flex-col items-center gap-2 bg-surface px-2">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                  isCompleted ? 'bg-success border-success text-white' :
                  isCurrent ? 'bg-accent border-accent text-white' :
                  'bg-surface border-border text-text-muted'
                }`}>
                  {isCompleted ? <CheckCircle size={20} /> : <span className="font-bold">{idx + 1}</span>}
                </div>
                <span className={`text-xs font-semibold ${isCurrent ? 'text-accent' : isCompleted ? 'text-text-primary' : 'text-text-muted'}`}>
                  {STAGE_LABELS[stage as keyof typeof STAGE_LABELS]}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Current Stage Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <div className="bg-surface border border-border p-6 rounded-2xl">
            <h3 className="text-lg font-bold mb-1">Required Documents</h3>
            <p className="text-xs text-text-muted mb-4">Accepted: PDF, JPG, PNG, DOCX, XLSX · Max 10 MB per file</p>
            {uploadError && (
              <div className="mb-4 p-3 rounded-lg bg-error/10 border border-error/30 text-error text-sm flex items-start gap-2">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                {uploadError}
                <button onClick={() => setUploadError(null)} className="ml-auto text-error/70 hover:text-error">✕</button>
              </div>
            )}
            {STAGE_DOCS[app.current_stage as keyof typeof STAGE_DOCS].length === 0 ? (
              <p className="text-text-muted italic text-sm">No documents required for this stage.</p>
            ) : (
              <div className="space-y-3">
                {STAGE_DOCS[app.current_stage as keyof typeof STAGE_DOCS].map(doc => {
                  const url = app.document_urls?.[doc];
                  const isUploading = uploading === doc;
                  return (
                    <div key={doc} className="flex items-center justify-between p-3 rounded-lg border border-border/60 bg-surface-hover">
                      <div className="flex items-center gap-3">
                        <FileText size={18} className="text-text-muted" />
                        <span className="font-medium text-sm text-text-primary">{doc}</span>
                      </div>
                      {url ? (
                        <div className="flex items-center gap-2">
                          <a href={url} target="_blank" rel="noreferrer" className="text-xs text-accent hover:underline flex items-center gap-1 font-medium">
                            View Document <CheckCircle size={14} className="text-success" />
                          </a>
                          <label className="text-xs px-2 py-1 bg-surface border border-border hover:border-accent hover:text-accent rounded cursor-pointer transition-colors" title="Replace file">
                            Replace
                            <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx" onChange={(e) => handleFileUpload(e, doc)} disabled={!!uploading} />
                          </label>
                        </div>
                      ) : (
                        <label className={`text-xs px-3 py-1.5 bg-surface border rounded cursor-pointer transition-colors flex items-center gap-2 ${
                          isUploading ? 'border-accent text-accent' : 'border-border hover:border-accent hover:text-accent'
                        } ${!!uploading && !isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                          <Upload size={14} className={isUploading ? 'animate-bounce' : ''} />
                          {isUploading ? 'Uploading...' : 'Upload'}
                          <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx" onChange={(e) => handleFileUpload(e, doc)} disabled={!!uploading} />
                        </label>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-surface border border-border p-6 rounded-2xl">
            <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider mb-4">Stage Status</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-text-secondary">Elapsed Time</span>
                  <span className={`font-bold ${isBreached ? 'text-error' : 'text-text-primary'}`}>
                    {daysInStage} days
                  </span>
                </div>
                <div className="w-full bg-border rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${isBreached ? 'bg-error' : 'bg-success'}`}
                    style={{ width: `${Math.min(100, (daysInStage / Math.max(1, sla)) * 100)}%` }}
                  ></div>
                </div>
                <p className="text-xs text-text-muted mt-2">SLA Limit: {sla > 0 ? `${sla} days` : 'N/A'}</p>
              </div>

              {app.current_stage !== 'approved' && (
                <button 
                  onClick={handleAdvanceStage}
                  className="w-full mt-4 flex items-center justify-center gap-2 py-2.5 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors font-medium text-sm shadow-sm"
                >
                  Mark Stage Complete <ChevronRight size={16} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
