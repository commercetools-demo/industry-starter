import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

const getLocale = vi.fn<() => Promise<string>>();
vi.mock('next-intl/server', () => ({ getLocale: () => getLocale() }));
vi.mock('next/font/google', () => {
  const font = (name: string) => () => ({ variable: `--font-${name}` });
  return { Poppins: font('poppins'), Lato: font('lato'), Roboto: font('roboto') };
});

vi.mock('@/lib/swr-fallback', () => ({ getSwrFallback: async () => ({}) }));

import RootLayout from './layout';

describe('storefront-locale-routing: Messages and document language', () => {
  it('Document language: <html lang> follows the active locale', async () => {
    getLocale.mockResolvedValue('en-US');
    const html = (await RootLayout({ children: null })) as ReactElement<{ lang: string }>;
    expect(html.type).toBe('html');
    expect(html.props.lang).toBe('en-US');

    getLocale.mockResolvedValue('de-DE');
    const other = (await RootLayout({ children: null })) as ReactElement<{ lang: string }>;
    expect(other.props.lang).toBe('de-DE');
  });
});
