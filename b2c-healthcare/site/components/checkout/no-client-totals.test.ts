import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/**
 * checkout-page: the summary is a projection of the last cart response. The checkout components and hooks never
 * calculate a price: no `reduce`, no `Math.*`, no arithmetic whose operands mention an amount.
 */
const ARITHMETIC = new Set<ts.SyntaxKind>([ts.SyntaxKind.PlusToken, ts.SyntaxKind.MinusToken, ts.SyntaxKind.AsteriskToken, ts.SyntaxKind.SlashToken, ts.SyntaxKind.PercentToken, ts.SyntaxKind.PlusEqualsToken, ts.SyntaxKind.MinusEqualsToken]);
const MONEY_WORD = /centAmount|price|subtotal|total|amount|shipping|fee|tax/i;

function findPriceArithmetic(source: string, fileName: string): string[] {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, fileName.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const problems: string[] = [];
  const where = (node: ts.Node) => `${fileName}:${file.getLineAndCharacterOfPosition(node.getStart()).line + 1}`;
  const visit = (node: ts.Node): void => {
    if (ts.isBinaryExpression(node) && ARITHMETIC.has(node.operatorToken.kind) && MONEY_WORD.test(node.getText(file))) problems.push(`${where(node)} arithmetic on an amount: ${node.getText(file)}`);
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const callee = node.expression;
      if (callee.name.text === 'reduce') problems.push(`${where(node)} reduce()`);
      if (ts.isIdentifier(callee.expression) && callee.expression.text === 'Math') problems.push(`${where(node)} Math.${callee.name.text}()`);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return problems;
}

const root = resolve(__dirname, '../..');
const files = [
  ...readdirSync(__dirname).filter((f) => f.endsWith('.tsx') && !f.endsWith('.test.tsx')).map((f) => join(__dirname, f)),
  join(root, 'hooks/use-checkout.ts'),
  join(root, 'hooks/use-place-flow.ts'),
];

describe('checkout-page: Checkout re-reading totals after each shipping change: figures strictly from the cart', () => {
  it('finds the checkout components and hooks', () => {
    expect(files.length).toBeGreaterThanOrEqual(8);
  });

  it.each(files.map((f) => [f.replace(`${root}/`, ''), f]))('%s has no sums or other arithmetic on prices', (_name, path) => {
    expect(findPriceArithmetic(readFileSync(path as string, 'utf8'), path as string)).toEqual([]);
  });

  it('the detector flags a client-side sum', () => {
    expect(findPriceArithmetic('const x = cart.total.centAmount + shipping.price.centAmount;', 'x.ts')).toHaveLength(1);
    expect(findPriceArithmetic('const x = lines.reduce((a, l) => a, 0);', 'x.ts')).toHaveLength(1);
  });
});
