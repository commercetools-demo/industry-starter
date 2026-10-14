// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { render } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));
const theme = vi.hoisted(() => ({ current: null as unknown }));
vi.mock('@/lib/contentools/theme', () => ({ getStoreTheme: async () => theme.current }));

import ThemePreview from './page';

const params = (store: string) => ({ params: Promise.resolve({ store }) });

afterEach(() => vi.unstubAllEnvs());

describe('Theme preview (dev)', () => {
  it('Preview applies the adapter output', async () => {
    theme.current = { colorPrimary: '#1f6f43', colorPrimaryHover: '#185a37', borderRadius: 'none' };
    const { container } = render(await ThemePreview(params('qa-green')));
    const style = container.querySelector('style#store-theme-preview')!;
    expect(style.textContent).toContain('--color-brand-700:#1f6f43');
    expect(style.textContent).toContain('--radius-md:0px');
    for (const id of ['btn-primary', 'btn-secondary', 'price', 'chip', 'hero', 'fit-ok', 'fit-no']) {
      expect(container.querySelector(`[data-testid="${id}"]`), id).not.toBeNull();
    }
  });
  it('Default theme gives an empty preview style', async () => {
    theme.current = null;
    const { container } = render(await ThemePreview(params('default')));
    expect(container.querySelector('style#store-theme-preview')!.textContent).toBe('');
  });
  it('Preview escapes nothing from the theme', async () => {
    theme.current = { colorPrimary: ';}</style><script>alert(1)</script>', fontFamily: 'x;}</style>', colorAccent: 'url(javascript:alert(1))', borderRadius: '8px;}' };
    const html = renderToStaticMarkup(await ThemePreview(params('qa-hostile')));
    expect(html).not.toContain('<script');
    expect(html).not.toContain('alert(1)');
    expect(html).not.toContain('url(');
  });
  it('The store segment is escaped as text', async () => {
    theme.current = null;
    const html = renderToStaticMarkup(await ThemePreview(params('<script>x</script>')));
    expect(html).not.toContain('<script>');
  });
  it('Preview is not found in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    await expect(ThemePreview(params('qa-green'))).rejects.toThrow('NEXT_NOT_FOUND');
  });
});
