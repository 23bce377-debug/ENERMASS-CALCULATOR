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
    const { data, error } = await (supabase as any).rpc('create_bundle_preset_atomic', {
      p_preset: preset,
      p_items: items
    });
    if (error) throw error;
    return data as BundlePreset;
  },

  async update(id: string, updates: Partial<BundlePreset>, items?: Partial<BundlePresetItem>[]): Promise<BundlePreset> {
    const { data, error } = await (supabase as any).rpc('update_bundle_preset_atomic', {
      p_preset_id: id,
      p_updates: updates,
      p_items: items || null
    });
    if (error) throw error;
    return data as BundlePreset;
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
