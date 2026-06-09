import { useState, useEffect } from 'react';
import { OrganisationORM, type OrganisationRow, type OrganisationInsert, type OrganisationUpdate } from '../../backend/orm/organisation';

export function useOrganisation(orgId?: string) {
  const [organisation, setOrganisation] = useState<OrganisationRow | null>(null);
  const [organisations, setOrganisations] = useState<OrganisationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchOrganisation = async (id: string) => {
    try {
      const data = await OrganisationORM.getById(id);
      setOrganisation(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
    }
  };

  const fetchAll = async () => {
    try {
      const data = await OrganisationORM.getAll();
      setOrganisations(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      if (orgId) {
        await fetchOrganisation(orgId);
      } else {
        await fetchAll();
      }
      setLoading(false);
    };
    load();
  }, [orgId]);

  const createOrganisation = async (org: OrganisationInsert) => {
    try {
      const data = await OrganisationORM.create(org);
      setOrganisations((prev) => [...prev, data]);
      return data;
    } catch (err) {
      throw err;
    }
  };

  const updateOrganisation = async (id: string, updates: OrganisationUpdate) => {
    try {
      const data = await OrganisationORM.update(id, updates);
      if (organisation?.id === id) {
        setOrganisation(data);
      }
      setOrganisations((prev) => prev.map((o) => (o.id === id ? data : o)));
      return data;
    } catch (err) {
      throw err;
    }
  };

  const deleteOrganisation = async (id: string) => {
    try {
      await OrganisationORM.delete(id);
      if (organisation?.id === id) {
        setOrganisation(null);
      }
      setOrganisations((prev) => prev.filter((o) => o.id !== id));
      return true;
    } catch (err) {
      throw err;
    }
  };

  return {
    organisation,
    organisations,
    loading,
    error,
    refresh: orgId ? () => fetchOrganisation(orgId) : fetchAll,
    createOrganisation,
    updateOrganisation,
    deleteOrganisation
  };
}
