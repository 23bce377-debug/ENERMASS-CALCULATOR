'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ProjectORM, type SiteSurvey } from '@/backend/orm/project';
import { 
  ClipboardList, ArrowLeft, Save, MapPin, 
  Home, Zap, UploadCloud, Camera, CheckCircle2 
} from 'lucide-react';
import Link from 'next/link';

export default function SiteSurveyPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [survey, setSurvey] = useState<Partial<SiteSurvey>>({
    project_id: projectId,
    roof_mount_type: 'RCC Flat',
    net_metering_available: true
  });

  useEffect(() => {
    async function loadData() {
      try {
        const projData = await ProjectORM.getById(projectId);
        if (!projData) throw new Error('Project not found');
        
        if (projData.epc_site_surveys && projData.epc_site_surveys.length > 0) {
          setSurvey(projData.epc_site_surveys[0]);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [projectId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    let finalValue: any = value;
    
    if (type === 'number') {
      finalValue = value === '' ? undefined : parseFloat(value);
    } else if (type === 'checkbox') {
      finalValue = (e.target as HTMLInputElement).checked;
    }

    setSurvey(prev => ({ ...prev, [name]: finalValue }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await ProjectORM.saveSiteSurvey(survey);
      alert('Site survey saved successfully!');
    } catch (err: any) {
      alert('Failed to save survey: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#f0a500]"></div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 bg-[#1a1a1a] p-6 rounded-xl border border-[#2a2a2a] shadow-lg">
        <div>
          <Link href={`/projects`} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#888] hover:text-white transition-colors mb-3">
            <ArrowLeft size={14} /> Back to Projects
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-[#f0a500]/20 flex items-center justify-center text-[#f0a500]">
              <ClipboardList size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                Site Survey Intake Form
              </h1>
              <p className="text-sm text-[#888] mt-1">Project {projectId.substring(0, 8)}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {survey.id && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-green-400 bg-green-400/10 px-2.5 py-1 rounded-full border border-green-400/20">
              <CheckCircle2 size={12} /> Saved
            </span>
          )}
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        
        {/* Section: Roof & Structure */}
        <div className="bg-[#1a1a1a] p-6 rounded-xl border border-[#2a2a2a] shadow-lg">
          <h2 className="text-sm font-semibold text-[#888] uppercase tracking-wider mb-5 flex items-center gap-2 border-b border-[#2a2a2a] pb-2">
            <Home size={16} /> Roof & Structure Details
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-[#888] uppercase tracking-wider">Roof Mount Type</label>
              <select name="roof_mount_type" value={survey.roof_mount_type || ''} onChange={handleChange} className="w-full px-3 py-2 bg-[#0d0d0d] border border-[#333] rounded-lg text-white text-sm outline-none focus:border-[#f0a500]">
                <option value="RCC Flat">RCC Flat</option>
                <option value="Tin Shed">Tin Shed</option>
                <option value="Sloped Tiled">Sloped Tiled</option>
                <option value="Ground Mount">Ground Mount</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-[#888] uppercase tracking-wider">Usable Area (sq.ft)</label>
              <input type="number" name="usable_area_sqft" value={survey.usable_area_sqft || ''} onChange={handleChange} className="w-full px-3 py-2 bg-[#0d0d0d] border border-[#333] rounded-lg text-white text-sm outline-none focus:border-[#f0a500]" placeholder="e.g. 1500" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-[#888] uppercase tracking-wider">Roof Height (ft)</label>
              <input type="number" name="roof_height_ft" value={survey.roof_height_ft || ''} onChange={handleChange} className="w-full px-3 py-2 bg-[#0d0d0d] border border-[#333] rounded-lg text-white text-sm outline-none focus:border-[#f0a500]" placeholder="e.g. 30" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-[#888] uppercase tracking-wider">Shading Percentage (%)</label>
              <input type="number" name="shading_percentage" value={survey.shading_percentage || ''} onChange={handleChange} className="w-full px-3 py-2 bg-[#0d0d0d] border border-[#333] rounded-lg text-white text-sm outline-none focus:border-[#f0a500]" placeholder="0-100" />
            </div>
          </div>
        </div>

        {/* Section: Electrical & Net Metering */}
        <div className="bg-[#1a1a1a] p-6 rounded-xl border border-[#2a2a2a] shadow-lg">
          <h2 className="text-sm font-semibold text-[#888] uppercase tracking-wider mb-5 flex items-center gap-2 border-b border-[#2a2a2a] pb-2">
            <Zap size={16} /> Electrical & Cable Runs
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-[#888] uppercase tracking-wider">Panel to Inverter Distance (m) [DC Run]</label>
              <input type="number" name="distance_panel_to_inverter_m" value={survey.distance_panel_to_inverter_m || ''} onChange={handleChange} className="w-full px-3 py-2 bg-[#0d0d0d] border border-[#333] rounded-lg text-white text-sm outline-none focus:border-[#f0a500]" placeholder="e.g. 15" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-[#888] uppercase tracking-wider">Inverter to Meter Distance (m) [AC Run]</label>
              <input type="number" name="distance_inverter_to_meter_m" value={survey.distance_inverter_to_meter_m || ''} onChange={handleChange} className="w-full px-3 py-2 bg-[#0d0d0d] border border-[#333] rounded-lg text-white text-sm outline-none focus:border-[#f0a500]" placeholder="e.g. 10" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-[#888] uppercase tracking-wider">Meter Phase</label>
              <select name="meter_phase" value={survey.meter_phase || ''} onChange={handleChange} className="w-full px-3 py-2 bg-[#0d0d0d] border border-[#333] rounded-lg text-white text-sm outline-none focus:border-[#f0a500]">
                <option value="">Select Phase...</option>
                <option value="Single Phase">Single Phase</option>
                <option value="Three Phase">Three Phase</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-[#888] uppercase tracking-wider">Sanctioned Load (kW)</label>
              <input type="number" name="sanctioned_load_kw" value={survey.sanctioned_load_kw || ''} onChange={handleChange} className="w-full px-3 py-2 bg-[#0d0d0d] border border-[#333] rounded-lg text-white text-sm outline-none focus:border-[#f0a500]" placeholder="e.g. 5" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-[#888] uppercase tracking-wider">DISCOM Name</label>
              <input type="text" name="discom_name" value={survey.discom_name || ''} onChange={handleChange} className="w-full px-3 py-2 bg-[#0d0d0d] border border-[#333] rounded-lg text-white text-sm outline-none focus:border-[#f0a500]" placeholder="e.g. BESCOM" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-[#888] uppercase tracking-wider">Consumer Number</label>
              <input type="text" name="consumer_number" value={survey.consumer_number || ''} onChange={handleChange} className="w-full px-3 py-2 bg-[#0d0d0d] border border-[#333] rounded-lg text-white text-sm outline-none focus:border-[#f0a500]" placeholder="e.g. 1234567890" />
            </div>
            <div className="md:col-span-2 pt-2">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input type="checkbox" name="net_metering_available" checked={survey.net_metering_available || false} onChange={handleChange} className="w-4 h-4 rounded bg-[#0d0d0d] border-[#333] accent-[#f0a500]" />
                <span className="text-sm font-medium text-white">Net Metering Available / Feasible</span>
              </label>
            </div>
          </div>
        </div>

        {/* Section: Notes & Media */}
        <div className="bg-[#1a1a1a] p-6 rounded-xl border border-[#2a2a2a] shadow-lg">
          <h2 className="text-sm font-semibold text-[#888] uppercase tracking-wider mb-5 flex items-center gap-2 border-b border-[#2a2a2a] pb-2">
            <Camera size={16} /> Photos & Notes
          </h2>
          
          <div className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-[#888] uppercase tracking-wider">Survey Notes</label>
              <textarea name="survey_notes" value={survey.survey_notes || ''} onChange={handleChange} rows={4} className="w-full px-3 py-2 bg-[#0d0d0d] border border-[#333] rounded-lg text-white text-sm outline-none focus:border-[#f0a500] resize-none" placeholder="Any special site conditions, obstacles, or safety hazards..." />
            </div>
            
            <div className="border-2 border-dashed border-[#333] rounded-xl p-8 text-center hover:bg-[#111] hover:border-[#f0a500]/50 transition-colors cursor-pointer group">
              <UploadCloud size={32} className="mx-auto mb-3 text-[#555] group-hover:text-[#f0a500] transition-colors" />
              <p className="text-sm text-white font-medium mb-1">Click to upload site photos</p>
              <p className="text-xs text-[#666]">Take photos directly from your device camera or upload files (Max 5MB each)</p>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <button 
            type="submit" 
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#f0a500] text-black hover:bg-[#f0a500]/90 transition-all text-sm font-bold shadow-[0_0_15px_rgba(240,165,0,0.3)] disabled:opacity-50"
          >
            <Save size={18} /> {saving ? 'Saving Survey...' : 'Submit Site Survey'}
          </button>
        </div>

      </form>
    </div>
  );
}
