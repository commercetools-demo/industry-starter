import 'server-only';
import { KeyedMutex } from '@/lib/agent/common/mutex';
import { NotOffered, SignInRequired, type StorefrontBackend, Unavailable } from '@/lib/agent/shopping/backend';
import type { ShoppingSessionContext, UserPreferences } from '@/lib/agent/shopping/types';
import { type CartMarket, LineRejected } from '@/lib/ct/cart';
import { AppError } from '@/lib/errors';
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

  // -- Methods built in U-04 to U-06

  async searchProducts(): Promise<never> {
    throw new Unavailable('not built');
  }

  async getProductDetails(): Promise<never> {
    throw new Unavailable('not built');
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
