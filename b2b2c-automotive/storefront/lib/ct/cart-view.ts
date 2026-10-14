// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// The cart as the page and the routes show it (workstream N-09): reads the cart, keeps its lines on the shopper's branch (D6), presets
// the delivery, adds delivery options and stock, and maps it. Every cart route answers with `buildCartView`.
import 'server-only';
import type { Cart as CtCart } from '@commercetools/platform-sdk';
import type { AppLocale } from '@/i18n/config';
import { getCart, loadRescopeInputs, pickupPlaceOf, planRescope, postActions } from '@/lib/ct/cart';
import { getDeliveryOptions, setDelivery, type DeliveryBranch } from '@/lib/ct/delivery';
import { getLineStock } from '@/lib/ct/inventory';
import { getShellContext } from '@/lib/ct/shell';
import { mapCart } from '@/lib/mappers/cart';
import { getBranchScope, type BranchScope } from '@/lib/store/branch-scope';
import { getPickupOption } from '@/lib/store/pickup';
import type { LineStock } from '@/lib/store/stock';
import type { Cart } from '@/lib/types';

export interface CartViewInput {
  storeKey: string;
  locale: AppLocale;
  branchKey: string | undefined;
  /** The active vehicle (fit per line); null without one. */
  vehicle: { make: string; model: string; year: number; engine: string } | null;
  /** Message `cart.savingFallback`. */
  savingFallback: string;
}

const logFailure = (what: string, error: unknown) => {
  const status = typeof error === 'object' && error !== null ? (error as { statusCode?: number }).statusCode : undefined;
  console.error(`[cart] ${what} failed${status ? ` with status ${status}` : ''} (${error instanceof Error ? error.constructor.name : typeof error})`);
};

/** The branch scope of the shopper: the chosen branch (else the first), its channel, the store's retail channel and the pickup option to show. */
export async function scopeOf(input: CartViewInput) {
  const shell = await getShellContext(input.storeKey, input.locale);
  const scope = getBranchScope({ branchKey: input.branchKey }, shell?.branches ?? [], shell?.retailChannelId);
  const branch = shell?.branches.find((b) => b.key === scope.branchKey);
  const deliveryBranch: DeliveryBranch | null =
    branch && shell ? { key: branch.key, name: branch.name, city: branch.address.city, pickupPromise: getPickupOption(branch, new Date(), shell.settings.timezone) } : null;
  return { scope, branch, deliveryBranch };
}

/** Maps a commercetools cart (expanded with `CART_EXPAND`) for the browser. Delivery options and stock are read here; `stock` may be passed when already known. */
export async function buildCartView(ct: CtCart, input: CartViewInput, known?: { stock?: Map<string, LineStock>; unpricedSkus?: string[]; scope?: BranchScope }): Promise<Cart> {
  const { scope, deliveryBranch } = await scopeOf(input);
  const skus = (ct.lineItems ?? []).map((l) => l.variant.sku).filter((s): s is string => Boolean(s));
  const [options, stock] = await Promise.all([
    getDeliveryOptions(ct, deliveryBranch).catch((error) => {
      logFailure('delivery options', error);
      return [];
    }),
    known?.stock ?? getLineStock(skus, scope.branchChannelId),
  ]);
  return mapCart(ct, {
    locale: input.locale,
    options,
    stock: Object.fromEntries(stock),
    branchName: deliveryBranch?.name ?? null,
    vehicle: input.vehicle,
    savingFallback: input.savingFallback,
    unpricedSkus: known?.unpricedSkus ?? [],
  });
}

/**
 * The cart of the session. `drop` is true when the id must be cleared from the session (gone, not Active, or a cart of another store).
 * With lines it also (1) re-scopes the lines to the session's branch when a price channel or supply channel differs (a branch change,
 * or a price that moved to another channel) and (2) presets pickup (shipping when there is no branch) on a cart without a shipping method.
 */
export async function loadCartView(cartId: string | undefined, input: CartViewInput): Promise<{ cart: Cart | null; drop: boolean }> {
  if (!cartId) return { cart: null, drop: false };
  let ct = await getCart(input.storeKey, cartId);
  if (!ct || ct.store?.key !== input.storeKey) return { cart: null, drop: true };
  if ((ct.lineItems ?? []).length === 0) return { cart: await buildCartView(ct, input), drop: false };

  const { scope, deliveryBranch } = await scopeOf(input);
  let stock: Map<string, LineStock> | undefined;
  let unpricedSkus: string[] = [];
  try {
    const inputs = await loadRescopeInputs(ct, scope);
    stock = inputs.stock;
    const place = await pickupPlaceOf(input.storeKey, input.locale, scope.branchKey);
    const plan = planRescope(ct, scope, inputs.prices, inputs.stock, place);
    unpricedSkus = plan.unpriced;
    if (plan.actions.length > 0) ct = await postActions(input.storeKey, cartId, plan.actions);
  } catch (error) {
    logFailure('branch re-scope', error);
  }
  if (!ct.shippingInfo) {
    try {
      const place = await pickupPlaceOf(input.storeKey, input.locale, scope.branchKey);
      ct = await setDelivery(input.storeKey, cartId, deliveryBranch && place ? 'pickup' : 'ship', place);
    } catch (error) {
      // Two requests (the server render and the client read) may preset at once and one loses the 409 race: read what the other wrote.
      logFailure('default delivery', error);
      ct = (await getCart(input.storeKey, cartId).catch(() => null)) ?? ct;
    }
  }
  return { cart: await buildCartView(ct, input, { stock, unpricedSkus, scope }), drop: false };
}
