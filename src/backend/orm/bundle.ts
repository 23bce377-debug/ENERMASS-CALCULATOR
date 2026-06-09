import { supabase } from '@/lib/supabase/client';
import type { BundlePreset, BundlePresetItem } from '@/lib/types/bundle';

export const BundlePresetORM = {
  async getAll(orgId: string): Promise<BundlePreset[]> {
    const { data, error } = await (supabase as any)
      .from('bundle_presets')
      .select('*, vendors(name)')
      .eq('org_id', orgId)
      .order('name', { ascending: true });
    if (error) throw error;
    return data as BundlePreset[];
  },

  async getById(id: string): Promise<BundlePreset> {
    const { data, error } = await (supabase as any)
      .from('bundle_presets')
      .select('*, bundle_preset_items(*), vendors(*)')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data as BundlePreset;
  },

  async create(preset: Partial<BundlePreset>, items: Partial<BundlePresetItem>[]): Promise<BundlePreset> {
    // 1. Insert Bundle Preset
    const { data: createdPreset, error: presetError } = await (supabase as any)
      .from('bundle_presets')
      .insert(preset)
      .select()
      .single();
    if (presetError) throw presetError;

    // 2. Insert items
    if (items && items.length > 0) {
      const itemsToInsert = items.map(item => ({
        ...item,
        bundle_preset_id: createdPreset.id
      }));

      const { error: itemsError } = await (supabase as any)
        .from('bundle_preset_items')
        .insert(itemsToInsert);
      if (itemsError) throw itemsError;
    }

    return createdPreset as BundlePreset;
  },

  async update(id: string, updates: Partial<BundlePreset>, items?: Partial<BundlePresetItem>[]): Promise<BundlePreset> {
    // 1. Update Preset
    const { data: updatedPreset, error: presetError } = await (supabase as any)
      .from('bundle_presets')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (presetError) throw presetError;

    // 2. Update Items if provided (replaces existing items)
    if (items !== undefined) {
      // Delete existing
      const { error: deleteError } = await (supabase as any)
        .from('bundle_preset_items')
        .delete()
        .eq('bundle_preset_id', id);
      if (deleteError) throw deleteError;

      // Insert new
      if (items.length > 0) {
        const itemsToInsert = items.map(item => ({
          ...item,
          bundle_preset_id: id
        }));
        const { error: itemsError } = await (supabase as any)
          .from('bundle_preset_items')
          .insert(itemsToInsert);
        if (itemsError) throw itemsError;
      }
    }

    return updatedPreset as BundlePreset;
  },

  async delete(id: string): Promise<boolean> {
    const { error } = await (supabase as any)
      .from('bundle_presets')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return true;
  }
};
