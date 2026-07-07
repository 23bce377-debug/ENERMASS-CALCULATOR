import { supabase } from '@/lib/supabase/client';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface ProcurementPO {
  id: string;
  org_id: string;
  vendor_id?: string | null;
  project_id?: string | null;
  po_number: string;
  status: string;
  pr_status: 'draft' | 'pending' | 'approved' | 'rejected' | 'po_generated';
  total_taxable: number;
  total_amount: number;
  delivery_date?: string | null;
  notes?: string | null;
  items_count: number;
  requested_by?: string | null;
  created_at: string;
  updated_at: string;
  vendor?: { name: string } | null;
  project?: { project_number: string; status: string } | null;
  requester?: { full_name: string } | null;
}

export interface ProcurementPOItem {
  id: string;
  po_id: string;
  catalog_item_id: string | null;
  item_description?: string | null;
  category?: string | null;
  unit: string;
  qty_ordered: number;
  qty_received: number;
  unit_price: number;
  estimated_rate: number;
  gst_pct: number;
  is_pr_item: boolean;
}

function toProcurementGstPercent(value: unknown, fallback = 18): number {
  const num = typeof value === 'string' ? Number(value.trim()) : Number(value);
  if (!Number.isFinite(num) || num < 0) return fallback;
  return num <= 1 ? num * 100 : num;
}

export interface ProcurementGRN {
  id: string;
  org_id: string;
  po_id: string;
  grn_number: string;
  receipt_date: string;
  status: string;
  is_processed: boolean;
  created_at: string;
}

export interface ShortfallItem {
  item_description: string;
  category: string;
  qty_needed: number;
  qty_in_stock: number;
  shortfall: number;
  unit: string;
}

// ─── Purchase Request / PO ORM ─────────────────────────────────────────────

export const ProcurementORM = {
  // ── Purchase Requests (PR) ──────────────────────────────────────────────

  async getPRs(orgId: string): Promise<ProcurementPO[]> {
    const { data, error } = await (supabase as any)
      .from('proc_purchase_orders')
      .select('*, vendor:vendors(name), project:epc_projects(project_number, status), requester:profiles!proc_purchase_orders_requested_by_fkey(full_name)')
      .eq('org_id', orgId)
      .in('pr_status', ['draft', 'pending', 'approved', 'rejected'])
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as ProcurementPO[];
  },

  async getPOs(orgId: string): Promise<ProcurementPO[]> {
    const { data, error } = await (supabase as any)
      .from('proc_purchase_orders')
      .select('*, vendor:vendors(name), project:epc_projects(project_number, status)')
      .eq('org_id', orgId)
      .eq('pr_status', 'po_generated')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as ProcurementPO[];
  },

  async getPOById(id: string): Promise<ProcurementPO & { items: ProcurementPOItem[] }> {
    const { data, error } = await (supabase as any)
      .from('proc_purchase_orders')
      .select('*, vendor:vendors(name), project:epc_projects(project_number), items:proc_po_items(*)')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async createPR(orgId: string, payload: {
    vendor_id?: string;
    project_id?: string;
    requested_by?: string;
    notes?: string;
    items: Array<{
      item_description: string;
      category?: string;
      qty: number;
      unit: string;
      estimated_rate: number;
      catalog_item_id?: string | null;
    }>;
  }): Promise<ProcurementPO> {
    const { data: prId, error } = await (supabase as any).rpc('create_purchase_request', {
      p_org_id: orgId,
      p_vendor_id: payload.vendor_id || null,
      p_project_id: payload.project_id || null,
      p_requested_by: payload.requested_by || null,
      p_notes: payload.notes || null,
      p_items: payload.items.map((item) => ({
        item_description: item.item_description,
        category: item.category || null,
        qty: item.qty,
        unit: item.unit,
        estimated_rate: item.estimated_rate,
        catalog_item_id: item.catalog_item_id || null,
      })),
    });
    if (error) throw error;
    if (!prId) throw new Error('Purchase request was not created');

    const po = await ProcurementORM.getPOById(prId);
    return po;
  },

  async approvePR(id: string): Promise<void> {
    const { error } = await (supabase as any)
      .from('proc_purchase_orders')
      .update({ pr_status: 'approved', updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  async rejectPR(id: string): Promise<void> {
    const { error } = await (supabase as any)
      .from('proc_purchase_orders')
      .update({ pr_status: 'rejected', updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  async convertToFullPO(id: string, payload: {
    vendor_id: string;
    delivery_date?: string;
    items: Array<{
      id: string;
      unit_price: number;
      gst_pct?: number;
    }>;
  }): Promise<void> {
    const { error } = await (supabase as any).rpc('convert_pr_to_po', {
      p_po_id: id,
      p_vendor_id: payload.vendor_id,
      p_delivery_date: payload.delivery_date || null,
      p_items: payload.items.map((item) => ({
        id: item.id,
        unit_price: item.unit_price,
        gst_pct: toProcurementGstPercent(item.gst_pct, 18),
      })),
    });
    if (error) throw error;
  },

  async getPOItems(poId: string): Promise<ProcurementPOItem[]> {
    const { data, error } = await (supabase as any)
      .from('proc_po_items')
      .select('*')
      .eq('po_id', poId);
    if (error) throw error;
    return (data || []) as ProcurementPOItem[];
  },

  // ── GRN ────────────────────────────────────────────────────────────────

  async createGRN(orgId: string, poId: string, items: Array<{
    po_item_id: string;
    catalog_item_id?: string | null;
    item_description: string;
    qty_received: number;
    unit: string;
  }>, idempotencyKey?: string): Promise<ProcurementGRN & { duplicate?: boolean }> {
    const { data, error } = await (supabase as any).rpc('create_grn_atomic', {
      p_org_id: orgId,
      p_po_id: poId,
      p_items: items.map((item) => ({
        po_item_id: item.po_item_id,
        catalog_item_id: item.catalog_item_id || null,
        item_description: item.item_description,
        qty_received: item.qty_received,
        unit: item.unit,
      })),
      p_idempotency_key: idempotencyKey || null,
    });
    if (error) throw error;

    const grnId = data?.grn_id;
    if (!grnId) throw new Error('GRN was not created');

    const { data: grn, error: fetchError } = await (supabase as any)
      .from('proc_goods_receipt_notes')
      .select('*')
      .eq('id', grnId)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!grn) throw new Error('GRN was created but could not be loaded');

    return { ...grn, duplicate: Boolean(data?.duplicate) };
  },

  async getGRNsForPO(poId: string): Promise<ProcurementGRN[]> {
    const { data, error } = await (supabase as any)
      .from('proc_goods_receipt_notes')
      .select('*')
      .eq('po_id', poId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as ProcurementGRN[];
  },

  // ── Shortfall Report ───────────────────────────────────────────────────

  async getShortfallForProject(projectId: string, orgId: string): Promise<ShortfallItem[]> {
    const { data: projectData } = await (supabase as any)
      .from('epc_projects')
      .select('quote_id')
      .eq('id', projectId)
      .maybeSingle();

    if (!projectData?.quote_id) return [];

    const { data: bomItems } = await (supabase as any)
      .from('quote_items')
      .select('description, unit, qty, section')
      .eq('quote_id', projectData.quote_id);

    if (!bomItems || bomItems.length === 0) return [];

    const { data: stock } = await (supabase as any)
      .from('inventory_summary')
      .select('item_description, current_qty, unit')
      .eq('org_id', orgId);

    const stockMap: Record<string, number> = {};
    (stock || []).forEach((s: any) => {
      stockMap[s.item_description.toLowerCase()] = Number(s.current_qty || 0);
    });

    const shortfalls: ShortfallItem[] = [];
    for (const item of bomItems) {
      const needed = Number(item.qty || 0);
      if (needed <= 0) continue;
      const inStock = stockMap[(item.description || '').toLowerCase()] || 0;
      const shortfall = Math.max(0, needed - inStock);
      if (shortfall > 0) {
        shortfalls.push({
          item_description: item.description || '',
          category: item.section || 'General',
          qty_needed: needed,
          qty_in_stock: inStock,
          shortfall,
          unit: item.unit || 'Nos',
        });
      }
    }

    return shortfalls;
  },

  async getProjectsWithShortfall(orgId: string): Promise<Array<{
    id: string;
    project_number: string;
    status: string;
    shortfall_count: number;
  }>> {
    const { data: projects } = await (supabase as any)
      .from('epc_projects')
      .select('id, project_number, status, quote_id')
      .eq('org_id', orgId)
      .not('status', 'in', '("closed","cancelled")')
      .not('quote_id', 'is', null);

    if (!projects) return [];

    const result = [];
    for (const p of projects) {
      const shortfalls = await ProcurementORM.getShortfallForProject(p.id, orgId);
      if (shortfalls.length > 0) {
        result.push({
          id: p.id,
          project_number: p.project_number,
          status: p.status,
          shortfall_count: shortfalls.length,
        });
      }
    }
    return result;
  }
};
