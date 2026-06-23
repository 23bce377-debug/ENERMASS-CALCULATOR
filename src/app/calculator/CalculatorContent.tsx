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

  // Fetch all chunks in parallel using Server Cache
  const [equipment, structures, rules, orgContext] = await Promise.all([
    getEquipmentMaster(orgId),
    getStructuresMaster(orgId),
    getRulesMaster(orgId),
    getOrgContext(orgId)
  ]);

  // Reassemble the bootstrap object shape expected by calculationStore
  const initialData = {
    panels: equipment.panels,
    inverters: equipment.inverters,
    batteries: equipment.batteries,
    meters: equipment.meters,
    lightningArresters: equipment.lightningArresters,
    commDevices: equipment.commDevices,
    structures: structures.structures,
    bomItems: rules.bomItems,
    systems: rules.systems,
    weightLookups: structures.weightLookups,
    stateRules: rules.stateRules,
    slabs: rules.slabs,
    schemes: rules.schemes,
    inventorySummary: orgContext.inventorySummary,
    vendors: orgContext.vendors,
    structureComponents: structures.structureComponents,
    structureBom: structures.structureBom,
    structureAddons: structures.structureAddons,
    appSettings: orgContext.appSettings,
    structureVendors: orgContext.structureVendors,
    structureAccessoryRates: structures.structureAccessoryRates,
    structureMaterialRates: structures.structureMaterialRates,
    structureTemplates: structures.structureTemplates,
    structureTemplateItems: structures.structureTemplateItems,
    walkwayTemplates: structures.walkwayTemplates,
    ladderTemplates: structures.ladderTemplates,
    structureComponentMasters: structures.structureComponentMasters,
    taxHsnCodes: rules.taxHsnCodes,
    taxGstRates: rules.taxGstRates
  };

  return <CalculatorClient initialData={initialData} />;
}
