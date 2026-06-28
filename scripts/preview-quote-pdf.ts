import fs from 'fs/promises';
import path from 'path';
import Handlebars from 'handlebars';
import '../src/lib/pdf/helpers'; // Register custom helpers
import { renderHtmlToPdf } from '../src/lib/pdf/renderPdf';

const MOCK_VIEW_MODEL = {
  company: {
    name: 'Enermass Power Solutions Pvt. Ltd.',
    tagline: 'INTEGRATED SOLAR AND POWER ENGINEERING SOLUTIONS',
    address: 'First Floor, AVM Complex · Chirangara Koratty Post · Thrissur, Kerala – 680 308',
    phone: '+91-81 380 27336',
    email: 'info@enermass.in',
    website: 'www.enermass.in',
    cin: 'U74999KL2018PTC053947',
    gstNumber: '32AAFCE1087R1ZA',
    panNumber: 'AAFCE1087R',
    ceoName: 'Mr. Manoj M S',
    ceoTitle: 'Chief Executive Officer',
    ceoSignatureUrl: null
  },
  customer: {
    name: 'Mr. Linjith',
    phone: '9876543210',
    whatsapp: '9876543210',
    email: 'linjith@example.com',
    category: 'Residential',
    state: 'Kerala',
    city: 'Nellayi',
    pin: '680301',
    billingAddress: 'Nellayi House, Nellayi P.O., Thrissur, Kerala - 680301',
    siteAddress: 'Nellayi House, Nellayi P.O., Thrissur, Kerala - 680301',
    discomName: 'KSEB (Kerala State Electricity Board)',
    meterNo: 'KSEB-1002345',
    sanctionedLoad: 3,
    monthlyBill: 3500,
    roofArea: 360
  },
  proposal: {
    reference: 'EPS-COKL-002992627',
    date: new Date().toISOString(),
    validUntil: new Date(Date.now() + 30 * 86400 * 1000).toISOString()
  },
  system: {
    capacityKW: 3.0,
    monthlyGeneration: 360,
    annualGeneration: 4380,
    typeLabel: 'Grid-Connected Rooftop Solar Power Plant — Net Metering',
    totalProjectCost: 218000,
    beneficiaryContribution: 140000,
    subsidyAmount: 78000,
    panelsUsed: 'Tec-N-type TOPCON Bifacial Mono 610 Wp (5 Nos)',
    invertersUsed: 'On-Grid String Inverter (1 Lot)',
    structureUsed: 'Galvanized Iron (GI) Structure designed for 150 km/h wind loads'
  },
  salesContact: {
    name: 'Gigit Antony',
    role: 'Sales Manager',
    phone: '7594933374'
  },
  bank: {
    accountHolder: 'Enermass Power Solutions Pvt. Ltd.',
    bankName: 'Bank of Baroda, Koratty',
    accountNo: '85080200000055',
    ifsc: 'BARB0KORATT',
    upiId: 'enermass@barodampay'
  },
  paymentMilestones: {
    advance: 70000,
    delivery: 56000,
    commissioning: 14000
  },
  terms: [
    "This proposal is valid for 30 days from the date of issue. Post expiry, all prices are subject to revision.",
    "Payment milestones: 50% advance booking, 40% before material dispatch, 10% on grid commissioning & handover.",
    "Installation completes within 15 working days from advance payment. Commissioning subject to DISCOM clearances (approx 30-45 days).",
    "Solar PV Modules carry a 12-year product warranty and a 30-year linear performance output warranty.",
    "Inverter carries a 10-year manufacturer warranty. Structural mounting MMS carries a 5-year warranty.",
    "Includes 1-year free AMC post commissioning. Net metering application liaison support is provided by Enermass.",
    "State Terms - Kerala: Installation complies with KSEB Net Metering Regulations 2014, ANERT/KSEBL empanelment, and requires Electrical Inspectorate approval."
  ],
  equipmentSpecs: [
    {
      label: 'A. Solar PV Modules',
      name: 'Adani / Waaree / V Guard / Panasonic, 610 Wp × 5 Nos',
      details: 'Tec-N-type TOPCON Bifacial Mono. Efficiency: ~21.5% -22.4%. Bifacil Gain~30% Low Degradation Y1~1%,After~0.4%. Product Warranty 10-12Y ,Performance Warranty 30Y'
    },
    {
      label: 'B. Inverter',
      name: 'On-Grid String Inverter | Deye-5 — 5Kw',
      details: 'On-Grid (Grid-Tied) String Inverter Maximum Efficiency ≥ 97.5% Total Harmonic Distortion (THD) < 3% .Warranty Minimum 10 years'
    },
    {
      label: 'C. Module Mounting Structure (MMS)',
      name: 'Module Mounting Structure (MMS) Make-Appolo GI',
      details: 'Module Mounting Structure (MMS) GI.'
    }
  ],
  bomGroups: [
    {
      groupLabel: 'A. SOLAR PV MODULES',
      items: [
        { lineNo: '01', description: 'Solar PV Module', specification: 'Tec-N-type TOPCON Bifacial Mono. Efficiency: ~21.5% -22.4%. Bifacil Gain~30% Low Degradation Y1~1%,After~0.4%. Product Warranty 10-12Y ,Performance Warranty 30Y', qty: 5, unit: 'Nos' }
      ]
    },
    {
      groupLabel: 'B. INVERTER',
      items: [
        { lineNo: '02', description: 'On-Grid String Inverter', specification: 'On-Grid (Grid-Tied) String Inverter Maximum Efficiency ≥ 97.5% Total Harmonic Distortion (THD) < 3% .Warranty Minimum 10 years', qty: 1, unit: 'Lot' }
      ]
    },
    {
      groupLabel: 'C. MODULE MOUNTING STRUCTURE',
      items: [
        { lineNo: '03', description: 'Module Mounting Structure (MMS) Make-Appolo GI', specification: 'Module Mounting Structure (MMS) GI.', qty: 1, unit: 'Lot' }
      ]
    },
    {
      groupLabel: 'D. DC ELECTRICAL',
      items: [
        { lineNo: '04', description: 'DC Cables – 4 sqmm UV Resistant Solar Cable- Polycab, Havells, Lumicon', specification: 'TÜV certified, double insulation, UV-resistant, 1500V DC, IS:694', qty: 24, unit: 'Meters' },
        { lineNo: '05', description: 'DC Distribution Box (DCDB) with SPD', specification: 'IP65, MC4 connectors, DC MCB, SPD Class II 1000V, fuse holder', qty: 1, unit: 'Set' }
      ]
    },
    {
      groupLabel: 'E. AC ELECTRICAL & PROTECTION',
      items: [
        { lineNo: '06', description: 'AC Cables Polycab, Havells, VGuard', specification: 'Multi-Stranded Flexible Cable', qty: 15, unit: 'Meters' },
        { lineNo: '07', description: 'AC Distribution Box (ACDB) with MCB', specification: 'IP65, , MCB,2P,4P, 32A, per system rating, 40kA SPD Class II', qty: 1, unit: 'Set' }
      ]
    },
    {
      groupLabel: 'F. EARTHING & LIGHTNING PROTECTION',
      items: [
        { lineNo: '08', description: 'Earthing Kit (Copper- Bonded Rod + Chemical)', specification: 'IS:3043, Copper bonded electrode', qty: 2, unit: 'Nos' },
        { lineNo: '09', description: 'Lightning Arrester with Down Conductor', specification: 'Class I+II combined, IS:3043,Multi Spike Copper Coated or Brass LA', qty: 1, unit: 'Set' }
      ]
    },
    {
      groupLabel: 'G. METERING & MONITORING',
      items: [
        { lineNo: '10', description: 'Solar Energy Meter', specification: 'DISCOM/CEIG approved, MID certified, IS:14697', qty: 1, unit: 'No' },
        { lineNo: '11', description: 'Remote Monitoring System – Wi-Fi/GSM Data Logger', specification: 'Real-time cloud dashboard, mobile app, alerts', qty: 1, unit: 'No' }
      ]
    },
    {
      groupLabel: 'H. CIVIL & INSTALLATION',
      items: [
        { lineNo: '12', description: 'Civil Work Foundation & Grouting', specification: 'As per structural drawings.', qty: 1, unit: 'Lot' },
        { lineNo: '13', description: 'Installation, Cable Tray & Conduit', specification: 'Skilled labour, safety PPE, Cable tray, ISI Wiring Conduit', qty: 1, unit: 'Lot' },
        { lineNo: '14', description: 'Commissioning, Testing & Handover', specification: 'String test, IR test, functional test, owner training', qty: 1, unit: 'Lot' }
      ]
    },
    {
      groupLabel: 'I. DOCUMENTATION & LIAISON',
      items: [
        { lineNo: '15', description: 'Bi-Directional Net Metering Application & DISCOM Liaison', specification: 'SLD, DPR, DISCOM application, follow-up till net meter commissioning', qty: 1, unit: 'Set' },
        { lineNo: '16', description: 'CFA / State Subsidy Documentation', specification: 'MNRE portal registration, subsidy application, bank linkage', qty: 1, unit: 'Set' }
      ]
    }
  ],
  cashFlow: [
    { year: 1, generation: '4,380', benefit: 24090, cumulative: 24090, netAfter: -115910, isPositive: false },
    { year: 2, generation: '4,345', benefit: 25054, cumulative: 49144, netAfter: -90856, isPositive: false },
    { year: 3, generation: '4,310', benefit: 26056, cumulative: 75200, netAfter: -64800, isPositive: false },
    { year: 4, generation: '4,276', benefit: 27098, cumulative: 102298, netAfter: -37702, isPositive: false },
    { year: 5, generation: '4,242', benefit: 28182, cumulative: 130480, netAfter: -9520, isPositive: false },
    { year: 6, generation: '4,208', benefit: 29309, cumulative: 159789, netAfter: 19789, isPositive: true },
    { year: 7, generation: '4,174', benefit: 30482, cumulative: 190271, netAfter: 50271, isPositive: true },
    { year: 8, generation: '4,141', benefit: 31701, cumulative: 221972, netAfter: 81972, isPositive: true },
    { year: 9, generation: '4,107', benefit: 32969, cumulative: 254941, netAfter: 114941, isPositive: true },
    { year: 10, generation: '4,075', benefit: 34288, cumulative: 289229, netAfter: 149229, isPositive: true }
  ],
  twentyFiveYearSavings: 511912,
  paybackYears: '5.2',
  roiPercent: 266,
  co2OffsetTons: 3.6,
  lifetimeCo2OffsetTons: 90.0,
  treesPlanted: 171,
  upiQrCode: `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent('upi://pay?pa=enermass@barodampay&pn=Enermass%20Power%20Solutions%20Pvt%20Ltd&am=70000&cu=INR')}`
};

async function generateLocalPreview() {
  console.log('[CLI Preview] Starting local PDF quote preview compilation...');
  
  try {
    const templatePath = path.join(process.cwd(), 'src', 'lib', 'pdf', 'templates', 'quote.hbs');
    console.log('[CLI Preview] Reading template from:', templatePath);
    const source = await fs.readFile(templatePath, 'utf-8');
    
    console.log('[CLI Preview] Compiling template with mock view model data...');
    const template = Handlebars.compile(source);
    const html = template(MOCK_VIEW_MODEL);
    
    // Save preview.html for easy browser inspection
    const htmlOutputPath = path.join(process.cwd(), 'preview.html');
    await fs.writeFile(htmlOutputPath, html, 'utf-8');
    console.log('[CLI Preview] Saved intermediate HTML file for layout inspection at:', htmlOutputPath);
    
    // Render PDF
    console.log('[CLI Preview] Launching Puppeteer to generate PDF buffer...');
    const pdfBuffer = await renderHtmlToPdf(html);
    
    // Save preview.pdf
    const pdfOutputPath = path.join(process.cwd(), 'preview.pdf');
    await fs.writeFile(pdfOutputPath, pdfBuffer);
    console.log('[CLI Preview] Successfully generated PDF preview at:', pdfOutputPath);
    
    console.log('[CLI Preview] Preview execution completed successfully!');
  } catch (err) {
    console.error('[CLI Preview] Compilation or rendering error:', err);
    process.exit(1);
  }
}

generateLocalPreview();
