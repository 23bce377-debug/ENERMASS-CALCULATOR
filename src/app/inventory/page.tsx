'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Package, Building2, ShoppingCart } from 'lucide-react';

export default function InventoryAndProcurementPage() {
  const [siteInventory, setSiteInventory] = useState<any[]>([]);
  const [purchaseRequests, setPurchaseRequests] = useState<any[]>([]);
  const [projectLedger, setProjectLedger] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setError(null);
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        const userId = sessionData.session?.user.id;
        if (!userId) {
          setSiteInventory([]);
          setPurchaseRequests([]);
          setProjectLedger([]);
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('org_id')
          .eq('id', userId)
          .single();
        if (profileError) throw profileError;
        const orgId = profile?.org_id;
        if (!orgId) {
          setSiteInventory([]);
          setPurchaseRequests([]);
          setProjectLedger([]);
          return;
        }

        const [invRes, prRes, plRes] = await Promise.all([
          supabase
            .from('inventory_summary')
            .select('item_description, category, current_qty, unit, weighted_avg_cost, last_updated')
            .eq('org_id', orgId)
            .order('last_updated', { ascending: false })
            .limit(50),
          supabase
            .from('proc_purchase_orders')
            .select('po_number, pr_status, status, total_amount, created_at')
            .eq('org_id', orgId)
            .in('pr_status', ['draft', 'pending', 'approved', 'rejected'])
            .order('created_at', { ascending: false })
            .limit(50),
          supabase
            .from('acc_journal_entries')
            .select('entry_date, reference_no, description, created_at')
            .eq('org_id', orgId)
            .order('entry_date', { ascending: false })
            .limit(50)
        ]);

        if (invRes.error) throw invRes.error;
        if (prRes.error) throw prRes.error;
        if (plRes.error) throw plRes.error;
        
        setSiteInventory(invRes.data || []);
        setPurchaseRequests(prRes.data || []);
        setProjectLedger(plRes.data || []);
      } catch (err: any) {
        console.error('Error loading data:', err);
        setError(err.message || 'Failed to load inventory and procurement data.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const renderTable = (data: any[], title: string, Icon: any) => (
    <div className="border rounded-xl shadow-sm bg-white overflow-hidden mb-8">
      <div className="bg-zinc-50 border-b px-6 py-4 flex items-center space-x-2">
        <Icon className="w-5 h-5 text-zinc-500" />
        <h2 className="text-lg font-semibold text-zinc-800">{title}</h2>
      </div>
      <div className="p-6">
        {loading ? (
          <div className="animate-pulse space-y-3">
            <div className="h-10 bg-zinc-100 rounded"></div>
            <div className="h-10 bg-zinc-100 rounded"></div>
          </div>
        ) : data.length === 0 ? (
          <p className="text-zinc-500 text-sm">No records found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-zinc-50 border-b">
                <tr>
                  {Object.keys(data[0] || {}).slice(0, 5).map((key) => (
                    <th key={key} className="px-4 py-2 font-medium capitalize">
                      {key.replace(/_/g, ' ')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.map((item, idx) => (
                  <tr key={idx} className="hover:bg-zinc-50">
                    {Object.values(item).slice(0, 5).map((val: any, vIdx) => (
                      <td key={vIdx} className="px-4 py-2">
                        {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8 flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Inventory & Procurement</h1>
      </div>

      {error && (
        <div className="mb-6 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {renderTable(siteInventory, 'Inventory Summary', Package)}
      {renderTable(purchaseRequests, 'Purchase Requests', ShoppingCart)}
      {renderTable(projectLedger, 'Ledger Entries', Building2)}
    </div>
  );
}
