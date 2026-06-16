import { createClient } from '@/lib/supabase/server';

export interface ConsumptionResult {
  totalCost: number;
  layersConsumed: {
    layerId: string;
    qtyConsumed: number;
    unitCost: number;
  }[];
}

/**
 * Consumes inventory using FIFO valuation.
 * It strictly deducts from the oldest available cost layers first.
 *
 * @param orgId Tenant ID
 * @param warehouseId Warehouse ID
 * @param catalogItemId Item to consume
 * @param qty Quantity to consume
 * @returns Cost details of the consumed layers
 */
export async function consumeInventoryFIFO(
  orgId: string,
  warehouseId: string,
  catalogItemId: string,
  qty: number
): Promise<ConsumptionResult> {
  if (qty <= 0) throw new Error('Quantity to consume must be greater than zero');

  const supabase = await createClient();

  // 1. Fetch available layers in FIFO order (oldest received_date first)
  const { data: layers, error: layersError } = await supabase
    .from('inv_cost_layers')
    .select('id, remaining_qty, unit_cost')
    .eq('org_id', orgId)
    .eq('warehouse_id', warehouseId)
    .eq('catalog_item_id', catalogItemId)
    .gt('remaining_qty', 0)
    .order('received_date', { ascending: true });

  if (layersError) throw new Error(`Failed to fetch cost layers: ${layersError.message}`);

  let remainingToConsume = qty;
  let totalCost = 0;
  const layersConsumed = [];

  // 2. Consume layers
  for (const layer of layers || []) {
    if (remainingToConsume <= 0) break;

    const qtyFromLayer = Math.min(layer.remaining_qty, remainingToConsume);
    const costFromLayer = qtyFromLayer * layer.unit_cost;

    layersConsumed.push({
      layerId: layer.id,
      qtyConsumed: qtyFromLayer,
      unitCost: layer.unit_cost
    });

    totalCost += costFromLayer;
    remainingToConsume -= qtyFromLayer;
  }

  // 3. Prevent Negative Stock / Ensure enough stock exists
  if (remainingToConsume > 0) {
    throw new Error(`Insufficient inventory to consume ${qty} units. Missing ${remainingToConsume} units in cost layers.`);
  }

  return { totalCost, layersConsumed };
}

/**
 * Persists the consumption by updating cost layers and balances.
 * This should typically be called inside a Database Transaction / RPC, but we simulate it via API calls here.
 */
export async function commitInventoryConsumption(
  orgId: string,
  warehouseId: string,
  catalogItemId: string,
  transactionType: string,
  projectId: string | null,
  consumption: ConsumptionResult
) {
  const supabase = await createClient();
  const totalQty = consumption.layersConsumed.reduce((sum, l) => sum + l.qtyConsumed, 0);

  // Note: For true ACID compliance, this must run via an RPC in Supabase.
  // We're iterating here for API demonstration, but in production this delegates to a pl/pgsql function
  // to prevent race conditions during concurrent checkouts.

  for (const layer of consumption.layersConsumed) {
    // Deduct from layer
    await supabase.rpc('decrement_layer_qty', {
      p_layer_id: layer.layerId,
      p_qty: layer.qtyConsumed
    });

    // Log the transaction
    await supabase.from('inv_stock_transactions').insert({
      org_id: orgId,
      warehouse_id: warehouseId,
      catalog_item_id: catalogItemId,
      transaction_type: transactionType,
      qty: -layer.qtyConsumed,
      unit_cost_wac: layer.unitCost, // Storing specific layer cost
      cost_layer_id: layer.layerId,
      valuation_method: 'FIFO',
      project_id: projectId
    });
  }

  // Trigger will decrement inv_stock_balances automatically or we do it via RPC
}
