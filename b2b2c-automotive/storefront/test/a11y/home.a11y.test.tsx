// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Workstream Y: page-level axe for the home page (default layout) in both locales, default theme and themed store.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DefaultHome } from '@/components/home/DefaultHome';
import { HomeDataProvider } from '@/components/home/HomeDataContext';
import { homeData, product } from '@/test/home';
import { axePage, LOCALES, renderStorePage, stubShellFetch } from '@/test/a11y';

vi.mock('@/i18n/routing', async () => (await import('@/test/routing-mock')).mockRouting());

afterEach(() => vi.unstubAllGlobals());

const popular = [
  { product: product({ id: 'p1' }), fit: 'unknown' as const },
  { product: product({ id: 'p2', name: 'Vektra oil filter', slug: 'vektra-oil-filter', sku: 'MLV-OF-1' }), fit: 'unknown' as const },
];

describe.each(LOCALES)('a11y: home page (%s)', (locale) => {
  it.each(['default', 'themed'] as const)('has no axe violations with the %s theme', async (theme) => {
    stubShellFetch();
    renderStorePage(
      <HomeDataProvider value={homeData({ popular })}>
        <DefaultHome />
      </HomeDataProvider>,
      { locale, theme },
    );
    expect(await axePage()).toHaveNoViolations();
  });
});

describe('a11y: home page structure', () => {
  it('has exactly one h1 and the skip link is the first focus stop', async () => {
    stubShellFetch();
    const { container } = renderStorePage(
      <HomeDataProvider value={homeData({ popular })}>
        <DefaultHome />
      </HomeDataProvider>,
    );
    expect(container.querySelectorAll('h1')).toHaveLength(1);
    const first = container.querySelector<HTMLElement>('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
    expect(first?.getAttribute('href')).toMatch(/^#/);
  });
});
