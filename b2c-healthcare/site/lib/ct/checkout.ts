import 'server-only';
import type { Cart as CtCart, CartUpdateAction } from '@commercetools/platform-sdk';
import { withCartRetry } from '@/lib/api-retry';
import { STANDARD_METHOD_KEY } from '@/lib/checkout/config';
import { paymentModeNow } from '@/lib/checkout/payment-provider';
import { fetchActiveCart } from '@/lib/ct/cart';
import { applyFunding, recalcActions } from '@/lib/ct/cart-funding';
import { checkLines } from '@/lib/ct/cart-validation';
import { apiRoot } from '@/lib/ct/client';
import { loadCheckoutFixtures } from '@/lib/ct/fixtures';
import type { Patient } from '@/lib/ct/patient';
import type { RxContext } from '@/lib/ct/prescriptions';
import { getOptionsForCart } from '@/lib/ct/shipping-options';
import { setRestrictedChoice, tenderViewOf } from '@/lib/ct/tender';
import { toCtAddress } from '@/lib/mappers/address';
import { rxFieldsOf } from '@/lib/mappers/cart';
import { mapCheckoutCart } from '@/lib/mappers/checkout';
import type { AddressInput, CartLineProblem, CheckoutCart, CheckoutState, DeliveryOption } from '@/lib/types';

/**
 * Checkout reads and writes (workstream Q). The page never keeps its own copy of the summary: after every change to
 * the address or the delivery method the cart is read again and the shipping cost, tax and total come from that
 * response (checkout-page: re-read after each shipping change). Delivery options come from
 * `shipping-methods/matching-cart` for the cart as it now is.
 */

export interface CheckoutContext {
  patient: Patient;
  customerId: string;
  cartId: string | undefined;
  rx: RxContext;
  /** "Now" for the same-day cut-off. */
  now: Date;
}

const hasLines = (cart: CtCart) => cart.lineItems.length > 0;

async function readCart(cartId: string): Promise<CtCart> {
  const { body } = await apiRoot.carts().withId({ ID: cartId }).get({ queryArgs: { expand: ['shippingInfo.shippingMethod'] } }).execute();
  return body;
}

async function update(cart: Pick<CtCart, 'id' | 'version'>, actions: CartUpdateAction[]): Promise<CtCart> {
  const { body } = await apiRoot.carts().withId({ ID: cart.id }).post({ body: { version: cart.version, actions } }).execute();
  return body;
}

/** A cart state read fresh from the platform (the single source of every figure on the page). */
async function stateOf(cartId: string, ctx: CheckoutContext, problems?: ReadonlyMap<string, CartLineProblem>, unresolved = false): Promise<CheckoutState> {
  const cart = await readCart(cartId);
  const options: DeliveryOption[] = hasLines(cart) ? await getOptionsForCart(cart.id, ctx.now) : [];
  const tender = await tenderViewOf(cart, { patientRef: ctx.patient.patientRef, now: ctx.now });
  return {
    cart: { ...mapCheckoutCart(cart, { ...(problems ? { problems } : {}), ...(unresolved ? { unresolved } : {}) }), ...(tender ? { tender } : {}) },
    options,
    deliverable: options.length > 0,
    paymentMode: paymentModeNow(),
  };
}

/**
 * The checkout page's data: the customer's cart recalculated (changed prices come through), every line re-validated
 * against the prescription rules, and the delivery options for the address on the cart. Null without a cart.
 */
export async function readCheckout(ctx: CheckoutContext): Promise<CheckoutState | null> {
  const fixtures = await loadCheckoutFixtures();
  if (fixtures) return fixtures.readCheckout(ctx);
  const before = await fetchActiveCart(ctx.customerId, ctx.cartId);
  if (!before) return null;
  if (!hasLines(before)) return stateOf(before.id, ctx);
  const recalculated = await withCartRetry(async () => {
    const cart = (await fetchActiveCart(ctx.customerId, before.id)) ?? before;
    return update(cart, recalcActions(cart));
  });
  // Cost-share is resolved again on every checkout read (workstream U); unresolved blocks the page's Place order.
  const funded = await applyFunding(recalculated, ctx.patient);
  const problems = await checkLines(ctx.patient, funded.cart.lineItems.map((item) => ({ id: item.id, rx: rxFieldsOf(item) })), ctx.rx);
  return stateOf(funded.cart.id, ctx, problems, funded.unresolved);
}

/**
 * Sets the shipping address, then keeps the cart's delivery method valid for it: when the selected method no longer
 * matches (same-day outside NY/TX/IL) the standard method is selected; when no method matches at all the state says
 * so (`deliverable: false`) and checkout cannot be completed. Returns the cart as re-read afterwards.
 */
export async function setCheckoutAddress(ctx: CheckoutContext, input: AddressInput): Promise<CheckoutState | null> {
  const fixtures = await loadCheckoutFixtures();
  if (fixtures) return fixtures.setAddress(ctx, input);
  const cart = await fetchActiveCart(ctx.customerId, ctx.cartId);
  if (!cart || !hasLines(cart)) return null;
  await withCartRetry(async () => update((await fetchActiveCart(ctx.customerId, cart.id)) ?? cart, [{ action: 'setShippingAddress', address: toCtAddress(input) }]));

  const options = await getOptionsForCart(cart.id, ctx.now);
  const current = (await readCart(cart.id)).shippingInfo?.shippingMethod?.obj?.key;
  const wanted = options.find((o) => o.key === current) ?? options.find((o) => o.key === STANDARD_METHOD_KEY) ?? options[0];
  if (wanted && wanted.key !== current) {
    await withCartRetry(async () => update(await readCart(cart.id), [{ action: 'setShippingMethod', shippingMethod: { typeId: 'shipping-method', key: wanted.key } }]));
  }
  return stateOf(cart.id, ctx);
}

export interface MethodOutcome {
  state: CheckoutState;
  /** False when the method is not valid for this cart now (not offered, or the cut-off passed): nothing was changed. */
  accepted: boolean;
}

/** Selects a delivery method the platform offers for the cart now; the totals come from the re-read cart. */
export async function setCheckoutShippingMethod(ctx: CheckoutContext, key: string): Promise<MethodOutcome | null> {
  const fixtures = await loadCheckoutFixtures();
  if (fixtures) return fixtures.setShippingMethod(ctx, key);
  const cart = await fetchActiveCart(ctx.customerId, ctx.cartId);
  if (!cart || !hasLines(cart)) return null;
  const options = await getOptionsForCart(cart.id, ctx.now);
  if (!options.some((o) => o.key === key)) return { state: await stateOf(cart.id, ctx), accepted: false };
  try {
    await withCartRetry(async () => update(await readCart(cart.id), [{ action: 'setShippingMethod', shippingMethod: { typeId: 'shipping-method', key } }]));
  } catch (error) {
    // The platform rejects a method that does not match the cart's conditions: same outcome as "not offered".
    if ((error as { statusCode?: number } | null)?.statusCode === 400) return { state: await stateOf(cart.id, ctx), accepted: false };
    throw error;
  }
  return { state: await stateOf(cart.id, ctx), accepted: true };
}

/** The cart as payment sees it: read now (no recalculation, no re-validation), amounts as the platform holds them. */
export async function readPaymentCart(ctx: CheckoutContext): Promise<CheckoutCart | null> {
  const fixtures = await loadCheckoutFixtures();
  if (fixtures) return (await fixtures.readCheckout(ctx))?.cart ?? null;
  const cart = await fetchActiveCart(ctx.customerId, ctx.cartId);
  if (!cart) return null;
  const fresh = await readCart(cart.id);
  const tender = await tenderViewOf(fresh, { patientRef: ctx.patient.patientRef, now: ctx.now });
  return { ...mapCheckoutCart(fresh), ...(tender ? { tender } : {}) };
}

export type RestrictedOutcome = { ok: true; state: CheckoutState } | { ok: false; reason: 'none-eligible'; state: CheckoutState };

/**
 * The patient chooses (or drops) the restricted instrument ("Health account card (demo)"). It is refused when nothing
 * in the basket qualifies (the state says why). The answer is the checkout state re-read after the change, so the card
 * amount in the summary is the server's.
 */
export async function setCheckoutRestricted(ctx: CheckoutContext, on: boolean): Promise<RestrictedOutcome | null> {
  const fixtures = await loadCheckoutFixtures();
  if (fixtures) return fixtures.setRestricted(ctx, on);
  const cart = await fetchActiveCart(ctx.customerId, ctx.cartId);
  if (!cart || !hasLines(cart)) return null;
  const outcome = await setRestrictedChoice(await readCart(cart.id), on, { patientRef: ctx.patient.patientRef, now: ctx.now });
  const state = await stateOf(cart.id, ctx);
  return outcome.ok ? { ok: true, state } : { ok: false, reason: outcome.reason, state };
}
