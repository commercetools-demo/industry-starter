import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { mapLocalizedString, mapMoney } from './index';

const root = resolve(import.meta.dirname, '../..');

function sources(dir: string): string[] {
  const base = join(root, dir);
  try {
    statSync(base);
  } catch {
    return [];
  }
  const out: string[] = [];
  const walk = (d: string): void => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(name)) out.push(p);
    }
  };
  walk(base);
  return out;
}

describe('storefront-bff-and-session: Type boundary', () => {
  it('Component imports: components, hooks, context and app never import the SDK or lib/ct', () => {
    for (const file of ['components', 'hooks', 'context', 'app'].flatMap(sources)) {
      if (/\.test\.tsx?$/.test(file)) continue;
      const src = readFileSync(file, 'utf8');
      expect(src, file).not.toMatch(/from ['"]@commercetools\//);
    }
  });

  it('Component imports: lib/types.ts has only type-level SDK imports (none in the skeleton)', () => {
    const src = readFileSync(join(root, 'lib/types.ts'), 'utf8');
    expect(src).not.toMatch(/^import (?!type)/m);
  });

  it('Localized strings and money: mappers copy values and never hard-code a locale key or divide centAmount', () => {
    const src = readFileSync(join(root, 'lib/mappers/index.ts'), 'utf8');
    expect(src).not.toMatch(/\['en(-[A-Z]{2})?'\]|\.en(-US)?\b/);
    expect(src).not.toMatch(/centAmount\s*\/\s*100/);
    expect(mapMoney({ centAmount: 1999, currencyCode: 'USD', fractionDigits: 2 })).toEqual({
      centAmount: 1999,
      currencyCode: 'USD',
      fractionDigits: 2,
    });
    expect(mapLocalizedString({ 'en-US': 'Cough syrup' })).toEqual({ 'en-US': 'Cough syrup' });
    expect(mapLocalizedString(undefined)).toEqual({});
  });
});
