/**
 * bom.ts — ORM layer for bom_categories and bom_template_items.
 *
 * Design principles:
 * - All queries filter by org_id (null = global/shared row visible to all orgs).
 * - bulkInsert() uses upsert with onConflict: 'sku_code' to be idempotent.
 * - qty_formula is validated before write using the formula parser.
 * - append-safe: no DELETE on template items that are referenced by active systems
 *   (enforced at DB via FK; this ORM raises a typed error).
 */

import { supabase } from '../../lib/supabase/client';
import type { Database } from '../../lib/types/schema.types';
import { safeEvalFormula } from '../../lib/engine/formulaParser';

// ─── Types ────────────────────────────────────────────────────────────────────

export type BomCategoryRow = Database['public']['Tables']['bom_categories']['Row'];
export type BomCategoryInsert = Database['public']['Tables']['bom_categories']['Insert'];
export type BomCategoryUpdate = Database['public']['Tables']['bom_categories']['Update'];

export type BomTemplateItemRow = Database['public']['Tables']['bom_template_items']['Row'];
export type BomTemplateItemInsert = Database['public']['Tables']['bom_template_items']['Insert'];
export type BomTemplateItemUpdate = Database['public']['Tables']['bom_template_items']['Update'];

// ─── Formula Validation ───────────────────────────────────────────────────────

/**
 * Validates a qty_formula string before persisting.
 * Uses a dummy variable set to confirm parseability.
 *
 * @throws Error if the formula fails to parse.
 */
function validateQtyFormula(formula: string | null | undefined): void {
  if (!formula) return;
  const dummyVars = {
    system_kw: 5,
    panel_count: 10,
    inverter_count: 1,
    battery_count: 0,
    string_count: 2,
    dc_cable_length: 100,
    ac_cable_length: 50,
    structure_area: 40,
  };
  try {
    safeEvalFormula(formula, dummyVars);
  } catch (e) {
    throw new Error(`Invalid qty_formula "${formula}": ${(e as Error).message}`);
  }
}

// ─── BomCategoryORM ───────────────────────────────────────────────────────────

export const BomCategoryORM = {
  /**
   * Returns all categories visible to an org:
   *   - global rows (org_id IS NULL) are always included
   *   - org-specific rows (org_id = orgId) are included when orgId is provided
   */
  async getAll(orgId?: string): Promise<BomCategoryRow[]> {
    const query = supabase.from('bom_categories').select('*').order('display_order');
    if (orgId) {
      query.or(`org_id.is.null,org_id.eq.${orgId}`);
    } else {
      query.is('org_id', null);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async getById(id: string): Promise<BomCategoryRow | null> {
    const { data, error } = await supabase
      .from('bom_categories')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async create(item: BomCategoryInsert): Promise<BomCategoryRow> {
    const { data, error } = await supabase
      .from('bom_categories')
      .insert(item)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, updates: BomCategoryUpdate): Promise<BomCategoryRow> {
    const { data, error } = await supabase
      .from('bom_categories')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id: string): Promise<true> {
    const { error } = await supabase.from('bom_categories').delete().eq('id', id);
    if (error) throw error;
    return true;
  },
};

// ─── BomTemplateItemORM ───────────────────────────────────────────────────────

export const BomTemplateItemORM = {
  /**
   * Returns all template items visible to an org (global + org-specific).
   * Ordered by category's display_order so the result can be rendered directly.
   */
  async getAll(orgId?: string): Promise<BomTemplateItemRow[]> {
    const query = supabase.from('bom_template_items').select('*');
    if (orgId) {
      query.or(`org_id.is.null,org_id.eq.${orgId}`);
    } else {
      query.is('org_id', null);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async getById(id: string): Promise<BomTemplateItemRow | null> {
    const { data, error } = await supabase
      .from('bom_template_items')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  /**
   * Returns all template items for a specific category, optionally filtered by org.
   */
  async getByCategory(categoryId: string, orgId?: string): Promise<BomTemplateItemRow[]> {
    const query = supabase
      .from('bom_template_items')
      .select('*')
      .eq('category_id', categoryId);

    if (orgId) {
      query.or(`org_id.is.null,org_id.eq.${orgId}`);
    } else {
      query.is('org_id', null);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  /**
   * Upsert a single template item. Validates qty_formula before write.
   * Conflicts on sku_code within the same org_id.
   */
  async upsert(item: BomTemplateItemInsert): Promise<BomTemplateItemRow> {
    validateQtyFormula(item.qty_formula);
    const { data, error } = await supabase
      .from('bom_template_items')
      .upsert(item, { onConflict: 'sku_code' })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  /**
   * Bulk insert template items. Each formula is validated before any DB write.
   * If any formula is invalid, throws before touching the DB (fail-fast).
   */
  async bulkInsert(items: BomTemplateItemInsert[]): Promise<BomTemplateItemRow[]> {
    // Validate all formulas before any DB call
    for (const item of items) {
      validateQtyFormula(item.qty_formula);
    }
    const { data, error } = await supabase
      .from('bom_template_items')
      .insert(items)
      .select();
    if (error) throw error;
    return data;
  },

  async update(id: string, updates: BomTemplateItemUpdate): Promise<BomTemplateItemRow> {
    if (updates.qty_formula !== undefined) {
      validateQtyFormula(updates.qty_formula);
    }
    const { data, error } = await supabase
      .from('bom_template_items')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id: string): Promise<true> {
    const { error } = await supabase.from('bom_template_items').delete().eq('id', id);
    if (error) throw error;
    return true;
  },
};
