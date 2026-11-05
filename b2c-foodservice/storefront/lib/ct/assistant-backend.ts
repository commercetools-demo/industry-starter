import 'server-only';
import { KeyedMutex } from '@/lib/agent/common/mutex';
import { NotOffered, SignInRequired, type StorefrontBackend, Unavailable } from '@/lib/agent/shopping/backend';
import { decodeId } from '@/lib/agent/shopping/ids';
import type { Product, ProductDetails, SearchFilters, ShoppingSessionContext, UserPreferences } from '@/lib/agent/shopping/types';
import { getCategoryBySlug, getCategoryTree } from '@/lib/ct/categories';
import { type CartMarket, LineRejected } from '@/lib/ct/cart';
import { getInventoryDetail } from '@/lib/ct/inventory';
import { getListingProjections } from '@/lib/ct/products';
import { searchProducts as searchCatalogue } from '@/lib/ct/search';
import { rootCategoryName } from '@/lib/category-tree';
import { AppError } from '@/lib/errors';
import { detailsFromPage, productFromSummary } from '@/lib/mappers/assistant';
import { loadProductPage } from '@/lib/pdp/load';
import type { SearchContext, SearchScope } from '@/lib/search/build';
import type { ListingParams, SortKey } from '@/lib/search/params';
import type { Session } from '@/lib/session';

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

  // -- Methods built in U-05 and U-06

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

  async getCart(): Promise<never> {
    throw new Unavailable('not built');
  }

  async addToCart(): Promise<never> {
    throw new Unavailable('not built');
  }

  async updateCartItem(): Promise<never> {
    throw new Unavailable('not built');
  }

  async removeFromCart(): Promise<never> {
    throw new Unavailable('not built');
  }

  async getOrders(): Promise<never> {
    throw new Unavailable('not built');
  }

  async getOrder(): Promise<never> {
    throw new Unavailable('not built');
  }
}
