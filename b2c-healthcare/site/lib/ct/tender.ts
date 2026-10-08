import 'server-only';
import type { Cart as CtCart, CartUpdateAction, Order, OrderUpdateAction, Payment } from '@commercetools/platform-sdk';
import { withCartRetry } from '@/lib/api-retry';
import { drawdown, getAllowanceView } from '@/lib/ct/allowance';
import { apiRoot } from '@/lib/ct/client';
import { loadFundingFixtures } from '@/lib/ct/fixtures';
import { allocateTender, buildTenderView, METHOD_ALLOWANCE, METHOD_RESTRICTED, planTender, type TenderPlan } from '@/lib/funding/tender';
import type { BasketLine } from '@/lib/funding/eligibility';
import { splitBasket } from '@/lib/funding/eligibility';
import { eligibleOf } from '@/lib/mappers/cart';
import { mapMoney } from '@/lib/mappers';
import { log } from '@/lib/log';
import type { TenderView } from '@/lib/types';

/**
 * Tenders as commercetools Payments (workstream U). One order, up to three instruments in this order: the
 * allowance and the restricted instrument as their own Payments (`paymentMethodInfo.method` = `allowance` and
 * `restricted-health-account`, each with its own `amountPlanned`), and the remainder on the card Payment that
 * Checkout creates. The amounts are computed here and asserted before the Payments are set: the platform neither
 * caps the restricted instrument at the eligible subtotal nor knows the allowance balance.
 *
 *  - `tenderViewFor` / `planFor`: the split for a cart now (allowance balance read from the cycle object);
 *  - `ensureTenderPayments`: makes the cart's tender Payments match a plan (creates, re-amounts or detaches);
 *  - `settleTender`: after the order exists, draws the allowance (idempotent on the order id), records the Charge
 *    transactions, the order meta and which instrument settled each line.
 * The restricted instrument is chosen by the patient: "chosen" means a restricted Payment is on the cart.
 */

export const TENDER_METHODS: readonly string[] = [METHOD_ALLOWANCE, METHOD_RESTRICTED];
const PAYMENT_INTERFACE = 'malva-demo';
const METHOD_NAME: Record<string, string> = { [METHOD_ALLOWANCE]: 'Benefit allowance', [METHOD_RESTRICTED]: 'Health account card (demo)' };

const isTender = (p: Payment): boolean => TENDER_METHODS.includes(p.paymentMethodInfo?.method ?? '');

/** The payable total of a cart or order, in cents: gross when the platform has taxed it, else the total price. */
export const payableOf = (cart: Pick<CtCart, 'taxedPrice' | 'totalPrice'>): number => (cart.taxedPrice?.totalGross ?? cart.totalPrice).centAmount;

export function basketLinesOf(cart: Pick<CtCart, 'lineItems'>): BasketLine[] {
  return cart.lineItems.map((item) => ({ id: item.id, eligible: eligibleOf(item), amount: (item.taxedPrice?.totalGross ?? item.totalPrice).centAmount }));
}

async function paymentsByIds(ids: string[]): Promise<Payment[]> {
  if (ids.length === 0) return [];
  const { body } = await apiRoot.payments().get({ queryArgs: { where: `id in (${ids.map((id) => `"${id}"`).join(', ')})`, limit: 20 } }).execute();
  return body.results;
}

/** The tender Payments (allowance, restricted instrument) referenced by the cart or order. */
export async function readTenderPayments(resource: Pick<CtCart, 'paymentInfo'> | Pick<Order, 'paymentInfo'>): Promise<Payment[]> {
  const ids = (resource.paymentInfo?.payments ?? []).map((ref) => ref.id);
  return (await paymentsByIds(ids)).filter(isTender);
}

interface TenderContext {
  patientRef: string;
  now: Date;
}

/** The split for the cart now. `restrictedChosen` is whether a restricted Payment is on the cart. */
export async function planFor(cart: CtCart, ctx: TenderContext): Promise<{ plan: TenderPlan; view: TenderView; restrictedChosen: boolean }> {
  const fixtures = await loadFundingFixtures();
  const chosen = fixtures ? fixtures.fixtureRestrictedChoice(cart.customerId ?? '') : (await readTenderPayments(cart)).some((p) => p.paymentMethodInfo?.method === METHOD_RESTRICTED);
  const allowance = await getAllowanceView(ctx.patientRef, ctx.now);
  const total = payableOf(cart);
  const lines = basketLinesOf(cart);
  const eligibleSubtotal = splitBasket(lines).eligibleSubtotal;
  const plan = planTender({ total, allowanceBalance: allowance?.balance ?? 0, eligibleSubtotal, restrictedChosen: chosen && eligibleSubtotal > 0 });
  const money = mapMoney(cart.totalPrice);
  const view = buildTenderView({ currencyCode: money.currencyCode, fractionDigits: money.fractionDigits, total, allowance, lines, restrictedChosen: chosen });
  return { plan, view, restrictedChosen: chosen };
}

/**
 * The tender view for a page read. A failure to read the allowance or the Payments must not take the cart page down: the
 * view is left out (the page shows the plain total) and `placeOrder` still computes the real plan itself.
 */
export async function tenderViewOf(cart: CtCart, ctx: TenderContext): Promise<TenderView | undefined> {
  if (cart.lineItems.length === 0) return undefined;
  try {
    return (await planFor(cart, ctx)).view;
  } catch (error) {
    log.error('funding', 'could not read the tender split', error instanceof Error ? error : { name: typeof error });
    return undefined;
  }
}

function paymentDraft(method: string, amount: number, cart: CtCart) {
  return {
    amountPlanned: { currencyCode: cart.totalPrice.currencyCode, centAmount: amount },
    paymentMethodInfo: { paymentInterface: PAYMENT_INTERFACE, method, name: { 'en-US': METHOD_NAME[method] ?? method } },
    ...(cart.customerId ? { customer: { typeId: 'customer' as const, id: cart.customerId } } : {}),
  };
}

/**
 * Makes the cart's tender Payments match the plan: a Payment per instrument with an amount above zero (created, or its
 * `amountPlanned` changed), none for an instrument whose amount is zero (detached from the cart). Idempotent: calling it
 * again with the same plan changes nothing. The cart is re-read for the version.
 */
export async function ensureTenderPayments(cartId: string, plan: TenderPlan): Promise<void> {
  const fixtures = await loadFundingFixtures();
  if (fixtures) return;
  const { body: cart } = await apiRoot.carts().withId({ ID: cartId }).get().execute();
  const existing = await readTenderPayments(cart);
  const cartActions: CartUpdateAction[] = [];
  for (const [method, wanted] of [[METHOD_ALLOWANCE, plan.allowance], [METHOD_RESTRICTED, plan.restricted]] as const) {
    const found = existing.find((p) => p.paymentMethodInfo?.method === method);
    if (wanted === 0) {
      if (found) cartActions.push({ action: 'removePayment', payment: { typeId: 'payment', id: found.id } });
    } else if (!found) {
      const { body } = await apiRoot.payments().post({ body: paymentDraft(method, wanted, cart) }).execute();
      cartActions.push({ action: 'addPayment', payment: { typeId: 'payment', id: body.id } });
    } else if (found.amountPlanned.centAmount !== wanted) {
      await apiRoot.payments().withId({ ID: found.id }).post({ body: { version: found.version, actions: [{ action: 'changeAmountPlanned', amount: { currencyCode: found.amountPlanned.currencyCode, centAmount: wanted } }] } }).execute();
    }
  }
  if (cartActions.length === 0) return;
  await withCartRetry(async () => {
    const { body: current } = await apiRoot.carts().withId({ ID: cartId }).get().execute();
    await apiRoot.carts().withId({ ID: cartId }).post({ body: { version: current.version, actions: cartActions } }).execute();
  });
}

export type RestrictedChoice = { ok: true; view: TenderView } | { ok: false; reason: 'none-eligible' };

/** The patient chooses (or drops) the restricted instrument for this cart: refused when nothing in the basket qualifies. */
export async function setRestrictedChoice(cart: CtCart, on: boolean, ctx: TenderContext): Promise<RestrictedChoice> {
  const eligible = splitBasket(basketLinesOf(cart)).eligibleSubtotal;
  const fixtures = await loadFundingFixtures();
  if (on && eligible === 0) return { ok: false, reason: 'none-eligible' };
  if (fixtures) {
    fixtures.setFixtureRestrictedChoice(cart.customerId ?? '', on);
    return { ok: true, view: (await planFor(cart, ctx)).view };
  }
  const allowance = await getAllowanceView(ctx.patientRef, ctx.now);
  const plan = planTender({ total: payableOf(cart), allowanceBalance: allowance?.balance ?? 0, eligibleSubtotal: eligible, restrictedChosen: on });
  await ensureTenderPayments(cart.id, plan);
  const { body: fresh } = await apiRoot.carts().withId({ ID: cart.id }).get().execute();
  return { ok: true, view: (await planFor(fresh, ctx)).view };
}

/** The plan an existing order was placed with, read back from its Payments (a resumed placement). */
export async function planFromOrder(order: Order): Promise<TenderPlan> {
  const payments = await readTenderPayments(order);
  const amount = (method: string) => payments.find((p) => p.paymentMethodInfo?.method === method)?.amountPlanned.centAmount ?? 0;
  const total = payableOf(order);
  const allowance = amount(METHOD_ALLOWANCE);
  const restricted = amount(METHOD_RESTRICTED);
  return { total, allowance, restricted, card: total - allowance - restricted };
}

export type SettleOutcome = { ok: true; allowanceApplied: number } | { ok: false; reason: 'ALLOWANCE_SHORT'; applied: number };

const hasCharge = (p: Payment) => p.transactions.some((t) => t.type === 'Charge');

/**
 * After the order exists: draws the allowance for the order id (a part-payment is never silent: a draw that comes
 * back smaller than planned is reported so the caller can cancel), records a `Charge` transaction on each tender
 * Payment, the order meta (`allowanceApplied`, `restrictedApplied`) and, per line, which instrument settled it.
 * Idempotent: a resumed placement repeats it without drawing or recording twice.
 */
export async function settleTender(order: Order, plan: TenderPlan, ctx: TenderContext): Promise<SettleOutcome> {
  if (plan.allowance === 0 && plan.restricted === 0) return { ok: true, allowanceApplied: 0 };
  let applied = 0;
  if (plan.allowance > 0) {
    const draw = await drawdown(ctx.patientRef, order.id, plan.allowance, ctx.now);
    applied = draw.applied;
    if (applied < plan.allowance) return { ok: false, reason: 'ALLOWANCE_SHORT', applied };
  }
  const payments = await readTenderPayments(order);
  for (const payment of payments) {
    if (hasCharge(payment)) continue;
    const method = payment.paymentMethodInfo?.method;
    const amount = method === METHOD_ALLOWANCE ? applied : method === METHOD_RESTRICTED ? plan.restricted : 0;
    if (amount === 0) continue;
    await withCartRetry(async () => {
      const { body } = await apiRoot.payments().withId({ ID: payment.id }).get().execute();
      if (hasCharge(body)) return;
      await apiRoot
        .payments()
        .withId({ ID: payment.id })
        .post({ body: { version: body.version, actions: [{ action: 'addTransaction', transaction: { type: 'Charge', amount: { currencyCode: body.amountPlanned.currencyCode, centAmount: amount }, state: 'Success', timestamp: ctx.now.toISOString() } }] } })
        .execute();
    });
  }
  await withCartRetry(async () => {
    const { body: current } = await apiRoot.orders().withId({ ID: order.id }).get().execute();
    const currency = current.totalPrice.currencyCode;
    const settlements = allocateTender(basketLinesOf(current), { ...plan, allowance: applied });
    const actions: OrderUpdateAction[] = [
      { action: 'setCustomType', type: { typeId: 'type', key: 'mlv-order-meta' }, fields: { allowanceApplied: { currencyCode: currency, centAmount: applied }, restrictedApplied: { currencyCode: currency, centAmount: plan.restricted } } },
      ...current.lineItems.map((item, i): OrderUpdateAction => ({ action: 'setLineItemCustomField', lineItemId: item.id, name: 'settlement', value: JSON.stringify({ allowance: settlements[i]!.allowance, [METHOD_RESTRICTED]: settlements[i]!.restricted, card: settlements[i]!.card }) })),
    ];
    await apiRoot.orders().withId({ ID: order.id }).post({ body: { version: current.version, actions } }).execute();
  });
  return { ok: true, allowanceApplied: applied };
}
