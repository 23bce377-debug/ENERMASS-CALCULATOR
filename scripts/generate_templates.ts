import fs from 'fs';
import path from 'path';
import { calculateSystem, type CalcInput } from '../src/lib/engine/calculator';

const CAPACITIES = [3, 5, 10, 20];

const buildTemplate = (capacityKw: number) => {
  const inputs: CalcInput = {
    systemId: 'dynamic_system',
    systems: [{
      id: 'dynamic_system',
      name: `${capacityKw}kW Dynamic System`,
      category: 'on-grid',
      capacityKW: capacityKw,
      panelWattage: 500,
      panelQty: (capacityKw * 1000) / 500,
      targetMarginPct: 0.15,
      items: []
    }],
    state: 'Kerala',
    stateData: {
      'Kerala': {
        state: 'Kerala',
        zone: 'south',
        solar_irradiance: 5.5,
        avg_temperature: 30,
        electricity_tariff_residential: 6,
        electricity_tariff_commercial: 8,
        gridTariffInr: 6,
        net_metering_available: true,
        subsidy_available: true
      } as any
    },
    projectType: 'residential',
    panelCapacityKW: capacityKw,
    inverterCapacityKW: capacityKw,
    totalInverterCapacityKW: capacityKw,
    
    // Engineering Engine Flags
    structureType: 'rcc_roof_elevated',

    // Prevent missing DB crashes
    dbStructures: [],
    dbStructureVendors: [],
    dbStructureMaterialRates: [],
    dbStructureTemplates: [],
    dbStructureTemplateItems: [],
    dbWalkwayTemplates: [],
    dbLadderTemplates: [],
    dbWeightLookups: [],
    dbMeters: [],
    dbLAs: [],
    dbStructureParts: [],
    dbStructureComponents: [],
    dbStructureBom: [],
    dbStructureAddons: [],
    dbOrientationMultipliers: {},
    dbPanels: [{ id: 'default_panel', capacity_watt: 500, price_per_watt: 20 }],
  };

  const result = calculateSystem(inputs);

  return {
    systemId: `${capacityKw}kwp_ongrid_dynamic`,
    systemName: `${capacityKw}kW On-Grid System`,
    systemType: 'ongrid',
    capacityKW: capacityKw,
    bomTemplate: 'dynamic_engine',
    classification: 'Dynamic Generation',
    sourceWorkbook: 'calculateSystem Engine',
    lineItems: result.lines.map((item, idx) => ({
      itemType: item.categoryId || 'accessory',
      category: item.categoryName || 'bom_item',
      description: item.description,
      quantity: item.effectiveQty,
      ratePerUnit: item.effectiveRate,
      totalPrice: item.lineSubTotal,
      gstPct: item.effectiveGstPct,
      formula: 'dynamic engine',
    }))
  };
};

const templates = CAPACITIES.map(buildTemplate);

const systemTemplatesPath = path.join(__dirname, '../knowledge/systems/system_templates.json');
const ongridSystemsPath = path.join(__dirname, '../knowledge/systems/ongrid_systems.json');

fs.writeFileSync(systemTemplatesPath, JSON.stringify(templates, null, 2));
fs.writeFileSync(ongridSystemsPath, JSON.stringify(templates, null, 2));

console.log('Successfully generated updated templates:');
console.log(`- ${systemTemplatesPath}`);
console.log(`- ${ongridSystemsPath}`);
