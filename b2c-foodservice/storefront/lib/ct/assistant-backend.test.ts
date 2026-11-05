import { describe, expect, it, vi } from 'vitest';
import { Unavailable } from '@/lib/agent/shopping/backend';
import type { ShoppingSessionContext } from '@/lib/agent/shopping/types';
import { LineRejected } from '@/lib/ct/cart';
import { AppError } from '@/lib/errors';
import type { Session } from '@/lib/session';
import type { ProductSummary } from '@/lib/types';
import { usd } from '@/test/cart';
import { podPage } from '@/test/pdp';
import { StorefrontApiBackend, toToolError } from './assistant-backend';

const m = vi.hoisted(() => ({
  search: vi.fn(),
  projections: vi.fn(),
  page: vi.fn(),
  inventory: vi.fn(),
  tree: vi.fn(),
  bySlug: vi.fn(),
}));

// The domain error class is what the mapper tests against; the real module pulls in the commercetools client.
vi.mock('@/lib/ct/cart', () => ({
  LineRejected: class LineRejected extends Error {
    constructor(
      readonly code: string,
      readonly status: number,
    ) {
      super(code);
      this.name = 'LineRejected';
    }
  },
}));
vi.mock('@/lib/ct/search', () => ({ searchProducts: m.search }));
vi.mock('@/lib/ct/products', () => ({ getListingProjections: m.projections }));
vi.mock('@/lib/pdp/load', () => ({ loadProductPage: m.page }));
vi.mock('@/lib/ct/inventory', () => ({ getInventoryDetail: m.inventory }));
vi.mock('@/lib/ct/categories', () => ({ getCategoryTree: m.tree, getCategoryBySlug: m.bySlug }));

const market = { country: 'US', currency: 'USD', locale: 'en-US' };
const ctx = (over: Partial<ShoppingSessionContext> = {}): ShoppingSessionContext => ({
  sessionId: 's1', userId: 'user-1', page: { pageType: 'home', extra: {} }, now: new Date('2026-11-05T12:00:00Z'), timeZone: 'UTC',
  ...over,
} as ShoppingSessionContext);

const backendFor = (session: Session) => new StorefrontApiBackend({ session, market, baseHref: '/malva-coffee/en-US' });

const summary = (sku: string, over: Partial<ProductSummary> = {}): ProductSummary => ({
  id: `id-${sku}`, slug: sku.toLowerCase(), sku, name: `Product ${sku}`, categoryName: 'Pods', imageAlt: sku,
  badge: null, price: { from: usd(1000), fromIsRange: false }, requiredChoice: null, rating: null, availability: null, ...over,
});

const searchOk = (ids: string[]) => ({ status: 'ok', total: ids.length, ids, matchedSkus: {}, facets: [], page: 1, pageCount: 1 });
const stockEntry = (online: number) => ({ online, stores: {} });

describe('StorefrontApiBackend skeleton', () => {
  it('Unknown errors become a plain failure, never a leaked message', () => {
    const leaked = toToolError(new Error('Bearer sk-live-123 rejected by https://api.example'));
    expect(leaked).toBeInstanceOf(Error);
    expect(leaked).not.toBeInstanceOf(Unavailable);
    expect(leaked.message).toBe('The storefront is temporarily unavailable.');

    const upstream = toToolError(new AppError('upstream_unavailable', 503, 'project key abc is down'));
    expect(upstream.message).not.toContain('abc');
    expect(upstream.message).toBe('The storefront is temporarily unavailable.');
  });

  it('A rejected line is an Unavailable that names only the code', () => {
    const error = toToolError(new LineRejected('quantity_exceeds_stock', 409));
    expect(error).toBeInstanceOf(Unavailable);
    expect(error.message).toBe('The bag cannot take that line (quantity_exceeds_stock).');
  });

  it('Preferences carry no email', async () => {
    const backend = backendFor({ customerId: 'c-1', customerEmail: 'maya@example.com', customerFirstName: 'Maya' });
    const prefs = await backend.getPreferences(ctx());
    expect(prefs).toEqual({ userId: 'user-1', displayName: 'Maya', preferences: {} });
    expect(JSON.stringify(prefs)).not.toContain('@');
  });

  it('A guest has no display name', async () => {
    const prefs = await backendFor({ anonymousId: 'anon-1' }).getPreferences(ctx());
    expect('displayName' in prefs).toBe(false);
  });

  it('Methods not built yet say so as Unavailable', async () => {
    await expect(backendFor({}).getCart()).rejects.toBeInstanceOf(Unavailable);
  });

  it('Drained notes are returned once', () => {
    class Probe extends StorefrontApiBackend {
      say(text: string) {
        this.note(text);
      }
    }
    const backend = new Probe({ session: {}, market, baseHref: '/x' });
    backend.say('one');
    expect(backend.drainNotes()).toEqual(['one']);
    expect(backend.drainNotes()).toEqual([]);
  });
});

describe('StorefrontApiBackend catalogue reads', () => {
  it('Search maps results and keeps order', async () => {
    m.tree.mockResolvedValue([]);
    m.search.mockResolvedValue(searchOk(['id-A', 'id-B']));
    m.projections.mockResolvedValue([summary('A'), summary('B')]);
    m.inventory.mockResolvedValue({ A: stockEntry(3), B: stockEntry(0) });
    const products = await backendFor({}).searchProducts(ctx(), 'espresso', undefined, 8);
    expect(products.map((p) => [p.productId, p.inStock])).toEqual([['A', true], ['B', false]]);
    // Both brands: the search context carries no brand.
    expect(m.search.mock.calls[0]?.[0]).not.toHaveProperty('brand');
  });

  it('An unsupported price filter is dropped and said', async () => {
    m.tree.mockResolvedValue([]);
    m.search.mockResolvedValue(searchOk([]));
    const backend = backendFor({});
    const products = await backend.searchProducts(ctx(), 'gift', { sort: 'relevance', attributes: {}, maxPrice: 40 }, 8);
    expect(products).toEqual([]);
    expect(backend.drainNotes()).toEqual(["The price limit could not be applied; check each result's price against what the customer asked."]);
  });

  it('A failed search throws, never returns an empty list', async () => {
    m.search.mockResolvedValue({ status: 'unsupported_language' });
    await expect(backendFor({}).searchProducts(ctx(), 'gift', undefined, 8)).rejects.toThrow('The storefront is temporarily unavailable.');
    m.search.mockRejectedValue(new Error('network down'));
    await expect(backendFor({}).searchProducts(ctx(), 'gift', undefined, 8)).rejects.toThrow('The storefront is temporarily unavailable.');
  });

  it('A family returns variants with their own price and stock', async () => {
    m.page.mockResolvedValue(podPage());
    m.inventory.mockResolvedValue({ 'POD-10': stockEntry(5), 'POD-50': stockEntry(0), 'POD-100': stockEntry(2) });
    const details = await backendFor({}).getProductDetails(ctx(), 'fam:POD-10');
    expect(details?.productId).toBe('fam:POD-10');
    expect(details?.variants.map((v) => [v.productId, v.inStock])).toEqual([['POD-10', true], ['POD-50', false], ['POD-100', true]]);
  });

  it('A variant sku returns the purchasable record', async () => {
    m.page.mockResolvedValue(podPage());
    m.inventory.mockResolvedValue({ 'POD-10': stockEntry(5), 'POD-50': stockEntry(0), 'POD-100': stockEntry(2) });
    const record = await backendFor({}).getProductDetails(ctx(), 'POD-50');
    expect(record?.productId).toBe('POD-50');
    expect(record?.variantOf).toBe('fam:POD-10');
    expect(record?.variants).toEqual([]);
  });

  it('Unknown sku is null', async () => {
    m.page.mockResolvedValue(null);
    expect(await backendFor({}).getProductDetails(ctx(), 'NOPE-1')).toBeNull();
  });
});
