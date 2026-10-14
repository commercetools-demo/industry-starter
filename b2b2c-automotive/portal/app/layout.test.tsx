/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { isValidElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const headerValue = vi.hoisted(() => ({ value: null as string | null }));
vi.mock('next/headers', () => ({ headers: async () => new Headers(headerValue.value ? { 'x-next-intl-locale': headerValue.value } : {}) }));
vi.mock('@/lib/fonts', () => ({ fontClassNames: '__inter' }));
vi.mock('./globals.css', () => ({}));

import RootLayout, { metadata } from './layout';

async function htmlProps(locale: string | null) {
  headerValue.value = locale;
  const el = await RootLayout({ children: null });
  expect(isValidElement(el)).toBe(true);
  return (el as ReactElement<Record<string, unknown>>).props;
}

describe('Root layout', () => {
  it('Root layout sets lang from the proxy header', async () => {
    expect((await htmlProps('en-US')).lang).toBe('en-US');
    expect((await htmlProps('de-DE')).lang).toBe('de-DE');
  });
  it('falls back to de-DE without or with an unsupported header', async () => {
    expect((await htmlProps(null)).lang).toBe('de-DE');
    expect((await htmlProps('fr-FR')).lang).toBe('de-DE');
  });
  it('Root layout starts light and carries the font class', async () => {
    const props = await htmlProps(null);
    expect(props['data-theme']).toBe('light');
    expect(props.className).toBe('__inter');
  });
});

describe('lang attribute follows locale (workstream Y, 3.1.1)', () => {
  const markup = async (locale: string | null) => {
    headerValue.value = locale;
    return renderToStaticMarkup(await RootLayout({ children: <p>body</p> }));
  };

  it('renders lang="de-DE" and lang="en-US" on the html element', async () => {
    expect(await markup('de-DE')).toContain('<html lang="de-DE"');
    expect(await markup('en-US')).toContain('<html lang="en-US"');
    expect(await markup('fr-FR')).toContain('<html lang="de-DE"');
  });

  it('applies the theme script before first paint (no flash, no layout shift from the theme)', async () => {
    expect(await markup('en-US')).toMatch(/<head><script>/);
  });

  it('titles every route through one template (2.4.2)', () => {
    expect(metadata.title).toEqual({ default: 'Malva Partner Portal', template: '%s | Malva Partner Portal' });
  });
});
