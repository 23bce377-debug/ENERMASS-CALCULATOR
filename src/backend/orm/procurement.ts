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
  catalog_item_id: string;
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
    }>;
  }): Promise<ProcurementPO> {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    const po_number = `PR-${dateStr}-${rand}`;

    const total_taxable = payload.items.reduce((s, i) => s + i.qty * i.estimated_rate, 0);

    const { data: po, error } = await (supabase as any)
      .from('proc_purchase_orders')
      .insert({
        org_id: orgId,
        vendor_id: payload.vendor_id || null,
        po_number,
        project_id: payload.project_id || null,
        requested_by: payload.requested_by || null,
        notes: payload.notes || null,
        pr_status: 'pending',
        status: 'draft',
        total_taxable,
        cgst_amount: 0,
        sgst_amount: 0,
        igst_amount: 0,
        total_amount: total_taxable,
        items_count: payload.items.length,
        version: 1,
      })
      .select()
      .maybeSingle();
    if (error) throw error;

    if (payload.items.length > 0) {
      const { error: itemsError } = await (supabase as any)
        .from('proc_po_items')
        .insert(payload.items.map(i => ({
          po_id: po.id,
          item_description: i.item_description,
          category: i.category || null,
          qty_ordered: i.qty,
          qty_received: 0,
          unit: i.unit,
          estimated_rate: i.estimated_rate,
          unit_price: i.estimated_rate,
          gst_pct: 0.18,
          catalog_item_id: null,
          is_pr_item: true,
        })));
      if (itemsError) throw itemsError;
    }

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
    // Update PO items with final rates
    for (const item of payload.items) {
      await (supabase as any)
        .from('proc_po_items')
        .update({ unit_price: item.unit_price, gst_pct: item.gst_pct || 0.18 })
        .eq('id', item.id);
    }

    // Get all items to compute totals
    const { data: allItems } = await (supabase as any)
      .from('proc_po_items')
      .select('qty_ordered, unit_price, gst_pct')
      .eq('po_id', id);

    const total_taxable = (allItems || []).reduce((s: number, i: any) => s + Number(i.qty_ordered) * Number(i.unit_price), 0);
    const gst_total = (allItems || []).reduce((s: number, i: any) => s + Number(i.qty_ordered) * Number(i.unit_price) * Number(i.gst_pct), 0);

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    const po_number = `PO-${dateStr}-${rand}`;

    const { error } = await (supabase as any)
      .from('proc_purchase_orders')
      .update({
        vendor_id: payload.vendor_id,
        po_number,
        pr_status: 'po_generated',
        status: 'sent',
        delivery_date: payload.delivery_date || null,
        total_taxable,
        cgst_amount: gst_total / 2,
        sgst_amount: gst_total / 2,
        igst_amount: 0,
        total_amount: total_taxable + gst_total,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
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
    grn_item_id?: string;
    catalog_item_id: string;
    item_description: string;
    qty_received: number;
    unit: string;
  }>, idempotencyKey?: string): Promise<ProcurementGRN & { duplicate?: boolean }> {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    const grn_number = `GRN-${dateStr}-${rand}`;

    // Get/create default warehouse
    const { data: warehouse } = await (supabase as any)
      .from('inv_warehouses')
      .select('id')
      .eq('org_id', orgId)
      .eq('is_default', true)
      .maybeSingle();

    let warehouseId = warehouse?.id;
    if (!warehouseId) {
      const { data: newWh } = await (supabase as any)
        .from('inv_warehouses')
        .insert({ org_id: orgId, name: 'Main Warehouse', location: 'Default', is_default: true })
        .select()
        .maybeSingle();
      warehouseId = newWh?.id;
    }

    let grn;
    const { data: grnData, error } = await (supabase as any)
      .from('proc_goods_receipt_notes')
      .insert({
        org_id: orgId,
        po_id: poId,
        warehouse_id: warehouseId,
        grn_number,
        receipt_date: new Date().toISOString().split('T')[0],
        status: 'pending',
        is_processed: false,
        idempotency_key: idempotencyKey || null,
      })
      .select()
      .maybeSingle();
      
    if (error) {
      if (idempotencyKey && (error.code === '23505' || error.message?.includes('duplicate key'))) {
        const { data: existing } = await (supabase as any)
          .from('proc_goods_receipt_notes')
          .select('*')
          .eq('idempotency_key', idempotencyKey)
          .maybeSingle();
        if (existing) return { ...existing, duplicate: true };
      }
      throw error;
    }
    grn = grnData;

    // Insert GRN items (with unique constraint to prevent duplicates)
    for (const item of items) {
      if (item.qty_received <= 0) continue;
      await (supabase as any)
        .from('proc_grn_items')
        .upsert({
          grn_id: grn.id,
          catalog_item_id: item.catalog_item_id,
          item_description: item.item_description,
          qty_received: item.qty_received,
          unit: item.unit,
          serials: [],
        }, { onConflict: 'grn_id,catalog_item_id', ignoreDuplicates: true });

      // Update PO item qty_received
      const { data: poItem } = await (supabase as any)
        .from('proc_po_items')
        .select('qty_received, qty_ordered')
        .eq('po_id', poId)
        .eq('catalog_item_id', item.catalog_item_id)
        .maybeSingle();

      if (poItem) {
        const newQty = Math.min(Number(poItem.qty_ordered), Number(poItem.qty_received) + item.qty_received);
        await (supabase as any)
          .from('proc_po_items')
          .update({ qty_received: newQty })
          .eq('po_id', poId)
          .eq('catalog_item_id', item.catalog_item_id);
      }
    }

    // Mark GRN as processed
    await (supabase as any)
      .from('proc_goods_receipt_notes')
      .update({ status: 'approved', is_processed: true, processed_at: new Date().toISOString() })
      .eq('id', grn.id);

    // Check if PO is fully received
    const { data: poItems } = await (supabase as any)
      .from('proc_po_items')
      .select('qty_ordered, qty_received')
      .eq('po_id', poId);

    if (poItems) {
      const allReceived = poItems.every((i: any) => Number(i.qty_received) >= Number(i.qty_ordered));
      const anyReceived = poItems.some((i: any) => Number(i.qty_received) > 0);
      await (supabase as any)
        .from('proc_purchase_orders')
        .update({
          status: allReceived ? 'received' : anyReceived ? 'partially_received' : 'sent',
          updated_at: new Date().toISOString(),
        })
        .eq('id', poId);
    }

    return grn;
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
