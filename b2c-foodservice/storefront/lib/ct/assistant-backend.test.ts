import { describe, expect, it, vi } from 'vitest';
import { SignInRequired, Unavailable } from '@/lib/agent/shopping/backend';
import type { ShoppingSessionContext } from '@/lib/agent/shopping/types';
import { LineRejected } from '@/lib/ct/cart';
import { AppError } from '@/lib/errors';
import type { Session } from '@/lib/session';
import type { ProductSummary } from '@/lib/types';
import { usd, viewCart, viewLine } from '@/test/cart';
import { podPage } from '@/test/pdp';
import { StorefrontApiBackend, toToolError } from './assistant-backend';
import { ctOrder } from '@/test/orders';

const m = vi.hoisted(() => ({
  search: vi.fn(),
  projections: vi.fn(),
  page: vi.fn(),
  inventory: vi.fn(),
  tree: vi.fn(),
  bySlug: vi.fn(),
  cartView: vi.fn(),
  addLine: vi.fn(),
  changeQuantity: vi.fn(),
  removeLine: vi.fn(),
  cartFor: vi.fn(),
  listOrders: vi.fn(),
  byNumber: vi.fn(),
  byId: vi.fn(),
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
  getCartView: m.cartView,
  addLine: m.addLine,
  changeQuantity: m.changeQuantity,
  removeLine: m.removeLine,
  getCartForSession: m.cartFor,
}));
vi.mock('@/lib/ct/search', () => ({ searchProducts: m.search }));
vi.mock('@/lib/ct/products', () => ({ getListingProjections: m.projections }));
vi.mock('@/lib/pdp/load', () => ({ loadProductPage: m.page }));
vi.mock('@/lib/ct/inventory', () => ({ getInventoryDetail: m.inventory }));
vi.mock('@/lib/ct/categories', () => ({ getCategoryTree: m.tree, getCategoryBySlug: m.bySlug }));
vi.mock('@/lib/ct/orders', () => ({ listOrders: m.listOrders, getCustomerOrderByNumber: m.byNumber, getCustomerOrderById: m.byId }));

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

  it('Drained notes start empty', () => {
    expect(backendFor({}).drainNotes()).toEqual([]);
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

describe('StorefrontApiBackend cart (the bag is the cart)', () => {
  const inBag = (ids: string[]) => viewCart(ids.map((id) => viewLine({ id, quantity: 1, unitPrice: usd(1000) })));
  const bagSession: Session = { cartId: 'c1', anonymousId: 'anon-1' };

  it('Add keeps other lines', async () => {
    m.cartFor.mockResolvedValue({ id: 'c1' });
    m.inventory.mockResolvedValue({ 'SKU-new': stockEntry(5) });
    m.addLine.mockResolvedValue({ session: bagSession, cart: {} });
    m.cartView.mockResolvedValue({ cart: inBag(['a', 'new']), session: bagSession });
    const cart = await backendFor(bagSession).addToCart(ctx(), 'SKU-new', 1);
    expect(cart.items.map((i) => i.productId)).toEqual(['SKU-a', 'SKU-new']);
  });

  it('Delivery is the only fulfilment sent, and the shopper session is used', async () => {
    m.cartFor.mockResolvedValue({ id: 'c1' });
    m.inventory.mockResolvedValue({ 'SKU-new': stockEntry(5) });
    m.addLine.mockResolvedValue({ session: bagSession, cart: {} });
    m.cartView.mockResolvedValue({ cart: inBag(['new']), session: bagSession });
    await backendFor(bagSession).addToCart(ctx(), 'SKU-new', 2);
    expect(m.addLine).toHaveBeenLastCalledWith(bagSession, market, { sku: 'SKU-new', quantity: 2, fulfilment: 'delivery' });
  });

  it('Add of an out-of-stock sku names ids only', async () => {
    m.cartFor.mockResolvedValue({ id: 'c1' });
    m.inventory.mockResolvedValue({ 'POD-50': stockEntry(0), 'POD-10': stockEntry(4) });
    m.page.mockResolvedValue(podPage());
    m.addLine.mockClear();
    const error = await backendFor(bagSession).addToCart(ctx(), 'POD-50', 1).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Unavailable);
    expect((error as Error).message).toBe('POD-50 is out of stock. In stock: POD-10.');
    expect(m.addLine).not.toHaveBeenCalled();
  });

  it('Update of a product not in the cart returns the cart unchanged', async () => {
    m.cartView.mockResolvedValue({ cart: inBag(['a']), session: bagSession });
    m.changeQuantity.mockClear();
    const cart = await backendFor(bagSession).updateCartItem(ctx(), 'SKU-zzz', 3);
    expect(cart.items.map((i) => i.productId)).toEqual(['SKU-a']);
    expect(m.changeQuantity).not.toHaveBeenCalled();
  });

  it('Remove the last line leaves an empty cart', async () => {
    m.cartView.mockResolvedValue({ cart: inBag(['a']), session: bagSession });
    m.removeLine.mockResolvedValue(inBag([]));
    const cart = await backendFor(bagSession).removeFromCart(ctx(), 'SKU-a');
    expect(cart).toEqual({ items: [], currency: 'USD' });
    expect(m.removeLine).toHaveBeenCalledWith(bagSession, market, 'a');
  });

  it('A lost bag is a reload message, not a new cart', async () => {
    m.cartFor.mockResolvedValue(null);
    m.inventory.mockResolvedValue({ 'SKU-new': stockEntry(5) });
    m.addLine.mockClear();
    const error = await backendFor({ cartId: 'gone' }).addToCart(ctx(), 'SKU-new', 1).catch((e: unknown) => e);
    expect((error as Error).message).toBe('The bag was reset. Reload the page and try again.');
    expect(m.addLine).not.toHaveBeenCalled();
  });

  it('A family id is refused by add', async () => {
    const error = await backendFor(bagSession).addToCart(ctx(), 'fam:POD-10', 1).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Unavailable);
    expect(m.addLine).not.toHaveBeenCalled();
  });
});

describe('StorefrontApiBackend orders (the shopper\'s own orders only)', () => {
  const signedIn: Session = { customerId: 'cust-1', customerFirstName: 'Maya' };
  const order = (number: string) => ({ ...ctOrder({ orderNumber: number }), customerId: 'cust-1' });

  it('A guest is asked to sign in', async () => {
    const error = await backendFor({ anonymousId: 'anon-1' }).getOrders().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SignInRequired);
    const detail = await backendFor({ anonymousId: 'anon-1' }).getOrder(ctx(), 'MC-1001').catch((e: unknown) => e);
    expect(detail).toBeInstanceOf(SignInRequired);
    expect(m.byNumber).not.toHaveBeenCalled();
  });

  it('Another customer order is null', async () => {
    m.byNumber.mockResolvedValue(null);
    m.byId.mockResolvedValue(null);
    expect(await backendFor(signedIn).getOrder(ctx(), 'MC-FOREIGN')).toBeNull();
  });

  it('An unknown number is null, and a malformed id makes no call', async () => {
    m.byNumber.mockClear();
    expect(await backendFor(signedIn).getOrder(ctx(), 'bad id with spaces')).toBeNull();
    expect(m.byNumber).not.toHaveBeenCalled();
  });

  it('Newest first, at most five', async () => {
    m.listOrders.mockResolvedValue({ results: [order('MC-3'), order('MC-2')], total: 2 });
    const orders = await backendFor(signedIn).getOrders(ctx(), 9);
    expect(m.listOrders).toHaveBeenCalledWith('cust-1', { filter: 'all', limit: 5, offset: 0 });
    expect(orders.map((o) => o.orderId)).toEqual(['MC-3', 'MC-2']);
  });

  it('Order link uses the route locale and brand', async () => {
    m.byNumber.mockResolvedValue(order('MC-1001'));
    const found = await backendFor(signedIn).getOrder(ctx(), 'MC-1001');
    expect(found?.viewUrl).toBe('/malva-coffee/en-US/account/orders/MC-1001');
    expect(found?.orderId).toBe('MC-1001');
  });
});
