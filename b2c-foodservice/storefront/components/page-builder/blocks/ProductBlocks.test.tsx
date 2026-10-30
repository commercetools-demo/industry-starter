import { act, fireEvent, screen } from '@testing-library/react';
import { unstable_serialize } from 'swr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { keyChannels } from '@/lib/cache-keys';
import { parseSelection } from '@/lib/product/selection';
import type { ProductPageData } from '@/lib/types';
import { coffeePage, podPage, STORE_BK, STORE_SOHO } from '@/test/pdp';
import { renderShell, stubFetch } from '@/test/shell';

const m = vi.hoisted(() => ({ data: null as unknown }));
vi.mock('@/lib/pdp/request-product', () => ({ requestProduct: () => m.data }));
vi.mock('next-intl/server', () => ({ getTranslations: async () => (k: string) => (k === 'breadcrumb.home' ? 'Home' : k) }));
vi.mock('@/components/pdp/ReviewsSlot', () => ({ default: () => <section data-testid="reviews-slot" /> }));
vi.mock('@/i18n/routing', async () => (await import('@/test/shell')).routingMock());
vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

import { catalogComponents } from '@/components/page-builder/component-map';
import { PdpProvider } from '@/components/pdp/pdp-state';

type Part = keyof typeof PARTS;
const PARTS = {
  breadcrumbs: 'product/breadcrumbs', gallery: 'product/gallery', header: 'product/header', facts: 'product/facts', options: 'product/options',
  fulfilment: 'product/fulfilment', addToBag: 'product/add-to-bag', trust: 'product/trust', details: 'product/details', rating: 'product/rating',
  reviews: 'product/reviews',
} as const;

const SERVER_PARTS: Part[] = ['breadcrumbs', 'rating', 'reviews'];
const channels = { stores: [STORE_SOHO, STORE_BK], selectedKey: null };

/** What the product route does for an authored page: provider around the placed parts (server parts are awaited first). */
async function draw(data: ProductPageData, parts: Part[], query: Record<string, string> = {}) {
  m.data = data;
  stubFetch({ '/api/channels': () => channels, '/api/cart/count': () => ({ count: 0 }) });
  const rendered = await Promise.all(
    parts.map(async (p) => {
      const entry = catalogComponents[PARTS[p]];
      // Server parts are plain (or async) functions; calling a client part outside a render would break its hooks.
      if (SERVER_PARTS.includes(p)) return await (entry as unknown as (props: { data: never }) => unknown)({ data: {} as never });
      const Part = entry as unknown as React.FC<{ data: never }>;
      return <Part key={p} data={{} as never} />;
    }),
  );
  const landing = data.product.variants.find((v) => v.sku === data.product.defaultSku);
  return renderShell(
    <PdpProvider data={data} initialSelection={parseSelection(query, data.product.selectors, landing)}>
      {rendered.map((node, i) => (
        <div key={i}>{node as React.ReactNode}</div>
      ))}
    </PdpProvider>,
    { fallback: { [unstable_serialize(keyChannels('US'))]: channels } },
  );
}

beforeEach(() => {
  m.data = null;
});
afterEach(() => vi.unstubAllGlobals());

const ALL = Object.keys(PARTS) as Part[];

describe('an authored product page with every part', () => {
  it('draws the native parts with the native data', async () => {
    await draw(podPage(), ALL);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Ember Ristretto');
    expect(screen.getByTestId('pdp-price')).toHaveTextContent('$5.90');
    expect(screen.getByRole('navigation')).toHaveTextContent('Home');
    expect(screen.getByTestId('rating-summary')).toBeInTheDocument();
    expect(screen.getByTestId('reviews-slot')).toBeInTheDocument();
    expect(screen.getByTestId('pdp-trust')).toBeInTheDocument();
  });

  it('separate placed parts share one state: choosing a pack size in the options changes the price in the header', async () => {
    await draw(podPage(), ['header', 'options', 'addToBag']);
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: '50 box' }));
    });
    expect(screen.getByTestId('pdp-price')).toHaveTextContent('$25.95');
  });
});

describe('parts alone and omitted', () => {
  it.each(ALL)('%s renders on its own', async (part) => {
    const { container } = await draw(podPage(), [part]);
    expect(container.querySelector('section, header, nav, ul, div[data-testid], aside, button, h1, h2')).not.toBeNull();
  });

  it('a page without fulfilment, trust or details still renders and can add to the bag', async () => {
    await draw(coffeePage(), ['header', 'options', 'addToBag']);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
  });

  it('the server parts render nothing off a product page', async () => {
    m.data = null;
    for (const key of [PARTS.breadcrumbs, PARTS.rating, PARTS.reviews]) {
      const C = catalogComponents[key] as (props: { data: never }) => unknown;
      expect(await C({ data: {} as never })).toBeNull();
    }
  });
});
