'use client';

import { useCalculatorStore } from '@/lib/store/calculatorStore';
import { SYSTEMS, type SolarSystem } from '@/lib/data/bom';
import { formatINR } from '@/lib/engine/calculator';
import { useSettings } from '@/lib/hooks/useSettings';

/**
 * CalculatorPrintView — Rendered on the Calculator page, hidden on screen.
 * When window.print() fires, this becomes the only visible content.
 * Designed for A4 paper output.
 */
export function CalculatorPrintView() {
  const selectedSystemId = useCalculatorStore((s) => s.selectedSystemId);
  const calcResult = useCalculatorStore((s) => s.calcResult);
  const selectedState = useCalculatorStore((s) => s.selectedState);
  const projectType = useCalculatorStore((s) => s.projectType);
  const itcEligible = useCalculatorStore((s) => s.itcEligible);
  const { settings } = useSettings();

  if (!selectedSystemId || !calcResult) return null;

  const allSystems: SolarSystem[] = [...SYSTEMS, ...(settings.customSystems ?? [])];
  const system = allSystems.find((s) => s.id === selectedSystemId);
  if (!system) return null;

  const companyName = settings.company?.name || 'ENERMASS Solar';
  const companyAddress = settings.company?.address || '';
  const calc = calcResult;
  const today = new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="print-only" id="calculator-print-view">
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
            <div className="pdf-meta-row"><span>Date:</span><strong>{today}</strong></div>
            <div className="pdf-meta-row"><span>State:</span><strong>{selectedState}</strong></div>
            <div className="pdf-meta-row"><span>Type:</span><strong style={{ textTransform: 'capitalize' }}>{projectType}</strong></div>
          </div>
        </div>

        <div className="pdf-divider" />

        {/* System Summary */}
        <div className="pdf-section-label">System Specifications</div>
        <table className="pdf-table">
          <tbody>
            <tr><td>System</td><td><strong>{system.name}</strong></td><td>Category</td><td style={{ textTransform: 'capitalize' }}>{system.category}</td></tr>
            <tr><td>Capacity</td><td>{system.capacityKW} kW</td><td>Panels</td><td>{system.panelQty} × {system.panelWattage}W</td></tr>
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
            {calc.lines.map((line, i) => {
              const originalSubTotal = line.effectiveQty * line.effectiveRate * (1 + line.effectiveGstPct);
              return (
                <tr key={i} style={line.isDisabled ? { opacity: 0.5, textDecoration: 'line-through' } : {}}>
                  <td>{i + 1}</td>
                  <td>{line.description}</td>
                  <td>{line.effectiveQty}</td>
                  <td>{formatINR(line.effectiveRate)}</td>
                  <td>{(line.effectiveGstPct * 100).toFixed(0)}%</td>
                  <td style={{ textAlign: 'right' }}>
                    {line.isDisabled ? (
                      <span style={{ textDecoration: 'line-through text-decoration-color-muted' }}>
                        <span style={{ textDecoration: 'line-through', marginRight: '6px', opacity: 0.6 }}>
                          {formatINR(originalSubTotal)}
                        </span>
                        <span style={{ textDecoration: 'none', display: 'inline-block' }}>₹0</span>
                      </span>
                    ) : (
                      formatINR(line.lineSubTotal)
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ═══ PAGE 2 ═══ */}
      <div className="pdf-page pdf-page-break">
        {/* Pricing Summary */}
        <div className="pdf-section-label">Investment Summary</div>
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
          <div className="pdf-subsidy-note" style={{ fontSize: '7pt', color: '#888', fontStyle: 'italic', marginTop: '4px', padding: '4px 8px', background: '#fafafa', borderRadius: '4px' }}>
            * Subsidy disbursed directly by DISCOM post-commissioning and inspection. Not deducted at invoice stage. Customer must apply via National Portal.
          </div>
        )}

        {projectType === 'commercial' && itcEligible && (() => {
          const gstAmount = calc.finalCustomerPrice - (calc.finalCustomerPrice / (1 + calc.gstOutputRate));
          const netCost = calc.finalCustomerPrice - gstAmount;
          return (
            <div style={{ marginTop: '16px', border: '1px solid #16a34a', borderRadius: '8px', padding: '10px', backgroundColor: '#f0fdf4' }}>
              <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#16a34a', textTransform: 'uppercase', marginBottom: '6px' }}>
                Commercial ITC Benefit Analysis
              </div>
              <table style={{ width: '100%', fontSize: '11px' }}>
                <tbody>
                  <tr>
                    <td>System Cost (excl. GST)</td>
                    <td style={{ textAlign: 'right' }}>{formatINR(netCost)}</td>
                  </tr>
                  <tr>
                    <td>GST @{(calc.gstOutputRate * 100).toFixed(1)}% (Payable)</td>
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
              <div style={{ fontSize: '9px', color: '#6b7280', marginTop: '6px', lineHeight: '1.2' }}>
                ITC effectively reduces your cost by {Math.round((gstAmount / calc.finalCustomerPrice) * 100)}%.<br/>
                ITC eligibility subject to vendor GST compliance (GSTR-1 filing). Consult your CA.
              </div>
            </div>
          );
        })()}

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
          <li>This estimation is valid for 30 days from the date of issue.</li>
          <li>Prices are subject to change based on material availability and market conditions.</li>
          <li>Government subsidy is subject to approval from the respective state DISCOM/MNRE.</li>
          <li>Installation timeline: 7–15 working days after order confirmation and site readiness.</li>
          <li>Warranty: Panels — 25 years performance; Inverter — 5 years; Workmanship — 5 years.</li>
          <li>Net metering application and DISCOM approvals will be assisted by {companyName}.</li>
        </ol>

        {/* Footer */}
        <div className="pdf-footer">
          {companyName} {companyAddress ? `· ${companyAddress}` : ''} · Generated {today}
        </div>
      </div>
    </div>
  );
}
