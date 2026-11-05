import { KeyedMutex } from '../../common/mutex';
import { SignInRequired, type StorefrontBackend, Unavailable } from '../../shopping/backend';
import type { Cart, CartTotals, Order, Product, ProductDetails, SearchFilters, ShoppingSessionContext, UserPreferences } from '../../shopping/types';
import type { McpCaller } from './client';
import { McpNotFound, McpNotOrderable, McpTransportError } from './errors';
import { decodeId, isFamilyId } from '../../shopping/ids';
import { cartLines, mapCart, mapCartTotals, mapOrder, mapProduct } from './mappers';
import { type McpCart, cartSchema, getProductResultSchema, orderSchema, searchResultSchema } from './schemas';

/**
 * `StorefrontBackend` over the commercetools Shopper MCP and NOTHING else: no `lib/ct/*`, no `@commercetools/*` (lint-enforced). One
 * instance serves one request for one market (the host builds the `McpCaller` from the session's country). No method places an order.
 */

/** Where the assistant's cart id lives: the server-side agent session, never the browser, the model or a tool result (a cart id is a credential: the MCP documents no ownership check). */
export interface AgentCartRef {
  get(session: ShoppingSessionContext): Promise<string | undefined>;
  set(session: ShoppingSessionContext, cartId: string | undefined): Promise<void>;
}

/** The two storefront reads that make order tools safe. The MCP's `get_order` takes an id or number only and the docs describe no customer scoping, so ownership is checked HERE, before any MCP call (decision D-054). Injected so the agent never imports `lib/ct`. */
export interface OrderAccess {
  /** The signed-in shopper's most recent order numbers, newest first. */
  listOwnOrderNumbers(customerId: string, limit: number): Promise<string[]>;
  /** The order NUMBER when `idOrNumber` (a number or an internal id) belongs to this shopper; null for "not theirs" and "unknown" alike. */
  resolveOwnOrderNumber(customerId: string, idOrNumber: string): Promise<string | null>;
}

export interface ShopperMcpBackendDeps {
  mcp: McpCaller;
  cartRef: AgentCartRef;
  orders: OrderAccess;
  /** The storefront's own host, for validating the order permalink. */
  storefrontHost?: string;
  /** Per-call timeout in milliseconds. */
  requestTimeoutMs?: number;
  /** Shared across requests in one process so two cart writes for one session serialise. */
  mutex?: KeyedMutex;
}

const MAX_ORDERS = 5;
const MAX_ATTEMPTS = 2;
const ORDER_REF = /^[A-Za-z0-9_-]{1,64}$/;
const sharedMutex = new KeyedMutex();

type Line = { sku: string; quantity: number };

export class ShopperMcpBackend implements StorefrontBackend {
  private notes: string[] = [];
  private readonly mutex: KeyedMutex;

  constructor(private readonly deps: ShopperMcpBackendDeps) {
    this.mutex = deps.mutex ?? sharedMutex;
  }

  /** Notes accumulated since the last call (a dropped filter, say). The executor appends them to the tool result. */
  drainNotes(): string[] {
    const out = this.notes;
    this.notes = [];
    return out;
  }

  private call(session: ShoppingSessionContext, tool: string, args: Record<string, unknown>): Promise<unknown> {
    return this.deps.mcp.call(tool, args, { ...(session.signal ? { signal: session.signal } : {}), ...(this.deps.requestTimeoutMs ? { timeoutMs: this.deps.requestTimeoutMs } : {}) });
  }

  private currency(session: ShoppingSessionContext): string {
    return session.currency ?? 'USD';
  }

  // ---- Catalogue

  async searchProducts(session: ShoppingSessionContext, query: string, filters?: SearchFilters, limit = 8): Promise<Product[]> {
    // An unsupported filter is DROPPED and SAID so: passing it through would return nothing, and an unmentioned dropped price ceiling
    // yields an over-budget shortlist presented as if it met the constraint. (Spike T-01 / U2 may wire real filters.)
    if (filters?.category) this.notes.push('The category filter could not be applied; results are not limited to that category.');
    if (filters?.minPrice !== undefined || filters?.maxPrice !== undefined) this.notes.push("The price limit could not be applied; check each result's price against what the customer asked.");
    if (filters?.minRating !== undefined) this.notes.push('The rating filter could not be applied.');
    if (filters && Object.keys(filters.attributes).length > 0) this.notes.push('The attribute filters could not be applied; check each result against them.');
    if (filters && filters.sort !== 'relevance') this.notes.push('The requested sort order could not be applied; results are in relevance order.');

    // A search backend that cannot serve THROWS (typed errors propagate): an empty list means "nothing matched".
    const raw = await this.call(session, 'search_catalog', { catalog: { query, pagination: { limit } } });
    const parsed = searchResultSchema.safeParse(raw);
    if (!parsed.success) throw new McpTransportError('unreadable search result');
    const seen = new Set<string>();
    const out: Product[] = [];
    for (const p of parsed.data.products) {
      const mapped = mapProduct(p, this.currency(session));
      if (!mapped || seen.has(mapped.product.productId)) continue;
      seen.add(mapped.product.productId);
      out.push(mapped.product);
    }
    return out.slice(0, limit);
  }

  async getProductDetails(session: ShoppingSessionContext, productId: string): Promise<ProductDetails | null> {
    const decoded = decodeId(productId);
    if (decoded.kind === 'sku' && decoded.sku === '') return null;
    let raw: unknown;
    try {
      raw = await this.call(session, 'get_product', { id: decoded.kind === 'family' ? decoded.mcpId : decoded.sku });
    } catch (error) {
      if (error instanceof McpNotFound) return null;
      throw error;
    }
    const parsed = getProductResultSchema.safeParse(raw);
    if (!parsed.success) throw new McpTransportError('unreadable product result');
    const mapped = mapProduct(parsed.data.product, this.currency(session));
    if (!mapped) return null;
    // A variant's id returns that variant (not its family).
    if (decoded.kind === 'sku' && mapped.variants.length > 0) {
      const variant = mapped.variants.find((v) => v.productId === decoded.sku);
      return variant ? { ...variant, specs: {}, reviewHighlights: [], variants: [] } : null;
    }
    return { ...mapped.product, ...(mapped.longDescription ? { longDescription: mapped.longDescription } : {}), specs: {}, reviewHighlights: [], variants: mapped.variants };
  }

  // ---- Cart (read-modify-write: `update_cart` REPLACES every line)

  private async readCart(session: ShoppingSessionContext, id: string): Promise<McpCart | null> {
    try {
      const parsed = cartSchema.safeParse(await this.call(session, 'get_cart', { id }));
      if (!parsed.success) throw new McpTransportError('unreadable cart result');
      return parsed.data;
    } catch (error) {
      if (error instanceof McpNotFound) return null;
      throw error;
    }
  }

  async getCart(session: ShoppingSessionContext): Promise<Cart> {
    const id = await this.deps.cartRef.get(session);
    if (!id) return { items: [], currency: this.currency(session) };
    const cart = await this.readCart(session, id);
    if (!cart) {
      await this.deps.cartRef.set(session, undefined);
      return { items: [], currency: this.currency(session) };
    }
    return mapCart(cart, this.currency(session));
  }

  async getCartTotals(session: ShoppingSessionContext): Promise<CartTotals | null> {
    const id = await this.deps.cartRef.get(session);
    if (!id) return null;
    const cart = await this.readCart(session, id);
    if (!cart || cart.line_items.length === 0) return null;
    return mapCartTotals(cart, this.currency(session));
  }

  /**
   * Apply `change` to the cart's lines and write the whole list back, serialised per session. `change` returns null for "nothing to do".
   * The MCP has no optimistic concurrency, so after a write the response is compared with what was meant and, if another writer got in
   * between, the change is re-applied once to a fresh read. The mutex covers one process only; this is the residual-risk mitigation.
   */
  private mutateCart(session: ShoppingSessionContext, change: (lines: Line[]) => Line[] | null): Promise<Cart> {
    return this.mutex.run(session.sessionId, async () => {
      let latest: McpCart | null = null;
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
        let id = await this.deps.cartRef.get(session);
        const current = id ? await this.readCart(session, id) : null;
        if (id && !current) {
          await this.deps.cartRef.set(session, undefined);
          id = undefined;
        }
        const next = change(current ? cartLines(current) : []);
        if (next === null) return current ? mapCart(current, this.currency(session)) : { items: [], currency: this.currency(session) };

        if (next.length === 0) {
          if (id) {
            await this.call(session, 'cancel_cart', { id });
            await this.deps.cartRef.set(session, undefined);
          }
          return { items: [], currency: this.currency(session) };
        }

        const lineItems = next.map((l) => ({ item: { id: l.sku }, quantity: l.quantity }));
        const raw = id
          ? await this.call(session, 'update_cart', { id, cart: { line_items: lineItems } })
          : await this.call(session, 'create_cart', { cart: { line_items: lineItems } });
        const parsed = cartSchema.safeParse(raw);
        if (!parsed.success) throw new McpTransportError('unreadable cart result');
        latest = parsed.data;
        if (!id) await this.deps.cartRef.set(session, latest.id);
        if (sameLines(cartLines(latest), next)) break;
      }
      return mapCart(latest as McpCart, this.currency(session));
    });
  }

  async addToCart(session: ShoppingSessionContext, productId: string, quantity: number): Promise<Cart> {
    if (isFamilyId(productId)) throw new Unavailable('This product has options; choose one of its variants (get_product_details lists them). Nothing was added.');
    const sku = decodeId(productId);
    if (sku.kind !== 'sku' || sku.sku === '') throw new Unavailable('Nothing was added: no product id.');
    try {
      return await this.mutateCart(session, (lines) => {
        const existing = lines.find((l) => l.sku === sku.sku);
        return existing ? lines.map((l) => (l === existing ? { ...l, quantity: l.quantity + quantity } : l)) : [...lines, { sku: sku.sku, quantity }];
      });
    } catch (error) {
      // Ids only: titles are catalogue text and stay inside fences.
      if (error instanceof McpNotOrderable) throw new Unavailable(`${sku.sku} is not available to buy right now (out of stock, or not sold in this store). Nothing was added and the cart is unchanged.`);
      throw error;
    }
  }

  async updateCartItem(session: ShoppingSessionContext, productId: string, quantity: number): Promise<Cart> {
    const { sku } = skuOf(productId);
    try {
      // A product the cart does not hold leaves the cart as it is; that is not an error.
      return await this.mutateCart(session, (lines) => (lines.some((l) => l.sku === sku) ? lines.map((l) => (l.sku === sku ? { ...l, quantity } : l)) : null));
    } catch (error) {
      if (error instanceof McpNotOrderable) throw new Unavailable(`${sku} cannot be set to that quantity right now. The cart is unchanged.`);
      throw error;
    }
  }

  async removeFromCart(session: ShoppingSessionContext, productId: string): Promise<Cart> {
    const { sku } = skuOf(productId);
    return this.mutateCart(session, (lines) => (lines.some((l) => l.sku === sku) ? lines.filter((l) => l.sku !== sku) : null));
  }

  // ---- Customer context

  async getPreferences(session: ShoppingSessionContext): Promise<UserPreferences> {
    // A guest profile, with no call: nothing is invented (no loyalty tier, no name).
    return { userId: session.userId, preferences: {} };
  }

  // ---- Orders: the shopper's OWN orders only, and only for a signed-in shopper.

  async getOrders(session: ShoppingSessionContext, limit = MAX_ORDERS): Promise<Order[]> {
    if (!session.customerId) throw new SignInRequired();
    const numbers = await this.deps.orders.listOwnOrderNumbers(session.customerId, Math.max(1, Math.min(limit, MAX_ORDERS)));
    const results = await Promise.allSettled(numbers.map((n) => this.fetchOrder(session, n)));
    const orders: Order[] = [];
    let firstError: unknown;
    for (const r of results) {
      if (r.status === 'fulfilled') {
        if (r.value) orders.push(r.value);
      } else if (!(r.reason instanceof McpNotFound)) firstError ??= r.reason;
    }
    if (orders.length === 0 && firstError !== undefined) throw firstError;
    return orders;
  }

  async getOrder(session: ShoppingSessionContext, orderId: string): Promise<Order | null> {
    if (!session.customerId) throw new SignInRequired();
    const ref = String(orderId ?? '').trim();
    if (!ORDER_REF.test(ref)) return null;
    // Ownership first, in the storefront's customer-scoped read: a number that is not theirs is a zero-row result there, so it is
    // indistinguishable from an unknown one, and the MCP is never asked about it.
    const number = await this.deps.orders.resolveOwnOrderNumber(session.customerId, ref);
    if (!number) return null;
    return this.fetchOrder(session, number);
  }

  private async fetchOrder(session: ShoppingSessionContext, numberOrId: string): Promise<Order | null> {
    try {
      const parsed = orderSchema.safeParse(await this.call(session, 'get_order', { id: numberOrId }));
      if (!parsed.success) throw new McpTransportError('unreadable order result');
      return mapOrder(parsed.data, this.currency(session), this.deps.storefrontHost);
    } catch (error) {
      if (error instanceof McpNotFound) return null;
      throw error;
    }
  }
}

function skuOf(productId: string): { sku: string } {
  const d = decodeId(productId);
  return { sku: d.kind === 'sku' ? d.sku : '' };
}

function sameLines(a: readonly Line[], b: readonly Line[]): boolean {
  if (a.length !== b.length) return false;
  const map = new Map(a.map((l) => [l.sku, l.quantity]));
  return b.every((l) => map.get(l.sku) === l.quantity);
}
