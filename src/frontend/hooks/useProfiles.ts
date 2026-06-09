import { useState, useEffect } from 'react';
import { ProfileORM, type ProfileRow, type ProfileInsert, type ProfileUpdate } from '../../backend/orm/profile';

export function useProfiles(orgId?: string) {
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [currentProfile, setCurrentProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchProfilesByOrg = async (id: string) => {
    try {
      const data = await ProfileORM.getByOrgId(id);
      setProfiles(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
    }
  };

  const fetchProfileById = async (id: string) => {
    try {
      const data = await ProfileORM.getById(id);
      setCurrentProfile(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      if (orgId) {
        await fetchProfilesByOrg(orgId);
      }
      setLoading(false);
    };
    load();
  }, [orgId]);

  const createProfile = async (profile: ProfileInsert) => {
    try {
      const data = await ProfileORM.create(profile);
      setProfiles((prev) => [...prev, data]);
      return data;
    } catch (err) {
      throw err;
    }
  };

  const updateProfile = async (id: string, updates: ProfileUpdate) => {
    try {
      const data = await ProfileORM.update(id, updates);
      if (currentProfile?.id === id) {
        setCurrentProfile(data);
      }
      setProfiles((prev) => prev.map((p) => (p.id === id ? data : p)));
      return data;
    } catch (err) {
      throw err;
    }
  };

  const deleteProfile = async (id: string) => {
    try {
      await ProfileORM.delete(id);
      if (currentProfile?.id === id) {
        setCurrentProfile(null);
      }
      setProfiles((prev) => prev.filter((p) => p.id !== id));
      return true;
    } catch (err) {
      throw err;
    }
  };

  return {
    profiles,
    currentProfile,
    loading,
    error,
    fetchProfileById,
    refresh: orgId ? () => fetchProfilesByOrg(orgId) : async () => {},
    createProfile,
    updateProfile,
    deleteProfile
  };
}
