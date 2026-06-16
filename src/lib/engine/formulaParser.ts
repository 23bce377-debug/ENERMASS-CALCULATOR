export class FormulaParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FormulaParseError';
  }
}

export function safeEvalFormula(expression: string): number {
  if (!expression || expression === 'null') return 0;
  
  const tokens = tokenize(expression);
  let pos = 0;

  function parseExpression(): number {
    let left = parseTerm();
    while (pos < tokens.length && (tokens[pos] === '+' || tokens[pos] === '-')) {
      const op = tokens[pos++];
      const right = parseTerm();
      if (op === '+') left += right;
      else left -= right;
    }
    return left;
  }

  function parseTerm(): number {
    let left = parseFactor();
    while (pos < tokens.length && (tokens[pos] === '*' || tokens[pos] === '/')) {
      const op = tokens[pos++];
      const right = parseFactor();
      if (op === '*') left *= right;
      else left /= right;
    }
    return left;
  }

  function parseFactor(): number {
    if (pos >= tokens.length) throw new FormulaParseError('Unexpected end of expression');
    const token = tokens[pos++];

    if (token === '(') {
      const val = parseExpression();
      if (pos >= tokens.length || tokens[pos++] !== ')') {
        throw new FormulaParseError('Expected )');
      }
      return val;
    }

    if (['CEIL', 'FLOOR', 'MAX', 'ROUND'].includes(token.toUpperCase())) {
      const funcName = token.toUpperCase();
      if (pos >= tokens.length || tokens[pos++] !== '(') {
        throw new FormulaParseError(`Expected ( after ${funcName}`);
      }
      const args: number[] = [];
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

      if (funcName === 'CEIL') return Math.ceil(args[0]);
      if (funcName === 'FLOOR') return Math.floor(args[0]);
      if (funcName === 'ROUND') return Math.round(args[0]);
      if (funcName === 'MAX') return Math.max(...args);
    }

    const num = parseFloat(token);
    if (isNaN(num)) {
      throw new FormulaParseError(`Invalid number or function: ${token}`);
    }
    return num;
  }

  function tokenize(expr: string): string[] {
    const regex = /\s*([A-Za-z]+|\d+(?:\.\d+)?|[\+\-\*\/\(\),])\s*/g;
    const tokens: string[] = [];
    let match;
    let lastIndex = 0;
    while ((match = regex.exec(expr)) !== null) {
      if (match.index > lastIndex) {
         const skipped = expr.substring(lastIndex, match.index).trim();
         if (skipped) throw new FormulaParseError(`Unknown token: ${skipped}`);
      }
      tokens.push(match[1]);
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < expr.length) {
      const skipped = expr.substring(lastIndex).trim();
      if (skipped) throw new FormulaParseError(`Unknown token: ${skipped}`);
    }
    return tokens;
  }

  const result = parseExpression();
  if (pos < tokens.length) {
    throw new FormulaParseError(`Unexpected token at end: ${tokens[pos]}`);
  }
  return result;
}
