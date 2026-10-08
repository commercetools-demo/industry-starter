import 'server-only';
import type { Cart as CtCart, CartUpdateAction } from '@commercetools/platform-sdk';
import { withCartRetry } from '@/lib/api-retry';
import { apiRoot } from '@/lib/ct/client';
import { loadCartFixtures } from '@/lib/ct/fixtures';
import type { Patient } from '@/lib/ct/patient';
import { checkLines } from '@/lib/ct/cart-validation';
import type { RxContext, SelectedLine } from '@/lib/ct/prescriptions';
import { mapCart, rxFieldsOf, RX_LINE_TYPE_KEY, unitPriceOf } from '@/lib/mappers/cart';
import type { Cart } from '@/lib/types';

/**
 * Prescription cart (workstream O). A customer cart (signed-in only, never anonymous): currency and country from
 * the visitor's region, `shippingMode Single`, tax mode Platform, and the standard delivery method preselected so
 * the delivery row is platform-calculated. Lines are medications only; quantity counts packs and the prescribed
 * quantity lives in the line's custom fields. The BFF never removes a line on its own: re-validation flags it.
 * Health-data rule: RX numbers and medication names are never logged.
 */

export const STANDARD_SHIPPING_KEY = 'mlv-standard';

const isNotFound = (error: unknown): boolean => (error as { statusCode?: number } | null)?.statusCode === 404;

export async function fetchActiveCart(customerId: string, cartId: string | undefined): Promise<CtCart | null> {
  if (cartId) {
    try {
      const { body } = await apiRoot.carts().withId({ ID: cartId }).get().execute();
      // Never act on a cart that is not the signed-in customer's own, or that is no longer Active.
      if (body.cartState === 'Active' && body.customerId === customerId) return body;
    } catch (error) {
      if (!isNotFound(error)) throw error;
    }
  }
  // No usable cartId (stale, cleared by sign-out): the customer's newest Active cart, if any.
  const { body } = await apiRoot
    .carts()
    .get({ queryArgs: { where: 'customerId=:id and cartState="Active"', 'var.id': customerId, sort: 'lastModifiedAt desc', limit: 1 } })
    .execute();
  return body.results[0] ?? null;
}

async function createCart(customerId: string, ctx: RxContext): Promise<CtCart> {
  const { body } = await apiRoot
    .carts()
    .post({
      body: {
        currency: ctx.currency,
        country: ctx.country,
        customerId,
        shippingMode: 'Single',
        taxMode: 'Platform',
        // The platform needs an address country to pick a zone and a tax rate; checkout (Q) replaces it with the real one.
        shippingAddress: { country: ctx.country },
        shippingMethod: { typeId: 'shipping-method', key: STANDARD_SHIPPING_KEY },
      },
    })
    .execute();
  return body;
}

/** The customer's Active cart (created when none exists). */
export async function getOrCreateCart(customerId: string, cartId: string | undefined, ctx: RxContext): Promise<CtCart> {
  return (await fetchActiveCart(customerId, cartId)) ?? (await createCart(customerId, ctx));
}

async function update(cart: CtCart, actions: CartUpdateAction[]): Promise<CtCart> {
  const { body } = await apiRoot.carts().withId({ ID: cart.id }).post({ body: { version: cart.version, actions } }).execute();
  return body;
}

export interface CartOutcome {
  /** The cart after the change, as the page shows it. */
  cart: Cart;
}

/**
 * Adds the accepted lines. The same prescription line (`rxNumber` + `rxLineRef`) already in the cart is replaced in
 * the same update, so adding twice never duplicates. Creates the cart on the first add. A platform quantity-limit
 * error propagates for the Route Handler to map. The caller has already run `validateRxSelection`.
 */
export async function addRxLines(customerId: string, cartId: string | undefined, rxNumber: string, accepted: SelectedLine[], ctx: RxContext): Promise<CartOutcome> {
  const fixtures = await loadCartFixtures();
  if (fixtures) return fixtures.addRxLines(customerId, rxNumber, accepted);
  const updated = await withCartRetry(async () => {
    const cart = await getOrCreateCart(customerId, cartId, ctx);
    const refs = new Set(accepted.map((a) => a.lineRef));
    const actions: CartUpdateAction[] = [];
    for (const item of cart.lineItems) {
      const f = rxFieldsOf(item);
      if (f && f.rxNumber === rxNumber && refs.has(f.rxLineRef)) actions.push({ action: 'removeLineItem', lineItemId: item.id });
    }
    for (const a of accepted) {
      actions.push({
        action: 'addLineItem',
        sku: a.sku,
        quantity: a.packs,
        custom: {
          type: { typeId: 'type', key: RX_LINE_TYPE_KEY },
          fields: { rxNumber, rxLineRef: a.lineRef, prescribedQty: a.qty },
        },
      });
    }
    return update(cart, actions);
  });
  return { cart: mapCart(updated) };
}

/** Removes one line. A line that is not in the cart (already removed in another tab) is not an error. */
export async function removeLine(customerId: string, cartId: string | undefined, lineId: string): Promise<CartOutcome | null> {
  const fixtures = await loadCartFixtures();
  if (fixtures) return fixtures.removeLine(customerId, lineId);
  const updated = await withCartRetry(async () => {
    const cart = await fetchActiveCart(customerId, cartId);
    if (!cart) return null;
    if (!cart.lineItems.some((i) => i.id === lineId)) return cart;
    return update(cart, [{ action: 'removeLineItem', lineItemId: lineId }]);
  });
  return updated ? { cart: mapCart(updated) } : null;
}

/** Cheap read for the header count: no re-validation, no write. */
export async function getCartSummary(customerId: string, cartId: string | undefined): Promise<Cart | null> {
  const fixtures = await loadCartFixtures();
  if (fixtures) return fixtures.getCart(customerId);
  const cart = await fetchActiveCart(customerId, cartId);
  return cart ? mapCart(cart) : null;
}

/**
 * The cart for the page: the platform recalculates (`recalculate` with `updateProductData`, so changed prices come
 * through), every line is re-validated against the prescription rules, and lines whose unit price changed since the
 * previous read are marked (`priceUpdated`). The price seen is stored on the line (`lastSeenUnitPrice`) for the next
 * read. Null when the customer has no cart.
 */
export async function getCartValidated(patient: Patient, customerId: string, cartId: string | undefined, ctx: RxContext): Promise<Cart | null> {
  const fixtures = await loadCartFixtures();
  if (fixtures) return fixtures.getCartValidated(patient, customerId, ctx);
  const before = await fetchActiveCart(customerId, cartId);
  if (!before) return null;
  if (before.lineItems.length === 0) return mapCart(before);

  const recalculated = await withCartRetry(async () => {
    const cart = (await fetchActiveCart(customerId, before.id)) ?? before;
    return update(cart, [{ action: 'recalculate', updateProductData: true }]);
  });

  const seenBefore = new Map(before.lineItems.map((i) => [i.id, rxFieldsOf(i)?.lastSeenCents]));
  const priceUpdated = new Set<string>();
  const stale: CartUpdateAction[] = [];
  for (const item of recalculated.lineItems) {
    const unit = unitPriceOf(item);
    const seen = seenBefore.get(item.id) ?? rxFieldsOf(item)?.lastSeenCents;
    if (seen !== undefined && seen !== unit.centAmount) priceUpdated.add(item.id);
    if (seen !== unit.centAmount && rxFieldsOf(item)) {
      stale.push({ action: 'setLineItemCustomField', lineItemId: item.id, name: 'lastSeenUnitPrice', value: { currencyCode: unit.currencyCode, centAmount: unit.centAmount } });
    }
  }
  const final = stale.length ? await withCartRetry(async () => update((await fetchActiveCart(customerId, before.id)) ?? recalculated, stale)) : recalculated;
  const problems = await checkLines(patient, final.lineItems.map((i) => ({ id: i.id, rx: rxFieldsOf(i) })), ctx);
  return mapCart(final, { problems, priceUpdated });
}
