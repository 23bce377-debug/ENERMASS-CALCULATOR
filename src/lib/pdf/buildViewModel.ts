import { createAdminClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/types/schema.types';
import {
  buildUpiPaymentPayload,
  createUpiQrDataUri,
  ENERMASS_PAYEE_NAME,
  ENERMASS_UPI_ID,
} from '@/lib/payments/upi';

// Map database sections to human-readable labels for the BOM Table
const SECTION_MAP: Record<string, string> = {
  solar_panels: 'A. Solar PV Modules',
  power_electronics: 'B. Power Electronics (Inverters)',
  mounting_structure: 'C. Module Mounting Structure (MMS)',
  electrical_protection: 'D. Electrical Protection (ACDB/DCDB)',
  earthing: 'E. Earthing & Protection Kits',
  cabling: 'F. Solar Cables',
  wiring: 'G. Conduits & Accessories',
  metering: 'H. Net Metering & Monitoring',
  services: 'I. Engineering & Liaison Services'
};

export async function buildQuoteViewModel(quoteId: string, orgId: string) {
  const supabase = createAdminClient();

  // 1. Fetch Quote
  const { data: quoteData, error: quoteError } = await supabase
    .from('quotes')
    .select('*')
    .eq('quote_number', quoteId)
    .eq('org_id', orgId)
    .single();

  if (quoteError || !quoteData) {
    throw new Error(`Quote not found: ${quoteId}. Error: ${quoteError?.message}`);
  }

  const quote = quoteData as any;

  // 2. Fetch Quote Items
  const { data: items, error: itemsError } = await supabase
    .from('quote_items')
    .select('*')
    .eq('quote_id', quote.id)
    .eq('is_included', true)
    .order('sort_order', { ascending: true });

  if (itemsError) {
    throw new Error(`Failed to fetch items for quote: ${quoteId}. Error: ${itemsError.message}`);
  }

  // 3. Fetch Organization Details
  const { data: org, error: orgError } = await supabase
    .from('organisations')
    .select('*')
    .eq('id', orgId)
    .single();

  if (orgError) {
    console.warn(`Failed to fetch organisation details for ${orgId}. Using default info.`);
  }

  // 3b. Resolve state-driven DISCOM name + T&C master template (data-driven).
  //     Fallback chain for terms: quote.terms_json → state template → global default.
  let stateDiscomName: string | null = null;
  let stateTermsTemplate: string[] | null = null;
  let globalTermsTemplate: string[] | null = null;
  let stateRule: any = null;
  try {
    if (quote.state_name) {
      const { data: stateRow } = await supabase
        .from('state_rules')
        .select('id, discom_name, sun_hours_per_day, performance_ratio, grid_tariff_inr')
        .eq('state_name', quote.state_name)
        .maybeSingle();
      const sr = stateRow as any;
      stateRule = sr ?? null;
      stateDiscomName = sr?.discom_name ?? null;
      if (sr?.id) {
        const { data: tpl } = await (supabase as any)
          .from('state_terms_templates')
          .select('clauses')
          .eq('state_id', sr.id)
          .eq('is_active', true)
          .maybeSingle();
        if (tpl?.clauses && Array.isArray(tpl.clauses) && tpl.clauses.length > 0) {
          stateTermsTemplate = tpl.clauses as string[];
        }
      }
    }
    const { data: globalTpl } = await (supabase as any)
      .from('state_terms_templates')
      .select('clauses')
      .is('state_id', null)
      .eq('is_active', true)
      .maybeSingle();
    if (globalTpl?.clauses && Array.isArray(globalTpl.clauses) && globalTpl.clauses.length > 0) {
      globalTermsTemplate = globalTpl.clauses as string[];
    }
  } catch (e) {
    console.warn('[buildViewModel] State T&C/DISCOM lookup failed; using defaults.', e);
  }

  // 4. Resolve date values
  const dateStr = quote.created_at || new Date().toISOString();
  const proposalDateObj = new Date(dateStr);
  const validUntilDateObj = quote.valid_until 
    ? new Date(quote.valid_until) 
    : new Date(proposalDateObj.getTime() + 30 * 86400 * 1000);

  // 5. Build BOM Groups & Equipment Specifications using a Summarizer
  const capacityKW = Number(quote.system_capacity_kw || 0) || 3;
  const panelQty = Number(quote.panel_qty || 0) || Math.ceil(capacityKW * 1000 / 610);
  const inverterQty = Number(quote.inverter_qty || 0) || 1;

  const looksLikeId = (value: unknown) =>
    typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(value);

  const appendQty = (label: string, qty: number, unit: string) => {
    if (!label || qty <= 0) return label;
    return /\b\d+\s*(nos|no|pcs|pieces|lot|lots)\b/i.test(label)
      ? label
      : `${label} (${qty} ${unit})`;
  };

  const formatResolvedEquipment = (row: any, metaKey: 'wattage_w' | 'capacity_kw' | 'capacity_kwh') => {
    if (!row) return null;
    const name = [row.brand, row.model].filter(Boolean).join(' ').trim();
    const metaValue = row[metaKey];
    const meta =
      metaKey === 'wattage_w' && metaValue ? `${metaValue} Wp` :
      metaKey === 'capacity_kw' && metaValue ? `${metaValue} kW` :
      metaKey === 'capacity_kwh' && metaValue ? `${metaValue} kWh` :
      null;

    return [name, meta ? `(${meta})` : null].filter(Boolean).join(' ');
  };

  const resolveEquipmentLabel = async (
    tableName: 'eq_panels' | 'eq_inverters' | 'eq_batteries',
    displayValue: string | null,
    fallbackId: string | null,
    metaKey: 'wattage_w' | 'capacity_kw' | 'capacity_kwh',
  ) => {
    if (displayValue && !looksLikeId(displayValue)) return displayValue;

    const id = looksLikeId(displayValue) ? displayValue : fallbackId;
    if (!id) return displayValue || null;

    const { data } = await (supabase as any)
      .from(tableName)
      .select(`brand, model, ${metaKey}`)
      .eq('id', id)
      .maybeSingle();

    return formatResolvedEquipment(data, metaKey) || displayValue || id;
  };

  const equipmentSnapshot = quote.equipment_json && typeof quote.equipment_json === 'object'
    ? quote.equipment_json
    : {};
  const panelDisplayName = await resolveEquipmentLabel(
    'eq_panels',
    quote.panel_brand_model,
    equipmentSnapshot.panelBrandId ?? null,
    'wattage_w',
  );
  const inverterDisplayName = await resolveEquipmentLabel(
    'eq_inverters',
    quote.inverter_brand_model,
    equipmentSnapshot.inverterBrandId ?? null,
    'capacity_kw',
  );

  // Helper to find a dynamic item in dbItems matching standard terms
  const findDbItem = (keywords: string[]) => {
    return items.find(item => {
      const desc = (item.description || '').toLowerCase();
      const spec = (item.remarks || '').toLowerCase();
      return keywords.some(k => desc.includes(k) || spec.includes(k));
    });
  };

  const getSpec = (dbItem: any, defaultSpec: string) => {
    if (dbItem && (dbItem.remarks || dbItem.specification_details || dbItem.specification)) {
      return dbItem.remarks || dbItem.specification_details || dbItem.specification;
    }
    return defaultSpec;
  };
  const getQty = (dbItem: any, defaultQty: number) => {
    if (dbItem && dbItem.qty) {
      return Number(dbItem.qty);
    }
    return defaultQty;
  };
  const getUnit = (dbItem: any, defaultUnit: string) => {
    if (dbItem && dbItem.unit) {
      return dbItem.unit;
    }
    return defaultUnit;
  };

  // Find DB items for override scan
  const panelDb = findDbItem(['panel', 'module', 'solar pv']);
  const inverterDb = findDbItem(['inverter', 'string inverter', 'power electronics']);
  const mmsDb = findDbItem(['mms', 'mounting', 'structure']);
  const dcCableDb = findDbItem(['dc cable', 'dc cabling', 'solar cable']);
  const dcdbDb = findDbItem(['dcdb', 'dc distribution', 'dc db']);
  const acCableDb = findDbItem(['ac cable', 'ac cabling', 'flexible cable']);
  const acdbDb = findDbItem(['acdb', 'ac distribution', 'ac db']);
  const earthingDb = findDbItem(['earthing', 'grounding', 'earth rod']);
  const laDb = findDbItem(['la', 'lightning arrester', 'lightning protection']);
  const solarMeterDb = findDbItem(['solar energy meter', 'solar meter', 'energy meter']);
  const rmsDb = findDbItem(['rms', 'remote monitoring', 'monitoring system', 'data logger']);
  const civilDb = findDbItem(['civil', 'foundation', 'grouting']);
  const installDb = findDbItem(['installation', 'labour', 'cable tray', 'conduit']);
  const commDb = findDbItem(['commissioning', 'testing', 'handover']);
  const liaisonDb = findDbItem(['liaison', 'net metering application', 'discom application']);
  const subsidyDb = findDbItem(['subsidy', 'cfa', 'portal registration']);

  // Equipment Specs for Page 4
  const panelBrand = panelDisplayName
    ? appendQty(panelDisplayName, panelQty, 'Nos')
    : `Adani / Waaree / V Guard / Panasonic, 610 Wp x ${panelQty} Nos`;
  
  const inverterBrand = inverterDisplayName
    ? appendQty(inverterDisplayName, inverterQty, 'Lot')
    : `Deye-5 — 5Kw`;

  const structureBrand = quote.structure_used || 'Module Mounting Structure (MMS) Make-Appolo GI';
  const defaultPanelSpec = 'Tec-N-type TOPCON Bifacial Mono. Efficiency: ~21.5% -22.4%. Bifacil Gain~30% Low Degradation Y1~1%,After~0.4%. Product Warranty 10-12Y ,Performance Warranty 30Y';
  const defaultInverterSpec = 'On-Grid (Grid-Tied) String Inverter Maximum Efficiency ≥ 97.5% Total Harmonic Distortion (THD) < 3% .Warranty Minimum 10 years';
  const defaultStructureSpec = 'Module Mounting Structure (MMS) GI.';

  const equipmentSpecs = [
    {
      label: 'A. Solar PV Modules',
      name: panelBrand,
      details: getSpec(panelDb, defaultPanelSpec)
    },
    {
      label: 'B. Inverter',
      name: `On-Grid String Inverter | ${inverterBrand}`,
      details: getSpec(inverterDb, defaultInverterSpec)
    },
    {
      label: 'C. Module Mounting Structure (MMS)',
      name: structureBrand,
      details: getSpec(mmsDb, defaultStructureSpec)
    }
  ];

  // Standardized BOM Groups for Page 5
  const bomGroups = [
    {
      groupLabel: 'A. SOLAR PV MODULES',
      items: [
        {
          lineNo: '01',
          description: 'Solar PV Module',
          specification: getSpec(panelDb, defaultPanelSpec),
          qty: getQty(panelDb, panelQty),
          unit: getUnit(panelDb, 'Nos')
        }
      ]
    },
    {
      groupLabel: 'B. INVERTER',
      items: [
        {
          lineNo: '02',
          description: 'On-Grid String Inverter',
          specification: getSpec(inverterDb, defaultInverterSpec),
          qty: getQty(inverterDb, 1),
          unit: getUnit(inverterDb, 'Lot')
        }
      ]
    },
    {
      groupLabel: 'C. MODULE MOUNTING STRUCTURE',
      items: [
        {
          lineNo: '03',
          description: 'Module Mounting Structure (MMS) Make-Appolo GI',
          specification: getSpec(mmsDb, defaultStructureSpec),
          qty: getQty(mmsDb, 1),
          unit: getUnit(mmsDb, 'Lot')
        }
      ]
    },
    {
      groupLabel: 'D. DC ELECTRICAL',
      items: [
        {
          lineNo: '04',
          description: 'DC Cables – 4 sqmm UV Resistant Solar Cable- Polycab, Havells, Lumicon',
          specification: getSpec(dcCableDb, 'TÜV certified, double insulation, UV-resistant, 1500V DC, IS:694'),
          qty: getQty(dcCableDb, capacityKW >= 5 ? 40 : 24),
          unit: getUnit(dcCableDb, 'Meters')
        },
        {
          lineNo: '05',
          description: 'DC Distribution Box (DCDB) with SPD',
          specification: getSpec(dcdbDb, 'IP65, MC4 connectors, DC MCB, SPD Class II 1000V, fuse holder'),
          qty: getQty(dcdbDb, 1),
          unit: getUnit(dcdbDb, 'Set')
        }
      ]
    },
    {
      groupLabel: 'E. AC ELECTRICAL & PROTECTION',
      items: [
        {
          lineNo: '06',
          description: 'AC Cables Polycab, Havells, VGuard',
          specification: getSpec(acCableDb, 'Multi-Stranded Flexible Cable'),
          qty: getQty(acCableDb, capacityKW >= 5 ? 25 : 15),
          unit: getUnit(acCableDb, 'Meters')
        },
        {
          lineNo: '07',
          description: 'AC Distribution Box (ACDB) with MCB',
          specification: getSpec(acdbDb, 'IP65, , MCB,2P,4P, 32A, per system rating, 40kA SPD Class II'),
          qty: getQty(acdbDb, 1),
          unit: getUnit(acdbDb, 'Set')
        }
      ]
    },
    {
      groupLabel: 'F. EARTHING & LIGHTNING PROTECTION',
      items: [
        {
          lineNo: '08',
          description: 'Earthing Kit (Copper- Bonded Rod + Chemical)',
          specification: getSpec(earthingDb, 'IS:3043, Copper bonded electrode'),
          qty: getQty(earthingDb, capacityKW >= 5 ? 3 : 2),
          unit: getUnit(earthingDb, 'Nos')
        },
        {
          lineNo: '09',
          description: 'Lightning Arrester with Down Conductor',
          specification: getSpec(laDb, 'Class I+II combined, IS:3043,Multi Spike Copper Coated or Brass LA'),
          qty: getQty(laDb, 1),
          unit: getUnit(laDb, 'Set')
        }
      ]
    },
    {
      groupLabel: 'G. METERING & MONITORING',
      items: [
        {
          lineNo: '10',
          description: 'Solar Energy Meter',
          specification: getSpec(solarMeterDb, 'DISCOM/CEIG approved, MID certified, IS:14697'),
          qty: getQty(solarMeterDb, 1),
          unit: getUnit(solarMeterDb, 'No')
        },
        {
          lineNo: '11',
          description: 'Remote Monitoring System – Wi-Fi/GSM Data Logger',
          specification: getSpec(rmsDb, 'Real-time cloud dashboard, mobile app, alerts'),
          qty: getQty(rmsDb, 1),
          unit: getUnit(rmsDb, 'No')
        }
      ]
    },
    {
      groupLabel: 'H. CIVIL & INSTALLATION',
      items: [
        {
          lineNo: '12',
          description: 'Civil Work Foundation & Grouting',
          specification: getSpec(civilDb, 'As per structural drawings.'),
          qty: getQty(civilDb, 1),
          unit: getUnit(civilDb, 'Lot')
        },
        {
          lineNo: '13',
          description: 'Installation, Cable Tray & Conduit',
          specification: getSpec(installDb, 'Skilled labour, safety PPE, Cable tray, ISI Wiring Conduit'),
          qty: getQty(installDb, 1),
          unit: getUnit(installDb, 'Lot')
        },
        {
          lineNo: '14',
          description: 'Commissioning, Testing & Handover',
          specification: getSpec(commDb, 'String test, IR test, functional test, owner training'),
          qty: getQty(commDb, 1),
          unit: getUnit(commDb, 'Lot')
        }
      ]
    },
    {
      groupLabel: 'I. DOCUMENTATION & LIAISON',
      items: [
        {
          lineNo: '15',
          description: 'Bi-Directional Net Metering Application & DISCOM Liaison',
          specification: getSpec(liaisonDb, 'SLD, DPR, DISCOM application, follow-up till net meter commissioning'),
          qty: getQty(liaisonDb, 1),
          unit: getUnit(liaisonDb, 'Set')
        },
        {
          lineNo: '16',
          description: 'CFA / State Subsidy Documentation',
          specification: getSpec(subsidyDb, 'MNRE portal registration, subsidy application, bank linkage'),
          qty: getQty(subsidyDb, 1),
          unit: getUnit(subsidyDb, 'Set')
        }
      ]
    }
  ];

  // 6. Calculate Financial Savings over 25 Years
  const stateSunHoursPerDay = Number(stateRule?.sun_hours_per_day || 0) || 5;
  const statePerformanceRatio = Number(stateRule?.performance_ratio || 0) || 0.78;
  const projectedDailyGeneration = capacityKW * stateSunHoursPerDay * statePerformanceRatio;
  const projectedAnnualGeneration = projectedDailyGeneration * 365.2425;
  const annualGen = Number(quote.annual_generation_kwh || 0) || projectedAnnualGeneration;
  const annualSavings = Number(quote.annual_savings_inr || 0);
  const twentyFiveYearSavings = annualSavings * 25 * 0.85;
  const grossQuoteValue = Number(quote.final_customer_price || quote.mrp_incl_gst || 0);
  const subsidyAmount = Number(quote.subsidy_amount || 0);
  const beneficiaryContribution = Number(
    quote.beneficiary_contribution ?? Math.max(0, grossQuoteValue - subsidyAmount)
  );
  const netInvestment = beneficiaryContribution;

  // Generate 10-Year Cash Flow Projection
  const cashFlow = [];
  let gen = annualGen;
  let benefit = annualSavings;
  let cumulative = 0;
  
  for (let y = 1; y <= 10; y++) {
    if (y > 1) {
      gen = gen * 0.992; // 0.8% degradation per year
      benefit = benefit * 1.04; // 4% tariff hike per year
    }
    cumulative += benefit;
    const netAfter = cumulative - netInvestment;
    cashFlow.push({
      year: y,
      generation: Math.round(gen).toLocaleString('en-IN'),
      benefit: Math.round(benefit),
      cumulative: Math.round(cumulative),
      netAfter: Math.round(netAfter),
      isPositive: netAfter > 0
    });
  }

  // 7. Carbon offsets calculations
  const co2OffsetTons = (annualGen * 0.82) / 1000;
  const lifetimeCo2OffsetTons = co2OffsetTons * 25;
  const treesPlanted = Math.round(lifetimeCo2OffsetTons * 47.5);
  const clampPct = (value: number) => Math.max(4, Math.min(100, Math.round(value)));
  const sunlightPct = clampPct((stateSunHoursPerDay / 6) * 100);
  const annualCarbonPct = clampPct((co2OffsetTons / Math.max(1, capacityKW * 1.7)) * 100);
  const treeTileCount = Math.max(1, Math.min(12, Math.round(treesPlanted / 500)));
  const solarTileCount = Math.max(1, Math.min(12, Math.round(capacityKW)));
  const sunlightLabel =
    stateSunHoursPerDay >= 5.7 ? 'Very high solar resource' :
    stateSunHoursPerDay >= 5.1 ? 'High solar resource' :
    stateSunHoursPerDay >= 4.6 ? 'Good solar resource' :
    'Moderate solar resource';
  const carbonImpact = {
    stateName: quote.state_name || 'Selected state',
    capacityKW,
    sunHoursPerDay: stateSunHoursPerDay,
    performanceRatioPct: Math.round(statePerformanceRatio * 100),
    sunlightLabel,
    sunlightPct,
    sunlightStyle: `width:${sunlightPct}%`,
    annualCarbonPct,
    annualCarbonStyle: `width:${annualCarbonPct}%`,
    dailyGenerationKWh: projectedDailyGeneration,
    annualGenerationKWh: annualGen,
    co2OffsetTons,
    lifetimeCo2OffsetTons,
    treesPlanted,
    gridEmissionFactor: 0.82,
    solarTiles: Array.from({ length: 12 }, (_, index) => ({ active: index < solarTileCount })),
    treeTiles: Array.from({ length: 12 }, (_, index) => ({ active: index < treeTileCount })),
  };

  const roiPercent = netInvestment <= 0 
    ? 0 
    : Math.round(((twentyFiveYearSavings - netInvestment) / netInvestment) * 100);

  // Calculate dynamic payback years fallback if not present in database
  let calculatedPaybackYears = quote.payback_years ? Number(quote.payback_years) : 0;
  if (!calculatedPaybackYears && annualSavings > 0) {
    calculatedPaybackYears = netInvestment / annualSavings;
  }

  const quotedPaymentAmount = beneficiaryContribution;
  const upiPayment = buildUpiPaymentPayload({
    amount: quotedPaymentAmount,
    reference: quote.quote_number,
    note: `Solar quote ${quote.quote_number}`,
    payeeAddress: ENERMASS_UPI_ID,
    payeeName: quote.bank_account_holder || ENERMASS_PAYEE_NAME,
  });
  let upiQrCode: string | null = null;
  try {
    upiQrCode = quotedPaymentAmount > 0 ? await createUpiQrDataUri(upiPayment) : null;
  } catch (error) {
    console.warn(`[buildViewModel] Failed to generate local UPI QR for ${quote.quote_number}.`, error);
  }

  // Final T&C fallback when neither the quote snapshot nor any DB template exists.
  // State-agnostic and professional; the authoritative source is state_terms_templates.
  const defaultTerms = [
    "This proposal is valid for the period stated herein. Upon expiry, all quoted prices are subject to revision at the Company's sole discretion.",
    "Payment schedule: 50% advance against a confirmed purchase order, 40% prior to dispatch of material, and the balance 10% upon successful grid commissioning.",
    "Installation shall be completed within 15 working days of receipt of the advance payment. Final commissioning remains subject to DISCOM inspection and approval, which typically requires 30 to 45 days.",
    "Solar PV modules are covered by a 12-year manufacturer product warranty and a 30-year linear performance warranty.",
    "The grid-tie inverter carries a 10-year manufacturer warranty from the date of commissioning.",
    "The mounting structure is warranted for 5 years against structural integrity and galvanisation defects.",
    "The scope of supply includes one (1) year of complimentary maintenance support, comprising four (4) scheduled preventive maintenance visits from the date of commissioning.",
    "The Company shall provide liaison assistance for feasibility approval and net-metering registration. All statutory timelines remain subject to clearances from the concerned DISCOM and electrical authorities.",
    "Disbursement of the PM Surya Ghar Central Financial Assistance is administered through the National Portal and is typically credited within 60 to 90 days of net-meter commissioning.",
    "Applicable Goods and Services Tax is levied in accordance with prevailing Government of India notifications and is included in the quoted value."
  ];

  // Resolve the effective T&C: quote snapshot → state template → global default → fallback.
  const effectiveTerms = (quote.terms_json && quote.terms_json.length > 0)
    ? quote.terms_json
    : (stateTermsTemplate ?? globalTermsTemplate ?? defaultTerms);

  return {
    company: {
      name: quote.company_name || (org?.name && org.name !== 'Pitbull Corporations' ? org.name : 'Enermass') || 'Enermass',
      tagline: org?.website || 'INTEGRATED SOLAR AND POWER ENGINEERING SOLUTIONS',
      address: quote.company_address || org?.address || 'AVM Complex, Chirangara Koratty Post, Thrissur, Kerala – 680 308',
      phone: quote.company_phone || org?.phone || '+91-81 380 27336',
      email: quote.company_email || org?.email || 'info@enermass.in',
      website: quote.company_website || org?.website || 'www.enermass.in',
      cin: quote.company_cin || 'U74999KL2018PTC053947',
      gstNumber: quote.company_gstin || '32AAFCE1087R1ZA',
      panNumber: quote.company_pan || 'AAFCE1087R',
      ceoName: quote.ceo_name || 'Mr. Manoj M S',
      ceoTitle: quote.ceo_designation || 'Chief Executive Officer',
      ceoSignatureUrl: quote.ceo_signature_url || null
    },
    customer: {
      name: quote.customer_name,
      phone: quote.customer_phone || '—',
      whatsapp: quote.customer_whatsapp || '—',
      email: quote.customer_email || '—',
      category: quote.project_type === 'commercial' ? 'Commercial' : 'Residential',
      state: quote.state_name || 'Kerala',
      city: quote.city || 'Nellayi',
      pin: quote.pincode || '—',
      billingAddress: `${quote.address_line1 || ''} ${quote.address_line2 || ''}`.trim() || '—',
      siteAddress: `${quote.address_line1 || ''} ${quote.address_line2 || ''}`.trim() || '—',
      discomName: stateDiscomName || (quote.state_name ? `${quote.state_name} State DISCOM` : 'Local DISCOM Grid'),
      meterNo: quote.meter_number || '—',
      sanctionedLoad: quote.sanctioned_load_kw || '—',
      monthlyBill: quote.monthly_bill_inr || 0,
      roofArea: quote.roof_area_sqft || 0
    },
    proposal: {
      reference: quote.quote_number,
      date: proposalDateObj.toISOString(),
      validUntil: validUntilDateObj.toISOString()
    },
    system: {
      capacityKW: quote.system_capacity_kw || 0,
      monthlyGeneration: Math.round(annualGen / 12),
      annualGeneration: Math.round(annualGen),
      typeLabel: quote.project_type === 'commercial' 
        ? 'Grid-Connected Commercial Solar Power Plant'
        : 'Grid-Connected Rooftop Solar Power Plant — Net Metering',
      totalProjectCost: grossQuoteValue,
      beneficiaryContribution,
      subsidyAmount,
      panelsUsed: panelDisplayName ? appendQty(panelDisplayName, panelQty, 'Nos') : 'Standard High-Efficiency Tier-1 Panels',
      invertersUsed: inverterDisplayName ? appendQty(inverterDisplayName, inverterQty, 'Lot') : 'On-Grid String Inverter',
      structureUsed: 'Galvanized Iron (GI) Structure designed for 150 km/h wind loads'
    },
    salesContact: {
      name: quote.exec_name || 'Gigit Antony',
      role: quote.sales_exec_role || 'Sales Executive',
      phone: quote.sales_exec_phone || '7594933374',
      email: quote.sales_exec_email || 'info@enermass.in'
    },
    bank: {
      accountHolder: quote.bank_account_holder || ENERMASS_PAYEE_NAME,
      bankName: quote.bank_name || 'Bank of Baroda, Koratty',
      accountNo: quote.bank_account_no || '85080200000055',
      ifsc: quote.bank_ifsc || 'BARB0KORATT',
      upiId: ENERMASS_UPI_ID
    },
    paymentMilestones: {
      advance: beneficiaryContribution * 0.50,
      delivery: beneficiaryContribution * 0.40,
      commissioning: beneficiaryContribution * 0.10
    },
    terms: effectiveTerms,
    equipmentSpecs,
    bomGroups,
    cashFlow,
    twentyFiveYearSavings,
    annualSavings,
    paybackYears: calculatedPaybackYears > 0 ? calculatedPaybackYears.toFixed(1) : '—',
    roiPercent,
    co2OffsetTons,
    lifetimeCo2OffsetTons,
    treesPlanted,
    carbonImpact,
    upiPayment,
    upiQrCode
  };
}
