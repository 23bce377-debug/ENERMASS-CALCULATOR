'use client';

import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import type { Quote } from '@/lib/types/quote';
import { SYSTEMS } from '@/lib/data/bom';
import { formatINR } from '@/lib/engine/calculator';
import { useCalculatorStore } from '@/lib/store/calculatorStore';

/**
 * QuotePDF — Professional customer-facing quote layout.
 * Hidden on screen via `.print-only` class.
 * Visible when window.print() is invoked.
 * 
 * DESIGN RULES:
 * - NO margin/profit information
 * - NO internal cost breakdowns (cost before GST, input GST, output GST)
 * - Only shows: equipment, total price, subsidy, net payable, and energy benefits
 * - Sleek, modern, easy-to-understand format
 */

interface QuotePDFProps {
  quote: Quote;
  companyName?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
}

export function QuotePDF({
  quote,
  companyName = 'ENERMASS Solar',
  companyAddress = '',
  companyPhone = '',
  companyEmail = '',
}: QuotePDFProps) {
  // Client-side mounting for portal
  const [mounted, setMounted] = useState(false);
  const dbSystems = useCalculatorStore((s) => s.dbSystems);
  const dbLoaded = useCalculatorStore((s) => s.dbLoaded);
  const dbPanels = useCalculatorStore((s) => s.dbPanels);
  const dbInverters = useCalculatorStore((s) => s.dbInverters);
  const dbBatteries = useCalculatorStore((s) => s.dbBatteries);

  useEffect(() => setMounted(true), []);

  // Look up system from both built-in and custom systems
  const systemsList = dbLoaded && dbSystems.length > 0 ? dbSystems : SYSTEMS;
  let system = systemsList.find((s) => s.id === quote.systemId);
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
  const quoteDate = new Date(quote.createdAt).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const validity = new Date(new Date(quote.createdAt).getTime() + 30 * 86400000).toLocaleDateString(
    'en-IN',
    { day: '2-digit', month: 'short', year: 'numeric' },
  );

  const projectTitle = quote.sales.projectTitle || quote.systemName;

  // Resolve equipment names for display
  let equipmentSettings: any;
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem('enermass-settings');
      if (raw) equipmentSettings = JSON.parse(raw);
    } catch {}
  }

  const allPanels = useMemo(() => {
    const base = dbLoaded && dbPanels.length > 0 ? dbPanels : [];
    const rateOverrides = equipmentSettings?.currentEquipmentRates?.panels ?? {};
    return [...base, ...(equipmentSettings?.customPanels ?? [])].map((panel) => ({
      ...panel,
      ratePerWatt: rateOverrides[panel.id] ?? panel.ratePerWatt,
    }));
  }, [dbLoaded, dbPanels, equipmentSettings]);

  const allInverters = useMemo(() => {
    const base = dbLoaded && dbInverters.length > 0 ? dbInverters : [];
    const rateOverrides = equipmentSettings?.currentEquipmentRates?.inverters ?? {};
    return [...base, ...(equipmentSettings?.customInverters ?? [])].map((inverter) => ({
      ...inverter,
      rate: rateOverrides[inverter.id] ?? inverter.rate,
    }));
  }, [dbLoaded, dbInverters, equipmentSettings]);

  const allBatteries = useMemo(() => {
    const base = dbLoaded && dbBatteries.length > 0 ? dbBatteries : [];
    const rateOverrides = equipmentSettings?.currentEquipmentRates?.batteries ?? {};
    return [...base, ...(equipmentSettings?.customBatteries ?? [])].map((battery) => ({
      ...battery,
      rate: rateOverrides[battery.id] ?? battery.rate,
    }));
  }, [dbLoaded, dbBatteries, equipmentSettings]);

  // Build equipment description
  const panelEntries = (quote.equipment.panelMix ?? []).map((entry) => {
    const panel = allPanels.find((p) => p.id === entry.panelBrandId);
    return { name: panel ? `${panel.brand} ${panel.model}` : entry.panelBrandId, qty: entry.qty, wattage: panel?.wattage ?? 0 };
  });

  const inverterEntries = (quote.equipment.inverterMix ?? []).map((entry) => {
    const inv = allInverters.find((i) => i.id === entry.inverterBrandId);
    return { name: inv ? `${inv.brand} ${inv.model}` : entry.inverterBrandId, qty: entry.qty, capacityKW: inv?.capacityKW ?? 0 };
  });

  const batteryEntries = (quote.equipment.batteryMix ?? []).map((entry) => {
    const bat = allBatteries.find((b) => b.id === entry.batteryBrandId);
    return { name: bat ? `${bat.brand} ${bat.model}` : entry.batteryBrandId, qty: entry.qty, capacityKWh: bat?.capacityKWh ?? 0 };
  });

  const totalPanelWattage = panelEntries.reduce((sum, e) => sum + e.wattage * e.qty, 0);
  const totalInverterKW = inverterEntries.reduce((sum, e) => sum + e.capacityKW * e.qty, 0);
  const totalBatteryKWh = batteryEntries.reduce((sum, e) => sum + e.capacityKWh * e.qty, 0);

  // 25-year projected savings
  const annualSavings = calc.annualSavingsINR;
  const twentyFiveYearSavings = annualSavings * 25 * 0.85; // conservative degradation factor

  // What's included items — from BOM descriptions (simplified for customer)
  const includedItems = calc.lines
    .filter((line) => line.effectiveQty > 0)
    .map((line) => line.description)
    .filter((desc) => !['PANEL', 'INVERTER', 'BATTERY'].includes(desc.toUpperCase()));

  if (!mounted) return null;

  return createPortal(
    <div className="print-only" id="quote-pdf">
      {/* ─── PAGE 1: System & Pricing ─── */}
      <div className="pdf-page">
        {/* Premium Header */}
        <div className="pdf-header">
          <div className="pdf-logo">

            <div className="pdf-logo-icon">☀</div>
            <div>
              <div className="pdf-brand">{companyName}</div>
              <div className="pdf-tagline">Solar Energy Solutions</div>
            </div>
          </div>
          <div className="pdf-meta">
            <div className="pdf-meta-row">
              <span>Date:</span>
              <strong>{quoteDate}</strong>
            </div>
            <div className="pdf-meta-row">
              <span>Quote ID:</span>
              <strong>{quote.quoteId}</strong>
            </div>
            <div className="pdf-meta-row">
              <span>Valid Until:</span>
              <strong>{validity}</strong>
            </div>
          </div>
        </div>

        <div className="pdf-divider" />

        {/* Project Title Banner */}
        <div className="pdf-project-banner">
          <div className="pdf-project-title">{projectTitle}</div>
          <div className="pdf-project-subtitle">
            {(system?.capacityKW ?? 0).toFixed(1)} kW Solar Power System
          </div>
        </div>

        {/* Customer & Site Info */}
        <div className="pdf-two-col">
          <div className="pdf-info-block">
            <div className="pdf-section-label">Customer Details</div>
            <div className="pdf-info-row">
              <span>Name:</span>
              <strong>{quote.customer.name}</strong>
            </div>
            <div className="pdf-info-row">
              <span>Phone:</span>
              {quote.customer.phone}
            </div>
            {quote.customer.whatsapp && (
              <div className="pdf-info-row">
                <span>WhatsApp:</span>
                {quote.customer.whatsapp}
              </div>
            )}
            {quote.customer.email && (
              <div className="pdf-info-row">
                <span>Email:</span>
                {quote.customer.email}
              </div>
            )}
          </div>

          <div className="pdf-info-block">
            <div className="pdf-section-label">Installation Site</div>
            {quote.address.line1 && <div className="pdf-info-row">{quote.address.line1}</div>}
            {quote.address.line2 && <div className="pdf-info-row">{quote.address.line2}</div>}
            {(quote.address.city || quote.address.pin) && (
              <div className="pdf-info-row">
                {[quote.address.city, quote.address.pin].filter(Boolean).join(' — ')}
              </div>
            )}
            <div className="pdf-info-row">
              <span>State:</span>
              {quote.address.state || quote.selectedState}
            </div>
            <div className="pdf-info-row">
              <span>Roof Type:</span>
              {quote.site.roofType} {quote.site.roofArea ? `· ${quote.site.roofArea} sq ft` : ''}
            </div>
          </div>
        </div>



        {/* Detailed Itemized Scope */}
        {calc.lines.filter((l: any) => l.effectiveQty > 0 && !l.isDisabled).length > 0 && (
          <>
            <div className="pdf-section-label" style={{ marginTop: '16px', pageBreakBefore: 'auto' }}>
              Detailed Scope of Supply & Services
            </div>
            <table className="pdf-table">
              <thead>
                <tr>
                  <th style={{ width: '40px', textAlign: 'center' }}>Sr</th>
                  <th>Item Description</th>
                  <th style={{ width: '60px', textAlign: 'center' }}>Qty</th>
                  <th style={{ width: '60px', textAlign: 'center' }}>Unit</th>
                  <th style={{ width: '100px', textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {calc.lines.filter((l: any) => l.effectiveQty > 0 && !l.isDisabled).map((line: any, i: number) => {
                  // If it's the panel or inverter, use the resolved name from earlier
                  let displayName = line.description;
                  let displayRemarks = line.remarks;
                  
                  if (line.description.toUpperCase() === 'PANEL') {
                    displayName = 'Solar Panels';
                    displayRemarks = panelEntries.map(p => `${p.name} (${p.wattage}W)`).join(', ');
                  } else if (line.description.toUpperCase() === 'INVERTER') {
                    displayName = 'Solar Inverter';
                    displayRemarks = inverterEntries.map(p => `${p.name} (${p.capacityKW}kW)`).join(', ');
                  } else if (line.description.toUpperCase() === 'BATTERY') {
                    displayName = 'Battery Storage';
                    displayRemarks = batteryEntries.map(p => `${p.name} (${p.capacityKWh}kWh)`).join(', ');
                  }

                  return (
                    <tr key={i}>
                      <td style={{ textAlign: 'center', color: '#6b7280' }}>{i + 1}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{displayName}</div>
                        {displayRemarks && <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '2px' }}>{displayRemarks}</div>}
                      </td>
                      <td style={{ textAlign: 'center' }}>{line.effectiveQty}</td>
                      <td style={{ textAlign: 'center' }}>{line.unit}</td>
                      <td style={{ textAlign: 'right', fontWeight: 500 }}>{formatINR(line.lineTotal)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}

        {/* ─── PRICING SECTION ─── */}
        <div className="pdf-section-label" style={{ marginTop: '16px' }}>
          Investment Summary
        </div>
        <table className="pdf-table pdf-pricing">
          <tbody>
            <tr>
              <td>System Price (incl. all taxes)</td>
              <td style={{ textAlign: 'right' }}>
                <strong>{formatINR(calc.finalCustomerPrice)}</strong>
              </td>
            </tr>
            {calc.discountAmount > 0 && (
              <tr>
                <td>Discount Applied</td>
                <td style={{ textAlign: 'right', color: '#16a34a' }}>
                  −{formatINR(calc.discountAmount)}
                </td>
              </tr>
            )}
            {calc.additionalCostTotal > 0 && (
              <tr>
                <td>Additional Site Charges</td>
                <td style={{ textAlign: 'right' }}>
                  +{formatINR(calc.additionalCostTotal)}
                </td>
              </tr>
            )}
            {calc.subsidyAmount > 0 && (
              <tr>
                <td>
                  <strong>Government Subsidy (PM Surya Ghar)</strong>
                </td>
                <td style={{ textAlign: 'right', color: '#16a34a' }}>
                  <strong>−{formatINR(calc.subsidyAmount)}</strong>
                </td>
              </tr>
            )}
            <tr className="pdf-highlight-row">
              <td>
                <strong>Your Net Investment</strong>
              </td>
              <td style={{ textAlign: 'right' }}>
                <strong>{formatINR(calc.beneficiaryContribution)}</strong>
              </td>
            </tr>
          </tbody>
        </table>

        {calc.subsidyAmount > 0 && (
          <div className="pdf-subsidy-note">
            * Subsidy disbursed directly by DISCOM post-commissioning and inspection. Not deducted at invoice stage. Customer must apply via National Portal.
          </div>
        )}

        {quote.sales.itcEligible && (() => {
          const gstAmount = calc.finalCustomerPrice - (calc.finalCustomerPrice / (1 + calc.gstOutputRate));
          const netCost = calc.finalCustomerPrice - gstAmount;
          return (
            <div style={{ marginTop: '20px', border: '1px solid #16a34a', borderRadius: '8px', padding: '12px', backgroundColor: '#f0fdf4' }}>
              <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#16a34a', textTransform: 'uppercase', marginBottom: '8px' }}>
                Commercial ITC Benefit Analysis
              </div>
              <table style={{ width: '100%', fontSize: '12px' }}>
                <tbody>
                  <tr>
                    <td>System Cost (excl. GST)</td>
                    <td style={{ textAlign: 'right' }}>{formatINR(netCost)}</td>
                  </tr>
                  <tr>
                    <td>GST @18% (Payable)</td>
                    <td style={{ textAlign: 'right' }}>+{formatINR(gstAmount)}</td>
                  </tr>
                  <tr>
                    <td><strong>Total Invoice</strong></td>
                    <td style={{ textAlign: 'right' }}><strong>{formatINR(calc.finalCustomerPrice)}</strong></td>
                  </tr>
                  <tr><td colSpan={2}><hr style={{ borderTop: '1px solid #bbf7d0', margin: '4px 0' }} /></td></tr>
                  <tr>
                    <td>ITC Claimable (GSTR-2B)</td>
                    <td style={{ textAlign: 'right', color: '#dc2626' }}>-{formatINR(gstAmount)}</td>
                  </tr>
                  <tr>
                    <td style={{ color: '#16a34a' }}><strong>Effective Net Cost</strong></td>
                    <td style={{ textAlign: 'right', color: '#16a34a' }}><strong>{formatINR(netCost)}</strong></td>
                  </tr>
                </tbody>
              </table>
              <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '8px', lineHeight: '1.2' }}>
                ITC effectively reduces your cost by {Math.round((gstAmount / calc.finalCustomerPrice) * 100)}%.<br/>
                ITC eligibility subject to vendor GST compliance (GSTR-1 filing). Consult your CA. ITC may be reversed if vendor defaults.
              </div>
            </div>
          );
        })()}
      </div>

      {/* ─── PAGE 2: Benefits & Terms ─── */}
      <div className="pdf-page pdf-page-break">
        {/* Mini header for page 2 */}
        <div className="pdf-page2-header">
          <span className="pdf-brand-small">{companyName}</span>
          <span className="pdf-quote-id-small">Quote {quote.quoteId}</span>
        </div>

        <div className="pdf-divider" />

        {/* Energy Generation */}
        <div className="pdf-section-label">Energy Generation Estimate</div>
        <div className="pdf-stats-grid">
          <div className="pdf-stat-card">
            <div className="pdf-stat-value">{calc.dailyGenerationKWh.toFixed(1)}</div>
            <div className="pdf-stat-unit">kWh / day</div>
            <div className="pdf-stat-label">Daily Generation</div>
          </div>
          <div className="pdf-stat-card">
            <div className="pdf-stat-value">{calc.monthlyGenerationKWh.toFixed(0)}</div>
            <div className="pdf-stat-unit">kWh / month</div>
            <div className="pdf-stat-label">Monthly Generation</div>
          </div>
          <div className="pdf-stat-card">
            <div className="pdf-stat-value">{(calc.annualGenerationKWh / 1000).toFixed(1)}</div>
            <div className="pdf-stat-unit">MWh / year</div>
            <div className="pdf-stat-label">Annual Generation</div>
          </div>
        </div>

        {/* Financial Benefits */}
        <div className="pdf-section-label" style={{ marginTop: '16px' }}>
          Financial Benefits
        </div>
        <div className="pdf-stats-grid">
          <div className="pdf-stat-card pdf-stat-gold">
            <div className="pdf-stat-value">{formatINR(calc.monthlySavingsINR)}</div>
            <div className="pdf-stat-label">Monthly Savings</div>
          </div>
          <div className="pdf-stat-card pdf-stat-gold">
            <div className="pdf-stat-value">{formatINR(calc.annualSavingsINR)}</div>
            <div className="pdf-stat-label">Annual Savings</div>
          </div>
          <div className="pdf-stat-card pdf-stat-gold">
            <div className="pdf-stat-value">
              {calc.paybackYears === Infinity ? 'N/A' : `${calc.paybackYears.toFixed(1)} yrs`}
            </div>
            <div className="pdf-stat-label">Payback Period</div>
          </div>
        </div>

        {/* 25-year savings highlight */}
        <div className="pdf-savings-banner">
          <div className="pdf-savings-label">Estimated 25-Year Savings</div>
          <div className="pdf-savings-value">{formatINR(twentyFiveYearSavings)}</div>
          <div className="pdf-savings-note">
            Based on current electricity rates with conservative degradation assumptions
          </div>
        </div>

        {/* System Highlights */}
        <div className="pdf-section-label" style={{ marginTop: '16px' }}>
          System Highlights
        </div>
        <div className="pdf-highlights-grid">
          <div className="pdf-highlight-item">
            <strong>☀ {(system?.capacityKW ?? 0).toFixed(1)} kW</strong> Total Solar Capacity
          </div>
          {totalPanelWattage > 0 && (
            <div className="pdf-highlight-item">
              <strong>🔋 {(totalPanelWattage / 1000).toFixed(2)} kWp</strong> Panel Array
            </div>
          )}
          {totalInverterKW > 0 && (
            <div className="pdf-highlight-item">
              <strong>⚡ {totalInverterKW.toFixed(1)} kW</strong> Inverter Capacity
            </div>
          )}
          {totalBatteryKWh > 0 && (
            <div className="pdf-highlight-item">
              <strong>🔌 {totalBatteryKWh.toFixed(1)} kWh</strong> Battery Storage
            </div>
          )}
          <div className="pdf-highlight-item">
            <strong>📋 25 Years</strong> Panel Performance Warranty
          </div>
          <div className="pdf-highlight-item">
            <strong>🛠️ Complete</strong> Installation & Commissioning
          </div>
        </div>

        {/* Terms */}
        <div className="pdf-section-label" style={{ marginTop: '16px' }}>
          Terms & Conditions
        </div>
        <ol className="pdf-terms">
          <li>This quotation is valid for 30 days from the date of issue.</li>
          <li>Prices are inclusive of all applicable taxes (GST) and are subject to material availability.</li>
          <li>Government subsidy is subject to approval from the respective state DISCOM/MNRE.</li>
          <li>Installation timeline: 7–15 working days from order confirmation, subject to site readiness.</li>
          <li>Warranty: 25 years linear performance warranty on panels; inverter warranty as per manufacturer.</li>
          <li>Net metering application and DISCOM approvals will be assisted by {companyName}.</li>
          <li>Payment terms: 50% advance, 40% on delivery, 10% on commissioning.</li>
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
          {companyName}
          {companyAddress ? ` · ${companyAddress}` : ''}
          {companyPhone ? ` · ${companyPhone}` : ''}
          {companyEmail ? ` · ${companyEmail}` : ''}
          <br />
          Quote {quote.quoteId} · Generated on {quoteDate}
        </div>
      </div>
    </div>,
    document.body,
  );
}
