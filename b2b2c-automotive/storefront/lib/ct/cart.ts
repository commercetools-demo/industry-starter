// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Cart reads and writes of the storefront. Workstream I added `getCartSummary` and the `rescopeCartToBranch` seam;
// workstreams L and N extend THIS file (do not create a second cart module).
import 'server-only';
import type { Cart, CartUpdateAction } from '@commercetools/platform-sdk';
import { ApiError } from '@/lib/api';
import { apiRoot } from '@/lib/ct/client';
import { inStore } from '@/lib/ct/in-store';
import { getStandalonePrices } from '@/lib/ct/prices';
import type { BranchScope } from '@/lib/store/branch-scope';
import { selectStandalonePrice } from '@/lib/store/standalone-price';
import type { Session } from '@/lib/types';

const statusOf = (error: unknown): number | undefined =>
  typeof error === 'object' && error !== null ? (error as { statusCode?: number }).statusCode : undefined;

/** The header badge: units in the cart (2 units plus 1 unit is 3, not 2 lines). A missing or deleted cart is 0. */
export async function getCartSummary(storeKey: string, cartId: string | undefined): Promise<{ count: number }> {
  if (!cartId) return { count: 0 };
  try {
    const { body } = await inStore(storeKey).carts().withId({ ID: cartId }).get().execute();
    return { count: (body.lineItems ?? []).reduce((sum, line) => sum + line.quantity, 0) };
  } catch (error) {
    if (statusOf(error) === 404) return { count: 0 };
    throw error;
  }
}

/**
 * Seam for workstream N (N-04): after a branch change set the supply channel of every line to the branch and its
 * distribution channel to the channel of the winning price (`selectPrice`), then recalculate. Returns whether the cart was
 * re-priced. Until N implements it the cart keeps its lines and the branch applies to the next add to cart.
 */
export async function rescopeCartToBranch(...args: [storeKey: string, cartId: string, scope: BranchScope]): Promise<boolean> {
  void args;
  return false;
}

// ---- Add to cart (workstream L, L-06; M and N reuse `addLineToCart` and extend it) ----

/** The shopper's market and branch for one cart write. */
export interface AddLineContext {
  storeKey: string;
  locale: string;
  currency: string;
  country: string;
  scope: BranchScope;
}
export interface AddLineInput {
  sku: string;
  quantity: number;
  /**
   * Subscription policy key sent by the product page (M-06). Not applied here: workstream N (N-03 `addLine`) adds the
   * `recurrenceInfo` for a `recurring-eligible` product; cards never send it.
   */
  recurrencePolicyKey?: string;
}
export interface AddLineResult {
  cartId: string;
  /** Units in the cart after the add. */
  count: number;
  /** Set only when this call minted an anonymous id for the shopper: the caller writes it to the session. */
  anonymousId?: string;
}

const SKU = /^[A-Za-z0-9._-]{1,64}$/;
const channelRef = (id: string) => ({ typeId: 'channel' as const, id });
const unitsOf = (cart: Cart): number => (cart.lineItems ?? []).reduce((sum, line) => sum + line.quantity, 0);
const hasMissingPrice = (error: unknown): boolean =>
  statusOf(error) === 400 && ((error as { body?: { errors?: { code?: string }[] } }).body?.errors ?? []).some((e) => e.code === 'MissingPrice');

/**
 * Adds `quantity` units of `sku` to the shopper's cart of the store, creating the cart when the session has none (or its cart is
 * gone or no longer active). The line carries the channel of the standalone price that price selection picks (branch, store
 * retail channel, or none for the Malva base price, D4) and the branch as supply channel only when the branch has enough stock.
 * Errors: 400 invalid sku, 404 sku not in the store's assortment, 422 `price-unavailable`, 409 after one retry.
 */
export async function addLineToCart(
  ctx: AddLineContext,
  session: Pick<Session, 'cartId' | 'customerId' | 'anonymousId'>,
  input: AddLineInput,
): Promise<AddLineResult> {
  const { sku, quantity } = input;
  if (!SKU.test(sku)) throw new ApiError(400, 'Invalid sku');

  const inAssortment = await apiRoot
    .productProjections()
    .get({ queryArgs: { storeProjection: ctx.storeKey, where: `masterVariant(sku="${sku}")`, limit: 1 } })
    .execute();
  if (inAssortment.body.results.length === 0) throw new ApiError(404, 'Not found');

  const channelIds = [ctx.scope.branchChannelId, ctx.scope.retailChannelId] as const;
  const prices = await getStandalonePrices([sku], { currency: ctx.currency, channelIds });
  const selected = selectStandalonePrice(prices.get(sku) ?? [], { currency: ctx.currency, country: ctx.country, channelIds });
  if (!selected) throw new ApiError(422, 'price-unavailable');

  let supplyChannelId: string | undefined;
  if (ctx.scope.branchChannelId) {
    const { body } = await apiRoot
      .inventory()
      .get({ queryArgs: { where: `sku="${sku}" and supplyChannel(id="${ctx.scope.branchChannelId}")`, limit: 1 } })
      .execute();
    if ((body.results[0]?.availableQuantity ?? 0) >= quantity) supplyChannelId = ctx.scope.branchChannelId;
  }

  const carts = inStore(ctx.storeKey).carts();
  let anonymousId: string | undefined;
  const create = async (): Promise<Cart> => {
    if (!session.customerId) anonymousId = session.anonymousId ?? crypto.randomUUID();
    const { body } = await carts
      .post({
        body: {
          currency: ctx.currency,
          country: ctx.country,
          locale: ctx.locale,
          shippingAddress: { country: ctx.country },
          deleteDaysAfterLastModification: 30,
          ...(session.customerId ? { customerId: session.customerId } : { anonymousId }),
        },
      })
      .execute();
    return body;
  };
  const load = async (id: string): Promise<Cart | null> => {
    try {
      const { body } = await carts.withId({ ID: id }).get().execute();
      return body.cartState === 'Active' && body.totalPrice.currencyCode === ctx.currency ? body : null;
    } catch (error) {
      if (statusOf(error) === 404) return null;
      throw error;
    }
  };

  let cart = (session.cartId ? await load(session.cartId) : null) ?? (await create());
  const action: CartUpdateAction = {
    action: 'addLineItem',
    sku,
    quantity,
    ...(selected.channelId ? { distributionChannel: channelRef(selected.channelId) } : {}),
    ...(supplyChannelId ? { supplyChannel: channelRef(supplyChannelId) } : {}),
  };
  const push = async (current: Cart): Promise<Cart> => {
    const { body } = await carts.withId({ ID: current.id }).post({ body: { version: current.version, actions: [action] } }).execute();
    return body;
  };
  try {
    try {
      cart = await push(cart);
    } catch (error) {
      if (statusOf(error) !== 409) throw error;
      // The cart changed under us (a second tab, a double click): one retry on the current version.
      const fresh = await load(cart.id);
      if (!fresh) throw error;
      cart = await push(fresh);
    }
  } catch (error) {
    if (hasMissingPrice(error)) throw new ApiError(422, 'price-unavailable');
    throw error;
  }
  return { cartId: cart.id, count: unitsOf(cart), ...(anonymousId ? { anonymousId } : {}) };
}
