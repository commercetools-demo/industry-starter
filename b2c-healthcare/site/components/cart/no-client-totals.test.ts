import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/**
 * cart-page: Cart with engine-calculated totals. The cart components and hook must show the platform's numbers and
 * never calculate one: no `reduce`, no `Math.*`, and no arithmetic whose operands mention a price or amount.
 * (The server mapper takes the subtotal from the platform's line totals; see lib/mappers/cart.ts.)
 */
const ARITHMETIC = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.PlusToken,
  ts.SyntaxKind.MinusToken,
  ts.SyntaxKind.AsteriskToken,
  ts.SyntaxKind.SlashToken,
  ts.SyntaxKind.PercentToken,
  ts.SyntaxKind.PlusEqualsToken,
  ts.SyntaxKind.MinusEqualsToken,
  ts.SyntaxKind.AsteriskEqualsToken,
  ts.SyntaxKind.SlashEqualsToken,
]);
const MONEY_WORD = /centAmount|price|subtotal|total|amount|shipping|fee/i;

export function findPriceArithmetic(source: string, fileName = 'x.tsx'): string[] {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, fileName.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const problems: string[] = [];
  const where = (node: ts.Node) => `${fileName}:${file.getLineAndCharacterOfPosition(node.getStart()).line + 1}`;
  const visit = (node: ts.Node): void => {
    if (ts.isBinaryExpression(node) && ARITHMETIC.has(node.operatorToken.kind) && MONEY_WORD.test(node.getText(file))) {
      problems.push(`${where(node)} arithmetic on an amount: ${node.getText(file)}`);
    }
    if ((ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) && MONEY_WORD.test(node.getText(file)) && [ts.SyntaxKind.PlusPlusToken, ts.SyntaxKind.MinusMinusToken].includes(node.operator)) {
      problems.push(`${where(node)} increment of an amount`);
    }
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      if (ts.isPropertyAccessExpression(callee) && callee.name.text === 'reduce') problems.push(`${where(node)} reduce() in a cart component`);
      if (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression) && callee.expression.text === 'Math') problems.push(`${where(node)} Math.${callee.name.text}() in a cart component`);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return problems;
}

const root = resolve(__dirname, '../..');
const cartFiles = [
  ...readdirSync(__dirname)
    .filter((f) => f.endsWith('.tsx') && !f.endsWith('.test.tsx'))
    .map((f) => join(__dirname, f)),
  join(root, 'hooks/use-cart.ts'),
];

describe('cart-page › Cart with engine-calculated totals after every change: Summary figures strictly from the platform', () => {
  it('finds the cart components and the hook', () => {
    expect(cartFiles.length).toBeGreaterThanOrEqual(4);
  });

  it.each(cartFiles.map((f) => [f.replace(`${root}/`, ''), f]))('%s has no sums or other arithmetic on prices', (_name, path) => {
    expect(findPriceArithmetic(readFileSync(path as string, 'utf8'), path as string)).toEqual([]);
  });

  it('the detector catches the shapes it exists for', () => {
    expect(findPriceArithmetic('const t = lines.reduce((s, l) => s + l.totalPrice.centAmount, 0);')).not.toEqual([]);
    expect(findPriceArithmetic('const t = a.price.centAmount + b.price.centAmount;')).not.toEqual([]);
    expect(findPriceArithmetic('const t = cart.total.centAmount / 100;')).not.toEqual([]);
    expect(findPriceArithmetic('let s = 0; s += line.unitPrice.centAmount;')).not.toEqual([]);
    expect(findPriceArithmetic('const x = Math.round(cart.total.centAmount);')).not.toEqual([]);
    expect(findPriceArithmetic('const label = `a` + name; const n = list.length - 1;')).toEqual([]);
  });
});
