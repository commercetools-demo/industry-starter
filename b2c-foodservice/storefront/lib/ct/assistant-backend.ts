import 'server-only';
import { KeyedMutex } from '@/lib/agent/common/mutex';
import { NotOffered, SignInRequired, type StorefrontBackend, Unavailable } from '@/lib/agent/shopping/backend';
import { decodeId } from '@/lib/agent/shopping/ids';
import type { Cart, CartTotals, Product, ProductDetails, SearchFilters, ShoppingSessionContext, UserPreferences } from '@/lib/agent/shopping/types';
import { getCategoryBySlug, getCategoryTree } from '@/lib/ct/categories';
import { addLine, changeQuantity, type CartMarket, getCartForSession, getCartView, LineRejected, removeLine } from '@/lib/ct/cart';
import { getInventoryDetail } from '@/lib/ct/inventory';
import { getListingProjections } from '@/lib/ct/products';
import { searchProducts as searchCatalogue } from '@/lib/ct/search';
import { rootCategoryName } from '@/lib/category-tree';
import { AppError } from '@/lib/errors';
import { cartFromView, detailsFromPage, productFromSummary, totalsFromView } from '@/lib/mappers/assistant';
import { loadProductPage } from '@/lib/pdp/load';
import type { SearchContext, SearchScope } from '@/lib/search/build';
import type { ListingParams, SortKey } from '@/lib/search/params';
import type { Session } from '@/lib/session';
import type { Cart as CartView } from '@/lib/types';

/**
 * The assistant's `StorefrontBackend` over the storefront's own commercetools modules (workstream T2). The assistant's cart IS the
 * shopper's bag: every read and write goes through `lib/ct/cart` with the shopper's own session. `lib/agent/**` never imports this file;
 * the route layer builds it and hands it to the agent.
 *
 * Errors: the executor relays `NotOffered`, `SignInRequired` and `Unavailable` to the model with their wording; any other error becomes
 * the tool being temporarily unavailable. Messages here never carry a storefront error text, a token or an id that is not the shopper's
 * own product (the executor logs the tool name only).
 */

const GENERIC_FAILURE = 'The storefront is temporarily unavailable.';
const RESET = 'The bag was reset. Reload the page and try again.';

/** The wording the executor relays when a filter or check could not run (the same sentences the Shopper MCP backend used). */
const NOTE = {
  category: 'The category filter could not be applied; results are not limited to that category.',
  price: "The price limit could not be applied; check each result's price against what the customer asked.",
  rating: 'The rating filter could not be applied.',
  attributes: 'The attribute filters could not be applied; check each result against them.',
  stock: 'Stock could not be checked.',
} as const;

/** Every agent sort maps to a listing sort the shop supports, so no sort note is needed. */
const SORT_KEY: Record<SearchFilters['sort'], SortKey> = { relevance: 'relevance', price_asc: 'price-asc', price_desc: 'price-desc', rating: 'rating' };

/** Maps any error from a storefront module to what the agent may show. The original message is never copied into the result. */
export function toToolError(error: unknown): Error {
  if (error instanceof NotOffered || error instanceof SignInRequired || error instanceof Unavailable) return error;
  if (error instanceof LineRejected) return new Unavailable(`The bag cannot take that line (${error.code}).`);
  if (error instanceof AppError) {
    if (error.code === 'validation_failed') return new Unavailable('That product cannot be added right now.');
    if (error.code === 'not_found') return new NotOffered('not found');
  }
  return new Error(GENERIC_FAILURE);
}

export interface StorefrontApiBackendOptions {
  /** The shopper's session as read from the signed cookie. Replaced by each cart call's returned session. */
  session: Session;
  market: CartMarket;
  /** The path prefix of this storefront's pages for the route locale and brand, for example `/malva-coffee/en-US`. */
  baseHref: string;
  mutex?: KeyedMutex;
}

export class StorefrontApiBackend implements StorefrontBackend {
  protected session: Session;
  protected readonly market: CartMarket;
  protected readonly baseHref: string;
  protected readonly mutex: KeyedMutex;
  private readonly notes: string[] = [];

  constructor(options: StorefrontApiBackendOptions) {
    this.session = options.session;
    this.market = options.market;
    this.baseHref = options.baseHref;
    this.mutex = options.mutex ?? new KeyedMutex();
  }

  /** Runs one storefront call and maps its failure. Every public method goes through it. */
  protected async guard<T>(call: () => Promise<T>): Promise<T> {
    try {
      return await call();
    } catch (error) {
      throw toToolError(error);
    }
  }

  /** Keeps the session a storefront call returned (a cart the shopper no longer owns is dropped from it by the module). */
  protected adopt(session: Session): void {
    this.session = session;
  }

  /** A note the executor relays with the next tool result (for example a filter the shop cannot apply). */
  protected note(text: string): void {
    this.notes.push(text);
  }

  drainNotes(): string[] {
    return this.notes.splice(0);
  }

  // -- Customer context

  /** The first name when signed in, never the email. */
  async getPreferences(ctx: ShoppingSessionContext): Promise<UserPreferences> {
    const name = this.session.customerFirstName;
    return { userId: ctx.userId, ...(name ? { displayName: name } : {}), preferences: {} };
  }

  // -- Catalogue

  /**
   * Text matches across both brands (Q-T2-2: no brand in the context), best first. Filters the shop cannot apply are dropped and SAID in a
   * note. A search that cannot run THROWS: an empty list means "nothing matched".
   */
  async searchProducts(_ctx: ShoppingSessionContext, query: string, filters?: SearchFilters, limit = 8): Promise<Product[]> {
    return this.guard(async () => {
      const category = filters?.category ? await getCategoryBySlug(this.market.locale, filters.category) : null;
      if (filters?.category && !category) this.note(NOTE.category);
      if (filters?.minPrice !== undefined || filters?.maxPrice !== undefined) this.note(NOTE.price);
      if (filters?.minRating !== undefined) this.note(NOTE.rating);
      if (filters && Object.keys(filters.attributes).length > 0) this.note(NOTE.attributes);

      const ctx: SearchContext = { locale: this.market.locale, currency: this.market.currency, country: this.market.country };
      const scope: SearchScope = category ? { categoryId: category.id } : {};
      const params: ListingParams = {
        ...(query ? { q: query } : {}),
        sort: SORT_KEY[filters?.sort ?? 'relevance'],
        sortGiven: true,
        page: 1,
        avail: false,
        facets: {},
      };
      const outcome = await searchCatalogue(ctx, scope, params, { limit, withFacets: false });
      if (outcome.status !== 'ok') throw new Error('search unavailable');
      if (outcome.ids.length === 0) return [];

      const tree = await getCategoryTree(this.market.locale);
      const summaries = await getListingProjections(outcome.ids, {
        locale: this.market.locale,
        country: this.market.country,
        currency: this.market.currency,
        categoryName: (ids: string[]) => rootCategoryName(tree, ids),
      });
      const pairs = summaries.flatMap((summary) => {
        const product = productFromSummary(summary, this.market.currency);
        return product ? [{ sku: summary.sku, product }] : [];
      });

      // One stock read for the page. When it fails the results stay in, marked as not checked.
      let stock: Record<string, number> | null = null;
      try {
        stock = await this.readStock(pairs.map((p) => p.sku));
      } catch {
        this.note(NOTE.stock);
      }
      return pairs.slice(0, limit).map(({ sku, product }) => (stock ? { ...product, inStock: (stock[sku] ?? 0) > 0 } : product));
    });
  }

  /**
   * The full record for an id: a family (`fam:<sku>`) with its variants, a plain product, or one variant by its SKU (the purchasable record,
   * with `variantOf`). Null for an unknown id.
   */
  async getProductDetails(_ctx: ShoppingSessionContext, productId: string): Promise<ProductDetails | null> {
    return this.guard(async () => {
      const decoded = decodeId(productId);
      const sku = decoded.kind === 'family' ? decoded.mcpId : decoded.sku;
      if (!sku) return null;
      const page = await loadProductPage(sku, this.market.locale);
      if (!page) return null;
      const stock = await this.readStock(page.product.variants.map((v) => v.sku));
      const details = detailsFromPage(page, stock);
      if (!details) return null;
      if (decoded.kind === 'family' || details.variants.length === 0 || details.productId === sku) return details;
      const variant = details.variants.find((v) => v.productId === sku);
      if (!variant) return null;
      return { ...variant, ...(details.longDescription ? { longDescription: details.longDescription } : {}), specs: details.specs, reviewHighlights: [], variants: [] };
    });
  }

  /** Online quantity per SKU from one inventory read. A SKU with no entry is absent, which means out of stock. */
  private async readStock(skus: string[]): Promise<Record<string, number>> {
    if (skus.length === 0) return {};
    const detail = await getInventoryDetail(skus);
    return Object.fromEntries(Object.entries(detail).map(([sku, d]) => [sku, d.online]));
  }

  // -- Cart: the assistant's cart IS the shopper's bag (every write goes through lib/ct/cart with this session)

  /** The bag as the agent sees it. A lost or empty bag is an empty cart. */
  async getCart(): Promise<Cart> {
    return this.guard(async () => this.view((await this.bag()).cart));
  }

  /** Adds `quantity` of one SKU. Refuses a family, an out-of-stock SKU and a lost bag; never creates a bag here (decision 5). */
  async addToCart(_ctx: ShoppingSessionContext, productId: string, quantity: number): Promise<Cart> {
    return this.guard(() =>
      this.lock(async () => {
        const decoded = decodeId(productId);
        if (decoded.kind === 'family') throw new Unavailable('This product has options; choose one of its variants.');
        await this.assertBuyable(decoded.sku);
        if (!(await getCartForSession(this.session))) throw new Unavailable(RESET);
        const written = await addLine(this.session, this.market, { sku: decoded.sku, quantity, fulfilment: 'delivery' });
        this.adopt(written.session);
        return this.view((await this.bag()).cart);
      }),
    );
  }

  /** A set. A product the bag does not hold leaves the bag as it is; that is not an error. */
  async updateCartItem(_ctx: ShoppingSessionContext, productId: string, quantity: number): Promise<Cart> {
    return this.guard(() =>
      this.lock(async () => {
        const { line, cart } = await this.lineFor(productId);
        if (!line) return this.view(cart);
        return cartFromView(await changeQuantity(this.session, this.market, line.id, quantity));
      }),
    );
  }

  /** Same tolerance as `updateCartItem`. Removing the last line leaves the shopper's bag in place, empty. */
  async removeFromCart(_ctx: ShoppingSessionContext, productId: string): Promise<Cart> {
    return this.guard(() =>
      this.lock(async () => {
        const { line, cart } = await this.lineFor(productId);
        if (!line) return this.view(cart);
        return cartFromView(await removeLine(this.session, this.market, line.id));
      }),
    );
  }

  /** Cent-exact totals for the checkout card. Null for an empty bag. */
  async getCartTotals(): Promise<CartTotals | null> {
    return this.guard(async () => {
      const { cart } = await this.bag();
      return cart ? totalsFromView(cart) : null;
    });
  }

  /** Reads the bag through the storefront module (prices and shipping refreshed) and keeps the session it returns. */
  private async bag(): Promise<{ cart: CartView | null }> {
    const result = await getCartView(this.session, this.market);
    this.adopt(result.session);
    return { cart: result.cart };
  }

  private view(cart: CartView | null): Cart {
    return cart ? cartFromView(cart) : { items: [], currency: this.market.currency };
  }

  /** The bag line for a SKU, or null. A family is never in the bag. */
  private async lineFor(productId: string): Promise<{ line: CartView['lines'][number] | null; cart: CartView | null }> {
    const decoded = decodeId(productId);
    const { cart } = await this.bag();
    if (decoded.kind === 'family' || !cart) return { line: null, cart };
    return { line: cart.lines.find((l) => l.sku === decoded.sku) ?? null, cart };
  }

  /**
   * Refuses a SKU that is unknown or out of stock. The message names ids only: the SKU and, for a variant, the in-stock sibling SKUs.
   */
  private async assertBuyable(sku: string): Promise<void> {
    const stock = await this.readStock([sku]);
    if ((stock[sku] ?? 0) > 0) return;
    const page = await loadProductPage(sku, this.market.locale);
    if (!page) throw new Unavailable(`${sku} cannot be bought right now.`);
    const siblings = page.product.variants.length > 1 ? page.product.variants.map((v) => v.sku).filter((s) => s !== sku) : [];
    const siblingStock = siblings.length > 0 ? await this.readStock(siblings) : {};
    const inStock = siblings.filter((s) => (siblingStock[s] ?? 0) > 0);
    throw new Unavailable(inStock.length > 0 ? `${sku} is out of stock. In stock: ${inStock.join(', ')}.` : `${sku} is out of stock.`);
  }

  /** Per-session serialisation of cart writes (a click on the page at the same time is handled by the module's own retry). */
  private lock<T>(fn: () => Promise<T>): Promise<T> {
    return this.mutex.run(this.session.anonymousId ?? this.session.customerId ?? 'bag', fn);
  }

  async getOrders(): Promise<never> {
    throw new Unavailable('not built');
  }

  async getOrder(): Promise<never> {
    throw new Unavailable('not built');
  }
}
