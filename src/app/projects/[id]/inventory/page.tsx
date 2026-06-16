'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { PackageSearch, Truck, MapPin, CheckCircle, AlertTriangle } from 'lucide-react';
import { formatINR } from '@/lib/engine/calculator';

interface InventoryRow {
  catalogId: string;
  description: string;
  unit: string;
  bomQty: number;
  inWarehouse: number;
  inTransit: number;
  atSite: number;
  installed: number;
}

export default function SiteInventoryDashboard() {
  const params = useParams();
  const projectId = params.id as string;
  const [data, setData] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        // 1. Get project and its quote
        const { data: project, error: pErr } = await supabase
          .from('epc_projects')
          .select('id, quote_id, project_number')
          .eq('id', projectId)
          .single();

        if (pErr) throw pErr;

        // 2. Get BOM items
        let bomItems: any[] = [];
        if (project.quote_id) {
          const { data: qItems } = await supabase
            .from('quote_items')
            .select('description, qty, unit')
            .eq('quote_id', project.quote_id);
          bomItems = qItems || [];
        }

        // 3. Get catalog items to map descriptions to IDs
        const { data: catalog } = await supabase
          .from('catalog_items')
          .select('id, name, unit');

        // 4. Get inventory positions for this project
        const { data: positions } = await supabase
          .from('inventory_positions')
          .select('*')
          .eq('project_id', projectId);

        const posMap = new Map();
        positions?.forEach(p => {
          posMap.set(p.item_id, p);
        });

        const rows: InventoryRow[] = [];

        // Match BOM to Catalog
        bomItems.forEach(bom => {
          const catItem = catalog?.find(c => c.name.toUpperCase() === bom.description.toUpperCase());
          const catId = catItem?.id;
          const pos = catId ? posMap.get(catId) : null;

          rows.push({
            catalogId: catId || '',
            description: bom.description,
            unit: bom.unit,
            bomQty: bom.qty,
            inWarehouse: pos ? Number(pos.qty_in_warehouse) : 0,
            inTransit: pos ? Number(pos.qty_in_transit) : 0,
            atSite: pos ? Number(pos.qty_at_site) : 0,
            installed: pos ? Number(pos.qty_installed) : 0,
          });
        });

        // Add positions not in BOM
        positions?.forEach(pos => {
          const catItem = catalog?.find(c => c.id === pos.item_id);
          const exists = rows.find(r => r.catalogId === pos.item_id);
          if (!exists && catItem) {
            rows.push({
              catalogId: pos.item_id || '',
              description: catItem.name,
              unit: catItem.unit || 'units',
              bomQty: 0,
              inWarehouse: Number(pos.qty_in_warehouse),
              inTransit: Number(pos.qty_in_transit),
              atSite: Number(pos.qty_at_site),
              installed: Number(pos.qty_installed),
            });
          }
        });

        setData(rows);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchDashboard();
  }, [projectId]);

  if (loading) {
    return <div className="p-8 text-center text-text-muted">Loading Site Inventory...</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto animate-fade-in">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center text-accent">
          <PackageSearch size={20} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Site Inventory Dashboard</h1>
          <p className="text-sm text-text-muted">Track material lifecycle from warehouse to installation.</p>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead>
              <tr className="bg-surface-active border-b border-border/60 text-text-muted">
                <th className="px-4 py-3 font-semibold">Material Description</th>
                <th className="px-4 py-3 font-semibold text-right">BOM Qty</th>
                <th className="px-4 py-3 font-semibold text-right">In Transit</th>
                <th className="px-4 py-3 font-semibold text-right">At Site</th>
                <th className="px-4 py-3 font-semibold text-right">Installed</th>
                <th className="px-4 py-3 font-semibold text-right">Delta (BOM - Installed)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {data.map((row, i) => {
                const delta = row.bomQty - row.installed;
                let deltaColor = 'text-text-secondary';
                if (delta > 0 && delta !== row.bomQty) deltaColor = 'text-warning font-medium'; // Short but partially installed
                if (delta === row.bomQty) deltaColor = 'text-text-muted'; // Nothing installed yet
                if (delta < 0) deltaColor = 'text-error font-bold'; // Over-delivery / Installed more than BOM

                return (
                  <tr key={i} className="hover:bg-surface-hover transition-colors">
                    <td className="px-4 py-3 font-medium text-text-primary">
                      {row.description}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {row.bomQty} <span className="text-text-muted text-xs">{row.unit}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {row.inTransit > 0 ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-info/10 text-info rounded-md font-medium text-xs">
                          <Truck size={12} /> {row.inTransit}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {row.atSite > 0 ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-warning/10 text-warning rounded-md font-medium text-xs">
                          <MapPin size={12} /> {row.atSite}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {row.installed > 0 ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-success/10 text-success rounded-md font-medium text-xs">
                          <CheckCircle size={12} /> {row.installed}
                        </span>
                      ) : '-'}
                    </td>
                    <td className={`px-4 py-3 text-right ${deltaColor}`}>
                      {delta > 0 && <span className="mr-1">+</span>}{delta}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {data.length === 0 && (
            <div className="p-8 text-center text-text-muted">No inventory records found for this project.</div>
          )}
        </div>
      </div>
    </div>
  );
}
