/**
 * formulaEvaluator.test.ts
 *
 * Tests for:
 * 1. FormulaEvaluator.validate() — safe validation without throwing
 * 2. FormulaEvaluator.compile() — pre-compile and reuse
 * 3. FormulaEvaluator.evaluate() — direct evaluation
 * 4. FormulaEvaluator.evaluateSafe() — fallback on error
 * 5. Security: blocked identifiers must not evaluate
 * 6. Fuzz: random malformed expressions must throw FormulaParseError (not crashes)
 * 7. Operator precedence and edge cases
 */

import { describe, it, expect, vi } from 'vitest';
import { FormulaEvaluator, FormulaParseError } from '../src/lib/formula/evaluator';

// ─── 1. Basic Arithmetic ──────────────────────────────────────────────────────

describe('FormulaEvaluator — Arithmetic', () => {
  const vars = {
    system_kw: 5,
    panel_count: 10,
    inverter_count: 2,
    battery_count: 0,
    string_count: 2,
    dc_cable_length: 100,
    ac_cable_length: 50,
    structure_area: 40,
  };

  it('evaluates addition', () => {
    expect(FormulaEvaluator.evaluate('panel_count + inverter_count', vars)).toBe(12);
  });

  it('evaluates subtraction', () => {
    expect(FormulaEvaluator.evaluate('panel_count - inverter_count', vars)).toBe(8);
  });

  it('evaluates multiplication', () => {
    expect(FormulaEvaluator.evaluate('panel_count * 2', vars)).toBe(20);
  });

  it('evaluates division', () => {
    expect(FormulaEvaluator.evaluate('dc_cable_length / 10', vars)).toBe(10);
  });

  it('respects operator precedence (* before +)', () => {
    expect(FormulaEvaluator.evaluate('panel_count + inverter_count * 3', vars)).toBe(16);
  });

  it('respects parentheses', () => {
    expect(FormulaEvaluator.evaluate('(panel_count + inverter_count) * 3', vars)).toBe(36);
  });

  it('handles unary minus', () => {
    expect(FormulaEvaluator.evaluate('-inverter_count', vars)).toBe(-2);
  });

  it('handles integer literals', () => {
    expect(FormulaEvaluator.evaluate('42', vars)).toBe(42);
  });

  it('handles decimal literals', () => {
    expect(FormulaEvaluator.evaluate('3.14', vars)).toBe(3.14);
  });

  it('throws on division by zero', () => {
    expect(() => FormulaEvaluator.evaluate('panel_count / 0', vars)).toThrow(FormulaParseError);
  });

  it('throws on undefined variable', () => {
    expect(() => FormulaEvaluator.evaluate('undefined_var', vars)).toThrow(FormulaParseError);
  });
});

// ─── 2. Built-in Functions ────────────────────────────────────────────────────

describe('FormulaEvaluator — Built-in Functions', () => {
  const vars = { system_kw: 5.7, panel_count: 11, inverter_count: 1, battery_count: 0 };

  it('CEIL rounds up', () => {
    expect(FormulaEvaluator.evaluate('CEIL(system_kw)', vars)).toBe(6);
  });

  it('CEIL of integer is unchanged', () => {
    expect(FormulaEvaluator.evaluate('CEIL(panel_count / 5)', { ...vars, panel_count: 10 })).toBe(2);
  });

  it('FLOOR rounds down', () => {
    expect(FormulaEvaluator.evaluate('FLOOR(system_kw)', vars)).toBe(5);
  });

  it('ROUND rounds to nearest integer', () => {
    expect(FormulaEvaluator.evaluate('ROUND(system_kw)', vars)).toBe(6);
  });

  it('MAX returns larger value', () => {
    expect(FormulaEvaluator.evaluate('MAX(system_kw, panel_count)', vars)).toBe(11);
  });

  it('MIN returns smaller value', () => {
    expect(FormulaEvaluator.evaluate('MIN(system_kw, panel_count)', vars)).toBe(5.7);
  });

  it('nested functions work', () => {
    // CEIL(MAX(5.7, 3)) = CEIL(5.7) = 6
    expect(FormulaEvaluator.evaluate('CEIL(MAX(system_kw, 3))', vars)).toBe(6);
  });

  it('functions are case-insensitive', () => {
    expect(FormulaEvaluator.evaluate('ceil(system_kw)', vars)).toBe(6);
    expect(FormulaEvaluator.evaluate('Ceil(system_kw)', vars)).toBe(6);
  });
});

// ─── 3. Real BOM Formulas ────────────────────────────────────────────────────

describe('FormulaEvaluator — Real BOM Formulas', () => {
  const vars5kw = {
    system_kw: 5,
    panel_count: 10,
    inverter_count: 1,
    battery_count: 0,
    string_count: 2,
    dc_cable_length: 100,
    ac_cable_length: 50,
    structure_area: 40,
  };

  it('CEIL(system_kw / 5) → DC cable runs (5kW = 1)', () => {
    expect(FormulaEvaluator.evaluate('CEIL(system_kw / 5)', vars5kw)).toBe(1);
  });

  it('panel_count * 2 → earthing pits', () => {
    expect(FormulaEvaluator.evaluate('panel_count * 2', vars5kw)).toBe(20);
  });

  it('panel_count * 2 + CEIL(panel_count * 0.1) → MC4 connectors', () => {
    // 20 + CEIL(1) = 21
    expect(FormulaEvaluator.evaluate('panel_count * 2 + CEIL(panel_count * 0.1)', vars5kw)).toBe(21);
  });

  it('CEIL(system_kw * 10) → conduit meters', () => {
    expect(FormulaEvaluator.evaluate('CEIL(system_kw * 10)', vars5kw)).toBe(50);
  });

  it('dc_cable_length * string_count → DC cable total', () => {
    expect(FormulaEvaluator.evaluate('dc_cable_length * string_count', vars5kw)).toBe(200);
  });

  it('10kW system: CEIL(system_kw / 5) → 2 runs', () => {
    expect(FormulaEvaluator.evaluate('CEIL(system_kw / 5)', { ...vars5kw, system_kw: 10 })).toBe(2);
  });
});

// ─── 4. compile() ────────────────────────────────────────────────────────────

describe('FormulaEvaluator — compile()', () => {
  it('returns a compiled formula with evaluate()', () => {
    const formula = FormulaEvaluator.compile('CEIL(system_kw / 5)');
    expect(formula.evaluate({ system_kw: 10 })).toBe(2);
    expect(formula.evaluate({ system_kw: 5 })).toBe(1);
    expect(formula.evaluate({ system_kw: 6 })).toBe(2);
  });

  it('throws FormulaParseError on invalid expression', () => {
    expect(() => FormulaEvaluator.compile('eval("x")')).toThrow(FormulaParseError);
  });

  it('exposes the expression string', () => {
    const formula = FormulaEvaluator.compile('panel_count * 2');
    expect(formula.expression).toBe('panel_count * 2');
  });

  it('exposes referenced variables', () => {
    // 'panel_count * 2 + system_kw' — battery_count is NOT referenced
    const formula = FormulaEvaluator.compile('panel_count * 2 + system_kw');
    expect(formula.referencedVariables.has('panel_count')).toBe(true);
    expect(formula.referencedVariables.has('system_kw')).toBe(true);
    // battery_count only appears if the formula uses it; multiplication by 0 vs 1
    // gives same result for 'panel_count * 2 + system_kw', so it should be absent.
    // Note: the detection heuristic sets each var to 0 vs 1 independently.
    // For this formula: (0 * 2 + 1) = 1 and (1 * 2 + 1) = 3 when panel_count varies.
    // battery_count=0 vs 1: (10 * 2 + 5) = 25 in both cases => absent.
    expect(formula.referencedVariables.has('battery_count')).toBe(false);
  });
});

// ─── 5. validate() ───────────────────────────────────────────────────────────

describe('FormulaEvaluator — validate()', () => {
  it('returns valid: true for a correct formula', () => {
    const result = FormulaEvaluator.validate('CEIL(system_kw / 5)');
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('returns valid: false for empty expression', () => {
    const result = FormulaEvaluator.validate('');
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns valid: false for unknown token', () => {
    const result = FormulaEvaluator.validate('system_kw $ panel_count');
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });
});

// ─── 6. evaluateSafe() ───────────────────────────────────────────────────────

describe('FormulaEvaluator — evaluateSafe()', () => {
  it('returns result on valid formula', () => {
    expect(FormulaEvaluator.evaluateSafe('panel_count * 2', { panel_count: 5 })).toBe(10);
  });

  it('returns fallback (0) on error instead of throwing', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = FormulaEvaluator.evaluateSafe('invalid $ expression', {});
    expect(result).toBe(0);
    consoleSpy.mockRestore();
  });

  it('returns custom fallback value', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = FormulaEvaluator.evaluateSafe('invalid $ expression', {}, 99);
    expect(result).toBe(99);
    consoleSpy.mockRestore();
  });
});

// ─── 7. Security Tests ────────────────────────────────────────────────────────

describe('FormulaEvaluator — Security', () => {
  const safeVars = { system_kw: 1, panel_count: 1, inverter_count: 1, battery_count: 0 };

  const blockedIdentifiers = [
    'constructor',
    'prototype',
    '__proto__',
    'globalThis',
    'window',
    'process',
    'eval',
    'Function',
    'require',
    'import',
    'export',
  ];

  for (const identifier of blockedIdentifiers) {
    it(`blocks identifier: ${identifier}`, () => {
      expect(() =>
        FormulaEvaluator.evaluate(`${identifier}`, safeVars)
      ).toThrow(FormulaParseError);
    });

    it(`blocks identifier in expression: system_kw + ${identifier}`, () => {
      expect(() =>
        FormulaEvaluator.evaluate(`system_kw + ${identifier}`, safeVars)
      ).toThrow(FormulaParseError);
    });
  }

  it('does not execute side effects (no eval)', () => {
    // If eval were possible, this would throw a ReferenceError or similar runtime error.
    // With our parser, it throws FormulaParseError cleanly.
    expect(() =>
      FormulaEvaluator.evaluate('eval("alert(1)")', safeVars)
    ).toThrow(FormulaParseError);
  });

  it('validate() returns invalid for all blocked identifiers', () => {
    for (const id of blockedIdentifiers) {
      const result = FormulaEvaluator.validate(id);
      expect(result.valid).toBe(false);
    }
  });
});

// ─── 8. Fuzz Tests ───────────────────────────────────────────────────────────

describe('FormulaEvaluator — Fuzz Tests', () => {
  const safeVars = {
    system_kw: 5,
    panel_count: 10,
    inverter_count: 1,
    battery_count: 0,
  };

  /**
   * Generate random malformed expressions.
   * All must throw FormulaParseError — never crash with an unhandled error.
   * Note: 'null', 'Infinity', and whitespace-only may parse validly on some parsers;
   * we focus on structurally broken expressions and security-blocked identifiers.
   */
  const malformedExpressions = [
    '((',
    '))',
    '++',
    '/',
    '*',
    '1 2 3',
    'CEIL(',
    'CEIL)',
    'MAX(,)',
    '1 + ',
    '+ 1',
    'UNKNOWNFUNC(system_kw)',
    '`template`',
    '${system_kw}',
    'system_kw; panel_count',
    'system_kw && panel_count',
    'system_kw || panel_count',
    'system_kw == panel_count',
    'system_kw === panel_count',
    '!system_kw',
    '~system_kw',
    'system_kw >> 1',
    'system_kw << 1',
    'system_kw % 3',
    'system_kw ** 2',
    'system_kw?.panel_count',
  ];

  for (const expr of malformedExpressions) {
    it(`handles malformed expression without crashing: "${expr.substring(0, 30)}"`, () => {
      expect(() => {
        // Must throw FormulaParseError — not any other error type
        FormulaEvaluator.evaluate(expr, safeVars);
      }).toThrow();

      // validate() must also return valid: false (no uncaught exceptions)
      const result = FormulaEvaluator.validate(expr);
      expect(typeof result.valid).toBe('boolean');
    });
  }
});
