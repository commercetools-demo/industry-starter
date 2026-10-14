// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
// Workstream X-04 (single chokepoint): every way to put a price on a product goes through `setStandalonePrice`, which calls `assertValidPrice`
// before any write. Complements prices.single-writer.test.ts (which fences the commercetools write call itself): this one fences the CALLERS of
// the chokepoint and the raw price actions of the Import API, so a new price path cannot skip the rule.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '..', '..', '..');
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (name === 'node_modules' || name === '.next') return [];
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
const sources = ['app', 'lib', 'components', 'hooks']
  .flatMap((d) => walk(path.join(root, d)))
  .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f))
  .map((f) => path.relative(root, f).split(path.sep).join('/'));
const read = (rel: string) => readFileSync(path.join(root, rel), 'utf8');

/** The modules that may set a price, all through `setStandalonePrice`. */
const PRICE_WRITERS = new Set(['lib/ct/seller/prices.ts', 'lib/ct/seller/bundles.ts', 'lib/ct/seller/branch-stock.ts', 'lib/ct/seller/local-products.ts']);

describe('price write callers (X-04)', () => {
  it('only the listed modules call setStandalonePrice', () => {
    const callers = sources.filter((f) => /\bsetStandalonePrice\s*\(/.test(read(f)));
    expect(callers.filter((f) => !PRICE_WRITERS.has(f))).toEqual([]);
  });
  it('setStandalonePrice validates the money before it writes (guards the fence above)', () => {
    const source = read('lib/ct/seller/prices.ts');
    const body = source.slice(source.indexOf('export async function setStandalonePrice'));
    expect(body.indexOf('assertValidPrice')).toBeGreaterThan(-1);
    expect(body.indexOf('assertValidPrice')).toBeLessThan(body.indexOf('standalonePrices'));
  });
  it('raw price actions never appear outside the price modules and the Import API client', () => {
    const raw = /\b(addPrice|changePrice|setPrices|setDiscountedPrice)\b|import-containers/;
    const offenders = sources.filter((f) => !PRICE_WRITERS.has(f) && f !== 'lib/import/import-api.ts' && f !== 'lib/portal/catalog-fixture-root.ts' && raw.test(read(f)));
    expect(offenders).toEqual([]);
  });
  it('the only caller of the Import API client is the product import service', () => {
    const callers = sources.filter((f) => /from\s+['"]@\/lib\/import\/import-api['"]/.test(read(f)));
    expect(callers.every((f) => f.startsWith('lib/ct/seller/') || f.startsWith('app/api/seller/') || f.startsWith('lib/import/') || f === 'lib/portal/w-fixture-root.ts')).toBe(true); // the fixture root is the development stand-in (PORTAL_DEV_FIXTURES, never production)
  });
});
