import { screen, within } from '@testing-library/react';
import { createTranslator } from 'next-intl';
import { renderWithProviders } from '@/test/utils';
import { LISTED_ADDONS, LISTED_CABLE_100, LISTED_CABLE_500, LISTED_CABLE_EXISTING, LISTED_CABLE_GIG, LISTED_EQUIPMENT, LISTED_PHONE_ONLINE_ONLY, LISTED_PHONE_UNLIMITED, LISTED_PLANS, TREE, usd } from '@/lib/listing/__fixtures__/catalog';
import type { Offer } from '@/lib/types';
import deMessages from '@/messages/de-DE.json';
import enMessages from '@/messages/en-US.json';
import { cartOf } from '@/components/offers/__fixtures__/cart';

const state = vi.hoisted(() => ({
  locale: 'en-US' as 'en-US' | 'de-DE',
  inCategory: [] as unknown[],
  everything: [] as unknown[],
  availability: { state: 'no-location', technologies: [] as string[] },
  postalCode: undefined as string | undefined,
}));

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  notFound: () => {
    throw new Error('NOT_FOUND');
  },
}));
vi.mock('@/i18n/routing', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/i18n/routing')>()),
  redirect: ({ href, locale }: { href: string; locale: string }) => {
    throw new Error(`REDIRECT ${locale} ${href}`);
  },
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/shop/x',
}));
vi.mock('next-intl/server', () => ({
  setRequestLocale: () => undefined,
  getTranslations: async (arg: string | { locale: string; namespace: string }) =>
    typeof arg === 'string'
      ? createTranslator({ locale: state.locale, messages: state.locale === 'de-DE' ? deMessages : enMessages, namespace: arg as never })
      : createTranslator({ locale: arg.locale, messages: arg.locale === 'de-DE' ? deMessages : enMessages, namespace: arg.namespace as never }),
}));
vi.mock('@/lib/ct/categories', async () => {
  const { findCategoryBySlug } = await import('@/lib/mappers/category');
  return {
    getCategoryTree: async () => TREE,
    getCategoryBySlug: async (slug: string, locale: string) => findCategoryBySlug(TREE, slug, locale),
  };
});
vi.mock('@/lib/ct/visible-offers', () => ({
  getVisibleOffersInCategory: async () => ({ offers: state.inCategory, buyer: { location: state.postalCode ? { postalCode: state.postalCode } : undefined }, availability: state.availability }),
  getVisibleOffers: async () => ({ offers: state.everything, buyer: {}, availability: state.availability }),
}));
const cartContext = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock('@/context/CartProvider', () => ({ useCartContext: () => cartContext.value }));

import ListingPage, { generateMetadata } from './page';

const ALL_OFFERS: Offer[] = [...LISTED_PLANS, LISTED_CABLE_EXISTING, LISTED_PHONE_ONLINE_ONLY, ...LISTED_ADDONS, ...LISTED_EQUIPMENT];

function manyAddons(count: number): Offer[] {
  return Array.from({ length: count }, (_, index) => ({
    ...LISTED_ADDONS[0],
    key: `malva-offer-extra-${String(index).padStart(2, '0')}`,
    name: `Extra ${String(index).padStart(2, '0')}`,
    anchors: [`malva-extra-${index}`],
    headline: { recurring: usd(1000 + index), term: null, termMonths: null },
    categoryKeys: ['malva-cat-add-ons'],
    primaryCategoryKey: 'malva-cat-add-ons',
  }));
}

function setCatalog(inCategory: Offer[], everything: Offer[] = ALL_OFFERS): void {
  state.inCategory = inCategory;
  state.everything = everything;
}

async function renderPage(slug: string, query: Record<string, string> = {}, locale: 'en-US' | 'de-DE' = 'en-US') {
  state.locale = locale;
  const ui = await ListingPage({ params: Promise.resolve({ locale, slug }), searchParams: Promise.resolve(query) });
  return renderWithProviders(ui, { locale });
}

beforeEach(() => {
  vi.clearAllMocks();
  Element.prototype.scrollIntoView = vi.fn();
  cartContext.value = { cart: cartOf([]), isLoading: false, itemCount: 0, addLine: vi.fn(), removeLine: vi.fn(), setQuantity: vi.fn() };
  state.availability = { state: 'no-location', technologies: [] };
  state.postalCode = undefined;
  setCatalog([LISTED_CABLE_GIG, LISTED_CABLE_100, LISTED_CABLE_500, LISTED_CABLE_EXISTING]);
});

describe('category listing page', () => {
  it('lists the plans of the category cheapest first with breadcrumb, H1, chips, count and the add-ons band', async () => {
    setCatalog([LISTED_CABLE_GIG, LISTED_CABLE_100, LISTED_CABLE_500]);
    await renderPage('cable-internet');
    expect(screen.getByRole('heading', { level: 1, name: 'Cable internet' })).toBeInTheDocument();
    expect(within(screen.getByRole('navigation', { name: 'Breadcrumb' })).getByRole('link', { name: 'Home' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 2 }).slice(0, 3).map((heading) => heading.textContent)).toEqual(['Cable 100', 'Cable 500', 'Cable Gig']);
    const chips = within(screen.getByRole('navigation', { name: 'Filter' })).getAllByRole('link');
    expect(chips.map((chip) => chip.textContent)).toEqual(['All', 'Up to 500 Mbps', '1 Gbps']);
    expect(screen.getByText('3 plans')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Make it yours with add-ons' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Choose plan' })).toHaveLength(3);
  });

  it('the same product offered twice shows one card (the unrestricted one)', async () => {
    setCatalog([LISTED_PHONE_UNLIMITED, LISTED_PHONE_ONLINE_ONLY], ALL_OFFERS);
    await renderPage('phone-plans');
    expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toContain('Unlimited');
    expect(screen.queryByRole('heading', { name: 'Unlimited online only' })).toBeNull();
    expect(screen.getByText('1 plan')).toBeInTheDocument();
  });

  it('a chip filters, sorts and counts from the URL', async () => {
    await renderPage('cable-internet', { filter: 'up-to-500', sort: 'price-desc' });
    expect(screen.getAllByRole('heading', { level: 2 }).slice(0, 2).map((heading) => heading.textContent)).toEqual(['Cable 500', 'Cable 100']);
    expect(screen.getByText('2 plans')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Remove filter Up to 500 Mbps' })).toHaveAttribute('href', '/en-US/shop/cable-internet?sort=price-desc');
    expect(screen.getByRole('combobox', { name: 'Sort' })).toHaveValue('price-desc');
  });

  it('a chip of another listing, an unknown sort and a bad page fall back to the plain listing', async () => {
    await renderPage('cable-internet', { filter: 'lte', sort: 'bogus', page: '-3' });
    expect(screen.getByText('3 plans')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Remove filter/ })).toBeNull();
  });

  it('Facet combination with no matches: states the empty result and keeps removable active filters', async () => {
    setCatalog([LISTED_CABLE_100, LISTED_CABLE_500]);
    await renderPage('cable-internet', { filter: '1-gbps' });
    expect(screen.getByRole('heading', { name: 'No plans match these filters' })).toBeInTheDocument();
    expect(screen.getByText('0 plans')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Remove filter 1 Gbps' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Clear filters' })).toHaveAttribute('href', '/en-US/shop/cable-internet');
  });

  it('Page past the last result: renders the last page, canonical points at it', async () => {
    const addons = manyAddons(13);
    setCatalog(addons, [...LISTED_PLANS, ...addons]);
    await renderPage('add-ons', { page: '99' });
    expect(screen.getAllByRole('heading', { level: 2 }).filter((heading) => /^Extra/.test(heading.textContent ?? ''))).toHaveLength(1);
    expect(screen.getByText('13 add-ons')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Page 2' })).toHaveAttribute('aria-current', 'page');
    const metadata = await generateMetadata({ params: Promise.resolve({ locale: 'en-US', slug: 'add-ons' }), searchParams: Promise.resolve({ page: '99' }) });
    expect(metadata.alternates?.canonical).toBe('http://localhost:3000/en-US/shop/add-ons?page=2');
  });

  it('the add-ons listing: own H1, blurb, pagination and links to the child categories', async () => {
    const addons = manyAddons(13);
    setCatalog(addons, [...LISTED_PLANS, ...addons]);
    await renderPage('add-ons');
    expect(screen.getByRole('heading', { level: 1, name: 'Add-ons for any plan' })).toBeInTheDocument();
    expect(screen.getByText(/Streaming, music and extras, billed with your Malva plan/)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Needs a plan' })).toHaveLength(12);
    expect(screen.getByRole('navigation', { name: 'Pagination' })).toBeInTheDocument();
    expect(within(screen.getByRole('navigation', { name: 'Browse by type' })).getByRole('link', { name: 'Streaming and entertainment' })).toHaveAttribute('href', '/en-US/shop/streaming-entertainment');
  });

  it('a child category shows its breadcrumb through the parent', async () => {
    setCatalog(LISTED_EQUIPMENT, ALL_OFFERS);
    await renderPage('routers-and-equipment');
    const crumbs = within(screen.getByRole('navigation', { name: 'Breadcrumb' }));
    expect(crumbs.getByRole('link', { name: 'Add-ons' })).toHaveAttribute('href', '/en-US/shop/add-ons');
    expect(screen.getByText('5 items')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Filter' })).toBeNull();
  });

  it('Empty category: explicit empty state with links to other categories', async () => {
    setCatalog([]);
    await renderPage('cable-internet');
    expect(screen.getByRole('heading', { name: 'Nothing here yet' })).toBeInTheDocument();
    const links = within(screen.getByRole('region', { name: /Nothing here yet/ })).getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual(['Phone plans', 'Wireless internet', 'Add-ons', 'Phones and devices']);
  });

  it('an unknown slug is not found', async () => {
    await expect(renderPage('not-a-category')).rejects.toThrow('NOT_FOUND');
  });

  it("another locale's slug redirects to this locale's slug and keeps the query", async () => {
    await expect(renderPage('kabel-internet', { filter: 'up-to-500' })).rejects.toThrow('REDIRECT en-US /shop/cable-internet?filter=up-to-500');
    await expect(renderPage('cable-internet', {}, 'de-DE')).rejects.toThrow('REDIRECT de-DE /shop/kabel-internet');
  });

  it('Offer in more than one category: non-primary listing redirects to canonical', async () => {
    setCatalog([LISTED_PHONE_UNLIMITED], ALL_OFFERS);
    await expect(renderPage('phone-plans', { offer: 'malva-offer-cable-gig' })).rejects.toThrow(
      'REDIRECT en-US /shop/cable-internet?offer=malva-offer-cable-gig#offer-malva-offer-cable-gig',
    );
  });

  it('an unknown ?offer= is ignored', async () => {
    await renderPage('cable-internet', { offer: 'does-not-exist' });
    expect(screen.getByText('3 plans')).toBeInTheDocument();
    expect(document.querySelector('[data-highlighted]')).toBeNull();
  });

  it('?offer= highlights its card and drops a chip that would hide it', async () => {
    await renderPage('cable-internet', { filter: '1-gbps', offer: 'malva-offer-cable-100' });
    expect(document.querySelector('[data-highlighted="true"]')).toHaveAttribute('id', 'offer-malva-offer-cable-100');
    expect(screen.getByText('3 plans')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Remove filter/ })).toBeNull();
  });

  it('German: slug, chips, count and prices come from the locale', async () => {
    setCatalog([LISTED_CABLE_100, LISTED_CABLE_500, LISTED_CABLE_GIG]);
    await renderPage('kabel-internet', {}, 'de-DE');
    expect(screen.getByRole('heading', { level: 1, name: 'Cable internet' })).toBeInTheDocument();
    expect(screen.getByText('3 Tarife')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Bis 500 Mbit/s' })).toHaveAttribute('href', '/de-DE/shop/kabel-internet?filter=up-to-500');
    expect(screen.getAllByRole('button', { name: 'Tarif wählen' })).toHaveLength(3);
  });

  it('shows the serviceability note for a remembered ZIP that is not served', async () => {
    state.availability = { state: 'not-served', technologies: [] };
    state.postalCode = '99999';
    await renderPage('cable-internet');
    expect(screen.getByRole('note')).toHaveTextContent("We don't serve 99999 yet.");
  });

  it('metadata: title, absolute canonical without filters, hreflang with each locale slug', async () => {
    const metadata = await generateMetadata({ params: Promise.resolve({ locale: 'en-US', slug: 'cable-internet' }), searchParams: Promise.resolve({ filter: 'gig', sort: 'price-desc' }) });
    expect(metadata.title).toBe('Cable internet | Malva Telecom');
    expect(metadata.alternates?.canonical).toBe('http://localhost:3000/en-US/shop/cable-internet');
    expect(metadata.alternates?.languages).toEqual({
      'en-US': 'http://localhost:3000/en-US/shop/cable-internet',
      'de-DE': 'http://localhost:3000/de-DE/shop/kabel-internet',
    });
    expect(String(metadata.description).length).toBeLessThanOrEqual(160);
  });
});
