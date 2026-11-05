import type { StorefrontBackend } from './shopping/backend';
import { NotOffered, SignInRequired, Unavailable } from './shopping/backend';
import type { Cart, CartTotals, Order, Product, ProductDetails, SearchFilters, ShoppingSessionContext, UserPreferences } from './shopping/types';

/** Test doubles for the shopping agent: no network, no key, no spend. */

export const session = (over: Partial<ShoppingSessionContext> = {}): ShoppingSessionContext => ({
  sessionId: 'sess-1',
  userId: 'u1',
  page: { pageType: 'home', extra: {} },
  currency: 'USD',
  ...over,
});

export const product = (id: string, over: Partial<Product> = {}): Product => ({
  productId: id,
  title: `Title ${id}`,
  price: 10,
  currency: 'USD',
  labels: [],
  attributes: {},
  inStock: true,
  options: {},
  optionValues: {},
  ...over,
});

/** An in-memory StorefrontBackend with a catalogue, a cart (with an artificial await between read and write so unserialised writers would interleave), orders and a call log. */
export class FakeBackend implements StorefrontBackend {
  calls: string[] = [];
  cart: Cart = { items: [], currency: 'USD' };
  notes: string[] = [];
  totals: CartTotals | null = null;
  orders: Order[] = [];
  /** Ids belonging to another customer: indistinguishable from unknown. */
  foreignOrders = new Set<string>();
  signedIn = true;
  failWith: Error | null = null;
  seenStatusArgs: unknown[] = [];

  constructor(public catalogue: Product[] = [], public details = new Map<string, ProductDetails>()) {}

  private log(name: string): void {
    this.calls.push(name);
    if (this.failWith) throw this.failWith;
  }

  async searchProducts(_s: ShoppingSessionContext, query: string, filters?: SearchFilters, limit = 8): Promise<Product[]> {
    this.log('searchProducts');
    this.seenStatusArgs.push({ query, filters, limit });
    return this.catalogue.filter((p) => p.title.toLowerCase().includes(query.toLowerCase()) || query === '*').slice(0, limit);
  }

  async getProductDetails(_s: ShoppingSessionContext, id: string): Promise<ProductDetails | null> {
    this.log('getProductDetails');
    const d = this.details.get(id);
    if (d) return d;
    const p = this.catalogue.find((c) => c.productId === id);
    return p ? { ...p, specs: {}, reviewHighlights: [], variants: [] } : null;
  }

  async getCart(): Promise<Cart> {
    this.log('getCart');
    await Promise.resolve();
    return structuredClone(this.cart);
  }

  async addToCart(_s: ShoppingSessionContext, id: string, quantity: number): Promise<Cart> {
    this.log('addToCart');
    // A family id is never bought (the contract): the cart takes one of its variants.
    if (id.startsWith('fam:')) throw new Unavailable('This product has options; choose one of its variants.');
    await Promise.resolve();
    const line = this.cart.items.find((i) => i.productId === id);
    if (line) line.quantity += quantity;
    else this.cart.items.push({ productId: id, title: `Title ${id}`, price: 10, quantity, optionValues: {} });
    return structuredClone(this.cart);
  }

  async updateCartItem(_s: ShoppingSessionContext, id: string, quantity: number): Promise<Cart> {
    this.log('updateCartItem');
    const line = this.cart.items.find((i) => i.productId === id);
    if (line) line.quantity = quantity;
    return structuredClone(this.cart);
  }

  async removeFromCart(_s: ShoppingSessionContext, id: string): Promise<Cart> {
    this.log('removeFromCart');
    this.cart.items = this.cart.items.filter((i) => i.productId !== id);
    return structuredClone(this.cart);
  }

  async getCartTotals(): Promise<CartTotals | null> {
    return this.totals;
  }

  async getPreferences(s: ShoppingSessionContext): Promise<UserPreferences> {
    this.log('getPreferences');
    return { userId: s.userId, preferences: {} };
  }

  async getOrders(): Promise<Order[]> {
    this.log('getOrders');
    if (!this.signedIn) throw new SignInRequired();
    return this.orders;
  }

  async getOrder(_s: ShoppingSessionContext, id: string): Promise<Order | null> {
    this.log('getOrder');
    if (!this.signedIn) throw new SignInRequired();
    if (this.foreignOrders.has(id)) return null;
    return this.orders.find((o) => o.orderId === id) ?? null;
  }

  drainNotes(): string[] {
    const n = this.notes;
    this.notes = [];
    return n;
  }
}

export { NotOffered };

// ---------------------------------------------------------------------------------------------------------------------------------
// A scripted model client: lets the whole turn loop be exercised with no API key and no spend. It emits the RAW stream events of the
// Messages API (message_start, content blocks with deltas, message_delta, message_stop), tool input split into small chunks so partial
// frames and malformed inputs can be tested.
// ---------------------------------------------------------------------------------------------------------------------------------

import type { RawEvent } from './common/turn';
import type { ModelClient } from './runtime/orchestrator';

export type ScriptedBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; name: string; input?: Record<string, unknown>; id?: string; rawInput?: string };

export interface ScriptedRound {
  blocks: ScriptedBlock[];
  stopReason?: string;
  usage?: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number };
  /** Milliseconds to wait before the first event (a slow model). */
  delayMs?: number;
  /** Throw after this many events (a dropped connection). */
  failAfterEvents?: number;
}

const chunk = (text: string, size: number): string[] => {
  const out: string[] = [];
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
  return out.length > 0 ? out : [''];
};

export function* rawEventsFor(round: ScriptedRound, roundNumber: number): Generator<RawEvent> {
  const usage = { input_tokens: 100, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, ...round.usage };
  yield { type: 'message_start', message: { id: `msg_${roundNumber}`, usage } };
  let toolCount = 0;
  for (const [index, block] of round.blocks.entries()) {
    if (block.type === 'text') {
      yield { type: 'content_block_start', index, content_block: { type: 'text', text: '' } };
      for (const piece of chunk(block.text, 6)) yield { type: 'content_block_delta', index, delta: { type: 'text_delta', text: piece } };
    } else {
      toolCount += 1;
      const id = block.id ?? `toolu_${roundNumber}_${toolCount}`;
      yield { type: 'content_block_start', index, content_block: { type: 'tool_use', id, name: block.name, input: {} } };
      for (const piece of chunk(block.rawInput ?? JSON.stringify(block.input ?? {}), 9)) yield { type: 'content_block_delta', index, delta: { type: 'input_json_delta', partial_json: piece } };
    }
    yield { type: 'content_block_stop', index };
  }
  yield { type: 'message_delta', delta: { stop_reason: round.stopReason ?? (toolCount > 0 ? 'tool_use' : 'end_turn') }, usage: { output_tokens: usage.output_tokens } };
  yield { type: 'message_stop' };
}

export class FakeModelClient implements ModelClient {
  /** The request of every call, deep-copied at call time (the loop mutates the conversation afterwards). */
  requests: Record<string, unknown>[] = [];
  private round = 0;

  constructor(private readonly script: ScriptedRound[] | ((request: Record<string, unknown>, round: number) => ScriptedRound)) {}

  async stream(request: Record<string, unknown>, options: { signal?: AbortSignal }): Promise<AsyncIterable<RawEvent>> {
    this.requests.push(JSON.parse(JSON.stringify(request)));
    const n = this.round++;
    const scripted = typeof this.script === 'function' ? this.script(request, n) : this.script[Math.min(n, this.script.length - 1)];
    return (async function* () {
      if (scripted.delayMs) await new Promise((resolve) => setTimeout(resolve, scripted.delayMs));
      let count = 0;
      for (const event of rawEventsFor(scripted, n)) {
        if (options.signal?.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' });
        if (scripted.failAfterEvents !== undefined && count >= scripted.failAfterEvents) throw new Error('connection dropped');
        count += 1;
        yield event;
      }
    })();
  }
}
