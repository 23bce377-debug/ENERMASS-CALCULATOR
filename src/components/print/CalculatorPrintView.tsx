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
