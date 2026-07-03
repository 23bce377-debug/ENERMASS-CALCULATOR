import { normalizeGstRate } from '@/lib/utils/gst';
import type { CalcResult, LineResult, ProjectType } from '@/lib/engine/calculator';

const MONEY_TOLERANCE = 0.05;
const RATE_TOLERANCE = 0.00001;

type MathIssueSeverity = 'error' | 'warning';

export interface MathIntegrityIssue {
  path: string;
  message: string;
  expected?: number;
  actual?: number;
  severity: MathIssueSeverity;
}

export interface MathIntegrityReport {
  ok: boolean;
  issues: MathIntegrityIssue[];
}

export interface QuoteItemMathInput {
  qty?: unknown;
  rate_per_unit?: unknown;
  gst_pct?: unknown;
  is_included?: unknown;
  line_total?: unknown;
  line_gst?: unknown;
  line_subtotal?: unknown;
}

function finiteNumber(value: unknown, fallback = 0): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

export function roundMoney(value: unknown): number {
  return Math.round(finiteNumber(value, 0) * 100) / 100;
}

export function roundRate(value: unknown): number {
  return Math.round(finiteNumber(value, 0) * 100000) / 100000;
}

export function amountsClose(actual: unknown, expected: unknown, tolerance = MONEY_TOLERANCE): boolean {
  return Math.abs(roundMoney(actual) - roundMoney(expected)) <= tolerance;
}

export function ratesClose(actual: unknown, expected: unknown, tolerance = RATE_TOLERANCE): boolean {
  return Math.abs(finiteNumber(actual, 0) - finiteNumber(expected, 0)) <= tolerance;
}

export function computeLineMath(input: {
  qty: unknown;
  rate: unknown;
  gstPct: unknown;
  isIncluded?: unknown;
}) {
  const isIncluded = input.isIncluded !== false;
  const qty = Math.max(0, roundRate(input.qty));
  const rate = Math.max(0, roundRate(input.rate));
  const gstPct = Math.max(0, normalizeGstRate(input.gstPct, 0));
  const lineTotal = isIncluded ? roundMoney(qty * rate) : 0;
  const lineGST = isIncluded ? roundMoney(lineTotal * gstPct) : 0;
  const lineSubTotal = roundMoney(lineTotal + lineGST);

  return {
    qty,
    rate,
    gstPct,
    lineTotal,
    lineGST,
    lineSubTotal,
  };
}

export function normalizeQuoteItemMath<T extends QuoteItemMathInput>(item: T): T & {
  qty: number;
  rate_per_unit: number;
  gst_pct: number;
  line_total: number;
  line_gst: number;
  line_subtotal: number;
} {
  const computed = computeLineMath({
    qty: item.qty,
    rate: item.rate_per_unit,
    gstPct: item.gst_pct,
    isIncluded: item.is_included,
  });

  return {
    ...item,
    qty: computed.qty,
    rate_per_unit: computed.rate,
    gst_pct: computed.gstPct,
    line_total: computed.lineTotal,
    line_gst: computed.lineGST,
    line_subtotal: computed.lineSubTotal,
  };
}

function pushIssue(
  issues: MathIntegrityIssue[],
  path: string,
  message: string,
  actual?: number,
  expected?: number,
  severity: MathIssueSeverity = 'error',
) {
  issues.push({ path, message, actual, expected, severity });
}

function validateFiniteNonNegative(
  issues: MathIntegrityIssue[],
  path: string,
  value: unknown,
  allowInfinity = false,
) {
  const num = Number(value);
  const isValid = allowInfinity ? (Number.isFinite(num) || num === Infinity) : Number.isFinite(num);
  if (!isValid || num < 0) {
    pushIssue(issues, path, 'must be a finite non-negative number', num);
  }
}

export function validateLineResultMath(line: LineResult, path = `lines[${line.index}]`): MathIntegrityIssue[] {
  const issues: MathIntegrityIssue[] = [];
  validateFiniteNonNegative(issues, `${path}.effectiveQty`, line.effectiveQty);
  validateFiniteNonNegative(issues, `${path}.effectiveRate`, line.effectiveRate);
  validateFiniteNonNegative(issues, `${path}.effectiveGstPct`, line.effectiveGstPct);

  if (line.effectiveGstPct > 1) {
    pushIssue(issues, `${path}.effectiveGstPct`, 'GST must be stored as a fraction, not a whole percent', line.effectiveGstPct);
  }

  const expected = computeLineMath({
    qty: line.effectiveQty,
    rate: line.effectiveRate,
    gstPct: line.effectiveGstPct,
    isIncluded: !line.isDisabled,
  });

  if (!amountsClose(line.lineTotal, expected.lineTotal)) {
    pushIssue(issues, `${path}.lineTotal`, 'line total must equal qty x rate', line.lineTotal, expected.lineTotal);
  }
  if (!amountsClose(line.lineGST, expected.lineGST)) {
    pushIssue(issues, `${path}.lineGST`, 'line GST must equal line total x GST rate', line.lineGST, expected.lineGST);
  }
  if (!amountsClose(line.lineSubTotal, expected.lineSubTotal)) {
    pushIssue(issues, `${path}.lineSubTotal`, 'line subtotal must equal line total + GST', line.lineSubTotal, expected.lineSubTotal);
  }

  return issues;
}

function sumActive(lines: LineResult[], field: keyof Pick<LineResult, 'lineTotal' | 'lineGST' | 'lineSubTotal'>) {
  return roundMoney(lines.reduce((sum, line) => sum + (line.isDisabled ? 0 : finiteNumber(line[field], 0)), 0));
}

export function validateCalcResultMath(
  result: CalcResult,
  options: {
    projectType?: ProjectType;
    context?: string;
  } = {},
): MathIntegrityReport {
  const issues: MathIntegrityIssue[] = [];
  const prefix = options.context ? `${options.context}.` : '';

  for (const line of result.lines ?? []) {
    issues.push(...validateLineResultMath(line, `${prefix}lines[${line.index}]`));
  }
  for (const line of result.quotedLines ?? []) {
    issues.push(...validateLineResultMath(line, `${prefix}quotedLines[${line.index}]`));
  }

  const expectedCostBeforeGST = sumActive(result.lines, 'lineTotal');
  const expectedInputGST = sumActive(result.lines, 'lineGST');
  const expectedTotalIncGST = roundMoney(expectedCostBeforeGST + expectedInputGST);

  if (!amountsClose(result.costBeforeGST, expectedCostBeforeGST)) {
    pushIssue(issues, `${prefix}costBeforeGST`, 'must equal included BOM line totals', result.costBeforeGST, expectedCostBeforeGST);
  }
  if (!amountsClose(result.totalInputGST, expectedInputGST)) {
    pushIssue(issues, `${prefix}totalInputGST`, 'must equal included BOM line GST totals', result.totalInputGST, expectedInputGST);
  }
  if (!amountsClose(result.totalIncGST, expectedTotalIncGST)) {
    pushIssue(issues, `${prefix}totalIncGST`, 'must equal cost before GST + input GST', result.totalIncGST, expectedTotalIncGST);
  }

  const expectedMargin = roundMoney(result.mrpExclGST - result.costBeforeGST);
  if (!amountsClose(result.marginAmount, expectedMargin)) {
    pushIssue(issues, `${prefix}marginAmount`, 'must equal MRP excl GST - cost before GST', result.marginAmount, expectedMargin);
  }

  const normalizedOutputGst = normalizeGstRate(result.gstOutputRate, 0);
  if (!ratesClose(result.gstOutputRate, normalizedOutputGst)) {
    pushIssue(issues, `${prefix}gstOutputRate`, 'output GST must be stored as a fraction', result.gstOutputRate, normalizedOutputGst);
  }

  const expectedMrpIncl = roundMoney(result.mrpExclGST * (1 + normalizedOutputGst));
  if (!amountsClose(result.mrpInclGST, expectedMrpIncl)) {
    pushIssue(issues, `${prefix}mrpInclGST`, 'must equal MRP excl GST plus output GST', result.mrpInclGST, expectedMrpIncl);
  }

  const expectedUnroundedFinal = roundMoney(Math.max(0, result.mrpInclGST - result.discountAmount + result.additionalCostTotal));
  if (!amountsClose(result.unroundedFinalCustomerPrice, expectedUnroundedFinal)) {
    pushIssue(issues, `${prefix}unroundedFinalCustomerPrice`, 'must equal MRP incl GST - discount + additional costs', result.unroundedFinalCustomerPrice, expectedUnroundedFinal);
  }

  const expectedFinal = roundMoney(result.unroundedFinalCustomerPrice + result.roundOffAdjustment);
  if (!amountsClose(result.finalCustomerPrice, expectedFinal)) {
    pushIssue(issues, `${prefix}finalCustomerPrice`, 'must equal unrounded final price + round-off adjustment', result.finalCustomerPrice, expectedFinal);
  }

  if (result.roundOffToThousand && Math.abs(result.finalCustomerPrice % 1000) > MONEY_TOLERANCE) {
    pushIssue(issues, `${prefix}finalCustomerPrice`, 'must be rounded to the nearest thousand when round-off is enabled', result.finalCustomerPrice);
  }

  const itcAmount = options.projectType === 'commercial'
    ? roundMoney(result.finalCustomerPrice - result.finalCustomerPrice / (1 + normalizedOutputGst))
    : 0;
  const expectedBeneficiaryContribution = roundMoney(Math.max(0, result.finalCustomerPrice - result.subsidyAmount - itcAmount));
  if (!amountsClose(result.beneficiaryContribution, expectedBeneficiaryContribution)) {
    pushIssue(issues, `${prefix}beneficiaryContribution`, 'must equal customer final price minus subsidy and eligible ITC', result.beneficiaryContribution, expectedBeneficiaryContribution);
  }

  validateFiniteNonNegative(issues, `${prefix}capacityKW`, result.capacityKW);
  validateFiniteNonNegative(issues, `${prefix}paybackYears`, result.paybackYears, true);
  validateFiniteNonNegative(issues, `${prefix}annualGenerationKWh`, result.annualGenerationKWh);
  validateFiniteNonNegative(issues, `${prefix}annualSavingsINR`, result.annualSavingsINR);

  return {
    ok: issues.every((issue) => issue.severity !== 'error'),
    issues,
  };
}

export function assertCalcResultIntegrity(
  result: CalcResult,
  options: {
    projectType?: ProjectType;
    context?: string;
  } = {},
) {
  const report = validateCalcResultMath(result, options);
  if (!report.ok) {
    const message = report.issues
      .filter((issue) => issue.severity === 'error')
      .map((issue) => {
        const expected = issue.expected !== undefined ? ` expected=${issue.expected}` : '';
        const actual = issue.actual !== undefined ? ` actual=${issue.actual}` : '';
        return `${issue.path}: ${issue.message}${actual}${expected}`;
      })
      .join('; ');
    throw new Error(`Math integrity check failed${options.context ? ` (${options.context})` : ''}: ${message}`);
  }
}
