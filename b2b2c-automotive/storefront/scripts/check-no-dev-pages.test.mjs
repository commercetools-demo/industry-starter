// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import { checkNoDevPages } from './check-no-dev-pages.mjs';
import { tmpApp } from './test-utils.mjs';

const GUARDED = "import { notFound } from 'next/navigation';\nexport default function P() { if (process.env.NODE_ENV === 'production') notFound(); return null; }";

describe('Gates and tests: Dev page in a release build', () => {
  it('Dev page in a release build fails', () => {
    expect(checkNoDevPages(tmpApp({ 'app/dev/tokens/page.tsx': GUARDED }), { RELEASE: '1' })).toHaveLength(1);
  });
  it('a guarded dev page passes outside a release build', () => {
    expect(checkNoDevPages(tmpApp({ 'app/dev/tokens/page.tsx': GUARDED }), {})).toEqual([]);
  });
  it('an unguarded dev page fails outside a release build', () => {
    expect(checkNoDevPages(tmpApp({ 'app/dev/x/page.tsx': 'export default () => null;' }), {})).toHaveLength(1);
  });
  it('no dev pages passes in a release build', () => {
    expect(checkNoDevPages(tmpApp({ 'app/page.tsx': 'export default () => null;' }), { RELEASE: '1' })).toEqual([]);
  });
});
