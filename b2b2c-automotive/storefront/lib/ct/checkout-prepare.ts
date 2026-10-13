// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Cart preparation before the hosted Checkout session (O D8, D9). One update: recalculate (prices, product data, tax), the customer
// email of a signed-in shopper (prefill), and the `malva-checkout` fields that Checkout copies to the order (`fitVehicleLabel`,
// `isTest` outside production, `salesChannel`). `pickupBranchKey` belongs to N's delivery preset and is NOT written here
// (N and the cart mapper read its presence as "pickup"); the return handler reconciles it on the order.
// No territory or store-country check (D7, owner answer Q-O03).
import 'server-only';
import type { Cart as CtCart, CartUpdateAction } from '@commercetools/platform-sdk';
import { postActions } from '@/lib/ct/cart';
import { parentOf } from '@/lib/ct/cart-bundles';
import { withCartRetry } from '@/lib/ct/cart-retry';
import { CHECKOUT_TYPE_KEY } from '@/lib/ct/delivery';
import { getLineStock } from '@/lib/ct/inventory';
import { getShellContext } from '@/lib/ct/shell';
import { getBranchScope, type BranchScope } from '@/lib/store/branch-scope';
import { splitStock } from '@/lib/store/stock';
import { subscriptionsPurchaseEnabled } from '@/lib/subscriptions/config';

export class EmptyCart extends Error {
  constructor() {
    super('The cart is empty');
    this.name = 'EmptyCart';
  }
}
export class LinesUnavailable extends Error {
  constructor(readonly lineItemIds: string[]) {
    super('Some lines cannot be supplied');
    this.name = 'LinesUnavailable';
  }
}
export class SubscriptionsUnavailable extends Error {
  constructor() {
    super('Subscriptions cannot be purchased right now');
    this.name = 'SubscriptionsUnavailable';
  }
}

export interface PrepareInput {
  storeKey: string;
  cartId: string;
  /** The shopper's chosen branch (session); the first branch of the store when absent or unknown. */
  branchKey: string | undefined;
  /** Label of the active vehicle (from J); `null` without one. */
  vehicleLabel: string | null;
  /** Email of the signed-in customer, to prefill the hosted page. */
  customerEmail?: string;
  /** The seller who shops as this customer (`session.impersonatedBy`, V-06): audit field on the cart and its order. Never a request value. */
  placedOnBehalfBy?: string;
}
export interface PrepareEnv {
  production: boolean;
  subscriptionsEnabled: boolean;
}

export const SALES_CHANNEL_WEB = 'web';
const defaultEnv = (): PrepareEnv => ({ production: process.env.NODE_ENV === 'production', subscriptionsEnabled: subscriptionsPurchaseEnabled() });

/** Lines the branch and the warehouse together cannot cover at all (available 0): the cart already blocks its Checkout button for them. */
async function unavailableLines(cart: CtCart, scope: BranchScope): Promise<string[]> {
  // A bundle line has no inventory entry of its own; its locked component lines are checked one by one (W-11).
  const lines = (cart.lineItems ?? []).filter((line) => !(cart.lineItems ?? []).some((other) => parentOf(other) === line.id));
  const stock = await getLineStock(
    lines.map((l) => l.variant.sku).filter((s): s is string => Boolean(s)),
    scope.branchChannelId,
  );
  return lines
    .filter((line) => {
      const split = splitStock(line.quantity, stock.get(line.variant.sku ?? '') ?? { branchQty: 0, masterQty: 0 });
      return split.fromStore + split.shipsLater === 0;
    })
    .map((line) => line.id);
}

/** Pure: the custom field changes for the `malva-checkout` type (desired value `undefined` removes the field). */
export function checkoutFieldActions(cart: CtCart, desired: Record<string, string | boolean | undefined>): CartUpdateAction[] {
  const current = cart.custom?.fields ?? {};
  if (!cart.custom?.type) {
    const fields = Object.fromEntries(Object.entries(desired).filter(([, v]) => v !== undefined));
    return Object.keys(fields).length === 0 ? [] : [{ action: 'setCustomType', type: { typeId: 'type', key: CHECKOUT_TYPE_KEY }, fields }];
  }
  return Object.entries(desired)
    .filter(([name, value]) => current[name] !== value && !(value === undefined && current[name] === undefined))
    .map(([name, value]) => ({ action: 'setCustomField' as const, name, ...(value === undefined ? {} : { value }) }));
}

/**
 * Loads the cart, refuses what cannot be bought, and writes the preparation in one update. Throws `EmptyCart`, `LinesUnavailable(ids)`,
 * `SubscriptionsUnavailable`. Returns the cart as commercetools answers (with its new version).
 */
export async function prepareCartForCheckout(input: PrepareInput, env: PrepareEnv = defaultEnv()): Promise<CtCart> {
  const cart = await withCartRetry(input.storeKey, input.cartId, async (current) => current);
  if (cart.cartState !== 'Active' || (cart.lineItems ?? []).length === 0) throw new EmptyCart();
  if (!env.subscriptionsEnabled && (cart.lineItems ?? []).some((line) => line.recurrenceInfo)) throw new SubscriptionsUnavailable();

  const shell = await getShellContext(input.storeKey, cart.locale ?? 'de-DE');
  const scope = getBranchScope({ branchKey: input.branchKey }, shell?.branches ?? [], shell?.retailChannelId);
  const unavailable = await unavailableLines(cart, scope);
  if (unavailable.length > 0) throw new LinesUnavailable(unavailable);

  const actions: CartUpdateAction[] = [{ action: 'recalculate', updateProductData: true }];
  if (input.customerEmail && cart.customerEmail !== input.customerEmail) actions.push({ action: 'setCustomerEmail', email: input.customerEmail });
  actions.push(
    ...checkoutFieldActions(cart, {
      fitVehicleLabel: input.vehicleLabel ?? undefined,
      isTest: env.production ? undefined : true,
      salesChannel: SALES_CHANNEL_WEB,
      placedOnBehalfBy: input.placedOnBehalfBy,
    }),
  );
  return postActions(input.storeKey, input.cartId, actions);
}
