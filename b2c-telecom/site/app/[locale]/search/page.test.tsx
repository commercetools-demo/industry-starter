import { screen, within } from '@testing-library/react';
import { createTranslator } from 'next-intl';
import { renderWithProviders } from '@/test/utils';
import { ApiError } from '@/lib/api-error';
import { LISTED_ALL, LISTED_CABLE_100, LISTED_CABLE_500, LISTED_CABLE_GIG, LISTED_ROUTER_AC1200, LISTED_SECURE, LISTED_SPOTIFY, TREE } from '@/lib/listing/__fixtures__/catalog';
import type { Offer } from '@/lib/types';
import deMessages from '@/messages/de-DE.json';
import enMessages from '@/messages/en-US.json';

const state = vi.hoisted(() => ({
  hits: [] as { id: string; matchedSkus: string[] }[],
  total: 0,
  languages: ['en-GB', 'de-DE', 'en-US'],
  fail: false,
  offers: [] as unknown[],
}));

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  notFound: () => {
    throw new Error('NOT_FOUND');
  },
}));
vi.mock('@/i18n/routing', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/i18n/routing')>()),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/search',
}));
vi.mock('next-intl/server', () => ({
  setRequestLocale: () => undefined,
  getTranslations: async (arg: string | { locale: string; namespace: string }) =>
    typeof arg === 'string'
      ? createTranslator({ locale: 'en-US', messages: enMessages, namespace: arg as never })
      : createTranslator({ locale: arg.locale, messages: arg.locale === 'de-DE' ? deMessages : enMessages, namespace: arg.namespace as never }),
}));
vi.mock('@/lib/ct/categories', () => ({ getCategoryTree: async () => TREE }));
vi.mock('@/lib/ct/search', () => ({
  searchOfferHits: async () => {
    if (state.fail) throw new ApiError('UPSTREAM_ERROR', 'x');
    return { total: state.total || state.hits.length, hits: state.hits };
  },
  getSearchLanguages: async () => state.languages,
}));
vi.mock('@/lib/ct/visible-offers', () => ({
  getVisibleOffers: async () => ({ offers: state.offers, buyer: {}, availability: { state: 'no-location', technologies: [] } }),
}));

import SearchPage, { generateMetadata } from './page';

const hit = (offer: Offer, matchedSkus: string[] = []) => ({ id: offer.id, matchedSkus });

async function renderPage(query: Record<string, string> = {}, locale: 'en-US' | 'de-DE' = 'en-US') {
  const ui = await SearchPage({ params: Promise.resolve({ locale }), searchParams: Promise.resolve(query) });
  return renderWithProviders(ui, { locale });
}

beforeEach(() => {
  state.hits = [];
  state.total = 0;
  state.languages = ['en-GB', 'de-DE', 'en-US'];
  state.fail = false;
  state.offers = LISTED_ALL;
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => vi.restoreAllMocks());

describe('search page', () => {
  it('without a query: the start state with popular searches and no search call', async () => {
    await renderPage();
    expect(screen.getByRole('heading', { level: 1, name: 'Search' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Spotify' })).toBeInTheDocument();
    expect(screen.queryByText('Type at least 2 characters.')).not.toBeInTheDocument();
  });

  it('a one-character query asks for two characters', async () => {
    await renderPage({ q: 'a' });
    expect(screen.getByText('Type at least 2 characters.')).toBeInTheDocument();
    expect(screen.getByRole('searchbox')).toHaveValue('a');
  });

  it('results: count, chips, cards linking to the listing anchor, prefilled query', async () => {
    state.hits = [hit(LISTED_CABLE_500), hit(LISTED_CABLE_100), hit(LISTED_CABLE_GIG)];
    await renderPage({ q: 'cable' });
    expect(screen.getByText('3 results for “cable”')).toBeInTheDocument();
    expect(screen.getByRole('searchbox')).toHaveValue('cable');
    expect(screen.getAllByTestId('result-link').map((link) => link.getAttribute('href'))).toEqual([
      '/en-US/shop/cable-internet?offer=malva-offer-cable-500#offer-malva-offer-cable-500',
      '/en-US/shop/cable-internet?offer=malva-offer-cable-100#offer-malva-offer-cable-100',
      '/en-US/shop/cable-internet?offer=malva-offer-cable-gig#offer-malva-offer-cable-gig',
    ]);
    expect(document.body.innerHTML).not.toMatch(/\/p\/|\/products\//);
    expect(screen.queryByRole('navigation', { name: 'Narrow by category' })).not.toBeInTheDocument();
  });

  it('category chips with counts that add up, and the category filter keeps q', async () => {
    state.hits = [hit(LISTED_SECURE), hit(LISTED_ROUTER_AC1200), hit(LISTED_SPOTIFY)];
    await renderPage({ q: 'malva' });
    const chips = within(screen.getByRole('navigation', { name: 'Narrow by category' })).getAllByRole('link');
    expect(chips.map((chip) => chip.textContent)).toEqual(['All (3)', 'Streaming and entertainment (1)', 'Security and protection (1)', 'Routers and equipment (1)']);
    expect(chips[2]).toHaveAttribute('href', '/en-US/search?q=malva&category=malva-cat-protection');
  });

  it('a category filter shows only its cards', async () => {
    state.hits = [hit(LISTED_SECURE), hit(LISTED_ROUTER_AC1200)];
    await renderPage({ q: 'malva', category: 'malva-cat-protection' });
    expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toEqual([LISTED_SECURE.name]);
    expect(screen.getByText('1 result for “malva”')).toBeInTheDocument();
  });

  it('pagination links keep q and sort; page 99 shows the last page', async () => {
    const many: Offer[] = Array.from({ length: 30 }, (_, index) => ({ ...LISTED_SPOTIFY, id: `id-x${index}`, key: `malva-offer-x${index}`, name: `Extra ${index}`, anchors: [`a${index}`] }));
    state.offers = many;
    state.hits = many.map((offer) => hit(offer));
    await renderPage({ q: 'extra', sort: 'price-asc', page: '2' });
    const pagination = within(screen.getByRole('navigation', { name: 'Pagination' }));
    expect(pagination.getByRole('link', { name: 'Next' })).toHaveAttribute('href', '/en-US/search?q=extra&sort=price-asc&page=3');
    expect(pagination.getByRole('link', { name: 'Previous' })).toHaveAttribute('href', '/en-US/search?q=extra&sort=price-asc');
    expect(screen.getAllByTestId('result-link')).toHaveLength(12);
  });

  it('page 99 renders the last page without an error', async () => {
    const many: Offer[] = Array.from({ length: 14 }, (_, index) => ({ ...LISTED_SPOTIFY, id: `id-y${index}`, key: `malva-offer-y${index}`, anchors: [`b${index}`] }));
    state.offers = many;
    state.hits = many.map((offer) => hit(offer));
    await renderPage({ q: 'extra', page: '99' });
    expect(screen.getAllByTestId('result-link')).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'Page 1' })).toBeInTheDocument();
  });

  it('a part number match shows the pill and the best-match label on the first card', async () => {
    state.hits = [hit(LISTED_CABLE_500, ['MLV-CABLE-500-24M'])];
    const sku = LISTED_CABLE_500.variants[0]?.sku ?? '';
    await renderPage({ q: sku });
    expect(screen.getByText('Part number match')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: `Best match: part number ${sku}` })).toBeInTheDocument();
  });

  it('no match: the none state with the query and the fallback tiles', async () => {
    await renderPage({ q: 'zzzzqq' });
    expect(screen.getByRole('heading', { name: 'No results for “zzzzqq”' })).toBeInTheDocument();
    expect(screen.queryAllByTestId('result-link')).toHaveLength(0);
    expect(within(screen.getByRole('navigation', { name: 'Browse categories' })).getAllByRole('link')).toHaveLength(4);
  });

  it('upstream failure: the error state inside the page with a retry link that keeps the URL', async () => {
    state.fail = true;
    await renderPage({ q: 'cable', sort: 'price-asc' });
    expect(screen.getByRole('heading', { name: 'Search is temporarily unavailable' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Try again' })).toHaveAttribute('href', '/en-US/search?q=cable&sort=price-asc');
    expect(screen.getByRole('heading', { level: 1, name: 'Search' })).toBeInTheDocument();
  });

  it('unsupported language: the dedicated message, not an empty result', async () => {
    state.languages = ['en-GB', 'en-US'];
    await renderPage({ q: 'tarif' }, 'de-DE');
    expect(screen.getByRole('heading', { name: 'Die Suche ist in dieser Sprache nicht verfügbar' })).toBeInTheDocument();
    expect(screen.queryByText(/Keine Ergebnisse/)).not.toBeInTheDocument();
  });

  it('German chrome and prices', async () => {
    state.hits = [hit(LISTED_CABLE_500)];
    await renderPage({ q: 'cable' }, 'de-DE');
    expect(screen.getByText('1 Ergebnis für „cable“')).toBeInTheDocument();
    expect(screen.getByTestId('result-link')).toHaveAttribute('href', '/de-DE/shop/kabel-internet?offer=malva-offer-cable-500#offer-malva-offer-cable-500');
  });

  it('an unsupported locale is a 404', async () => {
    await expect(SearchPage({ params: Promise.resolve({ locale: 'fr-FR' }), searchParams: Promise.resolve({}) })).rejects.toThrow('NOT_FOUND');
  });

  it('metadata: noindex, query in the title', async () => {
    const withQuery = await generateMetadata({ params: Promise.resolve({ locale: 'en-US' }), searchParams: Promise.resolve({ q: '  cable   500 ' }) });
    expect(withQuery.title).toBe('“cable 500” | Search | Malva Telecom');
    expect(withQuery.robots).toEqual({ index: false, follow: true });
    const plain = await generateMetadata({ params: Promise.resolve({ locale: 'de-DE' }), searchParams: Promise.resolve({}) });
    expect(plain.title).toBe('Suche');
  });
});
