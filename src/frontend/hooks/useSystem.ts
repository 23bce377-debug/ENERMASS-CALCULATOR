import { useState, useEffect } from 'react';
import {
  SystemORM,
  SystemItemORM,
  type SystemRow,
  type SystemInsert,
  type SystemUpdate,
  type SystemItemRow,
  type SystemItemInsert,
  type SystemItemUpdate
} from '../../backend/orm/system';

export function useSystems(orgId?: string) {
  const [systems, setSystems] = useState<SystemRow[]>([]);
  const [activeSystem, setActiveSystem] = useState<(SystemRow & { system_items: SystemItemRow[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSystems = async () => {
    try {
      const data = await SystemORM.getAll(orgId);
      setSystems(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
    }
  };

  const fetchSystemDetail = async (systemId: string) => {
    setLoading(true);
    try {
      const data = await SystemORM.getById(systemId);
      setActiveSystem(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await fetchSystems();
      setLoading(false);
    };
    load();
  }, [orgId]);

  const createSystem = async (system: SystemInsert) => {
    try {
      const data = await SystemORM.create(system);
      setSystems((prev) => [...prev, data]);
      return data;
    } catch (err) {
      throw err;
    }
  };

  const updateSystem = async (id: string, updates: SystemUpdate) => {
    try {
      const data = await SystemORM.update(id, updates);
      setSystems((prev) => prev.map((s) => (s.id === id ? data : s)));
      if (activeSystem?.id === id) {
        setActiveSystem((prev) => prev ? { ...prev, ...data } : null);
      }
      return data;
    } catch (err) {
      throw err;
    }
  };

  const deleteSystem = async (id: string) => {
    try {
      await SystemORM.delete(id);
      setSystems((prev) => prev.filter((s) => s.id !== id));
      if (activeSystem?.id === id) {
        setActiveSystem(null);
      }
      return true;
    } catch (err) {
      throw err;
    }
  };

  return {
    systems,
    activeSystem,
    loading,
    error,
    refresh: fetchSystems,
    fetchSystemDetail,
    createSystem,
    updateSystem,
    deleteSystem
  };
}
