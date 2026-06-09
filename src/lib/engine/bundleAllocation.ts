/**
 * ENERMASS Solar Calculator — Procurement Bundle Cost Allocation Engine
 * ======================================================================
 * Pure functions to distribute a single effective bundle price across child items.
 * Supports:
 *  1. proportional_cost: Ratio-based split using base catalog cost of each item.
 *  2. proportional_qty: Split equally per unit count of the items.
 *  3. manual: Split based on explicit manual cost overrides per line item (scales if sums mismatch).
 */

export interface BundleAllocationItem {
  item_description: string;
  category: string;
  qty: number;
  unit?: string;
  base_cost: number;
  allocated_cost_override?: number | null;
  gst_pct: number;
}

export interface AllocatedResultLine extends BundleAllocationItem {
  allocated_total: number; // base cost total allocated to this line (excl GST)
  rate_per_unit: number;   // rate_per_unit = allocated_total / qty (excl GST)
  line_gst: number;        // allocated_total * gst_pct
  line_subtotal: number;   // allocated_total + line_gst
}

export function allocateBundlePrice(
  effectiveBundlePrice: number, // base price (excl GST) of the bundle
  items: BundleAllocationItem[],
  strategy: 'proportional_cost' | 'proportional_qty' | 'manual'
): AllocatedResultLine[] {
  const count = items.length;
  if (count === 0) return [];

  // Initialize result lines
  const result: AllocatedResultLine[] = items.map(item => ({
    ...item,
    allocated_total: 0,
    rate_per_unit: 0,
    line_gst: 0,
    line_subtotal: 0
  }));

  if (strategy === 'proportional_qty') {
    const totalQty = items.reduce((sum, item) => sum + Number(item.qty), 0);
    if (totalQty > 0) {
      result.forEach(item => {
        item.allocated_total = (effectiveBundlePrice * item.qty) / totalQty;
        item.rate_per_unit = item.qty > 0 ? item.allocated_total / item.qty : 0;
      });
    } else {
      // If total quantity is 0, distribute equally by line count
      result.forEach(item => {
        item.allocated_total = effectiveBundlePrice / count;
        item.rate_per_unit = item.qty > 0 ? item.allocated_total / item.qty : 0;
      });
    }
  } else if (strategy === 'manual') {
    const totalOverride = items.reduce((sum, item) => sum + ((item.allocated_cost_override || 0) * item.qty), 0);
    if (totalOverride > 0) {
      // Scale overrides to match effectiveBundlePrice exactly (in case of manual override total mismatch)
      result.forEach(item => {
        const itemOverrideTotal = (item.allocated_cost_override || 0) * item.qty;
        item.allocated_total = (effectiveBundlePrice * itemOverrideTotal) / totalOverride;
        item.rate_per_unit = item.qty > 0 ? item.allocated_total / item.qty : 0;
      });
    } else {
      // Fallback to proportional_cost if manual overrides are missing or zero
      return allocateBundlePrice(effectiveBundlePrice, items, 'proportional_cost');
    }
  } else {
    // Default strategy: 'proportional_cost'
    const totalBaseCost = items.reduce((sum, item) => sum + (item.base_cost * item.qty), 0);
    if (totalBaseCost > 0) {
      result.forEach(item => {
        const itemBaseTotal = item.base_cost * item.qty;
        item.allocated_total = (effectiveBundlePrice * itemBaseTotal) / totalBaseCost;
        item.rate_per_unit = item.qty > 0 ? item.allocated_total / item.qty : 0;
      });
    } else {
      // Fallback: distribute by quantity if all base costs are 0
      return allocateBundlePrice(effectiveBundlePrice, items, 'proportional_qty');
    }
  }

  // Calculate GST & subtotal per line
  result.forEach(item => {
    item.line_gst = item.allocated_total * item.gst_pct;
    item.line_subtotal = item.allocated_total + item.line_gst;
  });

  // Floating point adjustment guardrail:
  // Ensure sum(item.allocated_total) is EXACTLY effectiveBundlePrice
  const sumAllocated = result.reduce((sum, item) => sum + item.allocated_total, 0);
  const diff = effectiveBundlePrice - sumAllocated;
  if (Math.abs(diff) > 0.000001 && count > 0) {
    // Find the item with the highest quantity or cost, add the rounding difference to it
    const targetItem = result.reduce((max, item) => item.allocated_total > max.allocated_total ? item : max, result[0]);
    targetItem.allocated_total += diff;
    targetItem.rate_per_unit = targetItem.qty > 0 ? targetItem.allocated_total / targetItem.qty : 0;
    targetItem.line_gst = targetItem.allocated_total * targetItem.gst_pct;
    targetItem.line_subtotal = targetItem.allocated_total + targetItem.line_gst;
  }

  return result;
}
