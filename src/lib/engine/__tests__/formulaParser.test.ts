import { describe, it, expect } from 'vitest';
import { safeEvalFormula, FormulaParseError } from '../formulaParser';

describe('Formula Parser', () => {
  it('handles basic arithmetic', () => {
    expect(safeEvalFormula('2 + 3')).toBe(5);
    expect(safeEvalFormula('10 - 4')).toBe(6);
    expect(safeEvalFormula('3 * 4')).toBe(12);
    expect(safeEvalFormula('15 / 3')).toBe(5);
    expect(safeEvalFormula('2 + 3 * 4')).toBe(14);
    expect(safeEvalFormula('(2 + 3) * 4')).toBe(20);
    expect(safeEvalFormula('-5 + 10')).toBe(5);
  });

  it('handles functions', () => {
    expect(safeEvalFormula('CEIL(1.2)')).toBe(2);
    expect(safeEvalFormula('FLOOR(1.9)')).toBe(1);
    expect(safeEvalFormula('ROUND(1.5)')).toBe(2);
    expect(safeEvalFormula('MAX(1, 5, 3)')).toBe(5);
    expect(safeEvalFormula('MIN(4, 2, 7)')).toBe(2);
  });

  it('handles variables', () => {
    expect(safeEvalFormula('CEIL(system_kw / 5)', { system_kw: 5 })).toBe(1);
    expect(safeEvalFormula('panel_count * 2', { panel_count: 20 })).toBe(40);
  });

  it('handles complex expressions', () => {
    expect(safeEvalFormula('panel_count * 2 + CEIL(panel_count * 0.1)', { panel_count: 20 })).toBe(42);
    expect(safeEvalFormula('MAX(1, CEIL(system_kw / 10))', { system_kw: 15 })).toBe(2);
  });

  it('rejects dangerous identifiers', () => {
    expect(() => safeEvalFormula('constructor')).toThrow(FormulaParseError);
    expect(() => safeEvalFormula('window')).toThrow(FormulaParseError);
    expect(() => safeEvalFormula('process')).toThrow(FormulaParseError);
    expect(() => safeEvalFormula('eval(1)')).toThrow(FormulaParseError);
  });

  it('handles error cases gracefully', () => {
    expect(() => safeEvalFormula('system_kw * 2', {})).toThrow(/Undefined variable/);
    expect(() => safeEvalFormula('10 / 0')).toThrow(/Division by zero/);
    expect(() => safeEvalFormula('(2 + 3')).toThrow(/Expected \)/);
  });

  it('handles fuzz cases', () => {
    expect(safeEvalFormula('')).toBe(0);
    expect(safeEvalFormula('   ')).toBe(0);
    expect(safeEvalFormula('null')).toBe(0);
  });
});
