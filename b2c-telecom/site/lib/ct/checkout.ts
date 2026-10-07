import 'server-only';
import type { Address, AddressDraft, Cart as CtCart, CartUpdateAction, Order as CtOrder, ShippingMethod } from '@commercetools/platform-sdk';
import { validateAddress } from '@/lib/addresses/validate';
import { checkReadiness, compareTotal, splitIssues } from '@/lib/checkout/guards';
import { generateOrderNumber, isOrderNumber } from '@/lib/checkout/orderNumber';
import { CheckoutRefusal } from '@/lib/checkout/refusal';
import { buildReview } from '@/lib/checkout/review';
import { isValidEmail } from '@/lib/checkout/steps';
import { isDemoPayment } from '@/lib/config/checkout';
import { MALVA_SHIPPING_KEY_PREFIX } from '@/lib/config/shipping';
import { mapCheckoutState } from '@/lib/mappers/checkout';
import { mapOrder } from '@/lib/mappers/order';
import { toDateOnly } from '@/lib/pricing/dates';
import type { SessionData } from '@/lib/session-types';
import type { CheckoutAddress, CheckoutReview, CheckoutSessionInfo, CheckoutState, Market, Money, OrderConfirmationView, ShippingOption } from '@/lib/types';
import { getActiveCartForSession, statusOf, updateCart } from './cart';
import { mapForMarket } from './bundle';
import { CheckoutSessionError, createCheckoutSession } from './checkout-session';
import { getApiRoot } from './client';
import { getCustomerById } from './customer';
import { applyDeviceRecurringExpiry, assertDeviceCartIntegrity, evaluateFinancing } from './devices';
import { stampOrderPricing } from './order-stamp';
import { getServiceability } from './serviceability';
import { withTimeout } from './timeout';

// Server side of the checkout (workstream U). Every function takes the session and the market, reads the cart through the ownership-checked
// helpers of M (D-070) and answers with state read back from commercetools. Nothing is computed here: the platform prices, taxes and
// totals the cart; we only write the buyer's facts (email, addresses, shipping method) and read it again.
// Never sets `recurringPaymentConfiguration`: the hosted Checkout adds the payment allocation (L finding: an order with a strategy but no
// allocation is refused).

const DIGITAL_METHOD_KEY = 'malva-delivery-digital';

export interface WithPatch<T> {
  data: T;
  /** What the session cookie must change afterwards (undefined deletes a field). */
  patch?: Partial<SessionData>;
}

const refuse = (status: number, code: string, message: string, details?: Record<string, unknown>, state?: CheckoutState | null): CheckoutRefusal => new CheckoutRefusal(status, code, message, details, state);

// ---- reading ----

/** A signed-in buyer's contact is the customer's own email: written to the cart once, so the contact step is complete and read-only. */
async function withCustomerEmail(ct: CtCart, session: SessionData): Promise<CtCart> {
  if (!session.customerId || ct.customerEmail) return ct;
  const customer = await getCustomerById(session.customerId);
  return customer?.email ? updateCart(ct, [{ action: 'setCustomerEmail', email: customer.email }]) : ct;
}

async function loadCart(session: SessionData, market: Market): Promise<CtCart> {
  const ct = await getActiveCartForSession(session, market);
  if (!ct) throw refuse(400, 'NO_CART', 'There is no bundle to check out.');
  return withCustomerEmail(ct, session);
}

async function stateOf(ct: CtCart, session: SessionData, market: Market): Promise<{ state: CheckoutState; ct: CtCart }> {
  const zip = ct.shippingAddress?.postalCode;
  const location = zip ? await getServiceability().check(zip, market.country) : undefined;
  const mapped = await mapForMarket(ct, market, location);
  return { state: mapCheckoutState(mapped.ct, mapped.cart, Boolean(session.customerId)), ct: mapped.ct };
}

/** The checkout state of the session's bundle. 400 NO_CART when there is none. */
export async function readCheckoutState(session: SessionData, market: Market): Promise<CheckoutState> {
  return (await stateOf(await loadCart(session, market), session, market)).state;
}

/** Same, but `null` instead of a refusal when there is no bundle (the page redirects). */
export async function findCheckoutState(session: SessionData, market: Market): Promise<CheckoutState | null> {
  const ct = await getActiveCartForSession(session, market);
  return ct ? (await stateOf(await withCustomerEmail(ct, session), session, market)).state : null;
}

// ---- contact and address ----

export interface DetailsInput {
  email?: string;
  phone?: string;
  serviceAddress?: CheckoutAddress;
  /** Omitted together with a service address = the billing address is the same. */
  billingAddress?: CheckoutAddress;
}

function toDraft(address: CheckoutAddress, email?: string, phone?: string): AddressDraft {
  const mobile = address.phone ?? phone;
  return {
    firstName: address.firstName,
    lastName: address.lastName,
    streetName: address.streetName,
    ...(address.additionalStreetInfo ? { additionalStreetInfo: address.additionalStreetInfo } : {}),
    city: address.city,
    ...(address.state ? { state: address.state } : {}),
    postalCode: address.postalCode,
    country: address.country,
    ...(mobile ? { phone: mobile } : {}),
    ...(email ? { email } : {}),
  };
}

function checkAddress(address: CheckoutAddress, market: Market): void {
  const fields = validateAddress({ ...address, isService: true, isBilling: false });
  if (Object.keys(fields).length > 0) throw refuse(400, 'INVALID_ADDRESS', 'Check the address.', { fields });
  if (address.country !== market.country) throw refuse(422, 'COUNTRY_MISMATCH', 'This store ships to its own country only.', { country: market.country });
}

/**
 * Writes contact and addresses to the cart, re-reads it (the platform recalculates tax and shipping) and answers with the new state.
 * A service address no line can be served at is STORED anyway and answered 422 NOT_SERVICEABLE with the state, so the buyer sees the cart.
 */
export async function saveDetails(session: SessionData, market: Market, input: DetailsInput): Promise<CheckoutState> {
  if (input.email === undefined && input.phone === undefined && !input.serviceAddress && !input.billingAddress) throw refuse(400, 'INVALID_BODY', 'Nothing to save.');
  if (input.email !== undefined && !isValidEmail(input.email.trim())) throw refuse(400, 'INVALID_EMAIL', 'Enter a valid email address.');
  if (input.serviceAddress) checkAddress(input.serviceAddress, market);
  if (input.billingAddress) checkAddress(input.billingAddress, market);
  const ct = await loadCart(session, market);
  const email = input.email?.trim();
  const actions: CartUpdateAction[] = [];
  if (email !== undefined) actions.push({ action: 'setCustomerEmail', email });
  const contactEmail = email ?? ct.customerEmail;
  if (input.serviceAddress) {
    actions.push({ action: 'setShippingAddress', address: toDraft(input.serviceAddress, contactEmail, input.phone) });
    actions.push({ action: 'setBillingAddress', address: toDraft(input.billingAddress ?? input.serviceAddress, contactEmail, input.phone) });
    actions.push({ action: 'setCustomField', name: 'postalCode', value: input.serviceAddress.postalCode });
  } else {
    if (input.billingAddress) actions.push({ action: 'setBillingAddress', address: toDraft(input.billingAddress, contactEmail, input.phone) });
    if (input.phone !== undefined && ct.shippingAddress) actions.push({ action: 'setShippingAddress', address: { ...(ct.shippingAddress as Address), phone: input.phone } });
  }
  const updated = actions.length === 0 ? ct : await updateCart(ct, actions);
  const { state } = await stateOf(updated, session, market);
  if (input.serviceAddress) {
    const { notServiceable } = splitIssues(state.cart.issues);
    if (notServiceable.length > 0) {
      throw refuse(422, 'NOT_SERVICEABLE', 'This address cannot be served for every item in your bundle.', { lineIds: notServiceable.flatMap((issue) => (issue.lineId ? [issue.lineId] : [])), postalCode: input.serviceAddress.postalCode }, state);
    }
  }
  return state;
}

// ---- delivery ----

const money = (value: { centAmount: number; currencyCode: string }): Money => ({ centAmount: value.centAmount, currencyCode: value.currencyCode });

function optionOf(method: ShippingMethod, locale: string, cartTotal: number): ShippingOption {
  const rates = method.zoneRates.flatMap((zone) => zone.shippingRates);
  const rate = rates.find((candidate) => candidate.isMatching) ?? rates[0];
  const free = rate?.freeAbove !== undefined && cartTotal >= rate.freeAbove.centAmount;
  const price = rate ? (free ? { centAmount: 0, currencyCode: rate.price.currencyCode } : money(rate.price)) : { centAmount: 0, currencyCode: 'USD' };
  const localized = method.localizedName?.[locale];
  const description = method.localizedDescription?.[locale] ?? method.description;
  return { id: method.id, key: method.key ?? method.id, name: localized ?? method.name, ...(description ? { description } : {}), price };
}

/** The shipping methods the platform says match this cart, restricted to Malva's own (the sample methods match everything). */
async function matchingMethods(ct: CtCart): Promise<ShippingMethod[]> {
  const { body } = await withTimeout(getApiRoot().shippingMethods().matchingCart().get({ queryArgs: { cartId: ct.id } }).execute(), 'checkout.shipping');
  return body.results.filter((method) => (method.key ?? '').startsWith(MALVA_SHIPPING_KEY_PREFIX));
}

const methodAction = (id: string): CartUpdateAction => ({ action: 'setShippingMethod', shippingMethod: { typeId: 'shipping-method', id } });

export interface DeliveryList {
  options: ShippingOption[];
  needsDelivery: boolean;
  state: CheckoutState;
}

/** Options for the delivery step. A digital-only bundle gets the digital method set once and no options. `forceNone` is the dev-only switch. */
export async function listDelivery(session: SessionData, market: Market, opts: { forceNone?: boolean } = {}): Promise<DeliveryList> {
  const ct = await loadCart(session, market);
  if (!ct.shippingAddress) throw refuse(422, 'NO_ADDRESS', 'Add the service address first.');
  const methods = await matchingMethods(ct);
  const current = await stateOf(ct, session, market);
  if (!current.state.needsDelivery) {
    const digital = methods.find((method) => method.key === DIGITAL_METHOD_KEY);
    const written = digital && ct.shippingInfo?.shippingMethod?.id !== digital.id ? await updateCart(ct, [methodAction(digital.id)]) : ct;
    return { options: [], needsDelivery: false, state: (await stateOf(written, session, market)).state };
  }
  const options = opts.forceNone ? [] : methods.filter((method) => method.key !== DIGITAL_METHOD_KEY).map((method) => optionOf(method, market.locale, ct.totalPrice.centAmount));
  return { options, needsDelivery: true, state: current.state };
}

/** Sets the shipping method. The id is checked against the platform's matching list BEFORE any write. */
export async function selectDelivery(session: SessionData, market: Market, shippingMethodId: string): Promise<CheckoutState> {
  const ct = await loadCart(session, market);
  const methods = await matchingMethods(ct);
  if (!methods.some((method) => method.id === shippingMethodId && method.key !== DIGITAL_METHOD_KEY)) {
    throw refuse(422, 'SHIPPING_METHOD_NOT_AVAILABLE', 'That delivery method is not available for this address.');
  }
  const updated = await updateCart(ct, [methodAction(shippingMethodId)]);
  return (await stateOf(updated, session, market)).state;
}

// ---- review ----

export async function readReview(session: SessionData, market: Market): Promise<CheckoutReview> {
  return buildReview(await readCheckoutState(session, market), toDateOnly(new Date()));
}

// ---- payment ----

export interface Prepared {
  ct: CtCart;
  state: CheckoutState;
  orderNumber: string;
  patch: Partial<SessionData>;
}

const notFound = (error: unknown): boolean => statusOf(error) === 404;

async function orderByNumber(orderNumber: string): Promise<CtOrder | null> {
  try {
    return (await withTimeout(getApiRoot().orders().withOrderNumber({ orderNumber }).get().execute(), 'checkout.orderByNumber')).body;
  } catch (error) {
    if (notFound(error)) return null;
    throw error;
  }
}

/**
 * Every check before a payment can start, in this order; the first failure answers and nothing is created:
 * cart, body, customer, contact/address/delivery, rules (serviceability, eligibility, device price integrity), recalculated total,
 * financing decision. Returns the order number reserved for this cart (the same one on every retry).
 */
export async function prepareCheckout(session: SessionData, market: Market, expectedTotalCents: unknown): Promise<Prepared> {
  const existing = await getActiveCartForSession(session, market);
  const found = existing ? await withCustomerEmail(existing, session) : null;
  if (!found) {
    if (session.pendingOrderNumber && (await orderByNumber(session.pendingOrderNumber))) {
      throw refuse(409, 'ALREADY_ORDERED', 'This bundle has already been ordered.', { orderNumber: session.pendingOrderNumber });
    }
    throw refuse(400, 'NO_CART', 'There is no bundle to check out.');
  }
  if (found.lineItems.length === 0 && found.customLineItems.length === 0) throw refuse(400, 'EMPTY_CART', 'Your bundle is empty.');
  if (typeof expectedTotalCents !== 'number' || !Number.isSafeInteger(expectedTotalCents)) throw refuse(400, 'INVALID_BODY', 'expectedTotalCents must be a whole number.');

  let { state, ct } = await stateOf(found, session, market);
  // Q-007: guests cannot create recurring orders; checkout needs a customer.
  if (state.needsCustomer && !session.customerId) throw refuse(401, 'SIGN_IN_REQUIRED', 'Sign in to place an order with monthly items.', { reason: 'recurring' }, state);
  const missing = checkReadiness(state);
  if (missing) throw refuse(422, missing, 'Complete the earlier steps first.', undefined, state);

  const { notServiceable, eligibility } = splitIssues(state.cart.issues);
  if (notServiceable.length > 0) throw refuse(422, 'NOT_SERVICEABLE', 'This address cannot be served for every item in your bundle.', { lineIds: notServiceable.flatMap((i) => (i.lineId ? [i.lineId] : [])), postalCode: state.serviceAddress?.postalCode ?? '' }, state);
  if (eligibility.length > 0) {
    throw refuse(422, 'ELIGIBILITY_LOST', 'Something in your bundle is no longer available to you.', { lineIds: eligibility.flatMap((i) => (i.lineId ? [i.lineId] : [])), reasons: eligibility.flatMap((i) => i.reasons.map((r) => r.code)) }, state);
  }
  try {
    await assertDeviceCartIntegrity(ct);
  } catch (error) {
    if (error instanceof Error && (error as { code?: unknown }).code === 'PRICE_NOT_FOR_TERM') throw refuse(422, 'DEVICE_PRICE_INVALID', 'A device price is not valid for its payment term.', undefined, state);
    throw error;
  }

  ct = await updateCart(ct, [{ action: 'recalculate', updateProductData: false }]);
  state = (await stateOf(ct, session, market)).state;
  const same = compareTotal(state.cart, expectedTotalCents);
  if (!same.ok) throw refuse(409, 'TOTAL_CHANGED', 'The total changed.', { total: same.total }, state);

  if (state.cart.lines.some((line) => line.acquisition && line.acquisition.mode !== 'outright')) {
    const decision = await evaluateFinancing(session, market);
    if (decision.outcome === 'declined') throw refuse(422, 'FINANCING_DECLINED', 'Financing was not approved.', { decision }, state);
    if (decision.outcome === 'sign-in-required') throw refuse(401, 'SIGN_IN_REQUIRED', 'Sign in to finance a device.', { reason: 'financing' }, state);
  }

  const reuse = session.pendingCartId === ct.id && session.pendingOrderNumber && isOrderNumber(session.pendingOrderNumber);
  const orderNumber = reuse ? (session.pendingOrderNumber as string) : generateOrderNumber();
  return {
    ct,
    state,
    orderNumber,
    patch: { pendingOrderNumber: orderNumber, pendingCartId: ct.id, pendingTotalCents: String(state.cart.summary.total.centAmount) },
  };
}

/** Starts the payment: the hosted Checkout session, or the demo marker when no Checkout application is configured. */
export async function startPayment(session: SessionData, market: Market, expectedTotalCents: unknown): Promise<WithPatch<CheckoutSessionInfo>> {
  const prepared = await prepareCheckout(session, market, expectedTotalCents);
  if (isDemoPayment()) return { data: { mode: 'demo', orderNumber: prepared.orderNumber }, patch: prepared.patch };
  try {
    const created = await createCheckoutSession(prepared.ct.id, prepared.orderNumber);
    return { data: { mode: 'hosted', orderNumber: prepared.orderNumber, sessionId: created.sessionId, projectKey: created.projectKey, region: created.region, flow: 'payment', ...(created.expiresAt ? { expiresAt: created.expiresAt } : {}) }, patch: prepared.patch };
  } catch (error) {
    if (error instanceof CheckoutSessionError) {
      if (error.code === 'DUPLICATE_ORDER_NUMBER' && (await orderByNumber(prepared.orderNumber))) {
        throw refuse(409, 'ALREADY_ORDERED', 'This bundle has already been ordered.', { orderNumber: prepared.orderNumber });
      }
      console.error('[checkout] session failed', error.code, error.status ?? '');
      throw refuse(502, 'CHECKOUT_UNAVAILABLE', 'Payment is unavailable right now. Try again in a moment.');
    }
    throw error;
  }
}

// ---- finishing an order ----

const fieldsOf = (order: Pick<CtOrder, 'custom'>): Record<string, unknown> | undefined => order.custom?.fields as Record<string, unknown> | undefined;
const hasStamp = (order: Pick<CtOrder, 'custom'>): boolean => typeof fieldsOf(order)?.serviceStartDate === 'string';
const marketOfOrder = (order: Pick<CtOrder, 'totalPrice'>): Market => (order.totalPrice.currencyCode === 'EUR' ? { locale: 'de-DE', currency: 'EUR', country: 'DE' } : { locale: 'en-US', currency: 'USD', country: 'US' });

/**
 * Gives a paid order its schedule, label snapshot and service start (M's `stampOrderPricing`; `setCustomType malva-order` when the cart was
 * not typed) and the Recurring Order expiry of device-only financing. Idempotent and never throws: a failure is logged by code and the
 * confirmation page finalizes lazily on its first view. Returns whether the order is stamped afterwards.
 */
export async function finalizeOrder(order: CtOrder): Promise<boolean> {
  if (hasStamp(order)) return true;
  try {
    const stamp = await stampOrderPricing(order.id, marketOfOrder(order));
    for (const error of stamp.errors) console.error('[checkout] stamp gap', order.orderNumber ?? '', error.code);
    const financed = order.lineItems.some((line) => {
      const mode = (line.custom?.fields as Record<string, unknown> | undefined)?.acquisitionMode;
      return typeof mode === 'string' && mode !== 'outright';
    });
    if (financed) await applyDeviceRecurringExpiry(order.id);
    return true;
  } catch (error) {
    console.error('finalizeOrder failed', error instanceof Error ? error.name : 'unknown');
    return false;
  }
}

function afterOrder(order: CtOrder): Partial<SessionData> {
  return { lastOrderNumber: order.orderNumber ?? order.id, cartId: undefined, pendingOrderNumber: undefined, pendingCartId: undefined, pendingTotalCents: undefined };
}

/**
 * The hosted Checkout created the order: prove it is this session's (`order.cart.id === pendingCartId`), finalize it and clear the cart.
 * Idempotent: a repeated call for the order the session just placed answers without work.
 */
export async function completeCheckout(session: SessionData, orderId: string): Promise<WithPatch<{ orderNumber: string }>> {
  let order: CtOrder;
  try {
    order = (await withTimeout(getApiRoot().orders().withId({ ID: orderId }).get().execute(), 'checkout.order')).body;
  } catch (error) {
    if (notFound(error)) throw refuse(404, 'ORDER_NOT_FOUND', 'Order not found.');
    throw error;
  }
  const number = order.orderNumber ?? order.id;
  if (!session.pendingCartId && session.lastOrderNumber === number) return { data: { orderNumber: number } };
  if (!session.pendingCartId || order.cart?.id !== session.pendingCartId) throw refuse(403, 'FORBIDDEN', 'That order is not yours.');
  await finalizeOrder(order);
  return { data: { orderNumber: number }, patch: afterOrder(order) };
}

/** Demo payment (no hosted Checkout): creates the order from the cart exactly as Checkout would, marked paid, then finalizes it. */
export async function placeDemoOrder(session: SessionData, market: Market, expectedTotalCents: unknown): Promise<WithPatch<{ orderNumber: string }>> {
  if (!isDemoPayment()) throw refuse(404, 'DEMO_PAYMENT_DISABLED', 'Demo payment is not enabled.');
  const prepared = await prepareCheckout(session, market, expectedTotalCents);
  let order: CtOrder;
  try {
    order = (
      await withTimeout(
        getApiRoot().orders().post({ body: { cart: { typeId: 'cart', id: prepared.ct.id }, version: prepared.ct.version, orderNumber: prepared.orderNumber, paymentState: 'Paid' } }).execute(),
        'checkout.demoOrder',
      )
    ).body;
  } catch (error) {
    const body = (error as { body?: { errors?: { code?: unknown }[] } } | null)?.body;
    if (body?.errors?.some((e) => e.code === 'DuplicateField')) throw refuse(409, 'ALREADY_ORDERED', 'This bundle has already been ordered.', { orderNumber: prepared.orderNumber });
    throw error;
  }
  await finalizeOrder(order);
  return { data: { orderNumber: order.orderNumber ?? order.id }, patch: afterOrder(order) };
}

// ---- confirmation ----

/**
 * The order behind a confirmation URL, read from the stored order only (never the cart). Owner or the session that placed it: full view;
 * anyone else with the number: limited view. Unknown number: null. A paid order without its stamp is finalized here (lazy path).
 */
export async function getOrderForConfirmation(session: SessionData, orderNumber: string): Promise<OrderConfirmationView | null> {
  if (!isOrderNumber(orderNumber)) return null;
  let order = await orderByNumber(orderNumber);
  if (!order) return null;
  if (!hasStamp(order) && (await finalizeOrder(order))) order = (await orderByNumber(orderNumber)) ?? order;
  const full = (Boolean(order.customerId) && order.customerId === session.customerId) || session.lastOrderNumber === orderNumber;
  const locale = marketOfOrder(order).locale;
  return {
    order: mapOrder(order, locale),
    full,
    email: full ? (order.customerEmail ?? null) : null,
    isGuest: !order.customerId,
    paymentState: order.paymentState ?? null,
  };
}

/** The order number behind the hosted Checkout's return URL (`?orderNumber=` or `?orderId=`), or null. */
export async function resolveReturnTarget(params: { orderNumber?: string; orderId?: string }): Promise<string | null> {
  if (params.orderNumber && isOrderNumber(params.orderNumber)) return params.orderNumber;
  if (!params.orderId) return null;
  try {
    const { body } = await withTimeout(getApiRoot().orders().withId({ ID: params.orderId }).get().execute(), 'checkout.return');
    return body.orderNumber && isOrderNumber(body.orderNumber) ? body.orderNumber : null;
  } catch (error) {
    if (notFound(error) || statusOf(error) === 400) return null;
    throw error;
  }
}
