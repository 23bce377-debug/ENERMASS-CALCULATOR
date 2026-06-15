'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { formatINR } from '@/lib/engine/calculator';

export default function VendorRetentionReport() {
  const [retentions, setRetentions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      // In a real scenario, we'd join with vendors and epc_projects
      // Since this is a new table, we simulate the join or rely on Drizzle/Supabase views
      const { data, error } = await supabase
        .from('vendor_payments')
        .select(`
          id,
          invoice_number,
          invoice_amount,
          retention_amount,
          retention_percent,
          status,
          created_at,
          vendors ( name ),
          epc_projects ( title )
        `)
        .order('created_at', { ascending: false });

      if (data) setRetentions(data);
      setLoading(false);
    }
    loadData();
  }, []);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Vendor Retention Aging Report</h1>
        <p className="text-sm text-text-muted mt-1">Track withheld vendor payments pending commissioning</p>
      </div>

      <div className="overflow-x-auto bg-surface border border-border rounded-xl shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-active border-b border-border">
            <tr>
              <th className="px-4 py-3 font-semibold text-text-muted">Vendor</th>
              <th className="px-4 py-3 font-semibold text-text-muted">Project</th>
              <th className="px-4 py-3 font-semibold text-text-muted">Invoice #</th>
              <th className="px-4 py-3 font-semibold text-text-muted">Invoice Amount</th>
              <th className="px-4 py-3 font-semibold text-text-muted">Retention</th>
              <th className="px-4 py-3 font-semibold text-text-muted">Days Held</th>
              <th className="px-4 py-3 font-semibold text-text-muted">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-text-muted">Loading...</td></tr>
            ) : retentions.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-text-muted">No retention data found.</td></tr>
            ) : (
              retentions.map(r => {
                const daysHeld = Math.floor((new Date().getTime() - new Date(r.created_at).getTime()) / (1000 * 3600 * 24));
                return (
                  <tr key={r.id} className="hover:bg-surface-hover">
                    <td className="px-4 py-3 font-medium">{r.vendors?.name || 'Unknown'}</td>
                    <td className="px-4 py-3">{r.epc_projects?.title || 'Unknown'}</td>
                    <td className="px-4 py-3 font-mono">{r.invoice_number}</td>
                    <td className="px-4 py-3">{formatINR(r.invoice_amount)}</td>
                    <td className="px-4 py-3 font-medium text-warning-dark">
                      {formatINR(r.retention_amount)} ({r.retention_percent}%)
                    </td>
                    <td className="px-4 py-3">{daysHeld} days</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        r.status === 'pending' ? 'bg-warning/10 text-warning-dark' :
                        r.status === 'retention_released' ? 'bg-success/10 text-success' :
                        'bg-border text-text-muted'
                      }`}>
                        {r.status === 'pending' ? 'Pending' : r.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
