'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Package, Building2, ShoppingCart } from 'lucide-react';

export default function InventoryAndProcurementPage() {
  const [siteInventory, setSiteInventory] = useState<any[]>([]);
  const [purchaseRequests, setPurchaseRequests] = useState<any[]>([]);
  const [projectLedger, setProjectLedger] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [invRes, prRes, plRes] = await Promise.all([
          supabase.from('site_inventory').select('*').limit(50),
          supabase.from('purchase_requests').select('*').limit(50),
          supabase.from('project_ledger').select('*').limit(50)
        ]);
        
        if (invRes.data) setSiteInventory(invRes.data);
        if (prRes.data) setPurchaseRequests(prRes.data);
        if (plRes.data) setProjectLedger(plRes.data);
      } catch (error) {
        console.error('Error loading data:', error);
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

      {renderTable(siteInventory, 'Site Inventory', Package)}
      {renderTable(purchaseRequests, 'Purchase Requests', ShoppingCart)}
      {renderTable(projectLedger, 'Project Ledger', Building2)}
    </div>
  );
}
