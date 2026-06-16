'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ProjectORM, type Project } from '@/backend/orm/project';
import { QuoteItemORM, type QuoteItemRow } from '@/backend/orm/quote';
import { 
  Box, ArrowLeft, Save, Plus, 
  CheckCircle2, Package, Search, 
  Settings, Copy, FileText 
} from 'lucide-react';
import Link from 'next/link';
import { formatINR } from '@/lib/engine/calculator';

export default function ProjectBOMPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [project, setProject] = useState<any>(null);
  const [bomItems, setBomItems] = useState<QuoteItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const projData = await ProjectORM.getById(projectId);
        if (!projData) throw new Error('Project not found');
        setProject(projData);

        if (projData.quote_id) {
          const items = await QuoteItemORM.getByQuoteId(projData.quote_id);
          setBomItems(items);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [projectId]);

  const handleUpdateQty = (id: string, qty: number) => {
    setBomItems(prev => prev.map(item => item.id === id ? { ...item, qty: qty } as QuoteItemRow : item));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const item of bomItems) {
        await QuoteItemORM.update(item.id, { qty: item.qty });
      }
      alert('BOM successfully updated.');
    } catch (err: any) {
      alert('Failed to save BOM: ' + err.message);
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

  if (error || !project) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="bg-red-500/10 border border-red-500/30 text-red-500 p-4 rounded-lg">
          Error: {error || 'Project not found'}
        </div>
      </div>
    );
  }

  const totalCost = bomItems.reduce((sum, i) => sum + (i.qty * i.rate_per_unit), 0);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 bg-[#1a1a1a] p-6 rounded-xl border border-[#2a2a2a] shadow-lg">
        <div>
          <Link href={`/projects`} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#888] hover:text-white transition-colors mb-3">
            <ArrowLeft size={14} /> Back to Projects
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-[#f0a500]/20 flex items-center justify-center text-[#f0a500]">
              <Package size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                As-Built BOM Manager
              </h1>
              <p className="text-sm text-[#888] mt-1">Project {project.project_number || projectId.substring(0, 8)}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2a2a2a] text-white hover:bg-[#333] transition-colors text-sm font-medium border border-[#444]">
            <Plus size={16} /> Add Custom Item
          </button>
          <button 
            onClick={handleSave} 
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#f0a500] text-black hover:bg-[#f0a500]/90 transition-colors text-sm font-bold shadow-[0_0_15px_rgba(240,165,0,0.3)] disabled:opacity-50"
          >
            <Save size={16} /> {saving ? 'Saving...' : 'Save BOM'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Sidebar Insights */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-[#1a1a1a] p-5 rounded-xl border border-[#2a2a2a] shadow-lg">
            <h2 className="text-sm font-semibold text-[#888] uppercase tracking-wider mb-4 border-b border-[#2a2a2a] pb-2 flex items-center gap-2">
              <FileText size={16} /> Project Info
            </h2>
            <div className="space-y-4 text-sm">
              <div>
                <p className="text-[#666] mb-1">Customer</p>
                <p className="text-white font-medium">{project.quotes?.customer_name || 'N/A'}</p>
              </div>
              <div>
                <p className="text-[#666] mb-1">System Spec</p>
                <p className="text-white font-medium">{project.quotes?.system_name || 'Custom'}</p>
              </div>
              <div>
                <p className="text-[#666] mb-1">Total BOM Cost (excl GST)</p>
                <p className="text-xl font-bold text-[#f0a500] mt-1">{formatINR(totalCost)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* BOM Editor */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-[#1a1a1a] rounded-xl border border-[#2a2a2a] shadow-lg overflow-hidden">
            <div className="p-5 border-b border-[#2a2a2a] bg-[#111] flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Settings size={16} className="text-[#888]"/> Component List
              </h2>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#666]" />
                <input 
                  type="text" 
                  placeholder="Filter items..." 
                  className="pl-9 pr-3 py-1.5 bg-[#0d0d0d] border border-[#333] rounded text-xs text-white outline-none focus:border-[#f0a500]"
                />
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-[#151515] text-[#888]">
                    <th className="px-5 py-3 font-medium border-b border-[#2a2a2a]">Description</th>
                    <th className="px-5 py-3 font-medium border-b border-[#2a2a2a]">Category</th>
                    <th className="px-5 py-3 font-medium border-b border-[#2a2a2a] text-center w-32">Actual Qty</th>
                    <th className="px-5 py-3 font-medium border-b border-[#2a2a2a] text-right">Unit Rate</th>
                    <th className="px-5 py-3 font-medium border-b border-[#2a2a2a] text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2a2a2a]">
                  {bomItems.map((item) => (
                    <tr key={item.id} className="hover:bg-[#1a1a1a]/50 transition-colors">
                      <td className="px-5 py-3.5 text-white max-w-[200px] truncate" title={item.description}>{item.description}</td>
                      <td className="px-5 py-3.5 text-[#666] capitalize">
                        {item.section || 'general'}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-center gap-1">
                          <input 
                            type="number" 
                            min={0}
                            value={item.qty}
                            onChange={(e) => handleUpdateQty(item.id, parseFloat(e.target.value) || 0)}
                            className="w-16 px-2 py-1 bg-[#0d0d0d] border border-[#333] focus:border-[#f0a500] rounded text-center text-white text-sm outline-none [appearance:textfield]"
                          />
                          <span className="text-xs text-[#555]">{item.unit || 'Nos'}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono text-[#888]">{formatINR(item.rate_per_unit)}</td>
                      <td className="px-5 py-3.5 text-right font-mono font-medium text-[#f0a500]">
                        {formatINR(item.qty * item.rate_per_unit)}
                      </td>
                    </tr>
                  ))}
                  {bomItems.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-[#555]">
                        No BOM items found for this project.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
