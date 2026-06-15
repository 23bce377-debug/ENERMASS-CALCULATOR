import { supabase } from '@/lib/supabase/client';

export type InventoryState = 'in_warehouse' | 'in_transit' | 'at_site' | 'installed' | 'commissioned' | 'returned_to_warehouse' | 'scrapped';

export async function dispatchToSite(
  itemId: string,
  projectId: string,
  qty: number,
  vehicleNumber: string,
  driverContact: string,
  movedBy?: string
) {
  if (qty <= 0) throw new Error("Quantity must be greater than 0");
  
  const { data, error } = await supabase.rpc('dispatch_inventory', {
    p_item_id: itemId,
    p_project_id: projectId,
    p_quantity: qty,
    p_vehicle_number: vehicleNumber,
    p_driver_contact: driverContact,
    p_moved_by: movedBy || null
  });

  if (error) throw new Error(`Dispatch failed: ${error.message}`);
  return data;
}

export async function confirmSiteReceipt(
  movementId: string,
  receivedBy: string,
  actualQty: number,
  notes?: string
) {
  if (actualQty < 0) throw new Error("Quantity cannot be negative");

  // 1. Fetch the original dispatch movement
  const { data: dispatch, error: fetchErr } = await supabase
    .from('inventory_movements')
    .select('*')
    .eq('id', movementId)
    .single();

  if (fetchErr || !dispatch) throw new Error("Movement not found");
  if (dispatch.to_state !== 'in_transit') throw new Error("Item is not in transit");

  const dispatchedQty = Number(dispatch.quantity);
  
  let finalNotes = notes || '';
  if (actualQty < dispatchedQty) {
    const shortQty = dispatchedQty - actualQty;
    console.warn(`[DISCREPANCY ALERT] Short delivery on movement ${movementId}. Expected: ${dispatchedQty}, Received: ${actualQty}, Short: ${shortQty}`);
    finalNotes = `[DISCREPANCY ALERT] Short delivery: received ${actualQty} out of ${dispatchedQty}. ` + finalNotes;
  } else if (actualQty > dispatchedQty) {
    console.warn(`[DISCREPANCY ALERT] Over delivery on movement ${movementId}. Expected: ${dispatchedQty}, Received: ${actualQty}`);
    finalNotes = `[DISCREPANCY ALERT] Over delivery: received ${actualQty} out of ${dispatchedQty}. ` + finalNotes;
  }

  // 2. Create the new movement moving from in_transit to at_site for the actual received amount.
  // Note: the delta (short delivery) remains "in_transit" in the ledger indefinitely unless handled by a separate process (like returned_to_warehouse or scrapped), acting as an automatic discrepancy flag.
  const { data, error } = await supabase.from('inventory_movements').insert({
    item_id: dispatch.item_id,
    project_id: dispatch.project_id,
    from_state: 'in_transit',
    to_state: 'at_site',
    quantity: actualQty,
    site_received_by: receivedBy,
    site_received_at: new Date().toISOString(),
    notes: finalNotes,
  }).select().single();

  if (error) throw new Error(`Receipt confirmation failed: ${error.message}`);
  
  // Asynchronously trigger T2 milestone check
  if (dispatch.project_id) {
    checkT2Milestone(dispatch.project_id).catch(err => console.error('T2 Milestone check failed:', err));
  }
  
  return data;
}

async function checkT2Milestone(projectId: string) {
  // Check if T2 is already paid or due
  const { data: project } = await supabase.from('epc_projects').select('quote_id').eq('id', projectId).single();
  if (!project?.quote_id) return;
  
  const { data: schedule } = await supabase.from('payment_schedules')
    .select('*')
    .eq('quote_id', project.quote_id)
    .eq('trigger_event', 'site_delivery')
    .single();
    
  if (schedule && !schedule.due_date) {
    // Use quote_items instead of project_bom
    const { data: positions } = await supabase.from('inventory_positions').select('*').eq('project_id', projectId);
    const { data: quoteItems } = await supabase.from('quote_items').select('*').eq('quote_id', project.quote_id);
    
    if (positions && quoteItems) {
      // Instead of full value calculation (as rate matching is complex across items), 
      // we do a rough check based on % of total line_total from quote_items,
      // mapping quote_item to catalog_item via some heuristic or just counting major items.
      // Since quote_items doesn't strictly have catalog_item_id without a join table, 
      // we'll do a simple quantity check for now as proxy.
      let totalQty = 0;
      let atSiteQty = 0;
      
      const posMap = new Map();
      positions.forEach(p => posMap.set(p.item_id, p));
      
      // Let's assume quoteItems represent the main BOM qtys roughly
      quoteItems.forEach(item => {
        totalQty += item.qty;
      });
      
      positions.forEach(pos => {
        atSiteQty += Number(pos.qty_at_site || 0) + Number(pos.qty_installed || 0);
      });
      
      if (totalQty > 0 && (atSiteQty / totalQty) >= 0.8) {
        await supabase.from('payment_schedules')
          .update({ due_date: new Date().toISOString() })
          .eq('id', schedule.id);
        console.log(`T2 Milestone marked due for project ${projectId}`);
      }
    }
  }
}

export async function markInstalled(
  itemId: string,
  projectId: string,
  qty: number,
  movedBy?: string
) {
  if (qty <= 0) throw new Error("Quantity must be greater than 0");

  const { data, error } = await supabase.from('inventory_movements').insert({
    item_id: itemId,
    project_id: projectId,
    from_state: 'at_site',
    to_state: 'installed',
    quantity: qty,
    moved_by: movedBy
  }).select().single();

  if (error) throw new Error(`Mark installed failed: ${error.message}`);
  return data;
}

export async function markCommissioned(
  projectId: string,
  movedBy?: string
) {
  // 1. Fetch current positions for the project to see what is At Site and Installed
  const { data: positions, error: fetchErr } = await supabase
    .from('inventory_positions')
    .select('*')
    .eq('project_id', projectId);

  if (fetchErr) throw new Error(`Could not fetch positions: ${fetchErr.message}`);
  if (!positions || positions.length === 0) return [];

  const movements = [];

  // 2. For every item, move any remaining 'at_site' and all 'installed' quantities to 'commissioned'
  for (const pos of positions) {
    const atSite = Number(pos.qty_at_site);
    const installed = Number(pos.qty_installed);

    if (atSite > 0) {
      movements.push({
        item_id: pos.item_id as string,
        project_id: projectId,
        from_state: 'at_site',
        to_state: 'commissioned',
        quantity: atSite,
        moved_by: movedBy,
        notes: "Auto-commissioned remaining site stock"
      } as any);
    }

    if (installed > 0) {
      movements.push({
        item_id: pos.item_id as string,
        project_id: projectId,
        from_state: 'installed',
        to_state: 'commissioned',
        quantity: installed,
        moved_by: movedBy
      } as any);
    }
  }

  if (movements.length === 0) return [];

  const { data, error } = await supabase.from('inventory_movements').insert(movements).select();
  if (error) throw new Error(`Commissioning failed: ${error.message}`);
  
  return data;
}
