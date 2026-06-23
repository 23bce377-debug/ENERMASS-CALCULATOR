import 'server-only';
import { getEquipmentMaster, getStructuresMaster, getRulesMaster, getOrgContext } from '@/lib/cache/server-cache';
import CalculatorClient from './CalculatorClient'; // We'll extract page.tsx to this
import { requireLicensedPage } from '@/lib/auth/requireLicensedPage';

export default async function CalculatorContent() {
  const session = await requireLicensedPage({
    feature: 'calculator',
    roles: ['owner', 'admin', 'manager', 'staff']
  });

  const orgId = session.orgId;

  // Fetch critical data chunk in parallel (blocking)
  const [equipment, rules] = await Promise.all([
    getEquipmentMaster(orgId),
    getRulesMaster(orgId)
  ]);

  // Start fetching deferred heavy structure and org contexts (non-blocking, progressively resolved on client)
  const deferredStructures = getStructuresMaster(orgId);
  const deferredOrgContext = getOrgContext(orgId);

  return (
    <CalculatorClient
      initialEquipment={equipment}
      initialRules={rules}
      deferredStructures={deferredStructures}
      deferredOrgContext={deferredOrgContext}
    />
  );
}
