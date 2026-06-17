import { supabase } from '@/lib/supabase/client';
import { allocateBundlePrice } from '@/lib/engine/bundleAllocation';


// Local types until schema.types.ts is regenerated
export interface Acquisition {
  id: string;
  org_id: string;
  vendor_id?: string;
  invoice_number?: string;
  invoice_date: string;
  total_amount: number;
  status: 'pending' | 'received' | 'cancelled';
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface AcquisitionItem {
  id: string;
  acquisition_id: string;
  item_description: string;
  category?: string;
  qty: number;
  unit?: string;
  rate_per_unit: number;
  gst_pct?: number;
  created_at: string;
}

export interface InventorySummary {
  org_id: string;
  item_description: string;
  category?: string;
  current_qty: number;
  weighted_avg_cost: number;
  last_updated: string;
}

export interface Vendor {
  id: string;
  org_id: string;
  name: string;
  contact_person?: string | null;
  email?: string | null;
  phone?: string | null;
  gst_number?: string | null;
  address?: string | null;
  created_at?: string;
  updated_at?: string;
  status?: string;
  is_structure_vendor?: boolean;
  version?: number;
}

export const VendorORM = {
  async create(vendor: Partial<Vendor>) {
    const { data, error } = await supabase
      .from('vendors')
      .insert({
        ...vendor,
        version: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, updates: Partial<Vendor>) {
    const { data, error } = await supabase
      .from('vendors')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
};



// ─── Acquisition ORM ──────────────────────────────────────────────────────────

export const AcquisitionORM = {
  async getAll(orgId: string) {
    const { data, error } = await (supabase as any)
      .from('acquisitions')
      .select('*, vendors(name)')
      .eq('org_id', orgId)
      .order('invoice_date', { ascending: false });
    if (error) throw error;
    return data;
  },

  async getById(id: string) {
    const { data, error } = await (supabase as any)
      .from('acquisitions')
      .select('*, acquisition_items(*), acquisition_bundles(*), vendors(*)')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async create(
    acquisition: Partial<Acquisition>,
    items: Partial<AcquisitionItem>[],
    bundles?: Array<{
      bundle_preset_id?: string | null;
      name: string;
      qty: number;
      effective_bundle_price: number;
      allocation_strategy: 'proportional_cost' | 'proportional_qty' | 'manual';
      gst_pct: number;
      items: any[];
    }>
  ) {
    // 1. Process bundle instances if provided to get the full items list
    const itemsToInsert: any[] = items.map(item => ({ ...item }));

    if (bundles && bundles.length > 0) {
      // NOTE: In a high-scale architecture, this allocation should ideally move to Postgres.
      // For now, we perform allocation in TS and send the full list to an atomic RPC.
      for (const bundle of bundles) {
        // Run allocation logic
        const allocatedItems = allocateBundlePrice(
          bundle.effective_bundle_price,
          bundle.items,
          bundle.allocation_strategy
        );

        // Map to acquisition_items format
        allocatedItems.forEach(allocated => {
          itemsToInsert.push({
            item_description: allocated.item_description,
            category: allocated.category,
            qty: bundle.qty * allocated.qty,
            unit: allocated.unit || 'Nos',
            rate_per_unit: allocated.rate_per_unit,
            gst_pct: allocated.gst_pct
          });
        });
      }
    }

    // 2. Call atomic RPC
    const { data, error } = await (supabase as any).rpc('create_acquisition_atomic', {
      p_acquisition: acquisition,
      p_items: itemsToInsert
    });

    if (error) throw error;
    return data;
  },

  async markAsReceived(id: string, orgId?: string) {
    const { data, error } = await (supabase as any).rpc('mark_acquisition_as_received', {
      p_acquisition_id: id
    });
    if (error) throw error;
    return data;
  }
};

// ─── Inventory ORM ────────────────────────────────────────────────────────────

export const InventoryORM = {
  async getSummary(orgId: string) {
    const { data, error } = await (supabase as any)
      .from('inventory_summary')
      .select('*')
      .eq('org_id', orgId)
      .order('item_description', { ascending: true });
    if (error) throw error;
    return data as unknown as InventorySummary[];
  },

  async getLedger(orgId: string, itemDescription?: string) {
    let query = (supabase as any)
      .from('inventory_ledger')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });
    
    if (itemDescription) {
      query = query.eq('item_description', itemDescription);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }
};
