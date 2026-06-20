/**
 * inventory.ts — Append-only inventory movement ledger ORM.
 *
 * Design principles:
 * - INSERT only. UPDATE and DELETE operations are intentionally absent.
 *   The DB trigger trg_inventory_immutable enforces this at the database level;
 *   this ORM enforces it at the TypeScript level.
 * - All reads are tenant-scoped by org_id.
 * - aggregatePosition() replicates the inventory_positions view logic in TypeScript
 *   for cases where the view is not accessible (e.g., RPC contexts).
 * - Negative stock is not blocked here — business logic in the calling layer
 *   must pre-check stock availability before allocating.
 */

import { supabase } from '../../lib/supabase/client';
import type { Database } from '../../lib/types/schema.types';

// ─── Types ────────────────────────────────────────────────────────────────────

export type InventoryMovementRow = Database['public']['Tables']['inventory_movements']['Row'];
export type InventoryMovementInsert = Database['public']['Tables']['inventory_movements']['Insert'];
// NOTE: Update is typed as `never` on the database type — intentional. No update type exported.

export interface AggregatedPosition {
  item_id: string;
  org_id: string;
  /** Net quantity on hand (sum of quantity across all movements for this item+org) */
  quantity_on_hand: number;
  /** Count of movements for this item */
  movement_count: number;
  /** Most recent movement timestamp */
  last_movement_at: string | null;
}

export interface MovementFilter {
  orgId: string;
  itemId?: string;
  projectId?: string;
  /** ISO date string — only return movements on or after this date */
  fromDate?: string;
  /** ISO date string — only return movements on or before this date */
  toDate?: string;
  limit?: number;
  offset?: number;
}

// ─── InventoryMovementORM ─────────────────────────────────────────────────────

export const InventoryMovementORM = {
  /**
   * Append a new movement to the immutable ledger.
   * This is the ONLY way to record inventory changes.
   *
   * @throws Supabase error if the DB trigger blocks the write.
   */
  async insert(record: InventoryMovementInsert): Promise<InventoryMovementRow> {
    const { data, error } = await supabase
      .from('inventory_movements')
      .insert(record)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  /**
   * Bulk append multiple movements atomically (single insert call).
   * All rows must belong to the same org_id.
   *
   * @throws Error if org_ids are inconsistent across rows.
   * @throws Supabase error if any row is rejected by DB constraints.
   */
  async bulkInsert(records: InventoryMovementInsert[]): Promise<InventoryMovementRow[]> {
    if (records.length === 0) return [];

    const firstOrgId = records[0].org_id;
    const allSameOrg = records.every((r) => r.org_id === firstOrgId);
    if (!allSameOrg) {
      throw new Error(
        'InventoryMovementORM.bulkInsert: all records must belong to the same org_id'
      );
    }

    const { data, error } = await supabase
      .from('inventory_movements')
      .insert(records)
      .select();
    if (error) throw error;
    return data;
  },

  /**
   * Fetch movements with tenant-scoped filtering.
   */
  async query(filter: MovementFilter): Promise<InventoryMovementRow[]> {
    let q = supabase
      .from('inventory_movements')
      .select('*')
      .eq('org_id', filter.orgId)
      .order('moved_at', { ascending: false });

    if (filter.itemId) q = q.eq('item_id', filter.itemId);
    if (filter.projectId) q = q.eq('project_id', filter.projectId);
    if (filter.fromDate) q = q.gte('moved_at', filter.fromDate);
    if (filter.toDate) q = q.lte('moved_at', filter.toDate);
    if (filter.limit) q = q.limit(filter.limit);
    if (filter.offset) q = q.range(filter.offset, filter.offset + (filter.limit ?? 50) - 1);

    const { data, error } = await q;
    if (error) throw error;
    return data;
  },

  /**
   * Fetch all movements for a specific item within an org.
   */
  async getByItem(
    orgId: string,
    itemId: string,
    limit = 100
  ): Promise<InventoryMovementRow[]> {
    const { data, error } = await supabase
      .from('inventory_movements')
      .select('*')
      .eq('org_id', orgId)
      .eq('item_id', itemId)
      .order('moved_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data;
  },

  /**
   * Fetch all movements for a specific project within an org.
   */
  async getByProject(
    orgId: string,
    projectId: string
  ): Promise<InventoryMovementRow[]> {
    const { data, error } = await supabase
      .from('inventory_movements')
      .select('*')
      .eq('org_id', orgId)
      .eq('project_id', projectId)
      .order('moved_at', { ascending: true });
    if (error) throw error;
    return data;
  },

  /**
   * Aggregate the position for a single item within an org.
   * Uses the DB's inventory_positions view if available, falls back
   * to a JavaScript SUM over all movements.
   *
   * NOTE: The DB view (inventory_positions) is the authoritative source.
   * This method is the JavaScript fallback used when the view is not
   * accessible (e.g., in unit test environments).
   */
  async aggregatePosition(
    orgId: string,
    itemId: string
  ): Promise<AggregatedPosition> {
    const movements = await InventoryMovementORM.getByItem(orgId, itemId, 10000);

    const quantity_on_hand = movements.reduce((sum, m) => {
      // IN movements have positive quantity, OUT movements have negative quantity
      return sum + m.quantity;
    }, 0);

    const last_movement_at =
      movements.length > 0 ? movements[0].moved_at : null;

    return {
      item_id: itemId,
      org_id: orgId,
      quantity_on_hand,
      movement_count: movements.length,
      last_movement_at,
    };
  },

  /**
   * Check if there is sufficient stock for an outbound movement.
   * Returns { sufficient: true } or { sufficient: false, available: number }.
   */
  async checkStock(
    orgId: string,
    itemId: string,
    requiredQty: number
  ): Promise<{ sufficient: boolean; available: number }> {
    const position = await InventoryMovementORM.aggregatePosition(orgId, itemId);
    const available = position.quantity_on_hand;
    return {
      sufficient: available >= requiredQty,
      available,
    };
  },
};
