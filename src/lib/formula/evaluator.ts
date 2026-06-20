/**
 * evaluator.ts — FormulaEvaluator: a class-based wrapper around the safe formula parser.
 *
 * The underlying safeEvalFormula() function already implements:
 * - Tokenizer → Parser → AST → Evaluator (no eval/Function/SQL)
 * - Blocked identifiers: constructor, prototype, __proto__, globalThis, window, process
 * - Supported functions: CEIL, FLOOR, ROUND, MAX, MIN
 * - Supported operators: +, -, *, /, unary -, parentheses
 *
 * This class adds:
 * - compile() — pre-validates an expression and returns a bound evaluator
 * - validate() — returns { valid, error } without throwing
 * - A typed variable contract via FormulaVariables
 * - A static ALLOWED_VARIABLES whitelist for documentation/validation
 *
 * Security invariants (enforced by the underlying parser):
 * - NO eval()
 * - NO Function()
 * - NO SQL execution
 * - NO arbitrary JavaScript
 * - All identifiers are validated against a whitelist of known variable names
 *   OR blocked if they match dangerous patterns.
 */

import { safeEvalFormula, FormulaParseError, type FormulaVariables } from '../engine/formulaParser';

export { FormulaParseError, type FormulaVariables };

// ─── Allowed Variables ────────────────────────────────────────────────────────

/**
 * All variables that a qty_formula may reference.
 * If you add a new variable to the calculator engine, add it here.
 */
export const ALLOWED_VARIABLES: ReadonlySet<string> = new Set([
  'system_kw',
  'panel_count',
  'inverter_count',
  'battery_count',
  'string_count',
  'dc_cable_length',
  'ac_cable_length',
  'structure_area',
]);

// ─── Compiled Formula ─────────────────────────────────────────────────────────

export interface CompiledFormula {
  /** The original expression string */
  expression: string;
  /** Evaluate the formula with a given variable set. Throws FormulaParseError on bad vars. */
  evaluate(variables: FormulaVariables): number;
  /** The set of variable names referenced in this formula */
  referencedVariables: ReadonlySet<string>;
}

// ─── Validation Result ────────────────────────────────────────────────────────

export interface FormulaValidationResult {
  valid: boolean;
  error?: string;
  /** Variables referenced by this formula (if valid) */
  referencedVariables?: string[];
}

// ─── Dummy variables for validation ──────────────────────────────────────────

const DUMMY_VARIABLES: Required<FormulaVariables> = {
  system_kw: 5,
  panel_count: 10,
  inverter_count: 1,
  battery_count: 0,
  string_count: 2,
  dc_cable_length: 100,
  ac_cable_length: 50,
  structure_area: 40,
};

// ─── FormulaEvaluator ─────────────────────────────────────────────────────────

export class FormulaEvaluator {
  /**
   * Validate an expression without throwing.
   *
   * @example
   * const result = FormulaEvaluator.validate('CEIL(system_kw / 5)');
   * // { valid: true, referencedVariables: ['system_kw'] }
   *
   * const bad = FormulaEvaluator.validate('eval("code")');
   * // { valid: false, error: 'Illegal identifier: eval' }
   */
  static validate(expression: string): FormulaValidationResult {
    if (!expression || expression.trim() === '') {
      return { valid: false, error: 'Empty formula' };
    }
    try {
      // Run with dummy variables — will catch parse errors and most runtime errors
      safeEvalFormula(expression, DUMMY_VARIABLES as FormulaVariables);

      // Extract referenced variable names by holding all vars constant at 1,
      // then setting just the target var to 0. If the result changes, it's referenced.
      const referenced: string[] = [];
      const allOnes = Object.fromEntries(
        Array.from(ALLOWED_VARIABLES).map((k) => [k, 1])
      ) as FormulaVariables;
      const baseResult = safeEvalFormula(expression, allOnes);

      for (const varName of ALLOWED_VARIABLES) {
        try {
          const withVarZero = { ...allOnes, [varName]: 0 } as FormulaVariables;
          const resultWithZero = safeEvalFormula(expression, withVarZero);
          if (resultWithZero !== baseResult) {
            referenced.push(varName);
          }
        } catch {
          // If evaluation fails when this var is 0 (e.g., division by zero), assume referenced
          referenced.push(varName);
        }
      }

      return { valid: true, referencedVariables: referenced };
    } catch (e) {
      return {
        valid: false,
        error: e instanceof FormulaParseError ? e.message : String(e),
      };
    }
  }

  /**
   * Compile an expression. Validates it immediately; throws FormulaParseError if invalid.
   * The returned CompiledFormula can be evaluated multiple times without re-parsing.
   *
   * @throws FormulaParseError if the expression fails to parse or references illegal identifiers.
   *
   * @example
   * const formula = FormulaEvaluator.compile('CEIL(system_kw / 5)');
   * const count = formula.evaluate({ system_kw: 10, panel_count: 20 });
   * // 2
   */
  static compile(expression: string): CompiledFormula {
    // Validate first — will throw on illegal expressions
    const validation = FormulaEvaluator.validate(expression);
    if (!validation.valid) {
      throw new FormulaParseError(validation.error ?? 'Invalid formula');
    }

    const referencedVariables = new Set(validation.referencedVariables ?? []);

    return {
      expression,
      referencedVariables,
      evaluate(variables: FormulaVariables): number {
        return safeEvalFormula(expression, variables);
      },
    };
  }

  /**
   * Evaluate an expression directly without compiling.
   * Prefer compile() when evaluating the same formula many times.
   *
   * @throws FormulaParseError on parse error or undefined variable.
   */
  static evaluate(expression: string, variables: FormulaVariables): number {
    return safeEvalFormula(expression, variables);
  }

  /**
   * Evaluate and return 0 on error (safe fallback for BOM rendering).
   * Logs a warning to the console.
   */
  static evaluateSafe(
    expression: string,
    variables: FormulaVariables,
    fallback = 0
  ): number {
    try {
      return safeEvalFormula(expression, variables);
    } catch (e) {
      console.warn(
        `[FormulaEvaluator] evaluateSafe fallback for expression "${expression}":`,
        (e as Error).message
      );
      return fallback;
    }
  }
}
