'use client';

import { useEffect, useState } from 'react';
import { ProcurementORM, type ProcurementPO } from '@/backend/orm/procurement';

import { useSettings } from '@/lib/hooks/useSettings';
import { 
  ShoppingCart, Plus, FileText, Send, 
  CheckCircle2, Clock, Search, Filter 
} from 'lucide-react';
import { formatINR } from '@/lib/engine/calculator';

export default function PurchaseOrdersPage() {
  const [pos, setPos] = useState<ProcurementPO[]>([]);
  const [prs, setPrs] = useState<ProcurementPO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'POs' | 'PRs'>('POs');

  useEffect(() => {
    async function loadData() {
      try {
        const { supabase } = await import('@/lib/supabase/client');
        const { data: { session } } = await supabase.auth.getSession();
        let orgId = 'default-org-id';
        if (session?.user?.id) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('org_id')
            .eq('id', session.user.id)
            .maybeSingle();
          if (profile?.org_id) orgId = profile.org_id;
        }

        const fetchedPOs = await ProcurementORM.getPOs(orgId);
        const fetchedPRs = await ProcurementORM.getPRs(orgId);
        setPos(fetchedPOs);
        setPrs(fetchedPRs);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#f0a500]"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="bg-red-500/10 border border-red-500/30 text-red-500 p-4 rounded-lg">
          Error: {error}
        </div>
      </div>
    );
  }

  const items = activeTab === 'POs' ? pos : prs;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#1a1a1a] p-6 rounded-xl border border-[#2a2a2a] shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-[#f0a500]/20 flex items-center justify-center text-[#f0a500]">
            <ShoppingCart size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Purchase Orders</h1>
            <p className="text-sm text-[#888] mt-1">Manage vendor POs and Purchase Requests</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#f0a500] text-black hover:bg-[#f0a500]/90 transition-colors text-sm font-bold shadow-[0_0_15px_rgba(240,165,0,0.3)]">
            <Plus size={16} /> New PO
          </button>
        </div>
      </div>

      <div className="bg-[#1a1a1a] rounded-xl border border-[#2a2a2a] shadow-lg overflow-hidden">
        
        {/* Tabs & Filters */}
        <div className="p-4 border-b border-[#2a2a2a] bg-[#111] flex flex-col md:flex-row justify-between gap-4">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setActiveTab('POs')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'POs' ? 'bg-[#f0a500]/10 text-[#f0a500] border border-[#f0a500]/30' : 'text-[#888] hover:text-white border border-transparent'
              }`}
            >
              Active POs
            </button>
            <button 
              onClick={() => setActiveTab('PRs')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'PRs' ? 'bg-[#f0a500]/10 text-[#f0a500] border border-[#f0a500]/30' : 'text-[#888] hover:text-white border border-transparent'
              }`}
            >
              Purchase Requests
            </button>
          </div>

          <div className="flex items-center gap-2 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#666]" />
            <input 
              type="text" 
              placeholder={`Search ${activeTab}...`} 
              className="pl-9 pr-3 py-2 bg-[#0d0d0d] border border-[#333] rounded-lg text-xs text-white outline-none focus:border-[#f0a500] min-w-[200px]"
            />
            <button className="p-2 border border-[#333] bg-[#0d0d0d] rounded-lg text-[#888] hover:text-white">
              <Filter size={16} />
            </button>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-[#151515] text-[#888]">
                <th className="px-5 py-3 font-medium border-b border-[#2a2a2a]">PO Number</th>
                <th className="px-5 py-3 font-medium border-b border-[#2a2a2a]">Vendor</th>
                <th className="px-5 py-3 font-medium border-b border-[#2a2a2a]">Project / Ref</th>
                <th className="px-5 py-3 font-medium border-b border-[#2a2a2a] text-center">Status</th>
                <th className="px-5 py-3 font-medium border-b border-[#2a2a2a] text-right">Amount</th>
                <th className="px-5 py-3 font-medium border-b border-[#2a2a2a] text-center">Date</th>
                <th className="px-5 py-3 font-medium border-b border-[#2a2a2a] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2a2a2a]">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-[#1a1a1a]/50 transition-colors">
                  <td className="px-5 py-3.5 text-white font-medium">{item.po_number}</td>
                  <td className="px-5 py-3.5 text-[#888]">{item.vendor?.name || 'Unknown Vendor'}</td>
                  <td className="px-5 py-3.5 text-[#888]">
                    {item.project?.project_number ? `Project: ${item.project.project_number}` : 'Inventory / General'}
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      item.status === 'sent' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                      item.status === 'received' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                      item.status === 'draft' ? 'bg-[#333] text-[#aaa] border border-[#444]' :
                      'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                    }`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono text-white">
                    {formatINR(item.total_amount || 0)}
                  </td>
                  <td className="px-5 py-3.5 text-center text-[#666]">
                    {new Date(item.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3.5 text-right space-x-2">
                    <button className="text-[#888] hover:text-white" title="View Details">
                      <FileText size={16} />
                    </button>
                    {activeTab === 'POs' && (
                      <button className="text-[#f0a500] hover:text-[#f0a500]/80" title="Send PO via Email">
                        <Send size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-[#555]">
                    No {activeTab} found for this organization.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
