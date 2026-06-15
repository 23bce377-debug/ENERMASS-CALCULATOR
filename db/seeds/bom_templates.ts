export const SEED_BOM_CATEGORIES = [
  { id: 'cat-dc-protection', name: 'DC Side Protection', displayOrder: 1, isOptional: false },
  { id: 'cat-ac-protection', name: 'AC Side Protection', displayOrder: 2, isOptional: false },
  { id: 'cat-cables', name: 'Cables', displayOrder: 3, isOptional: false },
  { id: 'cat-earthing', name: 'Earthing', displayOrder: 4, isOptional: false },
  { id: 'cat-safety', name: 'Monitoring & Safety', displayOrder: 5, isOptional: false },
  { id: 'cat-civil', name: 'Civil Works', displayOrder: 6, isOptional: false },
  { id: 'cat-logistics', name: 'Logistics & Handling', displayOrder: 7, isOptional: false },
];

export const SEED_BOM_TEMPLATE_ITEMS = [
  // DC Side Protection
  {
    id: 'item-dcdb', categoryId: 'cat-dc-protection', skuCode: 'DCDB-01', description: 'DCDB (DC Distribution Box)', unit: 'units',
    unitRateMin: 2500, unitRateMax: 4000, defaultRate: 3250, qtyFormula: 'CEIL(system_kw / 5)', isSystemSurveyDependent: false
  },
  {
    id: 'item-mc4', categoryId: 'cat-dc-protection', skuCode: 'MC4-PAIR-01', description: 'MC4 Connectors (pair)', unit: 'pairs',
    unitRateMin: 45, unitRateMax: 80, defaultRate: 60, qtyFormula: '(panel_count * 2) + CEIL(panel_count * 0.1)', isSystemSurveyDependent: false
  },
  {
    id: 'item-dc-spd', categoryId: 'cat-dc-protection', skuCode: 'DC-SPD-01', description: 'DC Surge Protection Device (SPD)', unit: 'units',
    unitRateMin: 800, unitRateMax: 1500, defaultRate: 1150, qtyFormula: 'CEIL(system_kw / 5)', isSystemSurveyDependent: false
  },
  
  // AC Side Protection
  {
    id: 'item-acdb', categoryId: 'cat-ac-protection', skuCode: 'ACDB-01', description: 'ACDB (AC Distribution Box)', unit: 'units',
    unitRateMin: 3500, unitRateMax: 5000, defaultRate: 4250, qtyFormula: '1', isSystemSurveyDependent: false
  },
  {
    id: 'item-ac-mcb', categoryId: 'cat-ac-protection', skuCode: 'AC-MCB-01', description: 'AC MCB (miniature circuit breaker)', unit: 'units',
    unitRateMin: 250, unitRateMax: 400, defaultRate: 325, qtyFormula: '1', isSystemSurveyDependent: false
  },
  {
    id: 'item-ac-spd', categoryId: 'cat-ac-protection', skuCode: 'AC-SPD-01', description: 'AC Surge Protection Device', unit: 'units',
    unitRateMin: 1200, unitRateMax: 2000, defaultRate: 1600, qtyFormula: '1', isSystemSurveyDependent: false
  },
  
  // Cables
  {
    id: 'item-dc-cable', categoryId: 'cat-cables', skuCode: 'DC-CABLE-01', description: 'DC Cable (4mm² copper)', unit: 'meters',
    unitRateMin: 28, unitRateMax: 35, defaultRate: 31, qtyFormula: 'null', isSystemSurveyDependent: true
  },
  {
    id: 'item-ac-cable', categoryId: 'cat-cables', skuCode: 'AC-CABLE-01', description: 'AC Cable', unit: 'meters',
    unitRateMin: 45, unitRateMax: 75, defaultRate: 60, qtyFormula: 'null', isSystemSurveyDependent: true
  },
  {
    id: 'item-earthing-strip', categoryId: 'cat-cables', skuCode: 'EARTH-STRIP-01', description: 'Earthing Strip (GI Flat 25x3mm)', unit: 'meters',
    unitRateMin: 85, unitRateMax: 120, defaultRate: 100, qtyFormula: 'null', isSystemSurveyDependent: true
  },
  
  // Earthing
  {
    id: 'item-earthing-kit', categoryId: 'cat-earthing', skuCode: 'EARTH-CHEM-01', description: 'Chemical Earthing Kit (pipe + compound)', unit: 'pits',
    unitRateMin: 2200, unitRateMax: 3500, defaultRate: 2850, qtyFormula: '2 + MAX(0, CEIL((system_kw - 10) / 10))', isSystemSurveyDependent: false
  },
  {
    id: 'item-earth-rod', categoryId: 'cat-earthing', skuCode: 'EARTH-ROD-01', description: 'GI Earth Rod (1.5m)', unit: 'units',
    unitRateMin: 350, unitRateMax: 500, defaultRate: 425, qtyFormula: '1', isSystemSurveyDependent: false
  },
  {
    id: 'item-earth-bus', categoryId: 'cat-earthing', skuCode: 'EARTH-BUS-01', description: 'Earth Bus Bar', unit: 'units',
    unitRateMin: 400, unitRateMax: 700, defaultRate: 550, qtyFormula: '1', isSystemSurveyDependent: false
  },
  
  // Monitoring & Safety
  {
    id: 'item-la', categoryId: 'cat-safety', skuCode: 'LA-01', description: 'Lightning Arrester (LA)', unit: 'units',
    unitRateMin: 1800, unitRateMax: 3000, defaultRate: 2400, qtyFormula: 'CEIL(roof_area_sqft / 1500)', isSystemSurveyDependent: true
  },
  {
    id: 'item-earthing-elec', categoryId: 'cat-safety', skuCode: 'EARTH-ELEC-01', description: 'Earthing Electrode (Copper Bonded)', unit: 'units',
    unitRateMin: 1200, unitRateMax: 1800, defaultRate: 1500, qtyFormula: '2 + MAX(0, CEIL((system_kw - 10) / 10))', isSystemSurveyDependent: false
  },
  {
    id: 'item-conduit', categoryId: 'cat-safety', skuCode: 'COND-PIPE-01', description: 'Conduit Pipe (GI, 25mm)', unit: 'meters',
    unitRateMin: 85, unitRateMax: 120, defaultRate: 100, qtyFormula: 'null', isSystemSurveyDependent: true
  },
  {
    id: 'item-cable-tray', categoryId: 'cat-safety', skuCode: 'CABLE-TRAY-01', description: 'Cable Tray (Perforated, 100mm)', unit: 'meters',
    unitRateMin: 180, unitRateMax: 250, defaultRate: 215, qtyFormula: 'null', isSystemSurveyDependent: true
  },

  // Civil Works
  {
    id: 'item-cement', categoryId: 'cat-civil', skuCode: 'CIV-CEMENT', description: 'Portland Cement (50kg)', unit: 'bags',
    unitRateMin: 380, unitRateMax: 420, defaultRate: 400, qtyFormula: 'CEIL(system_kw * 0.4)', isSystemSurveyDependent: false
  },
  {
    id: 'item-sand', categoryId: 'cat-civil', skuCode: 'CIV-SAND', description: 'River Sand', unit: 'cubic meters',
    unitRateMin: 1800, unitRateMax: 2400, defaultRate: 2100, qtyFormula: 'system_kw * 0.02', isSystemSurveyDependent: false
  },
  {
    id: 'item-aggregate', categoryId: 'cat-civil', skuCode: 'CIV-AGG', description: 'Coarse Aggregate (20mm)', unit: 'cubic meters',
    unitRateMin: 2200, unitRateMax: 2800, defaultRate: 2500, qtyFormula: 'system_kw * 0.015', isSystemSurveyDependent: false
  },
  {
    id: 'item-bricks', categoryId: 'cat-civil', skuCode: 'CIV-BRICK', description: 'Bricks (Red, std)', unit: 'units',
    unitRateMin: 8, unitRateMax: 12, defaultRate: 10, qtyFormula: 'system_kw * 15', isSystemSurveyDependent: false
  },
  {
    id: 'item-anchor', categoryId: 'cat-civil', skuCode: 'CIV-ANCHOR', description: 'Anchor Bolts (M12x150)', unit: 'units',
    unitRateMin: 35, unitRateMax: 55, defaultRate: 45, qtyFormula: 'panel_count * 4', isSystemSurveyDependent: false
  },
  {
    id: 'item-rmc', categoryId: 'cat-civil', skuCode: 'CIV-RMC', description: 'Ready-Mix Concrete (M20)', unit: 'cubic meters',
    unitRateMin: 5500, unitRateMax: 7000, defaultRate: 6250, qtyFormula: 'system_kw * 0.15', isSystemSurveyDependent: false
  },

  // Logistics & Handling
  {
    id: 'item-trans-in', categoryId: 'cat-logistics', skuCode: 'LOG-TRANS-IN', description: 'Transport: Vendor to Warehouse', unit: 'trips',
    unitRateMin: 2000, unitRateMax: 6000, defaultRate: 4000, qtyFormula: '1', isSystemSurveyDependent: false
  },
  {
    id: 'item-trans-out', categoryId: 'cat-logistics', skuCode: 'LOG-TRANS-OUT', description: 'Transport: Warehouse to Site', unit: 'trips',
    unitRateMin: 1500, unitRateMax: 4500, defaultRate: 3000, qtyFormula: '1', isSystemSurveyDependent: false
  },
  {
    id: 'item-labor-log', categoryId: 'cat-logistics', skuCode: 'LOG-LABOR', description: 'Loading/Unloading Labor', unit: 'days',
    unitRateMin: 600, unitRateMax: 900, defaultRate: 750, qtyFormula: 'CEIL(system_kw / 3)', isSystemSurveyDependent: false
  },
  {
    id: 'item-packing', categoryId: 'cat-logistics', skuCode: 'LOG-PACKING', description: 'Packing Material (straps)', unit: 'lumpsum',
    unitRateMin: 500, unitRateMax: 1200, defaultRate: 850, qtyFormula: '1', isSystemSurveyDependent: false
  }
];