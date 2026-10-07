import 'server-only';
import type { Cart as CtCart, CartUpdateAction, LineItem, RecurringOrder } from '@commercetools/platform-sdk';
import { unstable_cache } from 'next/cache';
import { DEVICE_POLICY_KEYS, EXPIRY_POLL_ATTEMPTS, EXPIRY_POLL_INTERVAL_MS, POLICY_CACHE_SECONDS } from '@/lib/config/devices';
import { computeEndDate, computeRecurringExpiry, modeOfPolicyKey, readAcquisition } from '@/lib/devices/acquisition';
import { assertDeviceCartIntegrity as assertDeviceLines } from '@/lib/devices/cart-actions';
import { getFinancingProvider } from '@/lib/devices/financing';
import { mapDeviceOffer } from '@/lib/mappers/device';
import type { SessionData } from '@/lib/session-types';
import type { CreditFlag, DeviceOffer, FinancingDecision, FinancingLine, Market, Offer } from '@/lib/types';
import { getActiveCartForSession, updateCart, withCartRetry } from './cart';
import { getAllOffers } from './catalog';
import { getApiRoot } from './client';
import { getCustomerById } from './customer';
import { withTimeout } from './timeout';

// Server side of the device acquisition modes (workstream Q): recurrence policy lookup, device offers, the stub credit flag and the
// Recurring Order expiry of financed lines.

/** Recurrence policy id to key for the four device policies (cached; the ids never change once created). */
export async function getDevicePolicyMap(): Promise<Record<string, string>> {
  const read = unstable_cache(
    async (): Promise<Record<string, string>> => {
      const where = `key in (${DEVICE_POLICY_KEYS.map((key) => `"${key}"`).join(',')})`;
      const { body } = await withTimeout(getApiRoot().recurrencePolicies().get({ queryArgs: { where, limit: 20 } }).execute(), 'devices.policies');
      const map: Record<string, string> = {};
      for (const policy of body.results) if (policy.key) map[policy.id] = policy.key;
      return map;
    },
    ['device-policy-map'],
    { revalidate: POLICY_CACHE_SECONDS },
  );
  return read();
}

/** The id of a device policy key, or undefined when the policy does not exist in the project. */
export async function getDevicePolicyId(key: string): Promise<string | undefined> {
  const map = await getDevicePolicyMap();
  return Object.entries(map).find(([, value]) => value === key)?.[0];
}

/** The device offers among `offers` (already visible to the buyer), as DeviceOffers. */
export async function toDeviceOffers(offers: readonly Offer[]): Promise<DeviceOffer[]> {
  const devices = offers.filter((offer) => offer.kind === 'device');
  if (devices.length === 0) return [];
  const policyKeyById = await getDevicePolicyMap();
  return devices.flatMap((offer) => {
    const mapped = mapDeviceOffer(offer, policyKeyById);
    return mapped ? [mapped] : [];
  });
}

/** Every device offer of the market, in catalog order. Eligibility and release windows are applied by `getAllOffers`. */
export async function getDeviceOffers(market: Market): Promise<DeviceOffer[]> {
  return toDeviceOffers(await getAllOffers(market));
}

/**
 * The stub credit flag of a customer (D-015): `creditApproved = false` declines, true or absent approves. Always a fresh read.
 * An unknown customer reads as `approve` (the financing stub refuses an anonymous request on its own).
 */
export async function getCreditFlag(customerId: string): Promise<CreditFlag> {
  const customer = await getCustomerById(customerId);
  const approved = (customer?.custom?.fields as Record<string, unknown> | undefined)?.creditApproved;
  return approved === false ? 'decline' : 'approve';
}

export interface ExpiryResult {
  /** Recurring order ids that now have an expiry. */
  applied: string[];
  /** Recurring orders left alone, with the reason. */
  skipped: { id: string; reason: 'already-set' | 'not-only-devices' | 'mixed-terms' | 'not-active' }[];
  /** Number of reads until the recurring orders appeared (0 = none appeared). */
  polls: number;
}

export interface ExpiryDeps {
  sleep?: (ms: number) => Promise<void>;
}

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** The term of every line of the recurring order when ALL its lines are device lines of one term; otherwise why not. */
function deviceTermOf(order: RecurringOrder, policyKeyById: Record<string, string>): { term: number } | { reason: 'not-only-devices' | 'mixed-terms' } {
  const lines = order.cart.obj?.lineItems ?? [];
  const terms = new Set<number>();
  for (const line of lines) {
    const key = policyKeyById[line.recurrenceInfo?.recurrencePolicy.id ?? ''];
    const parsed = key ? modeOfPolicyKey(key) : null;
    if (!parsed) return { reason: 'not-only-devices' };
    terms.add(parsed.termMonths);
  }
  if (terms.size === 0) return { reason: 'not-only-devices' };
  const [first] = [...terms];
  return terms.size === 1 && first !== undefined ? { term: first } : { reason: 'mixed-terms' };
}

/**
 * Gives the Recurring Order of financed device lines its end date (the policy has none; the end lives on the Recurring Order).
 * The platform creates Recurring Orders in the background after the Order, so this polls up to EXPIRY_POLL_ATTEMPTS times,
 * EXPIRY_POLL_INTERVAL_MS apart, and gives up quietly. Live finding (Q-03): Recurring Orders are grouped by schedule, not by policy, so a
 * plan (`malva-monthly`) and a device share ONE Recurring Order and two terms (12 and 24) share another. An expiry would end the plan
 * too; therefore it is set ONLY on a Recurring Order whose lines are all device lines of one term. Idempotent: never overwrites an
 * existing `expiresAt`. Never throws: a failure is logged and the order stays valid (the end of the payments is also stored on the line).
 */
export async function applyDeviceRecurringExpiry(orderId: string, deps: ExpiryDeps = {}): Promise<ExpiryResult> {
  const sleep = deps.sleep ?? wait;
  const result: ExpiryResult = { applied: [], skipped: [], polls: 0 };
  try {
    const policyKeyById = await getDevicePolicyMap();
    let orders: RecurringOrder[] = [];
    for (let attempt = 1; attempt <= EXPIRY_POLL_ATTEMPTS; attempt += 1) {
      const { body } = await withTimeout(
        getApiRoot()
          .recurringOrders()
          .get({ queryArgs: { where: `originOrder(id="${orderId.replace(/"/g, '')}")`, expand: ['cart'], limit: 20 } })
          .execute(),
        'devices.recurringOrders',
      );
      orders = body.results;
      result.polls = attempt;
      if (orders.length > 0) break;
      if (attempt < EXPIRY_POLL_ATTEMPTS) await sleep(EXPIRY_POLL_INTERVAL_MS);
    }
    if (orders.length === 0) result.polls = 0;
    for (const order of orders) {
      if (order.expiresAt) {
        result.skipped.push({ id: order.id, reason: 'already-set' });
        continue;
      }
      if (order.recurringOrderState !== 'Active') {
        result.skipped.push({ id: order.id, reason: 'not-active' });
        continue;
      }
      const found = deviceTermOf(order, policyKeyById);
      if ('reason' in found) {
        result.skipped.push({ id: order.id, reason: found.reason });
        continue;
      }
      const expiresAt = computeRecurringExpiry(new Date(order.startsAt), found.term).toISOString();
      await withTimeout(
        getApiRoot().recurringOrders().withId({ ID: order.id }).post({ body: { version: order.version, actions: [{ action: 'setExpiresAt', expiresAt }] } }).execute(),
        'devices.setExpiresAt',
      );
      result.applied.push(order.id);
    }
  } catch (error) {
    console.error('[devices] recurring expiry failed', orderId, error instanceof Error ? error.message : 'unknown error');
  }
  return result;
}

// ---- financing decision ----

const fieldsOf = (line: LineItem): Record<string, unknown> | undefined => line.custom?.fields as Record<string, unknown> | undefined;

/** The financed device lines of a cart (installments and lease), with the unit amount each pays every month. */
export function financedLinesOf(cart: Pick<CtCart, 'lineItems'>): FinancingLine[] {
  return cart.lineItems.flatMap((line): FinancingLine[] => {
    const acquisition = readAcquisition(fieldsOf(line));
    if (!acquisition || acquisition.mode === 'outright') return [];
    return [{ lineId: line.id, mode: acquisition.mode, termMonths: acquisition.termMonths, quantity: line.quantity, monthly: { centAmount: line.price.value.centAmount, currencyCode: line.price.value.currencyCode } }];
  });
}

/**
 * After an approved decision, writes `financingDecisionId` and `acquisitionEndDate` onto every financed line so the order carries
 * them (billing and returns read the line, not a document). The end date is fixed from the day of the decision. Anything but an
 * approval writes nothing. Returns the cart as it is afterwards.
 */
export async function recordFinancingDecision(cartId: string, decision: FinancingDecision): Promise<CtCart> {
  return withCartRetry(cartId, async (fresh) => {
    if (decision.outcome !== 'approved') return fresh;
    const decidedOn = new Date(decision.decidedAt);
    const actions: CartUpdateAction[] = [];
    for (const line of fresh.lineItems) {
      const acquisition = readAcquisition(fieldsOf(line));
      if (!acquisition || acquisition.mode === 'outright') continue;
      const endDate = computeEndDate(acquisition.mode, acquisition.termMonths, decidedOn);
      if (acquisition.financingDecisionId !== decision.decisionId) actions.push({ action: 'setLineItemCustomField', lineItemId: line.id, name: 'financingDecisionId', value: decision.decisionId });
      if (endDate && acquisition.endDate !== endDate) actions.push({ action: 'setLineItemCustomField', lineItemId: line.id, name: 'acquisitionEndDate', value: endDate });
    }
    return actions.length === 0 ? fresh : updateCart(fresh, actions);
  });
}

/**
 * The financing decision for the session's bundle, evaluated server-side every time (the client's picture is never trusted) and
 * recorded on the lines when approved. U calls it directly at "Continue to payment" and again inside the checkout session route.
 * An anonymous visitor with a financed line gets `sign-in-required`; a visitor with no cart gets an approval with no financed lines.
 */
export async function evaluateFinancing(session: SessionData, market: Market): Promise<FinancingDecision> {
  const cart = await getActiveCartForSession(session, market);
  const customerId = session.customerId ?? null;
  const decision = await getFinancingProvider().decide({
    customerId,
    creditFlag: customerId ? await getCreditFlag(customerId) : null,
    currency: market.currency,
    lines: cart ? financedLinesOf(cart) : [],
  });
  if (cart && decision.outcome === 'approved' && decision.reason === 'ok') await recordFinancingDecision(cart.id, decision);
  return decision;
}

/**
 * Every device line of the cart must still price from the policy of its recorded mode and term, or this throws `PriceNotForTermError`
 * (code PRICE_NOT_FOR_TERM). U calls it before it creates a checkout session, so a price that fell back to the outright price can never
 * be charged as if it were a monthly amount.
 */
export async function assertDeviceCartIntegrity(cart: Pick<CtCart, 'lineItems'>): Promise<void> {
  const policyKeyById = await getDevicePolicyMap();
  assertDeviceLines(cart.lineItems, Object.fromEntries(Object.entries(policyKeyById).map(([id, key]) => [key, id])));
}
