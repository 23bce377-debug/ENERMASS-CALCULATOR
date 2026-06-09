import { supabase } from '@/lib/supabase/client';
import { allocateBundlePrice } from '@/lib/engine/bundleAllocation';


// Local types until schema.types.ts is regenerated
export interface Vendor {
  id: string;
  org_id: string;
  name: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  gst_number?: string;
  address?: string;
  created_at: string;
  updated_at: string;
}

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

// ─── Vendor ORM ───────────────────────────────────────────────────────────────

export const VendorORM = {
  async getAll(orgId: string) {
    const { data, error } = await (supabase as any)
      .from('vendors')
      .select('*')
      .eq('org_id', orgId)
      .order('name', { ascending: true });
    if (error) throw error;
    return data as Vendor[];
  },

  async create(vendor: Partial<Vendor>) {
    const { data, error } = await (supabase as any)
      .from('vendors')
      .insert(vendor)
      .select()
      .single();
    if (error) throw error;
    return data as Vendor;
  },

  async update(id: string, updates: Partial<Vendor>) {
    const { data, error } = await (supabase as any)
      .from('vendors')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as Vendor;
  },

  async delete(id: string) {
    const { error } = await (supabase as any).from('vendors').delete().eq('id', id);
    if (error) throw error;
    return true;
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
      .single();
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
    // 1. Insert acquisition
    const { data: acq, error: acqErr } = await (supabase as any)
      .from('acquisitions')
      .insert(acquisition)
      .select()
      .single();
    if (acqErr) throw acqErr;

    // 2. Prepare items list
    const itemsToInsert: any[] = items.map(item => ({
      ...item,
      acquisition_id: acq.id
    }));

    // 3. Process bundle instances if provided
    if (bundles && bundles.length > 0) {
      for (const bundle of bundles) {
        // a. Insert acquisition bundle record
        const { data: acqBundle, error: bundleErr } = await (supabase as any)
          .from('acquisition_bundles')
          .insert({
            acquisition_id: acq.id,
            bundle_preset_id: bundle.bundle_preset_id,
            name: bundle.name,
            qty: bundle.qty,
            effective_bundle_price: bundle.effective_bundle_price,
            allocation_strategy: bundle.allocation_strategy,
            gst_pct: bundle.gst_pct
          })
          .select()
          .single();
        if (bundleErr) throw bundleErr;

        // b. Run allocation logic for each bundle unit.
        const allocatedItems = allocateBundlePrice(
          bundle.effective_bundle_price,
          bundle.items,
          bundle.allocation_strategy
        );

        // d. Map to acquisition_items format and add to insertion list
        allocatedItems.forEach(allocated => {
          itemsToInsert.push({
            acquisition_id: acq.id,
            acquisition_bundle_id: acqBundle.id,
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

    // 4. Insert all items
    if (itemsToInsert.length > 0) {
      const { error: itemsErr } = await (supabase as any)
        .from('acquisition_items')
        .insert(itemsToInsert);
      if (itemsErr) throw itemsErr;
    }

    return acq;
  },

  async markAsReceived(id: string, orgId: string) {
    const { data, error } = await (supabase as any).rpc('mark_acquisition_as_received', {
      p_acquisition_id: id,
      p_org_id: orgId
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
