// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ storeKey: null as string | null, theme: null as unknown }));
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-next-intl-locale': 'en-US', ...(state.storeKey ? { 'x-store-key': state.storeKey } : {}) }),
}));
vi.mock('@/lib/fonts', () => ({ fontClassNames: 'font-vars' }));
const getStoreTheme = vi.hoisted(() => vi.fn(async () => state.theme));
vi.mock('@/lib/contentools/theme', () => ({ getStoreTheme }));

import RootLayout from '@/app/layout';

async function render(): Promise<string> {
  const element = (await RootLayout({ children: <main>page</main> })) as ReactElement;
  return renderToStaticMarkup(element);
}

describe('External theme values are sanitised and applied at first paint: root layout', () => {
  beforeEach(() => {
    state.storeKey = null;
    state.theme = null;
    getStoreTheme.mockClear();
  });
  it('Style element is first-paint', async () => {
    state.storeKey = 'qa-green';
    state.theme = { colorPrimary: '#1f6f43', colorPrimaryHover: '#185a37' };
    const html = await render();
    expect(getStoreTheme).toHaveBeenCalledWith('qa-green');
    const head = /<head>([\s\S]*)<\/head>/.exec(html)?.[1] ?? '';
    expect(head).toContain('<style id="store-theme">');
    expect(head).toContain('--color-brand-700:#1f6f43');
    expect(html.indexOf('<style id="store-theme">')).toBeLessThan(html.indexOf('<body'));
  });
  it('Default store renders an empty style element', async () => {
    state.storeKey = 'mau-reseller-north';
    state.theme = null;
    expect(await render()).toContain('<style id="store-theme"></style>');
  });
  it('No store header reads the default namespace theme', async () => {
    await render();
    expect(getStoreTheme).toHaveBeenCalledWith(null);
  });
  it('Hostile theme leaves no markup in the head', async () => {
    state.storeKey = 'qa-hostile';
    state.theme = { colorPrimary: ';}</style><script>window.__pwned=1</script>', fontFamily: 'x;}</style><script>', colorAccent: 'url(javascript:alert(1))' };
    const html = await render();
    expect(html).not.toContain('<script');
    expect(html).not.toContain('__pwned');
    expect(html).toContain('<style id="store-theme"></style>');
  });
});
