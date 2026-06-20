export class FormulaParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FormulaParseError';
  }
}

export interface FormulaVariables {
  system_kw?: number;
  panel_count?: number;
  inverter_count?: number;
  battery_count?: number;
  structure_area?: number;
  string_count?: number;
  dc_cable_length?: number;
  ac_cable_length?: number;
  [key: string]: number | undefined;
}

type ASTNode = NumberNode | BinaryOpNode | UnaryOpNode | FunctionCallNode | VariableNode;

interface NumberNode { type: 'Number'; value: number; }
interface BinaryOpNode { type: 'BinaryOp'; operator: '+' | '-' | '*' | '/'; left: ASTNode; right: ASTNode; }
interface UnaryOpNode { type: 'UnaryOp'; operator: '-'; operand: ASTNode; }
interface FunctionCallNode { type: 'FunctionCall'; name: string; args: ASTNode[]; }
interface VariableNode { type: 'Variable'; name: string; }

export function safeEvalFormula(expression: string, variables?: FormulaVariables): number {
  if (!expression || expression.trim() === '' || expression === 'null') return 0;
  
  const tokens = tokenize(expression);
  let pos = 0;

  function parseExpression(): ASTNode {
    let left = parseTerm();
    while (pos < tokens.length && (tokens[pos] === '+' || tokens[pos] === '-')) {
      const operator = tokens[pos++] as '+' | '-';
      const right = parseTerm();
      left = { type: 'BinaryOp', operator, left, right };
    }
    return left;
  }

  function parseTerm(): ASTNode {
    let left = parseFactor();
    while (pos < tokens.length && (tokens[pos] === '*' || tokens[pos] === '/')) {
      const operator = tokens[pos++] as '*' | '/';
      const right = parseFactor();
      left = { type: 'BinaryOp', operator, left, right };
    }
    return left;
  }

  function parseFactor(): ASTNode {
    if (pos >= tokens.length) throw new FormulaParseError('Unexpected end of expression');
    const token = tokens[pos++];

    if (token === '-') {
      return { type: 'UnaryOp', operator: '-', operand: parseFactor() };
    }

    if (token === '(') {
      const node = parseExpression();
      if (pos >= tokens.length || tokens[pos++] !== ')') {
        throw new FormulaParseError('Expected )');
      }
      return node;
    }

    // Number
    const num = parseFloat(token);
    if (!isNaN(num)) {
      return { type: 'Number', value: num };
    }

    // Identifier (function or variable)
    const upperToken = token.toUpperCase();
    if (['CEIL', 'FLOOR', 'MAX', 'MIN', 'ROUND'].includes(upperToken)) {
      if (pos >= tokens.length || tokens[pos++] !== '(') {
        throw new FormulaParseError(`Expected ( after ${upperToken}`);
      }
      const args: ASTNode[] = [];
      if (tokens[pos] !== ')') {
        args.push(parseExpression());
        while (pos < tokens.length && tokens[pos] === ',') {
          pos++;
          args.push(parseExpression());
        }
      }
      if (pos >= tokens.length || tokens[pos++] !== ')') {
        throw new FormulaParseError('Expected )');
      }
      return { type: 'FunctionCall', name: upperToken, args };
    }

    // Security check for variables
    const blocked = ['constructor', 'prototype', '__proto__', 'globalthis', 'window', 'process', 'eval', 'function', 'require', 'import', 'export'];
    if (blocked.includes(token.toLowerCase())) {
      throw new FormulaParseError(`Illegal identifier: ${token}`);
    }

    return { type: 'Variable', name: token };
  }

  function tokenize(expr: string): string[] {
    const regex = /\s*([A-Za-z_][A-Za-z0-9_]*|\d+(?:\.\d+)?|[\+\-\*\/\(\),])\s*/g;
    const t: string[] = [];
    let match;
    let lastIndex = 0;
    while ((match = regex.exec(expr)) !== null) {
      if (match.index > lastIndex) {
         const skipped = expr.substring(lastIndex, match.index).trim();
         if (skipped) throw new FormulaParseError(`Unknown token: ${skipped}`);
      }
      t.push(match[1]);
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < expr.length) {
      const skipped = expr.substring(lastIndex).trim();
      if (skipped) throw new FormulaParseError(`Unknown token: ${skipped}`);
    }
    return t;
  }

  function evaluate(node: ASTNode): number {
    switch (node.type) {
      case 'Number':
        return node.value;
      case 'Variable':
        if (!variables || variables[node.name] === undefined) {
          throw new FormulaParseError(`Undefined variable: ${node.name}`);
        }
        return variables[node.name]!;
      case 'UnaryOp':
        return -evaluate(node.operand);
      case 'BinaryOp':
        const l = evaluate(node.left);
        const r = evaluate(node.right);
        if (node.operator === '+') return l + r;
        if (node.operator === '-') return l - r;
        if (node.operator === '*') return l * r;
        if (node.operator === '/') {
          if (r === 0) throw new FormulaParseError('Division by zero');
          return l / r;
        }
        throw new FormulaParseError(`Unknown operator: ${node.operator}`);
      case 'FunctionCall':
        const args = node.args.map(evaluate);
        if (node.name === 'CEIL') return Math.ceil(args[0]);
        if (node.name === 'FLOOR') return Math.floor(args[0]);
        if (node.name === 'ROUND') return Math.round(args[0]);
        if (node.name === 'MAX') return Math.max(...args);
        if (node.name === 'MIN') return Math.min(...args);
        throw new FormulaParseError(`Unknown function: ${node.name}`);
    }
  }

  const ast = parseExpression();
  if (pos < tokens.length) {
    throw new FormulaParseError(`Unexpected token at end: ${tokens[pos]}`);
  }
  return evaluate(ast);
}
