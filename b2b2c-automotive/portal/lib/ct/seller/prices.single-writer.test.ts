/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// E1: lib/ct/seller/prices.ts is the only module that may touch standalone prices through the client, and the routes only call it.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '..', '..', '..');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (name === 'node_modules' || name === '.next') return [];
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const sources = ['app', 'lib', 'components', 'hooks', 'scripts']
  .flatMap((d) => walk(path.join(root, d)))
  .filter((f) => /\.(ts|tsx|mjs)$/.test(f))
  .map((f) => path.relative(root, f).split(path.sep).join('/'));

const ALLOWED = new Set(['lib/ct/seller/prices.ts', 'lib/ct/seller/prices.single-writer.test.ts', 'lib/portal/catalog-fixture-root.ts']);

describe('single writer of standalone prices', () => {
  it('standalonePrices write methods appear only in prices.ts', () => {
    const offenders = sources.filter((f) => !ALLOWED.has(f) && /standalonePrices\s*\([^;]*\.(post|delete)\s*\(/.test(readFileSync(path.join(root, f), 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('prices.ts is the file that does write (guards the grep above)', () => {
    expect(readFileSync(path.join(root, 'lib/ct/seller/prices.ts'), 'utf8')).toMatch(/standalonePrices\(\)[\s\S]*\.post\(/);
  });

  it('no MAP floor, floor reconcile, cost or margin module anywhere in the portal', () => {
    const banned = /map-floor|computeFloor|assertAboveFloor|BELOW_MAP_FLOOR|malva-rules|reconcileMapFloor|BELOW_COST/;
    // branch-stock.test.ts asserts the same absence in its own source, so it names the terms.
    const SELF = new Set(['lib/ct/seller/prices.single-writer.test.ts', 'lib/ct/seller/branch-stock.test.ts']);
    const offenders = sources.filter((f) => !SELF.has(f) && banned.test(readFileSync(path.join(root, f), 'utf8')));
    expect(offenders).toEqual([]);
  });
});
