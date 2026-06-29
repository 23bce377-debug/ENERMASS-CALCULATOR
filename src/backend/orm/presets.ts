import { supabase } from '../../lib/supabase/client';

export interface PresetRow {
  id: string;
  name: string;
  capacity_kw: number;
  type: string;
  status: string;
  author_id: string | null;
  is_org_template: boolean;
  source: 'systems' | 'custom_presets';
  calculator_state: any;
  state_id?: string | null;
  state_name?: string | null;
  state_code?: string | null;
  created_at: string;
  updated_at: string;
}

export type PresetInsert = any;
export type PresetUpdate = any;

export interface PresetTagRow {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface PresetFavoriteRow {
  preset_id: string;
  user_id: string;
  created_at: string;
}

export const PresetORM: any = {
  async getAll(options: { tags?: string[]; authorId?: string; isOrgTemplate?: boolean; isFavoriteFor?: string; status?: string[] } = {}) {
    const { data: { session } } = await supabase.auth.getSession();
    let orgId = null;
    let userId = session?.user?.id ?? null;
    if (userId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('id', userId)
        .maybeSingle();
      orgId = profile?.org_id;
    }

    const results: any[] = [];
    const { data: stateRows } = await supabase
      .from('state_rules')
      .select('id, state_name, state_code')
      .eq('is_active', true);
    const stateById = new Map((stateRows || []).map((state: any) => [state.id, state]));

    // 1. Fetch built-in systems if applicable
    if (!options.authorId && !options.isFavoriteFor) {
      let sysQuery = supabase.from('systems').select('*').eq('is_active', true).order('capacity_kw', { ascending: true });
      if (orgId) {
        sysQuery = sysQuery.or(`org_id.eq.${orgId},org_id.is.null`);
      } else {
        sysQuery = sysQuery.is('org_id', null);
      }

      const { data: sysData, error: sysError } = await sysQuery;
      if (!sysError && sysData) {
        sysData.forEach((row: any) => {
          const state = row.state_id ? stateById.get(row.state_id) : null;
          results.push({
            id: row.id,
            name: row.name,
            capacity_kw: Number(row.capacity_kw),
            type: row.category ? row.category.replace('_', '-') : 'on-grid',
            status: 'published',
            author_id: null,
            is_org_template: !row.org_id,
            source: 'systems',
            calculator_state: null,
            state_id: row.state_id ?? null,
            state_name: state?.state_name ?? null,
            state_code: state?.state_code ?? null,
            created_at: row.created_at,
            updated_at: row.updated_at
          });
        });
      }
    }

    // 2. Fetch custom presets
    let presetQuery = supabase.from('custom_presets').select('*').eq('is_active', true).order('capacity_kw', { ascending: true });
    if (orgId) {
      presetQuery = presetQuery.eq('org_id', orgId);
    }
    if (options.authorId) {
      presetQuery = presetQuery.eq('user_id', options.authorId);
    }

    const { data: presetData, error: presetError } = await presetQuery;
    if (!presetError && presetData) {
      presetData.forEach((row: any) => {
        results.push({
          id: row.id,
          name: row.name,
          capacity_kw: Number(row.capacity_kw),
          type: row.config_json?.projectType || 'residential',
          status: 'published',
          author_id: row.user_id,
          is_org_template: false,
          source: 'custom_presets',
          calculator_state: row.config_json,
          state_id: row.config_json?.stateId ?? null,
          state_name: row.config_json?.selectedState ?? null,
          state_code: null,
          created_at: row.created_at,
          updated_at: row.updated_at
        });
      });
    }

    let filtered = results;

    // 3. Filter by favorites in localStorage
    if (options.isFavoriteFor) {
      let favs: string[] = [];
      try {
        const raw = localStorage.getItem(`preset_favs_${options.isFavoriteFor}`);
        if (raw) favs = JSON.parse(raw);
      } catch (e) {}
      filtered = filtered.filter(p => favs.includes(p.id));
    }

    // Populate preset_favorites based on localStorage
    let favsList: string[] = [];
    if (userId) {
      try {
        const raw = localStorage.getItem(`preset_favs_${userId}`);
        if (raw) favsList = JSON.parse(raw);
      } catch (e) {}
    }

    filtered.forEach(p => {
      p.preset_favorites = favsList.includes(p.id) ? [{ user_id: userId }] : [];
    });

    return filtered;
  },

  async getById(id: string) {
    const { data, error } = await supabase
      .from('custom_presets')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) {
      // Check systems table as fallback
      const { data: sysData, error: sysError } = await supabase
        .from('systems')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (sysError) throw sysError;
      return {
        id: sysData.id,
        name: sysData.name,
        capacity_kw: Number(sysData.capacity_kw),
        type: sysData.category ? sysData.category.replace('_', '-') : 'on-grid',
        status: 'published',
        author_id: null,
        is_org_template: !sysData.org_id,
        source: 'systems',
        calculator_state: null,
        state_id: (sysData as any).state_id ?? null,
        state_name: null,
        state_code: null,
        created_at: sysData.created_at,
        updated_at: sysData.updated_at
      };
    }
    return {
      id: data.id,
      name: data.name,
      capacity_kw: data.capacity_kw,
      type: data.config_json?.projectType || 'residential',
      status: 'published',
      author_id: data.user_id,
      is_org_template: false,
      source: 'custom_presets',
      calculator_state: data.config_json,
      state_id: data.config_json?.stateId ?? null,
      state_name: data.config_json?.selectedState ?? null,
      state_code: null,
      created_at: data.created_at,
      updated_at: data.updated_at
    };
  },

  async create(preset: any, tagIds: string[]) {
    const { data: { session } } = await supabase.auth.getSession();
    let orgId = null;
    if (session?.user?.id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('id', session.user.id)
        .maybeSingle();
      orgId = profile?.org_id;
    }

    const { data, error } = await supabase
      .from('custom_presets')
      .insert({
        org_id: orgId,
        user_id: session?.user?.id ?? null,
        name: preset.name,
        capacity_kw: Number(preset.capacity_kw) || 0,
        config_json: preset.calculator_state,
        is_active: true
      })
      .select()
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async update(id: string, updates: any) {
    const { data, error } = await supabase
      .from('custom_presets')
      .update({
        name: updates.name,
        capacity_kw: Number(updates.capacity_kw),
        config_json: updates.calculator_state,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('custom_presets')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return true;
  },

  async getTags() {
    return [];
  },

  async toggleFavorite(presetId: string, userId: string, isFavorite: boolean) {
    try {
      const key = `preset_favs_${userId}`;
      let favs: string[] = [];
      const raw = localStorage.getItem(key);
      if (raw) favs = JSON.parse(raw);
      
      if (isFavorite) {
        if (!favs.includes(presetId)) favs.push(presetId);
      } else {
        favs = favs.filter(id => id !== presetId);
      }
      localStorage.setItem(key, JSON.stringify(favs));
    } catch (e) {
      console.error(e);
    }
  },

  async trackUsage(presetId: string, userId: string) {
    try {
      const key = `preset_recent_${userId}`;
      let recent: string[] = [];
      const raw = localStorage.getItem(key);
      if (raw) recent = JSON.parse(raw);

      recent = [presetId, ...recent.filter(id => id !== presetId)].slice(0, 10);
      localStorage.setItem(key, JSON.stringify(recent));
    } catch (e) {
      console.error(e);
    }
  },
  
  async getRecent(userId: string) {
    try {
      const key = `preset_recent_${userId}`;
      const raw = localStorage.getItem(key);
      if (!raw) return [];
      const recentIds: string[] = JSON.parse(raw);
      
      const allPresets = await this.getAll();
      const mapped = recentIds
        .map(id => allPresets.find((p: any) => p.id === id))
        .filter((p): p is any => !!p);
      return mapped;
    } catch (e) {
      return [];
    }
  }
};
