/**
 * Validation script — verifies calculator engine against known values.
 * Run with: npx tsx src/scripts/validate.ts
 */

import { calculateSystem, formatINR } from '../lib/engine/calculator';

console.log('═══ ENERMASS Engine Validation ═══\n');

// Test: 3.1kW On-Grid (id:'3kwp'), Gujarat, residential
const result = calculateSystem({
  systemId: '3kwp',
  state: 'Gujarat',
  projectType: 'residential',
});

console.log('System: 3.1 KWp On-Grid (3kwp)');
console.log('State: Gujarat, Project: residential\n');

// BOM line checks
const panelLine = result.lines.find((l) => l.description === 'PANEL')!;
const inverterLine = result.lines.find((l) => l.description === 'INVERTER')!;

console.log('── BOM Lines ──');
console.log(`PANEL: qty=${panelLine.effectiveQty}, rate=${panelLine.effectiveRate}, lineTotal=${formatINR(panelLine.lineTotal)}, GST=${formatINR(panelLine.lineGST)}`);
console.log(`INVERTER: qty=${inverterLine.effectiveQty}, rate=${inverterLine.effectiveRate}, lineTotal=${formatINR(inverterLine.lineTotal)}, GST=${formatINR(inverterLine.lineGST)}`);

console.log('\n── Aggregates ──');
console.log(`costBeforeGST: ${formatINR(result.costBeforeGST)} (raw: ${result.costBeforeGST})`);
console.log(`totalInputGST: ${formatINR(result.totalInputGST)}`);
console.log(`effectiveMarginPct: ${(result.effectiveMarginPct * 100).toFixed(1)}%`);
console.log(`mrpExclGST: ${formatINR(result.mrpExclGST)} (raw: ${result.mrpExclGST.toFixed(2)})`);
console.log(`mrpInclGST: ${formatINR(result.mrpInclGST)} (raw: ${result.mrpInclGST.toFixed(2)})`);
console.log(`discountAmount: ${formatINR(result.discountAmount)}`);
console.log(`finalCustomerPrice: ${formatINR(result.finalCustomerPrice)} (raw: ${result.finalCustomerPrice.toFixed(2)})`);
console.log(`subsidyAmount: ${formatINR(result.subsidyAmount)}`);
console.log(`beneficiaryContribution: ${formatINR(result.beneficiaryContribution)} (raw: ${result.beneficiaryContribution.toFixed(2)})`);

console.log('\n── Energy ──');
console.log(`dailyGen: ${result.dailyGenerationKWh.toFixed(2)} kWh`);
console.log(`annualGen: ${result.annualGenerationKWh.toFixed(0)} kWh`);
console.log(`annualSavings: ${formatINR(result.annualSavingsINR)}`);
console.log(`paybackYears: ${result.paybackYears.toFixed(2)}`);

// Assertions
console.log('\n── Assertions ──');
const checks = [
  { name: 'Panel lineTotal', actual: panelLine.lineTotal, expected: 64000, tolerance: 0.01 },
  { name: 'Panel GST (5%)', actual: panelLine.lineGST, expected: 3200, tolerance: 0.01 },
  { name: 'Inverter lineTotal', actual: inverterLine.lineTotal, expected: 14500, tolerance: 0.01 },
  { name: 'Inverter GST (12%)', actual: inverterLine.lineGST, expected: 1740, tolerance: 0.01 },
  { name: 'Margin = 25%', actual: result.effectiveMarginPct, expected: 0.25, tolerance: 0.001 },
  { name: 'Subsidy (3.1kW ≤ 10)', actual: result.subsidyAmount, expected: 78000, tolerance: 0.01 },
];

let allPass = true;
for (const c of checks) {
  const diff = Math.abs(c.actual - c.expected) / Math.max(c.expected, 1);
  const pass = diff <= c.tolerance;
  if (!pass) allPass = false;
  console.log(`${pass ? '✅' : '❌'} ${c.name}: ${c.actual} (expected ${c.expected}, diff ${(diff * 100).toFixed(2)}%)`);
}

// Derived checks — engine uses MARKUP model: MRP = Cost × (1 + marginPct)
const expectedCostBeforeGST = result.costBeforeGST;
const expectedMrpExcl = expectedCostBeforeGST * (1 + 0.25); // markup model
const mrpDiff = Math.abs(result.mrpExclGST - expectedMrpExcl) / expectedMrpExcl;
console.log(`${mrpDiff < 0.001 ? '✅' : '❌'} mrpExclGST = cost*(1+0.25): ${result.mrpExclGST.toFixed(2)} vs ${expectedMrpExcl.toFixed(2)}`);

const expectedMrpIncl = expectedMrpExcl * 1.089;
const mrpInclDiff = Math.abs(result.mrpInclGST - expectedMrpIncl) / expectedMrpIncl;
console.log(`${mrpInclDiff < 0.001 ? '✅' : '❌'} mrpInclGST = mrpExcl×1.089: ${result.mrpInclGST.toFixed(2)} vs ${expectedMrpIncl.toFixed(2)}`);

console.log(`\n${allPass ? '🎉 ALL CHECKS PASSED' : '⚠️ SOME CHECKS FAILED'}`);
