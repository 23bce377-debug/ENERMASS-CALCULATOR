import { getOrmClient } from './client';
import type { Database } from '../../lib/types/schema.types';

export type ProfileRow = Database['public']['Tables']['profiles']['Row'];
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert'];
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

export const ProfileORM = {
  async getById(id: string, client?: any) {
    if (typeof window !== 'undefined') {
      const res = await fetch(`/api/profile?id=${encodeURIComponent(id)}`, { credentials: 'include' });
      if (!res.ok) {
        throw new Error(`Failed to fetch user profile: ${res.status}`);
      }
      return await res.json();
    }

    const db = getOrmClient(client);
    const { data, error } = await db
      .from('profiles')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async getByOrgId(orgId: string, client?: any) {
    const db = getOrmClient(client);
    const { data, error } = await db
      .from('profiles')
      .select('*')
      .eq('org_id', orgId);
    if (error) throw error;
    return data;
  },

  async create(profile: ProfileInsert, client?: any) {
    const db = getOrmClient(client);
    const { data, error } = await db
      .from('profiles')
      .insert(profile)
      .select()
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async update(id: string, updates: ProfileUpdate, client?: any) {
    if (typeof window !== 'undefined') {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error(`Failed to update user profile: ${res.status}`);
      }
      return await res.json();
    }

    const db = getOrmClient(client);
    const { data, error } = await db
      .from('profiles')
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
      .from('profiles')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return true;
  }
};
