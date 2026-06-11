const fs = require('fs');
const path = require('path');

const MASTERS_DIR = path.join(__dirname, '..', 'knowledge', 'masters');
const BOM_DIR = path.join(__dirname, '..', 'knowledge', 'bom');
const PRICING_DIR = path.join(__dirname, '..', 'knowledge', 'pricing');
const SYSTEMS_DIR = path.join(__dirname, '..', 'knowledge', 'systems');
const RULES_DIR = path.join(__dirname, '..', 'knowledge', 'rules');

const report = [];

function logSection(title) {
  report.push(`\n## ${title}`);
}

function logSubSection(title) {
  report.push(`\n### ${title}`);
}

function logItem(text) {
  report.push(`- ${text}`);
}

function logTable(headers, rows) {
  if (rows.length === 0) {
    report.push('\n*No issues found.*');
    return;
  }
  let headerRow = `| ${headers.join(' | ')} |`;
  let sepRow = `| ${headers.map(() => '---').join(' | ')} |`;
  report.push('\n' + headerRow);
  report.push(sepRow);
  rows.forEach(row => {
    report.push(`| ${row.map(cell => String(cell === null || cell === undefined ? '' : cell).replace(/\|/g, '\\|')).join(' | ')} |`);
  });
}

function readJsonFile(dir, filename) {
  const filePath = path.join(dir, filename);
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    console.error(`Error parsing file ${filePath}:`, err);
    return null;
  }
}

// Helper to safely get brand, model, capacity/wattage/etc.
function safeGet(val) {
  return val === undefined || val === null ? '' : String(val).trim().toLowerCase();
}

// -------------------------------------------------------------
// 1. Audit Equipment (panels, inverters, batteries, meters, lightning arresters)
// -------------------------------------------------------------
function auditEquipment() {
  logSection('1. Equipment Master Audit');

  // Panels
  const panels = readJsonFile(MASTERS_DIR, 'panels.json');
  if (panels) {
    logSubSection(`Panels (${panels.length} records)`);
    const seen = new Map();
    const duplicates = [];
    const invalidRates = [];
    const gstInconsistencies = [];
    const namingIssues = [];

    panels.forEach((p, idx) => {
      const brand = safeGet(p.brand);
      const model = safeGet(p.model);
      const wattage = safeGet(p.wattage_w);
      const key = `${brand}_${model}_${wattage}`;
      if (seen.has(key)) {
        duplicates.push([idx, seen.get(key), p.brand, p.model, p.wattage_w, p.rate_per_panel]);
      } else {
        seen.set(key, idx);
      }

      if (p.rate_per_panel === null || p.rate_per_panel <= 0) {
        invalidRates.push([idx, p.brand, p.model, p.wattage_w, p.rate_per_panel]);
      }

      if (p.gst_pct !== undefined && p.gst_pct !== null && p.gst_pct > 1) {
        gstInconsistencies.push([idx, p.brand, p.model, `Field 'gst_pct' has value ${p.gst_pct} (looks like absolute amount instead of rate fraction)`]);
      }

      if (brand === 'unknown') {
        namingIssues.push([idx, 'Brand is "Unknown"', p.model, p.wattage_w]);
      }
    });

    logItem(`Total records: ${panels.length}`);
    logSubSection('Duplicate Panels (same brand, model, wattage)');
    logTable(['Idx', 'Duplicate of', 'Brand', 'Model', 'Wattage (W)', 'Rate'], duplicates);
    logSubSection('Panels with Invalid/Zero/Null Rates');
    logTable(['Idx', 'Brand', 'Model', 'Wattage (W)', 'Rate'], invalidRates);
    logSubSection('Panels GST/Schema Inconsistencies');
    logTable(['Idx', 'Brand', 'Model', 'Issue Description'], gstInconsistencies);
    logSubSection('Panels Naming Inconsistencies');
    logTable(['Idx', 'Issue', 'Model', 'Wattage'], namingIssues);
  }

  // Inverters
  const inverters = readJsonFile(MASTERS_DIR, 'inverters.json');
  if (inverters) {
    logSubSection(`Inverters (${inverters.length} records)`);
    const seen = new Map();
    const duplicates = [];
    const invalidRates = [];
    const gstIssues = [];
    const brandNamingIssues = [];

    inverters.forEach((inv, idx) => {
      const brand = safeGet(inv.brand);
      const model = safeGet(inv.model);
      const cap = safeGet(inv.capacity_kw);
      const key = `${brand}_${model}_${cap}`;
      if (seen.has(key)) {
        duplicates.push([idx, seen.get(key), inv.brand, inv.model, inv.capacity_kw, inv.rate]);
      } else {
        seen.set(key, idx);
      }

      if (inv.rate === null || inv.rate <= 0) {
        invalidRates.push([idx, inv.brand, inv.model, inv.capacity_kw, inv.rate]);
      }

      if (inv.gst_pct !== undefined && inv.gst_pct !== null && inv.gst_pct > 1) {
        gstIssues.push([idx, inv.brand, inv.model, `Field 'gst_pct' has value ${inv.gst_pct} (looks like absolute amount)`]);
      }

      if (brand === 'unknown') {
        brandNamingIssues.push([idx, 'Brand is "Unknown"', inv.model, inv.capacity_kw]);
      }
    });

    logSubSection('Duplicate Inverters (same brand, model, capacity)');
    logTable(['Idx', 'Duplicate of', 'Brand', 'Model', 'Capacity (kW)', 'Rate'], duplicates);
    logSubSection('Inverters with Invalid/Zero/Null Rates');
    logTable(['Idx', 'Brand', 'Model', 'Capacity (kW)', 'Rate'], invalidRates);
    logSubSection('Inverters GST/Schema Inconsistencies');
    logTable(['Idx', 'Brand', 'Model', 'Issue Description'], gstIssues);
    logSubSection('Inverters Brand Naming Issues');
    logTable(['Idx', 'Issue', 'Model', 'Capacity'], brandNamingIssues);
  }

  // Batteries
  const batteries = readJsonFile(MASTERS_DIR, 'batteries.json');
  if (batteries) {
    logSubSection(`Batteries (${batteries.length} records)`);
    const seen = new Map();
    const duplicates = [];
    const invalidRates = [];
    const chemistryIssues = [];

    batteries.forEach((bat, idx) => {
      const brand = safeGet(bat.brand);
      const model = safeGet(bat.model);
      const cap = safeGet(bat.capacity_kwh);
      const chem = safeGet(bat.chemistry);
      const key = `${brand}_${model}_${cap}_${chem}`;
      if (seen.has(key)) {
        duplicates.push([idx, seen.get(key), bat.brand, bat.model, bat.capacity_kwh, bat.rate]);
      } else {
        seen.set(key, idx);
      }

      if (bat.rate === null || bat.rate <= 0) {
        invalidRates.push([idx, bat.brand, bat.model, bat.capacity_kwh, bat.rate]);
      }

      if (chem === 'unknown' || !bat.chemistry) {
        chemistryIssues.push([idx, bat.brand, bat.model, 'Chemistry is Unknown or missing']);
      }
    });

    logSubSection('Duplicate Batteries');
    logTable(['Idx', 'Duplicate of', 'Brand', 'Model', 'Capacity (kWh)', 'Rate'], duplicates);
    logSubSection('Batteries with Invalid/Zero/Null Rates');
    logTable(['Idx', 'Brand', 'Model', 'Capacity (kWh)', 'Rate'], invalidRates);
    logSubSection('Batteries Chemistry/Unit Issues');
    logTable(['Idx', 'Brand', 'Model', 'Issue'], chemistryIssues);
  }

  // Meters
  const meters = readJsonFile(MASTERS_DIR, 'meters.json');
  if (meters) {
    logSubSection(`Meters (${meters.length} records)`);
    const seen = new Map();
    const duplicates = [];
    const invalidRates = [];
    const typeIssues = [];

    meters.forEach((m, idx) => {
      const type = safeGet(m.meter_type);
      const brand = safeGet(m.brand);
      const model = safeGet(m.model);
      const phases = safeGet(m.phases);
      const rate = safeGet(m.rate);
      const key = `${type}_${brand}_${model}_${phases}_${rate}`;
      if (seen.has(key)) {
        duplicates.push([idx, seen.get(key), m.meter_type, m.brand, m.model, m.phases, m.rate]);
      } else {
        seen.set(key, idx);
      }

      if (m.rate === null || m.rate === 0) {
        invalidRates.push([idx, m.meter_type, m.brand, m.model, m.rate]);
      }

      if (type !== 'solar_meter' && type !== 'net_meter' && type !== 'meter') {
        typeIssues.push([idx, m.brand, m.model, `Non-standard meter_type: '${m.meter_type}'`]);
      }
    });

    logSubSection('Duplicate Meters');
    logTable(['Idx', 'Duplicate of', 'Type', 'Brand', 'Model', 'Phases', 'Rate'], duplicates);
    logSubSection('Meters with Zero/Null Rates');
    logTable(['Idx', 'Type', 'Brand', 'Model', 'Rate'], invalidRates);
    logSubSection('Meters Type Inconsistencies');
    logTable(['Idx', 'Brand', 'Model', 'Issue'], typeIssues);
  }

  // Lightning Arresters
  const la = readJsonFile(MASTERS_DIR, 'lightning_arresters.json');
  if (la) {
    logSubSection(`Lightning Arresters (${la.length} records)`);
    const seen = new Map();
    const duplicates = [];
    const invalidRates = [];

    la.forEach((item, idx) => {
      const type = safeGet(item.la_type);
      const brand = safeGet(item.brand);
      const model = safeGet(item.model);
      const rate = safeGet(item.rate);
      const key = `${type}_${brand}_${model}_${rate}`;
      if (seen.has(key)) {
        duplicates.push([idx, seen.get(key), item.la_type, item.brand, item.model, item.rate]);
      } else {
        seen.set(key, idx);
      }

      if (item.rate === null || item.rate <= 0) {
        invalidRates.push([idx, item.brand, item.model, item.rate]);
      }
    });

    logSubSection('Duplicate Lightning Arresters');
    logTable(['Idx', 'Duplicate of', 'Type', 'Brand', 'Model', 'Rate'], duplicates);
    logSubSection('Lightning Arresters with Invalid/Zero Rates');
    logTable(['Idx', 'Brand', 'Model', 'Rate'], invalidRates);
  }
}

// -------------------------------------------------------------
// 2. Audit Vendors & Structures
// -------------------------------------------------------------
function auditVendorsAndStructures() {
  logSection('2. Vendors & Structures Audit');

  // Vendors
  const vendors = readJsonFile(MASTERS_DIR, 'vendors.json');
  if (vendors) {
    logSubSection(`Vendors (${vendors.length} records)`);
    const seen = new Map();
    const duplicateNames = [];
    const missingContact = [];

    vendors.forEach((v, idx) => {
      const canonicalName = safeGet(v.vendorName).replace(/\s+/g, ' ');
      
      if (seen.has(canonicalName)) {
        duplicateNames.push([idx, seen.get(canonicalName).idx, v.vendorName, seen.get(canonicalName).originalName]);
      } else {
        seen.set(canonicalName, { idx, originalName: v.vendorName });
      }

      if (!v.contactInfo && !v.email && !v.phone) {
        missingContact.push([idx, v.vendorName, 'No contact info, email, or phone present']);
      }
    });

    logSubSection('Duplicate Vendor Names (Canonical/Fuzzy Match)');
    logTable(['Idx', 'Duplicate of', 'Vendor Name', 'Existing Name'], duplicateNames);
    logSubSection('Vendors Missing Contact Info');
    logTable(['Idx', 'Vendor Name', 'Issue'], missingContact);
  }

  // Structures
  const structures = readJsonFile(MASTERS_DIR, 'structures.json');
  if (structures) {
    logSubSection(`Structures (${structures.length} records)`);
    const seen = new Map();
    const duplicates = [];
    const materialInconsistencies = [];
    const zeroRates = [];

    structures.forEach((s, idx) => {
      const name = safeGet(s.name);
      const roofType = safeGet(s.roof_mount_type);
      const rate = safeGet(s.raw_material_rate);
      const key = `${name}_${roofType}_${rate}`;
      if (seen.has(key)) {
        duplicates.push([idx, seen.get(key), s.name, s.roof_mount_type, s.raw_material_rate]);
      } else {
        seen.set(key, idx);
      }

      if (s.material && !['gi', 'galvanized iron', 'aluminium', 'unknown'].includes(s.material.toLowerCase().trim())) {
        materialInconsistencies.push([idx, s.name, s.material, `Non-standard material naming`]);
      }

      if (s.raw_material_rate === null || s.raw_material_rate === 0) {
        zeroRates.push([idx, s.name, s.roof_mount_type, s.raw_material_rate]);
      }
    });

    logSubSection('Duplicate Structures (same name, type, rate)');
    logTable(['Idx', 'Duplicate of', 'Name', 'Type', 'Rate'], duplicates);
    logSubSection('Structures with Non-Standard Materials');
    logTable(['Idx', 'Name', 'Material', 'Issue'], materialInconsistencies);
    logSubSection('Structures with Zero/Null Rates');
    logTable(['Idx', 'Name', 'Type', 'Rate'], zeroRates);
  }
}

// -------------------------------------------------------------
// 3. Audit BOM & Accessories (accessories.json, bom_templates.json)
// -------------------------------------------------------------
function auditBOMAndTemplates() {
  logSection('3. BOM & Template Audit');

  const accessories = readJsonFile(MASTERS_DIR, 'accessories.json');
  if (accessories) {
    logSubSection(`Accessories / BOM Items (${accessories.length} records)`);
    
    const acdbVariations = [];
    const dcdbVariations = [];
    const unitInconsistencies = [];
    const zeroRates = [];
    const duplicates = [];
    const seen = new Map();

    accessories.forEach((item, idx) => {
      const desc = safeGet(item.item_description);
      const descUpper = desc.toUpperCase();

      const key = `${safeGet(item.section)}_${safeGet(item.sub_type)}_${descUpper}_${safeGet(item.rate)}`;
      if (seen.has(key)) {
        duplicates.push([idx, seen.get(key), item.section, item.sub_type, item.item_description, item.rate]);
      } else {
        seen.set(key, idx);
      }

      if (/a\.?\s?c\.?\s?d\.?\s?b/i.test(desc) && descUpper !== 'ACDB') {
        acdbVariations.push([idx, item.item_description, 'Should resolve to canonical "ACDB"']);
      }
      if (/d\.?\s?c\.?\s?d\.?\s?b/i.test(desc) && descUpper !== 'DCDB') {
        dcdbVariations.push([idx, item.item_description, 'Should resolve to canonical "DCDB"']);
      }

      if (item.unit && !['Nos', 'nos', 'Mtr', 'mtr', 'kg', 'Kg', 'set', 'Set', 'Lot', 'lot', 'Rmt', 'rmt'].includes(item.unit)) {
        unitInconsistencies.push([idx, item.item_description, item.unit, 'Non-standard casing or unit name']);
      }

      if (item.rate === 0) {
        zeroRates.push([idx, item.item_description, item.rate]);
      }
    });

    logSubSection('Duplicate BOM Items (same section, subtype, desc, rate)');
    logTable(['Idx', 'Duplicate of', 'Section', 'Subtype', 'Description', 'Rate'], duplicates.slice(0, 30));
    if (duplicates.length > 30) {
      logItem(`... and ${duplicates.length - 30} more duplicate accessory records.`);
    }

    logSubSection('ACDB Naming Variations');
    logTable(['Idx', 'Description', 'Suggestion'], acdbVariations);
    logSubSection('DCDB Naming Variations');
    logTable(['Idx', 'Description', 'Suggestion'], dcdbVariations);
    logSubSection('BOM Unit Inconsistencies');
    logTable(['Idx', 'Description', 'Unit Found', 'Issue'], unitInconsistencies);
    logSubSection('BOM Items with Zero Rate');
    logTable(['Idx', 'Description', 'Rate'], zeroRates);
  }

  // BOM Templates
  const templates = readJsonFile(BOM_DIR, 'bom_templates.json');
  if (templates) {
    logSubSection(`BOM Templates (${templates.length} records)`);
    const seenTemplates = new Map();
    const duplicateTemplates = [];
    const templatesWithDoubleItems = [];

    templates.forEach((t, idx) => {
      const key = `${safeGet(t.systemId)}_${safeGet(t.systemType)}_${safeGet(t.capacityKW)}`;
      if (seenTemplates.has(key)) {
        duplicateTemplates.push([idx, seenTemplates.get(key), t.bomTemplateId, t.systemId, t.capacityKW]);
      } else {
        seenTemplates.set(key, idx);
      }

      const seenItems = new Set();
      if (Array.isArray(t.items)) {
        t.items.forEach(item => {
          const itemKey = `${safeGet(item.itemType)}_${safeGet(item.description)}`;
          if (seenItems.has(itemKey)) {
            templatesWithDoubleItems.push([idx, t.bomTemplateId, item.itemType, item.description]);
          } else {
            seenItems.add(itemKey);
          }
        });
      }
    });

    logSubSection('Duplicate BOM Templates (same systemId, type, capacity)');
    logTable(['Idx', 'Duplicate of', 'Template ID', 'System ID', 'Capacity (kW)'], duplicateTemplates);
    logSubSection('BOM Templates with Duplicate Items within the Same Template');
    logTable(['Idx', 'Template ID', 'Item Type', 'Item Description'], templatesWithDoubleItems.slice(0, 30));
  }
}

// -------------------------------------------------------------
// 4. Audit Pricing & GST (equipment_pricing, pricing_rules, gst_rates)
// -------------------------------------------------------------
function auditPricingAndGST() {
  logSection('4. Pricing & GST Audit');

  const eqPricing = readJsonFile(PRICING_DIR, 'equipment_pricing.json');
  if (eqPricing) {
    logSubSection(`Equipment Pricing (${eqPricing.length} records)`);
    const zeroPrices = [];
    const duplicates = [];
    const seen = new Map();

    eqPricing.forEach((p, idx) => {
      const key = `${safeGet(p.itemType)}_${safeGet(p.description)}_${safeGet(p.capacityKW)}_${safeGet(p.ratePerUnit)}`;
      if (seen.has(key)) {
        duplicates.push([idx, seen.get(key), p.itemType, p.description, p.capacityKW, p.ratePerUnit]);
      } else {
        seen.set(key, idx);
      }

      if (p.ratePerUnit === 0) {
        zeroPrices.push([idx, p.itemType, p.description, p.ratePerUnit]);
      }
    });

    logSubSection('Duplicate Equipment Pricing Records');
    logTable(['Idx', 'Duplicate of', 'Type', 'Description', 'Capacity', 'Rate'], duplicates.slice(0, 30));
    logSubSection('Equipment Pricing with Zero Rate');
    logTable(['Idx', 'Type', 'Description', 'Rate'], zeroPrices.slice(0, 30));
  }

  // GST rates master check
  const gstRates = readJsonFile(MASTERS_DIR, 'gst_rates.json');
  if (gstRates) {
    logSubSection(`GST Rates References (${gstRates.length} records)`);
    const anomalousRates = [];
    
    gstRates.forEach((g, idx) => {
      if (g.gstPct > 0.5) {
        anomalousRates.push([idx, g.sourceWorkbook, g.sourceSheet, g.sourceRow, g.gstPct, 'GST percentage is >50% (potential amount or percentage scaling error)']);
      }
    });

    logSubSection('Anomalous GST Percentages in gst_rates.json');
    logTable(['Idx', 'Workbook', 'Sheet', 'Row', 'GST Pct', 'Issue'], anomalousRates.slice(0, 30));
  }

  // Pricing rules duplicate check
  const pricingRules = readJsonFile(PRICING_DIR, 'pricing_rules.json');
  if (pricingRules) {
    logSubSection(`Pricing Rules (${pricingRules.length} records)`);
    const seenRules = new Map();
    const duplicateRules = [];

    pricingRules.forEach((rule, idx) => {
      if (rule.ruleName) {
        if (seenRules.has(rule.ruleName)) {
          duplicateRules.push([idx, seenRules.get(rule.ruleName), rule.ruleName, rule.systemType, rule.capacityKW]);
        } else {
          seenRules.set(rule.ruleName, idx);
        }
      }
    });

    logSubSection('Duplicate Rule Names in pricing_rules.json');
    logTable(['Idx', 'Duplicate of', 'Rule Name', 'System Type', 'Capacity (kW)'], duplicateRules);
  }
}

// -------------------------------------------------------------
// 5. Audit Systems & Templates
// -------------------------------------------------------------
function auditSystems() {
  logSection('5. Systems Master Audit');

  const ongrid = readJsonFile(SYSTEMS_DIR, 'ongrid_systems.json');
  if (ongrid) {
    logSubSection(`On-Grid Systems (${ongrid.length} records)`);
    const seen = new Map();
    const duplicates = [];

    ongrid.forEach((s, idx) => {
      const key = `${safeGet(s.capacityKW)}_${safeGet(s.bomTemplate)}_${safeGet(s.systemId)}`;
      if (seen.has(key)) {
        duplicates.push([idx, seen.get(key), s.capacityKW, s.bomTemplate, s.systemId]);
      } else {
        seen.set(key, idx);
      }
    });

    logSubSection('Duplicate On-Grid Systems (same capacity, bom template, systemId)');
    logTable(['Idx', 'Duplicate of', 'Capacity (kW)', 'BOM Template', 'System ID'], duplicates.slice(0, 30));
  }

  const hybrid = readJsonFile(SYSTEMS_DIR, 'hybrid_systems.json');
  if (hybrid) {
    logSubSection(`Hybrid Systems (${hybrid.length} records)`);
    const seen = new Map();
    const duplicates = [];

    hybrid.forEach((s, idx) => {
      const key = `${safeGet(s.capacityKW)}_${safeGet(s.bomTemplate)}_${safeGet(s.systemId)}`;
      if (seen.has(key)) {
        duplicates.push([idx, seen.get(key), s.capacityKW, s.bomTemplate, s.systemId]);
      } else {
        seen.set(key, idx);
      }
    });

    logSubSection('Duplicate Hybrid Systems (same capacity, bom template, systemId)');
    logTable(['Idx', 'Duplicate of', 'Capacity (kW)', 'BOM Template', 'System ID'], duplicates.slice(0, 30));
  }
}

// -------------------------------------------------------------
// 6. Audit Subsidy & State Rules
// -------------------------------------------------------------
function auditSubsidyRules() {
  logSection('6. Subsidy & State Rules Audit');

  const subsidyRules = readJsonFile(RULES_DIR, 'subsidy_rules.json');
  if (subsidyRules) {
    logSubSection(`Subsidy Rules (${subsidyRules.length} records)`);
    
    // PM Surya Ghar slabs check
    // Slab 1 (0-2 kW): 30000/kW, Slab 2 (2-3 kW): 18000/kW additional, Slab 3 (>3 kW): capped at 78000
    const subsidyDiscrepancies = [];

    subsidyRules.forEach((rule, idx) => {
      const cap = Number(rule.capacityKW);
      if (isNaN(cap)) return;

      let expectedSubsidy = 0;
      if (cap <= 2) {
        expectedSubsidy = cap * 30000;
      } else if (cap <= 3) {
        expectedSubsidy = 2 * 30000 + (cap - 2) * 18000;
      } else {
        expectedSubsidy = 78000;
      }

      // If rule defines a subsidy amount, check if it matches expectation
      if (rule.subsidy !== undefined && rule.subsidy !== null) {
        const actual = Number(rule.subsidy);
        if (Math.abs(actual - expectedSubsidy) > 10) {
          subsidyDiscrepancies.push([idx, rule.ruleName || rule.systemId, cap, actual, expectedSubsidy, `Subsidy of ${actual} does not match expected PM Surya Ghar formula subsidy of ${expectedSubsidy}`]);
        }
      }
    });

    logSubSection('PM Surya Ghar Subsidy Discrepancies');
    logTable(['Idx', 'Rule Name / System ID', 'Capacity (kW)', 'Actual Subsidy (₹)', 'Expected Subsidy (₹)', 'Discrepancy Details'], subsidyDiscrepancies);
  }
}

function runAudit() {
  console.log('Starting Forensic Data Audit...');
  report.push('# Forensic Data Audit Report: ENERMASS ERP');
  report.push(`Generated: ${new Date().toISOString()}`);
  report.push('\nThis report documents all data inconsistencies, duplicate master records, naming variations, GST errors, and invalid pricing in the ENERMASS ERP database configuration.');

  auditEquipment();
  auditVendorsAndStructures();
  auditBOMAndTemplates();
  auditPricingAndGST();
  auditSystems();
  auditSubsidyRules();

  const outputPath = path.join(__dirname, '..', 'ENERMASS_DATA_AUDIT.md');
  fs.writeFileSync(outputPath, report.join('\n'), 'utf8');
  console.log(`Audit report generated at: ${outputPath}`);
}

runAudit();
