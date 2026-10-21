import 'server-only';
import type { Cart as CtCart, CartDraft, CartUpdateAction, LineItem } from '@commercetools/platform-sdk';
import { COLLECT_METHOD_KEY, SHIP_METHOD_KEY } from '@/lib/cart/plan';
import { buildSingleGroupActions, collectAddress, planGroups, splitPlan, type FulfilmentGroup } from '@/lib/checkout/fulfilment-plan';
import { checkoutBlockers, type CheckoutBlocker } from '@/lib/checkout/guards';
import { MIXED_STRATEGY } from '@/lib/checkout/strategy';
import type { MixedStrategy } from '@/lib/types';
import { apiRoot } from '@/lib/ct/client';
import { buildAddLineAction, getCartView, getOwnedCartForRebuild, ownsCart, rebuildCart, type AddLineInput, type CartMarket } from '@/lib/ct/cart';
import { getStoresForCountry } from '@/lib/ct/channels';
import { cachedPublic } from '@/lib/ct/public-cache';
import { updateWithRetry } from '@/lib/ct/retry';
import { AppError } from '@/lib/errors';
import { fulfilmentOf } from '@/lib/mappers/cart';
import { mapCheckoutState } from '@/lib/mappers/checkout';
import type { Session } from '@/lib/session';
import type { Cart, CheckoutPayment, CheckoutState, Store } from '@/lib/types';
import { getLocalizedString } from '@/lib/utils';

/**
 * Cart preparation for checkout (workstream K, 3.5). Server only. The hosted Checkout writes the address, delivery method and
 * payment to the cart it is given, so every read here is fresh and no copy is kept. The bag itself is never changed by the
 * Review stage under `complete-per-group`: payment carts are clones (they expire after a day), so going back to review
 * leaves the bag as it was.
 */

/** Delivery-time text of the standard method (`localizedDescription`, Q-K-11), or null. Public data, cached. */
const fetchDeliveryDays = async (locale: string): Promise<string | null> => {
  try {
    const { body } = await apiRoot.shippingMethods().withKey({ key: SHIP_METHOD_KEY }).get().execute();
    const text = body.localizedDescription ? getLocalizedString(body.localizedDescription, locale) : '';
    return text || null;
  } catch {
    return null;
  }
};
const getDeliveryDays: (locale: string) => Promise<string | null> = cachedPublic('shippingMethods', ['delivery-days'], fetchDeliveryDays);

export interface CheckoutRead {
  state: CheckoutState | null;
  /** The session to persist (the cart may have been rebuilt or dropped). */
  session: Session;
}

/** The Review stage data: the cart view plus pickup, delivery note, codes and issues. `null` state: no bag. */
export async function getCheckoutState(session: Session, market: CartMarket, now: Date = new Date()): Promise<CheckoutRead> {
  const { cart, session: next } = await getCartView(session, market);
  if (!cart) return { state: null, session: next };
  const [raw, stores, deliveryDays] = await Promise.all([
    getOwnedCartForRebuild(next),
    getStoresForCountry(cart.country, market.locale).catch((): Store[] => []),
    getDeliveryDays(market.locale),
  ]);
  const state = mapCheckoutState({
    cart, savings: (raw ?? { lineItems: [] }) as unknown as Parameters<typeof mapCheckoutState>[0]['savings'], stores, now,
    locale: market.locale, strategy: MIXED_STRATEGY, deliveryDays,
  });
  return { state, session: next };
}

/** What is missing before a session can be created: `pickup` (name for a collect group) and `lines`. */
export function missingForPayment(cart: Cart, pickupName: string | null): ('pickup' | 'lines')[] {
  const missing: ('pickup' | 'lines')[] = [];
  const groups = planGroups(cart);
  if (groups.length === 0) missing.push('lines');
  if (groups.some((g) => g.kind === 'collect') && !pickupName?.trim()) missing.push('pickup');
  return missing;
}

export function firstBlocker(cart: Cart, session: Session): CheckoutBlocker | null {
  return checkoutBlockers(cart, session)[0] ?? null;
}

// ---------------------------------------------------------------- payment carts

async function postUpdate(cart: Pick<CtCart, 'id' | 'version'>, actions: CartUpdateAction[]): Promise<CtCart> {
  const { body } = await apiRoot.carts().withId({ ID: cart.id }).post({ body: { version: cart.version, actions } }).execute();
  return body;
}

/** The grand total of a raw cart: the taxed gross (shipping included) or goods plus the shipping price. */
export function totalCentsOf(c: Pick<CtCart, 'taxedPrice' | 'totalPrice' | 'shippingInfo' | 'shipping'>): number {
  if (c.taxedPrice) return c.taxedPrice.totalGross.centAmount;
  const shipping = c.shippingInfo ? c.shippingInfo.price.centAmount : (c.shipping ?? []).reduce((n, s) => n + s.shippingInfo.price.centAmount, 0);
  return c.totalPrice.centAmount + shipping;
}

/** The line as a draft for a new cart: the same `addLineItem` shape the cart core builds, without the action name. */
function lineDraft(l: LineItem) {
  const fulfilment = fulfilmentOf(l);
  const sku = l.variant?.sku ?? '';
  const input: AddLineInput =
    fulfilment === 'collect'
      ? { sku, quantity: l.quantity, fulfilment, storeKey: '' }
      : fulfilment === 'subscribe'
        ? { sku, quantity: l.quantity, fulfilment, recurrencePolicyKey: '' }
        : { sku, quantity: l.quantity, fulfilment };
  const { action: _action, ...draft } = buildAddLineAction(input, {
    ...(l.supplyChannel ? { channelId: l.supplyChannel.id } : {}),
    ...(l.recurrenceInfo ? { policyId: l.recurrenceInfo.recurrencePolicy.id } : {}),
  });
  void _action;
  return draft;
}

/** Same sku, fulfilment, store and policy: how a clone line finds its bag line. */
function sameLine(a: LineItem, b: LineItem): boolean {
  return (
    a.variant?.sku === b.variant?.sku &&
    fulfilmentOf(a) === fulfilmentOf(b) &&
    (a.supplyChannel?.id ?? null) === (b.supplyChannel?.id ?? null) &&
    (a.recurrenceInfo?.recurrencePolicy.id ?? null) === (b.recurrenceInfo?.recurrencePolicy.id ?? null)
  );
}

interface PartContext { raw: CtCart; group: FulfilmentGroup; applyCodes: boolean; address: ReturnType<typeof collectAddress> | null }

async function createPartCart(c: PartContext): Promise<CtCart> {
  const { raw } = c;
  const codes = c.applyCodes ? (raw.discountCodes ?? []).flatMap((d) => (d.discountCode.obj?.code ? [d.discountCode.obj.code] : [])) : [];
  const body: CartDraft = {
    currency: raw.totalPrice.currencyCode,
    ...(raw.country ? { country: raw.country } : {}),
    ...(raw.locale ? { locale: raw.locale } : {}),
    shippingMode: 'Single',
    taxMode: 'Platform',
    deleteDaysAfterLastModification: 1,
    ...(raw.customerId ? { customerId: raw.customerId } : { anonymousId: raw.anonymousId }),
    ...(raw.customerEmail ? { customerEmail: raw.customerEmail } : {}),
    lineItems: raw.lineItems.filter((l) => c.group.lineIds.includes(l.id)).map(lineDraft),
    ...(codes.length ? { discountCodes: codes } : {}),
    shippingAddress: c.address ?? { country: raw.country ?? '' },
    ...(c.group.kind === 'collect' ? { shippingMethod: { typeId: 'shipping-method' as const, key: COLLECT_METHOD_KEY } } : {}),
  };
  const { body: created } = await apiRoot.carts().post({ body }).execute();
  return created;
}

export interface PreparedPayments {
  payments: CheckoutPayment[];
  /** Ids of the clone carts in payment order; empty when the bag itself is paid (one group). */
  payCartIds: string[];
}

/**
 * Prepares the cart(s) for the hosted flow. One group: the bag is paid as it is (a collect-only bag gets the store as its
 * shipping address with the pickup name, and `mcf-collect`; a delivery bag is left to the hosted flow). Several groups under
 * `complete-per-group`: one Single clone per group (collect stores first, codes on the first only, Q-K-02c).
 */
export async function preparePayments(
  session: Session,
  market: CartMarket,
  input: { pickupName: string | null; email?: string },
): Promise<PreparedPayments> {
  const { cart: view } = await getCartView(session, market);
  if (!view) throw new AppError('not_found', 404);
  const missing = missingForPayment(view, input.pickupName);
  if (missing.length) throw new CheckoutNotReady(missing);
  const groups = planGroups(view);
  const stores = groups.some((g) => g.kind === 'collect') ? await getStoresForCountry(view.country, market.locale) : [];
  const addressOf = (g: FulfilmentGroup) => {
    const store = stores.find((s) => s.key === g.storeKey);
    return g.kind === 'collect' && store && input.pickupName ? collectAddress(store, input.pickupName, input.email) : null;
  };
  const label = (g: FulfilmentGroup) => (g.kind === 'collect' ? (view.groups.find((x) => x.key === g.key)?.store?.name ?? null) : null);

  if (groups.length === 1) {
    const group = groups[0] as FulfilmentGroup;
    const actions = buildSingleGroupActions(group, addressOf(group));
    let total = view.total.centAmount;
    if (actions.length > 0) {
      const updated = await updateWithRetry(
        async () => {
          const raw = await getOwnedCartForRebuild(session);
          if (!raw) throw new AppError('not_found', 404);
          return raw;
        },
        (current) => postUpdate(current, actions as unknown as CartUpdateAction[]),
      );
      total = totalCentsOf(updated);
    } else {
      const raw = await getOwnedCartForRebuild(session);
      if (raw) total = totalCentsOf(raw);
    }
    return { payments: [{ part: 0, clusterKey: group.key, label: label(group), totalCents: total }], payCartIds: [] };
  }

  const raw = await getOwnedCartForRebuild(session);
  if (!raw) throw new AppError('not_found', 404);
  const payments: CheckoutPayment[] = [];
  const payCartIds: string[] = [];
  for (const part of splitPlan(groups)) {
    const created = await createPartCart({ raw, group: part.group, applyCodes: part.applyCodes, address: addressOf(part.group) });
    payCartIds.push(created.id);
    payments.push({ part: part.part, clusterKey: part.group.key, label: label(part.group), totalCents: totalCentsOf(created) });
  }
  return { payments, payCartIds };
}

export class CheckoutNotReady extends Error {
  constructor(readonly missing: ('pickup' | 'lines')[]) {
    super('checkout_not_ready');
    this.name = 'CheckoutNotReady';
  }
}

/** The raw cart to pay for `part`: the bag (no clones) or the clone; always owned by the session and Active. */
export async function getPaymentCart(session: Session, payCartIds: readonly string[], part: number): Promise<CtCart | null> {
  if (payCartIds.length === 0) return part === 0 ? getOwnedCartForRebuild(session) : null;
  const id = payCartIds[part];
  if (!id) return null;
  try {
    const { body } = await apiRoot.carts().withId({ ID: id }).get().execute();
    return body.cartState === 'Active' && ownsCart(body, session) ? body : null;
  } catch (e) {
    if ((e as { statusCode?: number })?.statusCode === 404) return null;
    throw e;
  }
}

/** After a part is paid: its lines leave the bag, so the bag holds only what still needs payment (4.1). Best effort. */
export async function removePaidLines(session: Session, paidCartId: string): Promise<void> {
  const paid = await apiRoot.carts().withId({ ID: paidCartId }).get().execute().then((r) => r.body);
  if (!ownsCart(paid, session)) return;
  await updateWithRetry(
    async () => {
      const bag = await getOwnedCartForRebuild(session);
      if (!bag) throw new AppError('not_found', 404);
      return bag;
    },
    async (bag) => {
      const actions: CartUpdateAction[] = bag.lineItems
        .filter((l) => paid.lineItems.some((p) => sameLine(p, l)))
        .map((l) => ({ action: 'removeLineItem' as const, lineItemId: l.id }));
      return actions.length ? postUpdate(bag, actions) : bag;
    },
  );
}

/**
 * `complete-multiple` and `payment-only-for-collect` need a `Multiple` cart when the bag has more than one group, and the
 * shipping mode is immutable: the bag is rebuilt into a new `Multiple` cart (lines and codes carried, the old cart expires)
 * and the new `cartId` goes into the returned session. `complete-per-group` never changes the bag. NOTE: `getCartView` migrates a
 * cart whose mode differs from `CART_SHIPPING_MODE` (Q-I-21), so these strategies also need that constant set deliberately.
 */
export async function ensureCheckoutCart(session: Session, market: CartMarket, strategy: MixedStrategy = MIXED_STRATEGY): Promise<Session> {
  if (strategy === 'complete-per-group') return session;
  const raw = await getOwnedCartForRebuild(session);
  if (!raw || raw.shippingMode === 'Multiple') return session;
  const view = await getCartView(session, market);
  if (!view.cart || planGroups(view.cart).length < 2) return session;
  const rebuilt = await rebuildCart(session, raw, {
    country: raw.country ?? market.country, currency: raw.totalPrice.currencyCode, locale: market.locale, shippingMode: 'Multiple',
  });
  return rebuilt.session;
}
