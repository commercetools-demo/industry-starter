/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { BUDGETS, budgetFor, buildReport, overBudget, parseManifest, routeOfEntry } from './bundle-report.mjs';
import { tmp } from './test-utils.mjs';

const manifestFile = (route, entry, chunks) =>
  `globalThis.__RSC_MANIFEST = globalThis.__RSC_MANIFEST || {};\nglobalThis.__RSC_MANIFEST["${route}"] = ${JSON.stringify({ clientModules: {}, entryJSFiles: { [entry]: chunks } })};\n`;

const noise = (n) => Array.from({ length: n }, (_, i) => `${(i * 7919) % 104729}:${(i * 104729) % 7919}`).join(',');

describe('bundle report', () => {
  it('maps a manifest entry to its route and drops route groups', () => {
    expect(routeOfEntry('[project]/app/[locale]/(portal)/catalog/prices/page')).toBe('/[locale]/catalog/prices');
    expect(routeOfEntry('[project]/app/[locale]/(portal)/page')).toBe('/[locale]');
    expect(routeOfEntry('[project]/app/[locale]/layout')).toBeNull();
  });

  it('gives the editor routes, and only those, the exception budget', () => {
    expect(budgetFor('/[locale]/content/[...slug]')).toBe(BUDGETS.editor);
    expect(budgetFor('/[locale]/store/theme')).toBe(BUDGETS.editor);
    expect(budgetFor('/[locale]/catalog')).toBe(BUDGETS.default);
    expect(budgetFor('/[locale]/store/settings')).toBe(BUDGETS.default);
  });

  it('parses a client reference manifest', () => {
    expect(parseManifest(manifestFile('/x/page', '[project]/app/x/page', ['static/chunks/a.js'])).entryJSFiles).toBeTruthy();
  });

  it('sums the gzip size of shared and page chunks once and fails a route over its budget', () => {
    const big = noise(400000); // incompressible enough to exceed 350 KB gzip
    const root = tmp({
      '.next/build-manifest.json': JSON.stringify({ polyfillFiles: ['static/chunks/p.js'], rootMainFiles: ['static/chunks/m.js'] }),
      '.next/static/chunks/p.js': 'a'.repeat(100),
      '.next/static/chunks/m.js': 'b'.repeat(100),
      '.next/static/chunks/small.js': 'c'.repeat(100),
      '.next/static/chunks/big.js': big,
      '.next/server/app/[locale]/(portal)/ok/page_client-reference-manifest.js': manifestFile('/[locale]/(portal)/ok/page', '[project]/app/[locale]/(portal)/ok/page', ['static/chunks/m.js', 'static/chunks/small.js']),
      '.next/server/app/[locale]/(portal)/heavy/page_client-reference-manifest.js': manifestFile('/[locale]/(portal)/heavy/page', '[project]/app/[locale]/(portal)/heavy/page', ['static/chunks/big.js']),
    });
    const rows = buildReport(root);
    const ok = rows.find((r) => r.route === '/[locale]/ok');
    // the nomodule polyfill chunk (p.js) is not counted; the main chunk (m.js) is counted once even though the page lists it too
    expect(ok.files).toBe(2);
    expect(ok.bytes).toBe(['b'.repeat(100), 'c'.repeat(100)].reduce((n, s) => n + gzipSync(s).length, 0));
    expect(overBudget(rows).map((r) => r.route)).toEqual(['/[locale]/heavy']);
  });

  it('refuses a missing build', () => {
    expect(() => buildReport(tmp({}))).toThrow(/next build/);
  });
});
