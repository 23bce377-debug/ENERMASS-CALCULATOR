import 'server-only';
import { createClient } from '@/lib/supabase/server';

export interface InventoryMovement {
  id: string;
  org_id: string;
  item_id: string;
  project_id: string | null;
  warehouse_id: string | null;
  from_state: string;
  to_state: string;
  quantity: number;
  moved_by: string | null;
  vehicle_number: string | null;
  driver_contact: string | null;
  site_received_by: string | null;
  site_received_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface InventoryPosition {
  item_id: string;
  project_id: string | null;
  qty_in_warehouse: number;
  qty_in_transit: number;
  qty_at_site: number;
  qty_installed: number;
  qty_commissioned: number;
  qty_scrapped: number;
  total_tracked: number;
}

export class InventoryRepository {
  async recordMovement(movement: Omit<InventoryMovement, 'id' | 'created_at'>): Promise<InventoryMovement> {
    const supabase = await createClient();
    
    // validate negative stock before inserting
    await this.validateNoNegativeStock(movement.item_id, movement.project_id, movement.from_state, movement.quantity);

    const { data, error } = await supabase
      .from('inventory_movements')
      .insert(movement as any)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to record movement: ${error.message}`);
    }

    return data as unknown as InventoryMovement;
  }
  
  async getMovementHistory(itemId: string, orgId: string): Promise<InventoryMovement[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('inventory_movements')
      .select('*')
      .eq('item_id', itemId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch movement history: ${error.message}`);
    }

    return data as unknown as InventoryMovement[];
  }
  
  async getPosition(itemId: string, projectId?: string): Promise<InventoryPosition | null> {
    const supabase = await createClient();
    let query = supabase
      .from('inventory_positions')
      .select('*')
      .eq('item_id', itemId);

    if (projectId) {
      query = query.eq('project_id', projectId);
    } else {
      query = query.is('project_id', null);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch position: ${error.message}`);
    }

    return data as unknown as InventoryPosition | null;
  }
  
  async getProjectPositions(projectId: string, orgId: string): Promise<InventoryPosition[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('inventory_positions')
      .select('*')
      .eq('project_id', projectId);

    if (error) {
      throw new Error(`Failed to fetch project positions: ${error.message}`);
    }

    return data as unknown as InventoryPosition[];
  }
  
  async validateNoNegativeStock(itemId: string, projectId: string | null, fromState: string, qty: number): Promise<void> {
    if (fromState === 'NEW_PURCHASE' || fromState === 'EXTERNAL') return; // Source states can generate stock

    const position = await this.getPosition(itemId, projectId || undefined);
    
    if (!position) {
      throw new Error(`Cannot move stock: Item ${itemId} has no recorded position`);
    }

    let available = 0;
    switch (fromState) {
      case 'WAREHOUSE': available = position.qty_in_warehouse; break;
      case 'IN_TRANSIT': available = position.qty_in_transit; break;
      case 'SITE': available = position.qty_at_site; break;
      case 'INSTALLED': available = position.qty_installed; break;
      default:
        throw new Error(`Unknown from_state: ${fromState}`);
    }

    if (available < qty) {
      throw new Error(`Negative stock prevented: Requested ${qty} from ${fromState}, but only ${available} available`);
    }
  }
}

export const inventoryRepository = new InventoryRepository();
