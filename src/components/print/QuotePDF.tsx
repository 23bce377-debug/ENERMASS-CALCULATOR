'use client';

import type { Quote } from '@/lib/types/quote';
import { SYSTEMS } from '@/lib/data/bom';
import { formatINR } from '@/lib/engine/calculator';

/**
 * QuotePDF — Print-only professional quote layout.
 * Hidden on screen via `.print-only` class.
 * Visible when window.print() is invoked.
 * Designed for A4 paper, 2 pages max.
 */

interface QuotePDFProps {
  quote: Quote;
  companyName?: string;
  companyAddress?: string;
}

export function QuotePDF({ quote, companyName = 'ENERMASS Solar', companyAddress = '' }: QuotePDFProps) {
  // Look up system from both built-in and custom systems
  let system = SYSTEMS.find((s) => s.id === quote.systemId);
  if (!system && typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem('enermass-settings');
      if (raw) {
        const settings = JSON.parse(raw);
        system = settings.customSystems?.find((s: { id: string }) => s.id === quote.systemId);
      }
    } catch {}
  }
  const calc = quote.calculations;
  const validity = new Date(new Date(quote.createdAt).getTime() + 30 * 86400000)
    .toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div className="print-only" id="quote-pdf">
      {/* ═══ PAGE 1 ═══ */}
      <div className="pdf-page">
        {/* Header */}
        <div className="pdf-header">
          <div className="pdf-logo">
            <div className="pdf-logo-icon">☀</div>
            <div>
              <div className="pdf-brand">{companyName}</div>
              <div className="pdf-tagline">Solar Energy Solutions</div>
            </div>
          </div>
          <div className="pdf-meta">
            <div className="pdf-meta-row"><span>Quote ID:</span><strong>{quote.quoteId}</strong></div>
            <div className="pdf-meta-row"><span>Date:</span><strong>{quote.date}</strong></div>
            <div className="pdf-meta-row"><span>Valid Until:</span><strong>{validity}</strong></div>
          </div>
        </div>

        <div className="pdf-divider" />

        {/* Customer & Address */}
        <div className="pdf-two-col">
          <div className="pdf-info-block">
            <div className="pdf-section-label">Customer Information</div>
            <div className="pdf-info-row"><span>Name:</span><strong>{quote.customer.name}</strong></div>
            <div className="pdf-info-row"><span>Phone:</span>{quote.customer.phone}</div>
            <div className="pdf-info-row"><span>WhatsApp:</span>{quote.customer.whatsapp}</div>
            <div className="pdf-info-row"><span>Email:</span>{quote.customer.email}</div>
          </div>
          <div className="pdf-info-block">
            <div className="pdf-section-label">Installation Address</div>
            <div className="pdf-info-row">{quote.address.line1}</div>
            {quote.address.line2 && <div className="pdf-info-row">{quote.address.line2}</div>}
            <div className="pdf-info-row">{quote.address.city}, {quote.address.state} — {quote.address.pin}</div>
            <div className="pdf-info-row"><span>Roof:</span>{quote.site.roofType} · {quote.site.roofArea} sq ft</div>
          </div>
        </div>

        {/* System Summary */}
        <div className="pdf-section-label" style={{ marginTop: '16px' }}>System Summary</div>
        <table className="pdf-table">
          <tbody>
            <tr><td>System</td><td><strong>{quote.systemName}</strong></td><td>Category</td><td>{quote.category}</td></tr>
            <tr><td>Capacity</td><td>{system?.capacityKW ?? '—'} kW</td><td>Panels</td><td>{system?.panelQty ?? '—'} × {system?.panelWattage ?? ''}W</td></tr>
            <tr><td>State</td><td>{quote.selectedState}</td><td>Project</td><td>{quote.projectType}</td></tr>
          </tbody>
        </table>

        {/* BOM Table */}
        <div className="pdf-section-label" style={{ marginTop: '16px' }}>Bill of Materials</div>
        <table className="pdf-table pdf-bom">
          <thead>
            <tr>
              <th>#</th>
              <th>Description</th>
              <th>Qty</th>
              <th>Rate</th>
              <th>GST</th>
              <th style={{ textAlign: 'right' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {calc.lines.map((line, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td>{line.description}</td>
                <td>{line.effectiveQty}</td>
                <td>{formatINR(line.effectiveRate)}</td>
                <td>{(line.effectiveGstPct * 100).toFixed(0)}%</td>
                <td style={{ textAlign: 'right' }}>{formatINR(line.lineSubTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ═══ PAGE 2 ═══ */}
      <div className="pdf-page pdf-page-break">
        {/* Pricing Summary */}
        <div className="pdf-section-label">Pricing Summary</div>
        <table className="pdf-table">
          <tbody>
            <tr><td>Cost Before GST</td><td style={{ textAlign: 'right' }}>{formatINR(calc.costBeforeGST)}</td></tr>
            <tr><td>Margin ({(calc.effectiveMarginPct * 100).toFixed(1)}%)</td><td style={{ textAlign: 'right' }}>{formatINR(calc.marginAmount)}</td></tr>
            <tr><td>MRP (excl GST)</td><td style={{ textAlign: 'right' }}>{formatINR(calc.mrpExclGST)}</td></tr>
            <tr><td>Output GST ({(calc.gstOutputRate * 100).toFixed(1)}%)</td><td style={{ textAlign: 'right' }}>{formatINR(calc.mrpInclGST - calc.mrpExclGST)}</td></tr>
            <tr><td><strong>MRP (incl GST)</strong></td><td style={{ textAlign: 'right' }}><strong>{formatINR(calc.mrpInclGST)}</strong></td></tr>
            {calc.discountAmount > 0 && <tr><td>Discount</td><td style={{ textAlign: 'right', color: '#22c55e' }}>−{formatINR(calc.discountAmount)}</td></tr>}
            {calc.additionalCostTotal > 0 && <tr><td>Additional Costs</td><td style={{ textAlign: 'right' }}>+{formatINR(calc.additionalCostTotal)}</td></tr>}
            <tr className="pdf-highlight-row"><td><strong>Final Customer Price</strong></td><td style={{ textAlign: 'right' }}><strong>{formatINR(calc.finalCustomerPrice)}</strong></td></tr>
            {calc.subsidyAmount > 0 && <tr><td>Govt. Subsidy</td><td style={{ textAlign: 'right', color: '#22c55e' }}>−{formatINR(calc.subsidyAmount)}</td></tr>}
            <tr className="pdf-highlight-row"><td><strong>YOU PAY (after subsidy)</strong></td><td style={{ textAlign: 'right' }}><strong>{formatINR(calc.beneficiaryContribution)}</strong></td></tr>
          </tbody>
        </table>

        {/* Energy Generation */}
        <div className="pdf-section-label" style={{ marginTop: '20px' }}>Energy Generation & Savings</div>
        <table className="pdf-table">
          <tbody>
            <tr><td>Daily Generation</td><td style={{ textAlign: 'right' }}>{calc.dailyGenerationKWh.toFixed(1)} kWh</td></tr>
            <tr><td>Monthly Generation</td><td style={{ textAlign: 'right' }}>{calc.monthlyGenerationKWh.toFixed(0)} kWh</td></tr>
            <tr><td>Annual Generation</td><td style={{ textAlign: 'right' }}>{calc.annualGenerationKWh.toFixed(0)} kWh</td></tr>
            <tr><td>Monthly Savings</td><td style={{ textAlign: 'right' }}>{formatINR(calc.monthlySavingsINR)}</td></tr>
            <tr><td>Annual Savings</td><td style={{ textAlign: 'right' }}>{formatINR(calc.annualSavingsINR)}</td></tr>
            <tr><td><strong>Estimated Payback</strong></td><td style={{ textAlign: 'right' }}><strong>{calc.paybackYears === Infinity ? 'N/A' : `${calc.paybackYears.toFixed(1)} years`}</strong></td></tr>
          </tbody>
        </table>

        {/* Terms */}
        <div className="pdf-section-label" style={{ marginTop: '20px' }}>Terms & Conditions</div>
        <ol className="pdf-terms">
          <li>This quotation is valid for 30 days from the date of issue.</li>
          <li>Prices are subject to change based on material availability and market conditions.</li>
          <li>Government subsidy is subject to approval from the respective state DISCOM/MNRE.</li>
          <li>Installation timeline: 7–15 working days after order confirmation and site readiness.</li>
          <li>Warranty: Panels — 25 years performance; Inverter — 5 years; Workmanship — 5 years.</li>
          <li>Payment terms: 50% advance, 50% upon commissioning.</li>
          <li>Net metering application and DISCOM approvals will be assisted by {companyName}.</li>
          <li>Any structural modifications required will be charged separately after site survey.</li>
        </ol>

        {/* Signature */}
        <div className="pdf-signature">
          <div className="pdf-sig-block">
            <div className="pdf-sig-line" />
            <div>Customer Signature</div>
            <div className="pdf-sig-name">{quote.customer.name}</div>
          </div>
          <div className="pdf-sig-block">
            <div className="pdf-sig-line" />
            <div>Authorized Signatory</div>
            <div className="pdf-sig-name">{companyName}</div>
          </div>
        </div>

        {/* Footer */}
        <div className="pdf-footer">
          {companyName} {companyAddress ? `· ${companyAddress}` : ''} · Quote {quote.quoteId}
        </div>
      </div>
    </div>
  );
}
