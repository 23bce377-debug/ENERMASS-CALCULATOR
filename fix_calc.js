const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src', 'lib', 'engine', 'calculator.ts');
let content = fs.readFileSync(file, 'utf8');

// The marker we want to replace from
const startMarker = `  // 🚀 Step 3.5: Inject Engineering BOS Components (Electrical, Structure, Civil)`;
const endMarker = `  // "?"? Step 4: Apply Overrides, Rate Master, and Calculate Totals "?"?`;
const endMarker2 = `  // ── Step 4: Apply Overrides, Rate Master, and Calculate Totals ──`;

const startIndex = content.indexOf(startMarker);
let endIndex = content.indexOf(endMarker);
if (endIndex === -1) endIndex = content.indexOf(endMarker2);

if (startIndex !== -1 && endIndex !== -1) {
  const replacement = `  // 🚀 Step 3.5: Inject Engineering BOS Components (Electrical, Structure, Civil)
  const systemKw = input.panelCapacityKW ?? system.capacityKW ?? 0;
  const panelCount = equipmentOverrides.panelQtyOverride ?? system.panelQty ?? 0;
  
  // Phase and Inverter approximations based on current state parameters
  const inverterCount = resolvedItems.filter(i => i.description.toUpperCase().includes('INVERTER')).reduce((acc, curr) => acc + curr.qty, 0) || 1;
  const phase = systemKw > 5 ? 3 : 1; 

  const electricalBOM = generateElectricalBOM({
    systemKw,
    panelCount,
    inverterCount,
    phase
  });

  const structureBOM = generateStructureBOM({
    systemKw,
    structureType: input.structureType as any
  });

  const civilEarthingBOM = generateCivilEarthingBOM({
    systemKw,
    structureType: input.structureType as any
  });

  // Additional base overheads that must exist
  const logisticsBOM: BomItem[] = [
    { description: 'TRANSPORTATION', unit: 'Lot', qty: 1, ratePerUnit: 0, gstPct: TAX_CONSTANTS.BOS_GST_RATE as any },
    { description: 'COMMISSION', unit: 'Lot', qty: 1, ratePerUnit: 0, gstPct: TAX_CONSTANTS.BOS_GST_RATE as any },
    { description: 'SITE VISIT', unit: 'Lot', qty: 1, ratePerUnit: 0, gstPct: TAX_CONSTANTS.BOS_GST_RATE as any },
    { description: 'INSTALLATION', unit: 'Lot', qty: systemKw, ratePerUnit: 3000, gstPct: TAX_CONSTANTS.INSTALLATION_SERVICE_GST as any }
  ];

  const engineeredItems = [...electricalBOM, ...structureBOM, ...civilEarthingBOM, ...logisticsBOM];

  for (const item of engineeredItems) {
    const exists = resolvedItems.some(i => i.description.toUpperCase().includes(item.description.toUpperCase()));
    if (!exists) {
      upsertItem(item.description, {
        qty: item.qty,
        ratePerUnit: item.ratePerUnit,
        gstPct: item.gstPct as any,
        unit: item.unit,
        remarks: 'Engineered BOM',
      }, false);
    }
  }

`;

  const newContent = content.substring(0, startIndex) + replacement + content.substring(endIndex);
  fs.writeFileSync(file, newContent, 'utf8');
  console.log("Successfully replaced block.");
} else {
  console.log("Could not find markers. startIndex=" + startIndex + ", endIndex=" + endIndex);
}
