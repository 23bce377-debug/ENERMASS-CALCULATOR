import { getOrmClient } from './client';
import type { Database } from '../../lib/types/schema.types';

export type OrganisationRow = Database['public']['Tables']['organisations']['Row'];
export type OrganisationInsert = Database['public']['Tables']['organisations']['Insert'];
export type OrganisationUpdate = Database['public']['Tables']['organisations']['Update'];

export const OrganisationORM = {
  async getById(id: string, client?: any) {
    const db = getOrmClient(client);
    const { data, error } = await db
      .from('organisations')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async getAll(client?: any) {
    const db = getOrmClient(client);
    const { data, error } = await db
      .from('organisations')
      .select('*');
    if (error) throw error;
    return data;
  },

  async create(org: OrganisationInsert, client?: any) {
    const db = getOrmClient(client);
    const { data, error } = await db
      .from('organisations')
      .insert(org)
      .select()
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async update(id: string, updates: OrganisationUpdate, client?: any) {
    const db = getOrmClient(client);
    const { data, error } = await db
      .from('organisations')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async delete(id: string, client?: any) {
    const db = getOrmClient(client);
    const { error } = await db
      .from('organisations')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return true;
  }
};
