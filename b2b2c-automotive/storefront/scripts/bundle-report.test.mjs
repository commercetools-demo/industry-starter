// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { BUDGETS, budgetFor, buildReport, overBudget, parseManifest, routeOfEntry } from './bundle-report.mjs';
import { tmpApp } from './test-utils.mjs';

const manifestFile = (route, entry, chunks) =>
  `globalThis.__RSC_MANIFEST = globalThis.__RSC_MANIFEST || {};\nglobalThis.__RSC_MANIFEST["${route}"] = ${JSON.stringify({ clientModules: {}, entryJSFiles: { [entry]: chunks } })};\n`;

const noise = (n) => Array.from({ length: n }, (_, i) => `${(i * 7919) % 104729}:${(i * 104729) % 7919}`).join(',');

describe('bundle report', () => {
  it('maps a manifest entry to its route and drops route groups', () => {
    expect(routeOfEntry('[project]/app/[locale]/[store]/(account)/account/orders/page')).toBe('/[locale]/[store]/account/orders');
    expect(routeOfEntry('[project]/app/[locale]/[store]/page')).toBe('/[locale]/[store]');
    expect(routeOfEntry('[project]/app/[locale]/layout')).toBeNull();
  });

  it('gives listing, search, product and cart 220 KB, the home page its documented Puck exception and the rest 260 KB', () => {
    expect(budgetFor('/[locale]/[store]')).toBe(BUDGETS.home);
    for (const r of ['/[locale]/[store]/category/[slug]', '/[locale]/[store]/p/[slug]', '/[locale]/[store]/search', '/[locale]/[store]/cart']) expect(budgetFor(r)).toBe(BUDGETS.shopping);
    for (const r of ['/[locale]/[store]/checkout', '/[locale]/[store]/account/orders', '/[locale]/[store]/checkout/confirmation/[orderNumber]']) expect(budgetFor(r)).toBe(BUDGETS.other);
    expect(BUDGETS.shopping).toBe(220 * 1024);
  });

  it('parses a client reference manifest', () => {
    expect(parseManifest(manifestFile('/x/page', '[project]/app/x/page', ['static/chunks/a.js'])).entryJSFiles).toBeTruthy();
  });

  it('sums the gzip size of shared and page chunks once and fails a route over its budget', () => {
    const big = noise(300000);
    const root = tmpApp({
      '.next/build-manifest.json': JSON.stringify({ polyfillFiles: ['static/chunks/p.js'], rootMainFiles: ['static/chunks/m.js'] }),
      '.next/static/chunks/p.js': 'a'.repeat(100),
      '.next/static/chunks/m.js': 'b'.repeat(100),
      '.next/static/chunks/small.js': 'c'.repeat(100),
      '.next/static/chunks/big.js': big,
      '.next/server/app/[locale]/[store]/cart/page_client-reference-manifest.js': manifestFile('/[locale]/[store]/cart/page', '[project]/app/[locale]/[store]/cart/page', ['static/chunks/m.js', 'static/chunks/small.js']),
      '.next/server/app/[locale]/[store]/p/[slug]/page_client-reference-manifest.js': manifestFile('/[locale]/[store]/p/[slug]/page', '[project]/app/[locale]/[store]/p/[slug]/page', ['static/chunks/big.js']),
    });
    const rows = buildReport(root);
    const cart = rows.find((r) => r.route === '/[locale]/[store]/cart');
    expect(cart.files).toBe(3);
    expect(cart.bytes).toBe(['a'.repeat(100), 'b'.repeat(100), 'c'.repeat(100)].reduce((n, s) => n + gzipSync(s).length, 0));
    expect(overBudget(rows).map((r) => r.route)).toEqual(['/[locale]/[store]/p/[slug]']);
  });

  it('refuses a missing build', () => {
    expect(() => buildReport(tmpApp({}))).toThrow(/next build/);
  });
});
