import { beforeEach, describe, expect, it, vi } from 'vitest';
import { podPage, renderPdp } from '@/test/pdp';

const h = vi.hoisted(() => ({ load: vi.fn(), redirect: vi.fn() }));
vi.mock('@/lib/pdp/load', () => ({ loadProductPage: h.load }));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));
vi.mock('next-intl/server', () => ({ setRequestLocale: () => {} }));
vi.mock('@/components/pdp/RelatedStrip', () => ({ default: () => null }));
vi.mock('@/i18n/routing', async () => ({
  ...(await (await import('@/test/shell')).routingMock()),
  permanentRedirect: (args: unknown) => {
    h.redirect(args);
    throw new Error('NEXT_REDIRECT');
  },
}));
vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

import ProductPage, { generateMetadata } from './page';

const props = (over: { locale?: string; slug?: string; sku?: string; query?: Record<string, string | string[]> } = {}) => ({
  params: Promise.resolve({ locale: over.locale ?? 'en-US', slug: over.slug ?? 'ember-ristretto', sku: over.sku ?? 'POD-10' }),
  searchParams: Promise.resolve(over.query ?? {}),
});

beforeEach(() => {
  vi.stubEnv('APP_MODE', 'website');
  h.load.mockReset();
  h.redirect.mockReset();
});

describe('product route', () => {
  it('canonical slug redirects permanently and keeps the query', async () => {
    h.load.mockResolvedValue(podPage());
    await expect(ProductPage(props({ slug: 'old-name', query: { capsulesPerPack: '50', choose: 'capsulesPerPack' } }))).rejects.toThrow('NEXT_REDIRECT');
    expect(h.redirect).toHaveBeenCalledWith({ href: '/p/ember-ristretto/POD-10?capsulesPerPack=50&choose=capsulesPerPack', locale: 'en-US' });
  });

  it('the canonical slug renders without a redirect', async () => {
    h.load.mockResolvedValue(podPage());
    const el = await ProductPage(props({ query: { capsulesPerPack: '50' } }));
    expect(h.redirect).not.toHaveBeenCalled();
    expect(el.props.initialSelection).toEqual({ capsulesPerPack: '50' });
  });

  it('unknown sku 404', async () => {
    h.load.mockResolvedValue(null);
    await expect(ProductPage(props({ sku: 'NOPE' }))).rejects.toThrow('NEXT_NOT_FOUND');
    expect(h.load).toHaveBeenCalledWith('NOPE', 'en-US');
  });

  it('metadata uses the same market context as the page', async () => {
    h.load.mockResolvedValue(podPage());
    const meta = await generateMetadata(props({ locale: 'en-CA' }));
    expect(h.load).toHaveBeenCalledWith('POD-10', 'en-CA');
    expect(meta.title).toBe('Ember Ristretto');
    expect(meta.description).toBe('A dark roast pod. Compatible with Original machines.');
    expect(meta.alternates?.canonical).toBe('/en-CA/p/ember-ristretto/POD-10');
  });

  it('metadata prefers the product meta fields and is empty for an unknown product', async () => {
    const data = podPage();
    h.load.mockResolvedValue({ ...data, product: { ...data.product, metaTitle: 'Ristretto pods', metaDescription: 'Dark and intense.' } });
    const meta = await generateMetadata(props());
    expect(meta.title).toBe('Ristretto pods');
    expect(meta.description).toBe('Dark and intense.');
    h.load.mockResolvedValue(null);
    expect(await generateMetadata(props())).toEqual({});
  });

  it('the quick add choose parameter reaches the page only for a selector the product has', async () => {
    h.load.mockResolvedValue(podPage());
    expect((await ProductPage(props({ query: { choose: 'capsulesPerPack' } }))).props.choose).toBe('capsulesPerPack');
    expect((await ProductPage(props({ query: { choose: 'grind' } }))).props.choose).toBeUndefined();
  });
});

describe('layout', () => {
  it('Mobile order is gallery then buy box then details then rating summary', async () => {
    const { container } = await renderPdp(podPage());
    const gallery = container.querySelector('[data-testid="pdp-main-image"]') as HTMLElement;
    const buyBox = container.querySelector('[data-testid="buy-box"]') as HTMLElement;
    const add = container.querySelector('[data-testid="add-to-bag"]') as HTMLElement;
    const accordions = container.querySelector('[data-testid="pdp-accordions"]') as HTMLElement;
    const rating = container.querySelector('[data-testid="rating-summary"]') as HTMLElement;
    const follows = (a: HTMLElement, b: HTMLElement) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(follows(gallery, buyBox)).toBe(true);
    expect(follows(add, accordions)).toBe(true); // the add button comes before the details
    expect(follows(buyBox, rating)).toBe(true);
    expect(container.querySelectorAll('h1')).toHaveLength(1);
    expect(container.querySelector('main')).toBeNull();
  });
});
