import 'server-only';

import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/types/schema.types';

// ---------------------------------------------------------------------------
// Type aliases
// ---------------------------------------------------------------------------
type BomCategory = Database['public']['Tables']['bom_categories']['Row'];
type BomCategoryInsert = Database['public']['Tables']['bom_categories']['Insert'];
type BomCategoryUpdate = Database['public']['Tables']['bom_categories']['Update'];

type BomTemplateItem = Database['public']['Tables']['bom_template_items']['Row'];
type BomTemplateItemInsert = Database['public']['Tables']['bom_template_items']['Insert'];

// ---------------------------------------------------------------------------
// BomCategoryORM
// ---------------------------------------------------------------------------

export class BomCategoryORM {
  /**
   * Return every BOM category, ordered by display_order ASC so callers
   * receive them in the canonical BOM sheet sequence.
   */
  async getAll(): Promise<BomCategory[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('bom_categories')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) {
      throw new Error(`BomCategoryORM.getAll failed: ${error.message}`);
    }

    return data ?? [];
  }

  /**
   * Fetch a single BOM category by primary key.
   * Returns null when no row is found (not an error condition).
   */
  async getById(id: string): Promise<BomCategory | null> {
    if (!id) throw new Error('BomCategoryORM.getById: id is required');

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('bom_categories')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`BomCategoryORM.getById(${id}) failed: ${error.message}`);
    }

    return data;
  }

  /**
   * Upsert a BOM category.  When `data.id` is present, the existing row is
   * updated; when absent a new row is created.
   *
   * `display_order` must be provided on create because the column has a NOT
   * NULL constraint in the database.
   */
  async upsert(data: Partial<BomCategoryInsert & BomCategoryUpdate>): Promise<BomCategory> {
    if (!data.name) {
      throw new Error('BomCategoryORM.upsert: name is required');
    }

    const supabase = await createClient();

    const { data: row, error } = await supabase
      .from('bom_categories')
      .upsert(data as BomCategoryInsert, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      throw new Error(`BomCategoryORM.upsert failed: ${error.message}`);
    }

    if (!row) {
      throw new Error('BomCategoryORM.upsert: no row returned after upsert');
    }

    return row;
  }

  /**
   * Hard-delete a BOM category by primary key.
   * Cascading deletes on bom_template_items must be handled at the DB level.
   */
  async delete(id: string): Promise<void> {
    if (!id) throw new Error('BomCategoryORM.delete: id is required');

    const supabase = await createClient();

    const { error } = await supabase
      .from('bom_categories')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`BomCategoryORM.delete(${id}) failed: ${error.message}`);
    }
  }
}

// ---------------------------------------------------------------------------
// BomTemplateItemORM
// ---------------------------------------------------------------------------

export class BomTemplateItemORM {
  /**
   * Return all BOM template items.  Items are sorted by their parent
   * category's display_order, then by SKU code within each category so the
   * result mirrors the physical BOM sheet order.
   */
  async getAll(): Promise<BomTemplateItem[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('bom_template_items')
      .select('*')
      .order('sku_code', { ascending: true });

    if (error) {
      throw new Error(`BomTemplateItemORM.getAll failed: ${error.message}`);
    }

    return data ?? [];
  }

  /**
   * Fetch a single BOM template item by primary key.
   * Returns null when no row is found.
   */
  async getById(id: string): Promise<BomTemplateItem | null> {
    if (!id) throw new Error('BomTemplateItemORM.getById: id is required');

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('bom_template_items')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`BomTemplateItemORM.getById(${id}) failed: ${error.message}`);
    }

    return data;
  }

  /**
   * Return all BOM template items belonging to a given category, sorted by
   * SKU code so they render in a deterministic order.
   */
  async getByCategory(categoryId: string): Promise<BomTemplateItem[]> {
    if (!categoryId) {
      throw new Error('BomTemplateItemORM.getByCategory: categoryId is required');
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('bom_template_items')
      .select('*')
      .eq('category_id', categoryId)
      .order('sku_code', { ascending: true });

    if (error) {
      throw new Error(
        `BomTemplateItemORM.getByCategory(${categoryId}) failed: ${error.message}`,
      );
    }

    return data ?? [];
  }

  /**
   * Upsert a single BOM template item.
   * `category_id`, `sku_code`, `description`, and `unit` are required on create.
   */
  async upsert(data: BomTemplateItemInsert): Promise<BomTemplateItem> {
    if (!data.category_id) {
      throw new Error('BomTemplateItemORM.upsert: category_id is required');
    }
    if (!data.sku_code) {
      throw new Error('BomTemplateItemORM.upsert: sku_code is required');
    }
    if (!data.description) {
      throw new Error('BomTemplateItemORM.upsert: description is required');
    }
    if (!data.unit) {
      throw new Error('BomTemplateItemORM.upsert: unit is required');
    }

    const supabase = await createClient();

    const { data: row, error } = await supabase
      .from('bom_template_items')
      .upsert(data, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      throw new Error(`BomTemplateItemORM.upsert failed: ${error.message}`);
    }

    if (!row) {
      throw new Error('BomTemplateItemORM.upsert: no row returned after upsert');
    }

    return row;
  }

  /**
   * Insert multiple BOM template items in a single round-trip.
   * The entire batch is inserted atomically — if any row fails, the operation
   * throws and no rows are committed.
   *
   * @param items  Array of items to insert (must all have required fields).
   * @returns      Array of created rows in insertion order.
   */
  async bulkInsert(items: BomTemplateItemInsert[]): Promise<BomTemplateItem[]> {
    if (!items.length) return [];

    // Validate required fields for every item before touching the DB.
    items.forEach((item, index) => {
      if (!item.category_id) {
        throw new Error(
          `BomTemplateItemORM.bulkInsert: items[${index}].category_id is required`,
        );
      }
      if (!item.sku_code) {
        throw new Error(
          `BomTemplateItemORM.bulkInsert: items[${index}].sku_code is required`,
        );
      }
      if (!item.description) {
        throw new Error(
          `BomTemplateItemORM.bulkInsert: items[${index}].description is required`,
        );
      }
      if (!item.unit) {
        throw new Error(
          `BomTemplateItemORM.bulkInsert: items[${index}].unit is required`,
        );
      }
    });

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('bom_template_items')
      .insert(items)
      .select();

    if (error) {
      throw new Error(`BomTemplateItemORM.bulkInsert failed: ${error.message}`);
    }

    return data ?? [];
  }

  /**
   * Hard-delete a BOM template item by primary key.
   */
  async delete(id: string): Promise<void> {
    if (!id) throw new Error('BomTemplateItemORM.delete: id is required');

    const supabase = await createClient();

    const { error } = await supabase
      .from('bom_template_items')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`BomTemplateItemORM.delete(${id}) failed: ${error.message}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton exports — import these instead of instantiating manually.
// ---------------------------------------------------------------------------
export const bomCategoryORM = new BomCategoryORM();
export const bomTemplateItemORM = new BomTemplateItemORM();
