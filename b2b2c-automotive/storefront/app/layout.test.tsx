// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { isValidElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const headerValue = vi.hoisted(() => ({ current: null as string | null }));
vi.mock('next/headers', () => ({ headers: async () => new Headers(headerValue.current ? { 'x-next-intl-locale': headerValue.current } : {}) }));
vi.mock('@/lib/fonts', () => ({ fontClassNames: '--font-poppins-class' }));

import RootLayout from './layout';

async function lang() {
  const el = await RootLayout({ children: null });
  expect(isValidElement(el)).toBe(true);
  return (el as { props: { lang: string; className: string } }).props;
}

describe('Locale routing for two locales: root layout', () => {
  beforeEach(() => {
    headerValue.current = null;
  });
  it('Root layout sets lang from the proxy header', async () => {
    headerValue.current = 'en-US';
    expect((await lang()).lang).toBe('en-US');
  });
  it('Root layout falls back to de-DE without or with an unsupported header', async () => {
    expect((await lang()).lang).toBe('de-DE');
    headerValue.current = 'fr-FR';
    expect((await lang()).lang).toBe('de-DE');
  });
  it('Root layout puts the font variable classes on html', async () => {
    expect((await lang()).className).toContain('--font-poppins-class');
  });
});
