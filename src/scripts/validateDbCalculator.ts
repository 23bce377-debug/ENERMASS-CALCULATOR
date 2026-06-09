import * as dotenv from 'dotenv';
import * as path from 'path';
import { Client } from 'pg';
import { calculateSystemFromDb } from '../lib/engine/dbCalculator';
import { formatINR } from '../lib/engine/calculator';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
  console.log('═══ ENERMASS DB-Driven Engine Validation ═══\n');

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('Error: DATABASE_URL environment variable is missing.');
    process.exit(1);
  }

  const rawUrl = connectionString.replace(/"/g, '');
  const url = new URL(rawUrl);
  const password = decodeURIComponent(url.password);

  const client = new Client({
    host: url.hostname,
    port: parseInt(url.port || '6543'),
    database: url.pathname.substring(1),
    user: decodeURIComponent(url.username),
    password,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();

  try {
    const result = await calculateSystemFromDb(client, {
      systemId: '3kwp_ongrid_3.1',
      state: 'Gujarat',
      capacity: 3.1,
      pricingContext: {
        projectType: 'residential',
        targetMarginPct: 0.25
      }
    });

    console.log('System: 3.1 KWp On-Grid (3kwp_ongrid_3.1)');
    console.log('State: Gujarat, Project: residential\n');

    // Find panel and inverter lines
    const panelLine = result.lines.find((l) => l.description === 'PANEL')!;
    const inverterLine = result.lines.find((l) => l.description === 'INVERTER')!;

    console.log('── BOM Lines ──');
    console.log(`PANEL: qty=${panelLine.qty}, rate=${panelLine.rate}, lineTotal=${formatINR(panelLine.lineTotal)}, GST=${formatINR(panelLine.lineGST)}`);
    console.log(`INVERTER: qty=${inverterLine.qty}, rate=${inverterLine.rate}, lineTotal=${formatINR(inverterLine.lineTotal)}, GST=${formatINR(inverterLine.lineGST)}`);

    console.log('\n── Aggregates ──');
    console.log(`costBeforeGST: ${formatINR(result.pricing.costBeforeGST)} (raw: ${result.pricing.costBeforeGST})`);
    console.log(`totalInputGST: ${formatINR(result.pricing.totalInputGST)}`);
    console.log(`targetMarginPct: ${(result.margin.targetMarginPct * 100).toFixed(1)}%`);
    console.log(`mrpExclGST: ${formatINR(result.pricing.mrpExclGST)} (raw: ${result.pricing.mrpExclGST.toFixed(2)})`);
    console.log(`mrpInclGST: ${formatINR(result.pricing.mrpInclGST)} (raw: ${result.pricing.mrpInclGST.toFixed(2)})`);
    console.log(`discountAmount: ${formatINR(result.pricing.discountAmount)}`);
    console.log(`finalCustomerPrice: ${formatINR(result.customerPrice.finalCustomerPrice)} (raw: ${result.customerPrice.finalCustomerPrice.toFixed(2)})`);
    console.log(`subsidyAmount: ${formatINR(result.subsidy.subsidyAmount)}`);
    console.log(`beneficiaryContribution: ${formatINR(result.customerPrice.beneficiaryContribution)} (raw: ${result.customerPrice.beneficiaryContribution.toFixed(2)})`);

    console.log('\n── Energy ──');
    console.log(`dailyGen: ${result.energy.dailyGenerationKWh.toFixed(2)} kWh`);
    console.log(`annualGen: ${result.energy.annualGenerationKWh.toFixed(0)} kWh`);
    console.log(`annualSavings: ${formatINR(result.energy.annualSavingsINR)}`);
    console.log(`paybackYears: ${result.energy.paybackYears.toFixed(2)}`);

    if (result.structureRequirements) {
      console.log('\n── Mounting Structure ──');
      console.log(`Name: ${result.structureRequirements.structureName}`);
      console.log(`Material: ${result.structureRequirements.material}`);
      console.log(`Mount Type: ${result.structureRequirements.roofMountType}`);
      console.log(`Pricing Mode: ${result.structureRequirements.pricingMode}`);
      if (result.structureRequirements.pricingMode === 'weight') {
        console.log(`Base Weight: ${result.structureRequirements.baseWeightKg} kg`);
        console.log(`Lookup Weight: ${result.structureRequirements.lookupWeightKg} kg`);
        console.log(`Final Weight: ${result.structureRequirements.totalWeightKg?.toFixed(1)} kg`);
        console.log(`Rate per kg: ${formatINR(result.structureRequirements.ratePerKg || 0, 2)}`);
      }
    }

    // Assertions
    console.log('\n── Assertions ──');
    const checks = [
      { name: 'Panel lineTotal', actual: panelLine.lineTotal, expected: 82150, tolerance: 0.01 },
      { name: 'Panel GST (5%)', actual: panelLine.lineGST, expected: 4107.5, tolerance: 0.01 },
      { name: 'Inverter lineTotal', actual: inverterLine.lineTotal, expected: 13800, tolerance: 0.01 },
      { name: 'Inverter GST (12%)', actual: inverterLine.lineGST, expected: 1656, tolerance: 0.01 },
      { name: 'Margin = 25%', actual: result.margin.targetMarginPct, expected: 0.25, tolerance: 0.001 },
      { name: 'Subsidy (3.1kW ≤ 10)', actual: result.subsidy.subsidyAmount, expected: 78000, tolerance: 0.01 },
    ];

    let allPass = true;
    for (const c of checks) {
      const diff = Math.abs(c.actual - c.expected) / Math.max(c.expected, 1);
      const pass = diff <= c.tolerance;
      if (!pass) allPass = false;
      console.log(`${pass ? '✅' : '❌'} ${c.name}: ${c.actual} (expected ${c.expected}, diff ${(diff * 100).toFixed(2)}%)`);
    }

    // Derived checks — engine uses MARKUP model: MRP = Cost × (1 + marginPct)
    const expectedCostBeforeGST = result.pricing.costBeforeGST;
    const expectedMrpExcl = expectedCostBeforeGST * (1 + 0.25); // markup model
    const mrpDiff = Math.abs(result.pricing.mrpExclGST - expectedMrpExcl) / expectedMrpExcl;
    console.log(`${mrpDiff < 0.001 ? '✅' : '❌'} mrpExclGST = cost*(1+0.25): ${result.pricing.mrpExclGST.toFixed(2)} vs ${expectedMrpExcl.toFixed(2)}`);

    const expectedMrpIncl = expectedMrpExcl * (1 + result.gst.gstOnOutput);
    const mrpInclDiff = Math.abs(result.pricing.mrpInclGST - expectedMrpIncl) / expectedMrpIncl;
    console.log(`${mrpInclDiff < 0.001 ? '✅' : '❌'} mrpInclGST = mrpExcl×(1 + OutputGST): ${result.pricing.mrpInclGST.toFixed(2)} vs ${expectedMrpIncl.toFixed(2)}`);

    console.log(`\n${allPass ? '🎉 ALL CHECKS PASSED' : '⚠️ SOME CHECKS FAILED'}`);

  } catch (err: any) {
    console.error('Exception during validation:', err);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
