import { supabase } from '../../lib/supabase/client';
import type { Database } from '../../lib/types/schema.types';

// Types
export type EqPanelRow = Database['public']['Tables']['eq_panels']['Row'];
export type EqPanelInsert = Database['public']['Tables']['eq_panels']['Insert'];
export type EqPanelUpdate = Database['public']['Tables']['eq_panels']['Update'];

export type EqInverterRow = Database['public']['Tables']['eq_inverters']['Row'];
export type EqInverterInsert = Database['public']['Tables']['eq_inverters']['Insert'];
export type EqInverterUpdate = Database['public']['Tables']['eq_inverters']['Update'];

export type EqBatteryRow = Database['public']['Tables']['eq_batteries']['Row'];
export type EqBatteryInsert = Database['public']['Tables']['eq_batteries']['Insert'];
export type EqBatteryUpdate = Database['public']['Tables']['eq_batteries']['Update'];

export type EqMeterRow = Database['public']['Tables']['eq_meters']['Row'];
export type EqMeterInsert = Database['public']['Tables']['eq_meters']['Insert'];
export type EqMeterUpdate = Database['public']['Tables']['eq_meters']['Update'];

export type EqLightningArresterRow = Database['public']['Tables']['eq_lightning_arresters']['Row'];
export type EqLightningArresterInsert = Database['public']['Tables']['eq_lightning_arresters']['Insert'];
export type EqLightningArresterUpdate = Database['public']['Tables']['eq_lightning_arresters']['Update'];

export type EqMountingStructureRow = Database['public']['Tables']['eq_mounting_structures']['Row'];
export type EqMountingStructureInsert = Database['public']['Tables']['eq_mounting_structures']['Insert'];
export type EqMountingStructureUpdate = Database['public']['Tables']['eq_mounting_structures']['Update'];

export type StructureWeightLookupRow = Database['public']['Tables']['structure_weight_lookup']['Row'];
export type StructureWeightLookupInsert = Database['public']['Tables']['structure_weight_lookup']['Insert'];
export type StructureWeightLookupUpdate = Database['public']['Tables']['structure_weight_lookup']['Update'];

export type EqBomItemRow = Database['public']['Tables']['eq_bom_items']['Row'];
export type EqBomItemInsert = Database['public']['Tables']['eq_bom_items']['Insert'];
export type EqBomItemUpdate = Database['public']['Tables']['eq_bom_items']['Update'];

export type EqCommunicationDeviceRow = Database['public']['Tables']['eq_communication_devices']['Row'];
export type EqCommunicationDeviceInsert = Database['public']['Tables']['eq_communication_devices']['Insert'];
export type EqCommunicationDeviceUpdate = Database['public']['Tables']['eq_communication_devices']['Update'];

// ORMs
export const PanelORM = {
  async getAll(orgId?: string) {
    const query = supabase.from('eq_panels').select('*');
    if (orgId) {
      query.or(`org_id.eq.${orgId},org_id.is.null`);
    } else {
      query.is('org_id', null);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },
  async getById(id: string) {
    const { data, error } = await supabase.from('eq_panels').select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  },
  async create(item: EqPanelInsert) {
    const { data, error } = await supabase.from('eq_panels').insert(item).select().single();
    if (error) throw error;
    return data;
  },
  async update(id: string, updates: EqPanelUpdate) {
    const { data, error } = await supabase.from('eq_panels').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
  async delete(id: string) {
    const { error } = await supabase.from('eq_panels').delete().eq('id', id);
    if (error) throw error;
    return true;
  }
};

export const InverterORM = {
  async getAll(orgId?: string) {
    const query = supabase.from('eq_inverters').select('*');
    if (orgId) {
      query.or(`org_id.eq.${orgId},org_id.is.null`);
    } else {
      query.is('org_id', null);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },
  async getById(id: string) {
    const { data, error } = await supabase.from('eq_inverters').select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  },
  async create(item: EqInverterInsert) {
    const { data, error } = await supabase.from('eq_inverters').insert(item).select().single();
    if (error) throw error;
    return data;
  },
  async update(id: string, updates: EqInverterUpdate) {
    const { data, error } = await supabase.from('eq_inverters').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
  async delete(id: string) {
    const { error } = await supabase.from('eq_inverters').delete().eq('id', id);
    if (error) throw error;
    return true;
  }
};

export const BatteryORM = {
  async getAll(orgId?: string) {
    const query = supabase.from('eq_batteries').select('*');
    if (orgId) {
      query.or(`org_id.eq.${orgId},org_id.is.null`);
    } else {
      query.is('org_id', null);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },
  async getById(id: string) {
    const { data, error } = await supabase.from('eq_batteries').select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  },
  async create(item: EqBatteryInsert) {
    const { data, error } = await supabase.from('eq_batteries').insert(item).select().single();
    if (error) throw error;
    return data;
  },
  async update(id: string, updates: EqBatteryUpdate) {
    const { data, error } = await supabase.from('eq_batteries').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
  async delete(id: string) {
    const { error } = await supabase.from('eq_batteries').delete().eq('id', id);
    if (error) throw error;
    return true;
  }
};

export const MeterORM = {
  async getAll(orgId?: string) {
    const query = supabase.from('eq_meters').select('*');
    if (orgId) {
      query.or(`org_id.eq.${orgId},org_id.is.null`);
    } else {
      query.is('org_id', null);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },
  async getById(id: string) {
    const { data, error } = await supabase.from('eq_meters').select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  },
  async create(item: EqMeterInsert) {
    const { data, error } = await supabase.from('eq_meters').insert(item).select().single();
    if (error) throw error;
    return data;
  },
  async update(id: string, updates: EqMeterUpdate) {
    const { data, error } = await supabase.from('eq_meters').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
  async delete(id: string) {
    const { error } = await supabase.from('eq_meters').delete().eq('id', id);
    if (error) throw error;
    return true;
  }
};

export const LightningArresterORM = {
  async getAll(orgId?: string) {
    const query = supabase.from('eq_lightning_arresters').select('*');
    if (orgId) {
      query.or(`org_id.eq.${orgId},org_id.is.null`);
    } else {
      query.is('org_id', null);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },
  async getById(id: string) {
    const { data, error } = await supabase.from('eq_lightning_arresters').select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  },
  async create(item: EqLightningArresterInsert) {
    const { data, error } = await supabase.from('eq_lightning_arresters').insert(item).select().single();
    if (error) throw error;
    return data;
  },
  async update(id: string, updates: EqLightningArresterUpdate) {
    const { data, error } = await supabase.from('eq_lightning_arresters').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
  async delete(id: string) {
    const { error } = await supabase.from('eq_lightning_arresters').delete().eq('id', id);
    if (error) throw error;
    return true;
  }
};

export const MountingStructureORM = {
  async getAll(orgId?: string) {
    const query = supabase.from('eq_mounting_structures').select('*');
    if (orgId) {
      query.or(`org_id.eq.${orgId},org_id.is.null`);
    } else {
      query.is('org_id', null);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },
  async getById(id: string) {
    const { data, error } = await supabase.from('eq_mounting_structures').select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  },
  async create(item: EqMountingStructureInsert) {
    const { data, error } = await supabase.from('eq_mounting_structures').insert(item).select().single();
    if (error) throw error;
    return data;
  },
  async update(id: string, updates: EqMountingStructureUpdate) {
    const { data, error } = await supabase.from('eq_mounting_structures').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
  async delete(id: string) {
    const { error } = await supabase.from('eq_mounting_structures').delete().eq('id', id);
    if (error) throw error;
    return true;
  }
};

export const StructureWeightLookupORM = {
  async getByStructureId(structureId: string) {
    const { data, error } = await supabase.from('structure_weight_lookup').select('*').eq('structure_id', structureId);
    if (error) throw error;
    return data;
  },
  async create(item: StructureWeightLookupInsert) {
    const { data, error } = await supabase.from('structure_weight_lookup').insert(item).select().single();
    if (error) throw error;
    return data;
  },
  async delete(id: string) {
    const { error } = await supabase.from('structure_weight_lookup').delete().eq('id', id);
    if (error) throw error;
    return true;
  }
};

export const BomItemORM = {
  async getAll(orgId?: string) {
    const query = supabase.from('eq_bom_items').select('*');
    if (orgId) {
      query.or(`org_id.eq.${orgId},org_id.is.null`);
    } else {
      query.is('org_id', null);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },
  async getById(id: string) {
    const { data, error } = await supabase.from('eq_bom_items').select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  },
  async create(item: EqBomItemInsert) {
    const { data, error } = await supabase.from('eq_bom_items').insert(item).select().single();
    if (error) throw error;
    return data;
  },
  async update(id: string, updates: EqBomItemUpdate) {
    const { data, error } = await supabase.from('eq_bom_items').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
  async delete(id: string) {
    const { error } = await supabase.from('eq_bom_items').delete().eq('id', id);
    if (error) throw error;
    return true;
  }
};

export const CommunicationDeviceORM = {
  async getAll(orgId?: string) {
    const query = supabase.from('eq_communication_devices').select('*');
    if (orgId) {
      query.or(`org_id.eq.${orgId},org_id.is.null`);
    } else {
      query.is('org_id', null);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },
  async getById(id: string) {
    const { data, error } = await supabase.from('eq_communication_devices').select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  },
  async create(item: EqCommunicationDeviceInsert) {
    const { data, error } = await supabase.from('eq_communication_devices').insert(item).select().single();
    if (error) throw error;
    return data;
  },
  async update(id: string, updates: EqCommunicationDeviceUpdate) {
    const { data, error } = await supabase.from('eq_communication_devices').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
  async delete(id: string) {
    const { error } = await supabase.from('eq_communication_devices').delete().eq('id', id);
    if (error) throw error;
    return true;
  }
};
