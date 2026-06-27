'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { Quote } from '@/lib/types/quote';
import { SYSTEMS } from '@/lib/data/bom';
import { formatINR } from '@/lib/engine/calculator';
import { useCalculatorStore } from '@/lib/store/calculatorStore';
import { useSettings } from '@/lib/hooks/useSettings';

interface QuotePDFProps {
  quote: Quote;
  companyName?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
}

const DEFAULT_TERMS = [
  "This proposal is valid for the period stated. Post expiry, all prices subject to revision.",
  "Payment: 50% advance with order; 40% before dispatch; 10% on commissioning & handover.",
  "Installation within 15 working days of 50% advance. Commissioning within 45–60 days.",
  "Solar PV Modules: 12-year product warranty + 30-year linear power output warranty (min 80% at year 30).",
  "Inverter: 10-year manufacturer warranty. Extended AMC packages available.",
  "MMS: 5-year structural warranty on galvanization and workmanship.",
  "1-year free AMC post commissioning. Annual AMC packages available thereafter.",
  "Net metering application assistance provided. DISCOM approval timelines as per DISCOM.",
  "CFA/state subsidy documentation assistance. Subsidy credited directly to consumer by Govt.",
  "Proposal based on standard site conditions. Additional civil/structural work quoted separately.",
  "Force Majeure: Not liable for delays due to acts of God, government restrictions, or supply disruptions.",
  "Disputes subject to courts at registered office. Governed by Indian law.",
  "GST @ 8.9% blended (70%@5% + 30%@18%) per Govt. notification on solar equipment.",
  "Contractor maintains workmen's compensation and public liability insurance during installation.",
  "Binding only upon written acceptance and receipt of advance payment.",
  "STATE TERMS – KERALA:",
  "Comply with KSEB Net Metering Regulations 2014.",
  "ANERT-empanelled / KSEB-approved installer required.",
  "Kerala Electrical Inspector (EI) approval before grid connectivity.",
  "KSEB bi-directional net meter subject to KSEB approval timeline.",
  "PM Surya Ghar subsidy application post-commissioning. Timeline 60–90 days typically."
];

const DEFAULT_WHY_SOLAR = {
  benefits: [
    "Reduce electricity bills by 70–90%",
    "25-year system lifespan",
    "Protection against rising tariffs",
    "Earn via net metering & grid export",
    "Increases property value",
    "Zero carbon emissions"
  ],
  reasons: [
    "MNRE Empanelled EPC Contractor",
    "13+ Years in Solar Energy Sector",
    "5500+ Solar Projects Commissioned",
    "25+ MW Aggregate Capacity commissioned",
    "Full DISCOM & net metering support",
    "ISO 9001:2015 certified"
  ],
  warranties: [
    "25-year panel power output warranty",
    "5–10 year inverter manufacturer warranty",
    "10-year structural warranty on MMS",
    "2-year workmanship warranty",
    "MNRE certified Tier-1 equipment",
    "BIS / IEC 61215 certified"
  ],
  promises: [
    "Dedicated project manager assigned",
    "Proactive DISCOM support",
    "Commissioning & handover report",
    "Annual performance monitoring",
    "Responsive WhatsApp & call support",
    "+91-81 380 27336"
  ]
};

// ─── Page count ─────────────────────────────────────────────────────────────────
const TOTAL_PAGES = 10;

export function QuotePDF({
  quote,
  companyName = 'ENERMASS Solar',
  companyAddress = '',
  companyPhone = '',
  companyEmail = '',
}: QuotePDFProps) {
  const [mounted, setMounted] = useState(false);
  const [pageHtmls, setPageHtmls] = useState<string[]>([]);
  const [cssLoaded, setCssLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { settings: equipmentSettings } = useSettings();
  const dbSystems = useCalculatorStore((s) => s.dbSystems);
  const dbLoaded = useCalculatorStore((s) => s.dbLoaded);
  const dbPanels = useCalculatorStore((s) => s.dbPanels);
  const dbInverters = useCalculatorStore((s) => s.dbInverters);
  const dbBatteries = useCalculatorStore((s) => s.dbBatteries);

  useEffect(() => setMounted(true), []);

  // ─── System / Equipment lookups ───────────────────────────────────────────────
  const systemsList = dbLoaded && dbSystems.length > 0 ? dbSystems : SYSTEMS;
  let system = systemsList.find((s) => s.id === quote.systemId);
  if (!system) {
    system = equipmentSettings?.customSystems?.find((s: { id: string }) => s.id === quote.systemId);
  }

  const calc = quote.calculations;

  const quoteDate = new Date(quote.createdAt).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
  const quoteDateShort = new Date(quote.createdAt).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
  const validity = new Date(new Date(quote.createdAt).getTime() + 30 * 86400000).toLocaleDateString(
    'en-IN', { day: '2-digit', month: 'long', year: 'numeric' },
  );

  const allPanels = useMemo(() => {
    const base = dbLoaded && dbPanels.length > 0 ? dbPanels : [];
    const rateOverrides = equipmentSettings?.currentEquipmentRates?.panels ?? {};
    return [...base, ...(equipmentSettings?.customPanels ?? [])].map((panel) => ({
      ...panel, ratePerWatt: rateOverrides[panel.id] ?? panel.ratePerWatt,
    }));
  }, [dbLoaded, dbPanels, equipmentSettings]);

  const allInverters = useMemo(() => {
    const base = dbLoaded && dbInverters.length > 0 ? dbInverters : [];
    const rateOverrides = equipmentSettings?.currentEquipmentRates?.inverters ?? {};
    return [...base, ...(equipmentSettings?.customInverters ?? [])].map((inverter) => ({
      ...inverter, rate: rateOverrides[inverter.id] ?? inverter.rate,
    }));
  }, [dbLoaded, dbInverters, equipmentSettings]);

  const allBatteries = useMemo(() => {
    const base = dbLoaded && dbBatteries.length > 0 ? dbBatteries : [];
    const rateOverrides = equipmentSettings?.currentEquipmentRates?.batteries ?? {};
    return [...base, ...(equipmentSettings?.customBatteries ?? [])].map((battery) => ({
      ...battery, rate: rateOverrides[battery.id] ?? battery.rate,
    }));
  }, [dbLoaded, dbBatteries, equipmentSettings]);

  const panelEntries = (quote.equipment.panelMix ?? []).map((entry) => {
    const panel = allPanels.find((p) => p.id === entry.panelBrandId);
    return { name: panel ? `${panel.brand} ${panel.model}` : entry.panelBrandId, qty: entry.qty, wattage: panel?.wattage_w ?? (panel as any)?.wattage ?? 0 };
  });

  const inverterEntries = (quote.equipment.inverterMix ?? []).map((entry) => {
    const inv = allInverters.find((i) => i.id === entry.inverterBrandId);
    return { name: inv ? `${inv.brand} ${inv.model}` : entry.inverterBrandId, qty: entry.qty, capacityKW: inv?.capacity_kw ?? (inv as any)?.capacityKW ?? 0 };
  });

  const batteryEntries = (quote.equipment.batteryMix ?? []).map((entry) => {
    const bat = allBatteries.find((b) => b.id === entry.batteryBrandId);
    return { name: bat ? `${bat.brand} ${bat.model}` : entry.batteryBrandId, qty: entry.qty, capacityKWh: bat?.capacity_kwh ?? (bat as any)?.capacityKWh ?? 0 };
  });

  const totalPanelWattage = panelEntries.reduce((sum, e) => sum + e.wattage * e.qty, 0);
  const totalInverterKW = inverterEntries.reduce((sum, e) => sum + e.capacityKW * e.qty, 0);
  const capacityKWp = system?.capacityKW ?? (totalPanelWattage / 1000);

  const annualSavings = calc.annualSavingsINR;
  const twentyFiveYearSavings = annualSavings * 25 * 0.85;
  const co2OffsetKg = calc.annualGenerationKWh * 0.82;
  const co2OffsetTons = co2OffsetKg / 1000;

  const cashFlow = useMemo(() => {
    const cf = [];
    let gen = calc.annualGenerationKWh;
    let benefit = calc.annualSavingsINR;
    let cumulative = 0;
    const netInvestment = calc.beneficiaryContribution;
    for (let y = 1; y <= 10; y++) {
      if (y > 1) { gen = gen * 0.992; benefit = benefit * 1.04; }
      cumulative += benefit;
      cf.push({ year: y, generation: Math.round(gen), benefit: Math.round(benefit), cumulative: Math.round(cumulative), netAfter: Math.round(cumulative - netInvestment) });
    }
    return cf;
  }, [calc.annualGenerationKWh, calc.annualSavingsINR, calc.beneficiaryContribution]);

  const breakevenYear = useMemo(() => cashFlow.find(cf => cf.netAfter >= 0)?.year || 6, [cashFlow]);
  const roiPercent = useMemo(() => {
    const ni = calc.beneficiaryContribution;
    return ni <= 0 ? 0 : Math.round(((twentyFiveYearSavings - ni) / ni) * 100);
  }, [twentyFiveYearSavings, calc.beneficiaryContribution]);

  // Customizable variables with fallbacks
  const dbCompanyCin = quote.company_cin || 'U74999KL2018PTC053947';
  const dbCompanyGstin = quote.company_gstin || '32AAFCE1087R1ZA';
  const dbCompanyPan = quote.company_pan || 'AAFCE1087R';
  const dbCompanyPhone = quote.company_phone || '+91-81 380 27336';
  const dbCompanyEmail = quote.company_email || 'info@enermass.in';
  const dbCompanyWebsite = quote.company_website || 'www.enermass.in';
  const dbCompanyAddress = quote.company_address || 'First Floor, AVM Complex, Chirangara Koratty Post, Thrissur, Kerala - 680 308';
  const dbCeoName = quote.ceo_name || 'Mr. Manoj M S';
  const dbCeoDesignation = quote.ceo_designation || 'Chief Executive Officer';
  const dbCeoSignatureUrl = quote.ceo_signature_url || '';
  const dbSalesExecName = quote.sales.execName || 'Gigit Antony';
  const dbSalesExecRole = quote.sales_exec_role || 'Sales Manager';
  const dbSalesExecPhone = quote.sales_exec_phone || '7594933374';
  const dbBankAccountHolder = quote.bank_account_holder || 'Enermass Power Solutions Pvt. Ltd.';
  const dbBankName = quote.bank_name || 'Bank of Baroda, Koratty';
  const dbBankAccountNo = quote.bank_account_no || '85080200000055';
  const dbBankIfsc = quote.bank_ifsc || 'BARB0KORATT';
  const dbBankUpiId = quote.bank_upi_id || 'enermass@barodampay';
  const terms = quote.terms_json || DEFAULT_TERMS;
  const whySolar = quote.why_solar_json || DEFAULT_WHY_SOLAR;

  const customerName = quote.customer.name || 'Customer';
  const customerState = quote.address.state || quote.selectedState || 'Kerala';
  const customerType = quote.projectType === 'commercial' ? 'Commercial' : 'Residential';

  const formattedPanels = panelEntries.map(p => `${p.name} (${p.wattage}Wp) × ${p.qty} Nos`).join(', ') || `${totalPanelWattage / 1000} kWp Panel Array`;
  const formattedInverters = inverterEntries.map(i => `${i.name} (${i.capacityKW}kW) × ${i.qty} Nos`).join(', ') || `${totalInverterKW} kW On-Grid Inverter`;

  const paybackYears = calc.beneficiaryContribution > 0 ? (calc.beneficiaryContribution / annualSavings).toFixed(1) : '0';

  // ─── Load CSS ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mounted) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/print/pages/quote.css';
    link.id = 'quote-pdf-css';
    document.head.appendChild(link);
    link.onload = () => setCssLoaded(true);
    return () => {
      const el = document.getElementById('quote-pdf-css');
      if (el) el.remove();
    };
  }, [mounted]);

  // ─── Fetch page HTML files ────────────────────────────────────────────────────
  useEffect(() => {
    if (!mounted) return;
    Promise.all(
      Array.from({ length: TOTAL_PAGES }, (_, i) =>
        fetch(`/print/pages/page_${i + 1}.html`).then(r => r.text())
      )
    ).then(htmls => setPageHtmls(htmls));
  }, [mounted]);

  // ─── DOM-based dynamic field replacement ──────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || pageHtmls.length === 0 || !cssLoaded) return;

    const root = containerRef.current;

    // Helper: find text div by its text content on a specific page
    const findTextDiv = (pageIdx: number, textMatch: string): HTMLElement | null => {
      const page = root.querySelector(`#pf${pageIdx + 1}`);
      if (!page) return null;
      const divs = page.querySelectorAll('.t');
      for (const div of divs) {
        if (div.textContent?.includes(textMatch)) return div as HTMLElement;
      }
      return null;
    };

    // Helper: find ALL text divs matching a text pattern on a page
    const findAllTextDivs = (pageIdx: number, textMatch: string): HTMLElement[] => {
      const page = root.querySelector(`#pf${pageIdx + 1}`);
      if (!page) return [];
      const divs = page.querySelectorAll('.t');
      const results: HTMLElement[] = [];
      for (const div of divs) {
        if (div.textContent?.includes(textMatch)) results.push(div as HTMLElement);
      }
      return results;
    };

    // Helper: replace text content keeping the div structure
    const replaceText = (div: HTMLElement, newText: string) => {
      // Clear all children and set plain text
      div.textContent = newText;
    };

    // ═══ PAGE 1: Cover Page ═══
    // Quote ID
    const quoteIdDiv = findTextDiv(0, 'EPS-COKL');
    if (quoteIdDiv) replaceText(quoteIdDiv, quote.quoteId);

    // Date
    const dateDiv = findTextDiv(0, 'Date:');
    if (dateDiv) replaceText(dateDiv, `Date: ${quoteDate}`);

    // Valid date
    const validDiv = findTextDiv(0, 'Valid:');
    if (validDiv) replaceText(validDiv, `Valid: ${validity}`);

    // Customer name (appears in the tags row)
    const linjithDivs1 = findAllTextDivs(0, 'Linjith');
    linjithDivs1.forEach(d => replaceText(d, customerName));

    // State
    const keralaDivs1 = findAllTextDivs(0, 'Kerala');
    keralaDivs1.forEach(d => {
      const txt = d.textContent || '';
      if (txt.trim() === 'Kerala') replaceText(d, customerState);
      else d.textContent = txt.replace(/Kerala/g, customerState);
    });

    // Customer type
    const resDivs1 = findAllTextDivs(0, 'Residential');
    resDivs1.forEach(d => {
      const txt = d.textContent || '';
      if (txt.trim() === 'Residential') replaceText(d, customerType);
      else d.textContent = txt.replace(/Residential/g, customerType);
    });

    // System capacity
    const kwpDivs1 = findAllTextDivs(0, '3 kWp');
    kwpDivs1.forEach(d => {
      const txt = d.textContent || '';
      d.textContent = txt.replace(/3 kWp/g, `${capacityKWp} kWp`);
    });

    // Annual savings value
    const savingsDivs = findAllTextDivs(0, '27,544');
    savingsDivs.forEach(d => {
      d.textContent = (d.textContent || '').replace(/₹?\s*27,544/g, formatINR(annualSavings));
    });

    // Payback years
    const paybackDivs = findAllTextDivs(0, '8.7');
    paybackDivs.forEach(d => {
      const txt = d.textContent || '';
      if (txt.includes('Years') || txt.includes('8.7')) {
        d.textContent = txt.replace(/8\.7/g, paybackYears);
      }
    });

    // 25-year returns
    const returnsDivs = findAllTextDivs(0, '4,86');
    returnsDivs.forEach(d => {
      d.textContent = (d.textContent || '').replace(/₹?\s*4,86,\d+/g, formatINR(twentyFiveYearSavings));
    });

    // CO2
    const co2Divs = findAllTextDivs(0, '3.57');
    co2Divs.forEach(d => {
      d.textContent = (d.textContent || '').replace(/3\.57/g, co2OffsetTons.toFixed(2));
    });

    // ═══ PAGE 2: Introduction Letter ═══
    // Customer name
    const linjithDivs2 = findAllTextDivs(1, 'Linjith');
    linjithDivs2.forEach(d => {
      d.textContent = (d.textContent || '').replace(/Mr\.\s*Linjith|Linjith/g, customerName);
    });

    // Quote reference on page 2
    const refDivs2 = findAllTextDivs(1, '002992627');
    refDivs2.forEach(d => {
      d.textContent = (d.textContent || '').replace(/EPS-COKL-002992627/g, quote.quoteId);
    });

    // Date on page 2
    const dateDivs2 = findAllTextDivs(1, 'June');
    dateDivs2.forEach(d => {
      const txt = d.textContent || '';
      // Replace various date formats
      d.textContent = txt
        .replace(/June\s*\d+,?\s*\d*/g, quoteDate)
        .replace(/\d+\s+June\s+\d+/g, quoteDate);
    });

    // System capacity on page 2
    const kwpDivs2 = findAllTextDivs(1, '3 kWp');
    kwpDivs2.forEach(d => {
      d.textContent = (d.textContent || '').replace(/3\s*kWp/g, `${capacityKWp} kWp`);
    });

    // CEO name
    const manojDivs = findAllTextDivs(1, 'Manoj');
    manojDivs.forEach(d => {
      d.textContent = (d.textContent || '').replace(/Mr\.\s*Manoj\s*M\s*S|Manoj/g, dbCeoName);
    });

    // Sales exec
    const gigitDivs2 = findAllTextDivs(1, 'Gigit');
    gigitDivs2.forEach(d => {
      d.textContent = (d.textContent || '').replace(/Gigit\s*Antony|Gigit/g, dbSalesExecName);
    });

    // Sales exec phone
    const salesPhoneDivs = findAllTextDivs(1, '7594933374');
    salesPhoneDivs.forEach(d => {
      d.textContent = (d.textContent || '').replace(/7594933374/g, dbSalesExecPhone);
    });

    // Kerala on page 2
    findAllTextDivs(1, 'Kerala').forEach(d => {
      d.textContent = (d.textContent || '').replace(/Kerala/g, customerState);
    });

    // ═══ PAGE 3: Company & Customer Profile ═══
    findAllTextDivs(2, 'Linjith').forEach(d => {
      d.textContent = (d.textContent || '').replace(/Mr\.\s*Linjith|Linjith/g, customerName);
    });
    findAllTextDivs(2, 'Kerala').forEach(d => {
      d.textContent = (d.textContent || '').replace(/Kerala/g, customerState);
    });
    findAllTextDivs(2, 'Residential').forEach(d => {
      d.textContent = (d.textContent || '').replace(/Residential/g, customerType);
    });
    findAllTextDivs(2, 'U74999').forEach(d => {
      d.textContent = (d.textContent || '').replace(/U74999KL2018PTC053947/g, dbCompanyCin);
    });
    findAllTextDivs(2, 'AAFCE').forEach(d => {
      const txt = d.textContent || '';
      if (txt.includes('32AAFCE')) d.textContent = txt.replace(/32AAFCE1087R1ZA/g, dbCompanyGstin);
      else if (txt.includes('AAFCE1087R')) d.textContent = txt.replace(/AAFCE1087R/g, dbCompanyPan);
    });
    findAllTextDivs(2, 'Koratty').forEach(d => {
      d.textContent = (d.textContent || '').replace(/First Floor.*680\s*308/g, dbCompanyAddress);
    });

    // ═══ PAGE 4: System Design ═══
    findAllTextDivs(3, '3 kWp').forEach(d => {
      d.textContent = (d.textContent || '').replace(/3\s*kWp/g, `${capacityKWp} kWp`);
    });

    // ═══ PAGE 6: Cash Flow ═══
    findAllTextDivs(5, '3 kWp').forEach(d => {
      d.textContent = (d.textContent || '').replace(/3\s*kWp/g, `${capacityKWp} kWp`);
    });
    findAllTextDivs(5, 'Residential').forEach(d => {
      d.textContent = (d.textContent || '').replace(/Residential/g, customerType);
    });

    // ═══ PAGE 7: Net Metering ═══
    findAllTextDivs(6, 'Kerala').forEach(d => {
      d.textContent = (d.textContent || '').replace(/Kerala/g, customerState);
    });

    // ═══ PAGE 8: Project Execution ═══
    findAllTextDivs(7, 'Kerala').forEach(d => {
      d.textContent = (d.textContent || '').replace(/Kerala/g, customerState);
    });

    // ═══ PAGE 9: Bank Details ═══
    findAllTextDivs(8, '85080200000055').forEach(d => {
      d.textContent = (d.textContent || '').replace(/85080200000055/g, dbBankAccountNo);
    });
    findAllTextDivs(8, 'BARB0').forEach(d => {
      d.textContent = (d.textContent || '').replace(/BARB0KORATT/g, dbBankIfsc);
    });
    findAllTextDivs(8, 'bank of Baroda').forEach(d => {
      d.textContent = (d.textContent || '').replace(/bank of Baroda, Koratty/g, dbBankName);
    });
    findAllTextDivs(8, 'Enermass Power Solutions').forEach(d => {
      d.textContent = (d.textContent || '').replace(/Enermass Power Solutions Pvt\. Ltd\./g, dbBankAccountHolder);
    });

    // ═══ PAGE 10: Customer Acceptance ═══
    findAllTextDivs(9, 'Linjith').forEach(d => {
      d.textContent = (d.textContent || '').replace(/Mr\.\s*Linjith|Linjith/g, customerName);
    });
    findAllTextDivs(9, '002992627').forEach(d => {
      d.textContent = (d.textContent || '').replace(/EPS-COKL-002992627/g, quote.quoteId);
    });
    findAllTextDivs(9, 'Gigit').forEach(d => {
      d.textContent = (d.textContent || '').replace(/Gigit\s*Antony|Gigit/g, dbSalesExecName);
    });
    findAllTextDivs(9, 'Sales Manager').forEach(d => {
      d.textContent = (d.textContent || '').replace(/Sales Manager/g, dbSalesExecRole);
    });
    findAllTextDivs(9, 'Valid').forEach(d => {
      d.textContent = (d.textContent || '').replace(/Valid:\s*\d+\s*[A-Za-z]+\s*\d+/g, `Valid: ${validity}`);
    });

    // Signature overlay on Page 2 (cover letter)
    if (dbCeoSignatureUrl) {
      const pc2 = root.querySelector('.pc2');
      if (pc2) {
        let sigImg = pc2.querySelector('.custom-ceo-signature');
        if (!sigImg) {
          sigImg = document.createElement('img');
          sigImg.className = 'custom-ceo-signature';
          sigImg.setAttribute('style', 'position: absolute; left: 45px; top: 1010px; width: 140px; height: 60px; object-fit: contain; z-index: 10;');
          pc2.appendChild(sigImg);
        }
        (sigImg as HTMLImageElement).src = dbCeoSignatureUrl;
      }
    }

  }, [pageHtmls, cssLoaded, quote, customerName, customerState, customerType,
      capacityKWp, annualSavings, paybackYears, twentyFiveYearSavings,
      co2OffsetTons, quoteDate, validity, dbCeoName, dbSalesExecName,
      dbSalesExecPhone, dbCompanyCin, dbCompanyGstin, dbCompanyPan,
      dbCompanyAddress, dbBankAccountNo, dbBankIfsc, dbBankName, dbBankAccountHolder,
      dbSalesExecRole, dbCeoSignatureUrl]);

  // ─── Render ───────────────────────────────────────────────────────────────────
  if (!mounted) return null;

  // Combine all page HTML into a single string
  const combinedHtml = pageHtmls.length > 0
    ? pageHtmls.join('\n')
    : '<div style="padding:40px;text-align:center;color:#666">Loading quotation pages...</div>';

  return createPortal(
    <div
      className="print-only"
      id="quote-pdf"
      ref={containerRef}
      style={{ margin: 0, padding: 0 }}
    >
      <style>{`
        /* Print styles for pdf2htmlEX pages */
        @media screen {
          #quote-pdf {
            position: fixed;
            left: -99999px;
            top: 0;
            z-index: -1;
            pointer-events: none;
          }
        }
        @media print {
          /* Hide everything except the quote */
          body > *:not(#quote-pdf) { display: none !important; }
          #quote-pdf {
            position: static !important;
            left: auto !important;
            z-index: auto !important;
            pointer-events: auto !important;
          }
          #quote-pdf #page-container {
            background: none !important;
          }
          #quote-pdf .pf {
            margin: 0 !important;
            box-shadow: none !important;
            page-break-after: always;
            page-break-inside: avoid;
          }
          #quote-pdf .pf:last-child {
            page-break-after: auto;
          }
          @page {
            size: A4 portrait;
            margin: 0;
          }
        }
      `}</style>
      <div
        id="page-container"
        dangerouslySetInnerHTML={{ __html: combinedHtml }}
      />
    </div>,
    document.body
  );
}
