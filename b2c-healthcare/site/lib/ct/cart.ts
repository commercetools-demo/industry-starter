import 'server-only';
import type { Cart as CtCart, CartUpdateAction } from '@commercetools/platform-sdk';
import { withCartRetry } from '@/lib/api-retry';
import { apiRoot } from '@/lib/ct/client';
import { loadCartFixtures } from '@/lib/ct/fixtures';
import type { Patient } from '@/lib/ct/patient';
import { applyFunding, recalcActions } from '@/lib/ct/cart-funding';
import { checkLines } from '@/lib/ct/cart-validation';
import type { RxContext, SelectedLine } from '@/lib/ct/prescriptions';
import { tenderViewOf } from '@/lib/ct/tender';
import { mapCart, rxFieldsOf, RX_LINE_TYPE_KEY, unitPriceOf } from '@/lib/mappers/cart';
import type { Cart } from '@/lib/types';

/**
 * Prescription cart. A customer cart (signed-in only, never anonymous): currency and country from
 * the visitor's region, `shippingMode Single`, tax mode Platform, and the standard delivery method preselected so
 * the delivery row is platform-calculated. Lines are medications only; quantity counts packs and the prescribed
 * quantity lives in the line's custom fields. The BFF never removes a line on its own: re-validation flags it.
 * Health-data rule: RX numbers and medication names are never logged.
 */

export const STANDARD_SHIPPING_KEY = 'mlv-standard';

const isNotFound = (error: unknown): boolean => (error as { statusCode?: number } | null)?.statusCode === 404;

/**
 * `currency` is the visitor's region currency: a cart's currency is fixed at creation, so after a region
 * switch the old cart (left Active to expire) is ignored, never read, re-priced or added to.
 */
export async function fetchActiveCart(customerId: string, cartId: string | undefined, currency?: string): Promise<CtCart | null> {
  if (cartId) {
    try {
      const { body } = await apiRoot.carts().withId({ ID: cartId }).get().execute();
      // Never act on a cart that is not the signed-in customer's own, that is no longer Active, or priced in another currency.
      if (body.cartState === 'Active' && body.origin !== 'RecurringOrder' && body.customerId === customerId && (!currency || body.totalPrice.currencyCode === currency)) return body;
    } catch (error) {
      if (!isNotFound(error)) throw error;
    }
  }
  // No usable cartId (stale, cleared by sign-out): the customer's newest Active cart, if any. Recurring carts (auto-refill,
  // origin RecurringOrder) are never the shopping cart.
  const { body } = await apiRoot
    .carts()
    .get({
      queryArgs: {
        where: currency ? 'customerId=:id and cartState="Active" and origin="Customer" and totalPrice(currencyCode=:currency)' : 'customerId=:id and cartState="Active" and origin="Customer"',
        'var.id': customerId,
        ...(currency ? { 'var.currency': currency } : {}),
        sort: 'lastModifiedAt desc',
        limit: 1,
      },
    })
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
  return (await fetchActiveCart(customerId, cartId, ctx.currency)) ?? (await createCart(customerId, ctx));
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
export async function addRxLines(customerId: string, cartId: string | undefined, rxNumber: string, accepted: SelectedLine[], ctx: RxContext, patient?: Patient): Promise<CartOutcome> {
  const fixtures = await loadCartFixtures();
  if (fixtures) return fixtures.addRxLines(customerId, rxNumber, accepted, patient);
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
          fields: {
            rxNumber,
            rxLineRef: a.lineRef,
            prescribedQty: a.qty,
            // Copied now, not read live later: the product's `hsaEligible` and the credential that allowed a controlled line.
            ...(a.hsaEligible !== undefined ? { eligibleForRestricted: a.hsaEligible } : {}),
            ...(a.credential ? { credentialRef: a.credential.id, credentialValidTo: a.credential.validTo } : {}),
          },
        },
      });
    }
    return update(cart, actions);
  });
  // The covered share is re-resolved on every cart change (adding a line can change the cover of the others).
  const funded = patient ? await applyFunding(updated, patient) : { cart: updated, unresolved: false };
  return { cart: mapCart(funded.cart, { unresolved: funded.unresolved }) };
}

/** Removes one line. A line that is not in the cart (already removed in another tab) is not an error. */
export async function removeLine(customerId: string, cartId: string | undefined, lineId: string, currency?: string, patient?: Patient): Promise<CartOutcome | null> {
  const fixtures = await loadCartFixtures();
  if (fixtures) return fixtures.removeLine(customerId, lineId, patient);
  const updated = await withCartRetry(async () => {
    const cart = await fetchActiveCart(customerId, cartId, currency);
    if (!cart) return null;
    if (!cart.lineItems.some((i) => i.id === lineId)) return cart;
    return update(cart, [{ action: 'removeLineItem', lineItemId: lineId }]);
  });
  if (!updated) return null;
  const funded = patient ? await applyFunding(updated, patient) : { cart: updated, unresolved: false };
  return { cart: mapCart(funded.cart, { unresolved: funded.unresolved }) };
}

/** Cheap read for the header count: no re-validation, no write. */
export async function getCartSummary(customerId: string, cartId: string | undefined, currency?: string): Promise<Cart | null> {
  const fixtures = await loadCartFixtures();
  if (fixtures) return fixtures.getCart(customerId);
  const cart = await fetchActiveCart(customerId, cartId, currency);
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
  const before = await fetchActiveCart(customerId, cartId, ctx.currency);
  if (!before) return null;
  if (before.lineItems.length === 0) return mapCart(before);

  const recalculated = await withCartRetry(async () => {
    const cart = (await fetchActiveCart(customerId, before.id, ctx.currency)) ?? before;
    return update(cart, recalcActions(cart));
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
  const final = stale.length ? await withCartRetry(async () => update((await fetchActiveCart(customerId, before.id, ctx.currency)) ?? recalculated, stale)) : recalculated;
  // Payer cost-share: re-resolved at every load, so the figures the patient sees are never older than this read.
  const funded = await applyFunding(final, patient);
  const problems = await checkLines(patient, funded.cart.lineItems.map((i) => ({ id: i.id, rx: rxFieldsOf(i) })), ctx);
  // The tender split (allowance balance, eligible subtotal, card remainder) is shown on the cart before checkout.
  const tender = await tenderViewOf(funded.cart, { patientRef: patient.patientRef, now: ctx.now ?? new Date() });
  return { ...mapCart(funded.cart, { problems, priceUpdated, unresolved: funded.unresolved }), ...(tender ? { tender } : {}) };
}
