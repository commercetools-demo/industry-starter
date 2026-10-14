// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Workstream K: the automotive blocks inside a rendered Puck document.
import type { PuckData } from '@commercetools-demo/puck-types';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { renderToString } from 'react-dom/server';
import { SWRConfig } from 'swr';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { homeData, product } from '@/test/home';
import messages from '@/messages/en-US.json';
import { installFakeApi } from '@/test/vehicle';
import { GarageContext } from '@/context/GarageProvider';
import { AUTOMOTIVE_BLOCKS } from '@/lib/puck/automotive-blocks.schema';
import { ContentoolsPage } from './ContentoolsPage';
import { puckRenderConfig } from './render-config';

vi.mock('@/i18n/routing', async () => (await import('@/test/routing-mock')).mockRouting());
afterEach(() => vi.unstubAllGlobals());

const doc = (content: Array<{ type: string; props: Record<string, unknown> }>) => ({ content: content.map((c, i) => ({ ...c, props: { id: `b-${i}`, ...c.props } })), root: { props: {} } }) as unknown as PuckData;
const base = { storeKey: 'mau-reseller-north', projectKey: 'proj-1', locale: 'en-US' };

function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="en-US" messages={messages}>
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <GarageContext.Provider value={{ lookupEnabled: false }}>{children}</GarageContext.Provider>
      </SWRConfig>
    </NextIntlClientProvider>
  );
}

describe('Reseller-controlled content blocks', () => {
  it('registers the six automotive blocks next to the default blocks', () => {
    for (const name of AUTOMOTIVE_BLOCKS) expect(puckRenderConfig.components[name]).toBeDefined();
    expect(puckRenderConfig.components.TextBlock).toBeDefined();
  });

  it('renders registered blocks in document order', () => {
    installFakeApi();
    const data = doc([
      { type: 'AutomotiveHero', props: { showFinder: false } },
      { type: 'CategoryTiles', props: {} },
      { type: 'PromoBanner', props: { title: 'Brake week', text: 'Save on pads', tone: 'neutral' } },
      { type: 'PopularProducts', props: { count: 4 } },
      { type: 'BrandStrip', props: { title: 'Brands we carry', brands: [{ name: 'Vektra' }] } },
    ]);
    const popular = Array.from({ length: 4 }, (_, i) => ({ product: product({ id: `p${i}`, name: `Part ${i}`, sku: `S${i}`, slug: `s${i}` }), fit: 'unknown' as const }));
    render(<ContentoolsPage {...base} data={data} homeData={homeData({ popular })} />, { wrapper: Providers });
    const order = ['Genuine parts from Küstenwerk Autoteile, ready near you.', 'Shop by category', 'Brake week', 'Popular at Küstenwerk Autoteile', 'Brands we carry'];
    const headings = screen.getAllByRole('heading').map((h) => h.textContent);
    expect(order.map((o) => headings.indexOf(o))).toEqual([...order.map((o) => headings.indexOf(o))].sort((a, b) => a - b));
    for (const o of order) expect(headings).toContain(o);
  });

  it('unknown block type renders nothing and does not throw', () => {
    installFakeApi();
    const data = doc([
      { type: 'DoesNotExist', props: {} },
      { type: 'PromoBanner', props: { title: 'Still here', text: 'x' } },
    ]);
    expect(() => render(<ContentoolsPage {...base} data={data} homeData={homeData()} />, { wrapper: Providers })).not.toThrow();
    expect(screen.getByText('Still here')).toBeInTheDocument();
  });

  it('a block with broken props falls back to its defaults', () => {
    installFakeApi();
    const data = doc([{ type: 'PopularProducts', props: { count: 'many', title: 5 } }]);
    const popular = Array.from({ length: 8 }, (_, i) => ({ product: product({ id: `p${i}`, name: `Part ${i}`, sku: `S${i}`, slug: `s${i}` }), fit: 'unknown' as const }));
    render(<ContentoolsPage {...base} data={data} homeData={homeData({ popular })} />, { wrapper: Providers });
    expect(screen.getAllByRole('article')).toHaveLength(8);
    expect(screen.getByRole('heading', { name: 'Popular at Küstenwerk Autoteile' })).toBeInTheDocument();
  });

  it('the page is in the initial server HTML (render mode)', () => {
    const data = doc([{ type: 'AutomotiveHero', props: { showFinder: false } }]);
    const html = renderToString(
      <Providers>
        <ContentoolsPage {...base} data={data} homeData={homeData()} />
      </Providers>,
    );
    expect(html).toContain('Shop all parts');
    expect(html).toContain('Genuine parts from Küstenwerk Autoteile');
  });

  it('children and fallback blocks also get the home data', () => {
    installFakeApi();
    render(
      <ContentoolsPage {...base} data={null} homeData={homeData()}>
        <p>Fallback</p>
      </ContentoolsPage>,
      { wrapper: Providers },
    );
    expect(screen.getByText('Fallback')).toBeInTheDocument();
  });
});
