// Returns of the store (workstream V-11, V-12): the native `Order.returnInfo` plus the seeded custom type `malva-return-item`
// (`returnNumber`, `status`, `reason`, `refundCents`, `rejectReason`, `refundRequestedAt`). Orders are read through the in-store
// endpoint, so an order of another store is "not found". Refunds go through the Checkout Payment Intents API (`checkout-payments.ts`):
// the portal requests the refund, the Refund transaction is added by Checkout and its state comes from the connector; the return
// becomes Refunded only after `reconcileRefund` sees a matching Refund transaction in `Success`. No e-mail is sent (D10).
import 'server-only';
import { randomBytes } from 'node:crypto';
import { CatalogError } from '@/lib/catalog/errors';
import { CheckoutError, refundPayment } from '@/lib/ct/checkout-payments';
import {
  canTransition,
  isReturnReason,
  isReturnStatus,
  nativeStates,
  OPEN_RETURN_STATUSES,
  returnWindowProblem,
  withinReturnWindow,
  type ReturnStatus,
} from '@/lib/contracts/return-item';
import { maskEmail } from '@/lib/customers/mask';
import type { OrderForReturn, RefundState, ReturnDetail, ReturnList, ReturnRow } from '@/lib/v-types';
import { vRoot } from './v-root';
import { retryOnConflict, statusOf } from './versioned';

const RETURN_TYPE = 'malva-return-item';
const CHECKOUT_TYPE = 'malva-checkout';
const REFUND_CLOCK_SKEW_MS = 60_000;
const DAY_MS = 86_400_000;
const ACTIVE_REFUND_STATES = ['Success', 'Pending', 'Initial'];

interface Money {
  centAmount: number;
  currencyCode: string;
}
interface LineLike {
  id: string;
  name: Record<string, string>;
  quantity: number;
  totalPrice: Money;
  taxedPrice?: { totalGross: Money };
  custom?: { fields?: Record<string, unknown> };
}
interface ItemLike {
  id: string;
  quantity: number;
  lineItemId?: string;
  comment?: string;
  shipmentState?: string;
  paymentState?: string;
  createdAt?: string;
  lastModifiedAt?: string;
  custom?: { fields?: Record<string, unknown> };
}
interface InfoLike {
  returnTrackingId?: string;
  returnDate?: string;
  items: ItemLike[];
}
export interface OrderLike {
  id: string;
  version: number;
  orderNumber?: string;
  customerId?: string;
  customerEmail?: string;
  createdAt: string;
  orderState?: string;
  lineItems: LineLike[];
  totalPrice: Money;
  shippingAddress?: { firstName?: string; lastName?: string };
  paymentInfo?: { payments: { id: string }[] };
  returnInfo?: InfoLike[];
  custom?: { type?: { id?: string }; fields?: Record<string, unknown> };
}
interface TransactionLike {
  type: string;
  state: string;
  amount: Money;
  timestamp?: string;
}
interface PaymentLike {
  id: string;
  transactions: TransactionLike[];
}

const text = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v : undefined);
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

const lineName = (line: LineLike, locale: string): string => line.name[locale] ?? Object.values(line.name)[0] ?? '';

function customerName(order: OrderLike): string {
  const a = order.shippingAddress;
  const first = a?.firstName?.trim();
  const last = a?.lastName?.trim();
  if (first || last) return [first, last ? `${last[0].toUpperCase()}.` : undefined].filter(Boolean).join(' ');
  return order.customerEmail ? maskEmail(order.customerEmail) : '-';
}

/** The custom `status`, else the native shipment state (Advised is requested, Returned is received). */
function statusOfItem(item: ItemLike): ReturnStatus | null {
  const custom = item.custom?.fields?.status;
  if (isReturnStatus(custom)) return custom;
  if (item.shipmentState === 'Advised') return 'requested';
  if (item.shipmentState === 'Returned') return 'received';
  return null;
}

interface Group {
  number: string;
  info: InfoLike;
  items: ItemLike[];
}

/** The returns of one order, one group per `returnNumber` (items without a number take `RET-<orderNumber>-<index>`). */
function groupsOf(order: OrderLike): Group[] {
  const out: Group[] = [];
  (order.returnInfo ?? []).forEach((info, index) => {
    for (const item of info.items) {
      const number = text(item.custom?.fields?.returnNumber) ?? `RET-${order.orderNumber ?? order.id}-${index + 1}`;
      const found = out.find((g) => g.number === number);
      if (found) found.items.push(item);
      else out.push({ number, info, items: [item] });
    }
  });
  return out;
}

function rowOf(order: OrderLike, group: Group, locale: string): ReturnRow | null {
  const first = group.items[0];
  const status = statusOfItem(first);
  if (!status) return null;
  const requested = text(first.custom?.fields?.refundRequestedAt);
  return {
    returnNumber: group.number,
    orderNumber: order.orderNumber ?? order.id,
    customer: customerName(order),
    customerId: order.customerId ?? null,
    items: group.items.map((i) => {
      const line = order.lineItems.find((l) => l.id === i.lineItemId);
      return { quantity: i.quantity, name: line ? lineName(line, locale) : '' };
    }),
    tracking: group.info.returnTrackingId ?? '',
    status,
    reason: text(first.custom?.fields?.reason) ?? 'other',
    // Provisional until `reconcileRefund` has read the Payment.
    refundState: status === 'inspected' && requested ? 'pending' : 'none',
    refundCents: num(first.custom?.fields?.refundCents) ?? null,
    rejectReason: text(first.custom?.fields?.rejectReason) ?? null,
    createdAt: group.info.returnDate ?? first.createdAt ?? order.createdAt,
  };
}

/** Pure: every return row of some orders. */
export function returnRows(orders: readonly OrderLike[], locale = 'en-US'): ReturnRow[] {
  return orders.flatMap((order) => groupsOf(order).flatMap((g) => rowOf(order, g, locale) ?? []));
}

// ---------------------------------------------------------------- reads

async function fetchOrders(storeKey: string, where: string | undefined, limit: number, sort = 'lastModifiedAt desc'): Promise<OrderLike[]> {
  const root = await vRoot();
  const { body } = await root
    .inStoreKeyWithStoreKeyValue({ storeKey })
    .orders()
    .get({ queryArgs: { ...(where ? { where } : {}), sort, limit, withTotal: false } })
    .execute();
  return body.results as unknown as OrderLike[];
}

async function orderByNumber(storeKey: string, orderNumber: string): Promise<OrderLike> {
  const root = await vRoot();
  try {
    const { body } = await root.inStoreKeyWithStoreKeyValue({ storeKey }).orders().withOrderNumber({ orderNumber }).get().execute();
    return body as unknown as OrderLike;
  } catch (error) {
    if (statusOf(error) === 404) throw new CatalogError(404, 'ORDER_NOT_FOUND', 'Order not found');
    throw error;
  }
}

async function readPayment(paymentId: string): Promise<PaymentLike | null> {
  const root = await vRoot();
  try {
    const { body } = await root.payments().withId({ ID: paymentId }).get().execute();
    return body as unknown as PaymentLike;
  } catch (error) {
    if (statusOf(error) === 404) return null;
    throw error;
  }
}

const paymentIdOf = (order: OrderLike): string | undefined => order.paymentInfo?.payments[0]?.id;

/** A Payment of a Checkout flow holds a successful Charge (Checkout adds the Charge when the connector captured). */
const captured = (payment: PaymentLike): number => payment.transactions.filter((t) => t.type === 'Charge' && t.state === 'Success').reduce((s, t) => s + t.amount.centAmount, 0);
const hasAuthorization = (payment: PaymentLike): boolean => payment.transactions.some((t) => t.type === 'Authorization' && t.state === 'Success');
const activeRefunds = (payment: PaymentLike): number => payment.transactions.filter((t) => t.type === 'Refund' && ACTIVE_REFUND_STATES.includes(t.state)).reduce((s, t) => s + t.amount.centAmount, 0);

/** Pro rata paid gross of the returned lines (the line's taxed gross when it has one). */
function paidShare(order: OrderLike, items: ItemLike[]): number {
  let total = 0;
  for (const item of items) {
    const line = order.lineItems.find((l) => l.id === item.lineItemId);
    if (!line || line.quantity === 0) continue;
    const gross = line.taxedPrice?.totalGross.centAmount ?? line.totalPrice.centAmount;
    total += Math.round((gross * item.quantity) / line.quantity);
  }
  return total;
}

/** What a Refund transaction of the Payment says about this return's request: `Success` wins, else the latest. */
export function refundStateOf(payment: PaymentLike, requestedAt: string | undefined, refundCents: number | undefined): 'success' | 'failed' | 'pending' {
  const since = requestedAt ? Date.parse(requestedAt) - REFUND_CLOCK_SKEW_MS : 0;
  const mine = payment.transactions.filter((t) => t.type === 'Refund' && (refundCents === undefined || t.amount.centAmount === refundCents) && (!t.timestamp || Date.parse(t.timestamp) >= since));
  if (mine.some((t) => t.state === 'Success')) return 'success';
  const latest = [...mine].sort((a, b) => (a.timestamp ?? '').localeCompare(b.timestamp ?? '')).at(-1);
  return latest?.state === 'Failure' ? 'failed' : 'pending';
}

function itemActions(items: ItemLike[], build: (item: ItemLike) => unknown[]): unknown[] {
  return items.flatMap(build);
}

async function updateOrder(storeKey: string, orderNumber: string, actions: (order: OrderLike) => unknown[]): Promise<OrderLike> {
  const root = await vRoot();
  return retryOnConflict(async () => {
    const order = await orderByNumber(storeKey, orderNumber);
    const list = actions(order);
    if (list.length === 0) return order;
    const { body } = await root
      .inStoreKeyWithStoreKeyValue({ storeKey })
      .orders()
      .withId({ ID: order.id })
      .post({ body: { version: order.version, actions: list as never[] } })
      .execute();
    return body as unknown as OrderLike;
  }, 3);
}

/**
 * Reads the Payment of a return waiting for its refund and, when Checkout recorded a matching Refund transaction in `Success`,
 * moves the return to Refunded (`paymentState` Refunded). `Failure` is reported as `failed`, anything else as `pending`.
 */
export async function reconcileRefund(storeKey: string, order: OrderLike, returnNumber: string): Promise<{ order: OrderLike; refundState: RefundState }> {
  const group = groupsOf(order).find((g) => g.number === returnNumber);
  const first = group?.items[0];
  const requestedAt = text(first?.custom?.fields?.refundRequestedAt);
  if (!group || !first || statusOfItem(first) !== 'inspected' || !requestedAt) return { order, refundState: 'none' };
  const paymentId = paymentIdOf(order);
  const payment = paymentId ? await readPayment(paymentId) : null;
  if (!payment) return { order, refundState: 'pending' };
  const state = refundStateOf(payment, requestedAt, num(first.custom?.fields?.refundCents));
  if (state === 'failed') return { order, refundState: 'failed' };
  if (state === 'pending') return { order, refundState: 'pending' };
  const updated = await updateOrder(storeKey, order.orderNumber ?? order.id, (current) => {
    const g = groupsOf(current).find((x) => x.number === returnNumber);
    if (!g || statusOfItem(g.items[0]) !== 'inspected') return [];
    return itemActions(g.items, (item) => [
      { action: 'setReturnItemCustomField', returnItemId: item.id, name: 'status', value: 'refunded' },
      { action: 'setReturnShipmentState', returnItemId: item.id, shipmentState: nativeStates('refunded').shipmentState },
      { action: 'setReturnPaymentState', returnItemId: item.id, paymentState: nativeStates('refunded').paymentState },
    ]);
  });
  return { order: updated, refundState: 'none' };
}

/** Reconciles every waiting return of the loaded orders (bounded: one Payment read per waiting return). */
async function reconcileAll(storeKey: string, orders: OrderLike[]): Promise<{ orders: OrderLike[]; states: Map<string, RefundState> }> {
  const states = new Map<string, RefundState>();
  const out: OrderLike[] = [];
  for (const original of orders) {
    let order = original;
    for (const group of groupsOf(original)) {
      const first = group.items[0];
      if (statusOfItem(first) !== 'inspected' || !text(first.custom?.fields?.refundRequestedAt)) continue;
      const result = await reconcileRefund(storeKey, order, group.number);
      order = result.order;
      states.set(`${order.id}:${group.number}`, result.refundState);
    }
    out.push(order);
  }
  return { orders: out, states };
}

function applyStates(rows: ReturnRow[], orders: OrderLike[], states: Map<string, RefundState>): ReturnRow[] {
  const idOf = new Map(orders.map((o) => [o.orderNumber ?? o.id, o.id]));
  return rows.map((r) => {
    const state = states.get(`${idOf.get(r.orderNumber)}:${r.returnNumber}`);
    return state === undefined ? r : { ...r, refundState: r.status === 'inspected' ? state : 'none' };
  });
}

export async function listReturns(storeKey: string, tab: 'open' | 'closed' = 'open', locale = 'en-US', now: Date = new Date()): Promise<ReturnList> {
  const withReturns = await fetchOrders(storeKey, 'returnInfo is not empty', 100);
  const { orders, states } = await reconcileAll(storeKey, withReturns);
  const all = applyStates(returnRows(orders, locale), orders, states);
  const recent = await fetchOrders(storeKey, undefined, 500, 'createdAt desc');
  const since = now.getTime() - 90 * DAY_MS;
  const inWindow = recent.filter((o) => Date.parse(o.createdAt) >= since && o.orderState !== 'Cancelled');
  const ordered = inWindow.reduce((s, o) => s + o.lineItems.reduce((q, l) => q + l.quantity, 0), 0);
  const returned = inWindow.reduce((s, o) => s + groupsOf(o).filter((g) => statusOfItem(g.items[0]) !== 'rejected').reduce((q, g) => q + g.items.reduce((n, i) => n + i.quantity, 0), 0), 0);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).getTime();
  let refundedThisMonthCents = 0;
  for (const order of orders) {
    for (const g of groupsOf(order)) {
      const first = g.items[0];
      if (statusOfItem(first) === 'refunded' && Date.parse(first.lastModifiedAt ?? order.createdAt) >= monthStart) refundedThisMonthCents += num(first.custom?.fields?.refundCents) ?? 0;
    }
  }
  const rows = all.filter((r) => (tab === 'open' ? OPEN_RETURN_STATUSES.includes(r.status) : !OPEN_RETURN_STATUSES.includes(r.status)));
  return {
    rows: rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    kpis: {
      open: all.filter((r) => OPEN_RETURN_STATUSES.includes(r.status)).length,
      returnRatePercent: ordered === 0 ? 0 : Math.round((returned / ordered) * 1000) / 10,
      refundedThisMonthCents,
      currency: recent[0]?.totalPrice.currencyCode ?? 'EUR',
    },
  };
}

/** `RET-<orderNumber>-<n>` to the order number (the order is then read through the store-scoped endpoint). */
function orderNumberOf(returnNumber: string): string {
  const m = /^RET-(.+)-\d+$/.exec(returnNumber);
  if (!m) throw new CatalogError(404, 'RETURN_NOT_FOUND', 'Return not found');
  return m[1];
}

async function findReturn(storeKey: string, returnNumber: string): Promise<{ order: OrderLike; group: Group }> {
  let order: OrderLike;
  try {
    order = await orderByNumber(storeKey, orderNumberOf(returnNumber));
  } catch (error) {
    if (error instanceof CatalogError) throw new CatalogError(404, 'RETURN_NOT_FOUND', 'Return not found');
    throw error;
  }
  const group = groupsOf(order).find((g) => g.number === returnNumber);
  if (!group) throw new CatalogError(404, 'RETURN_NOT_FOUND', 'Return not found');
  return { order, group };
}

function fittingOf(order: OrderLike, items: ItemLike[]): ReturnDetail['fitting'] {
  const line = order.lineItems.find((l) => l.id === items[0]?.lineItemId);
  const fields = line?.custom?.fields;
  let vehicle: string | null = null;
  const raw = text(fields?.vehicle);
  if (raw) {
    try {
      const v = JSON.parse(raw) as { make?: string; model?: string; year?: number; engine?: string };
      vehicle = [v.year, v.make, v.model].filter(Boolean).join(' ') + (v.engine ? ` · ${v.engine}` : '');
    } catch {
      vehicle = null;
    }
  }
  return { vehicle, fit: text(fields?.fit) ?? null };
}

export async function getReturn(storeKey: string, returnNumber: string, locale = 'en-US'): Promise<ReturnDetail> {
  const found = await findReturn(storeKey, returnNumber);
  const { order, refundState } = await reconcileRefund(storeKey, found.order, returnNumber);
  const group = groupsOf(order).find((g) => g.number === returnNumber) ?? found.group;
  const row = rowOf(order, group, locale);
  if (!row) throw new CatalogError(404, 'RETURN_NOT_FOUND', 'Return not found');
  const paymentId = paymentIdOf(order);
  const payment = paymentId ? await readPayment(paymentId) : null;
  const share = paidShare(order, group.items);
  const maxRefundCents = payment ? Math.max(0, Math.min(share, captured(payment) - activeRefunds(payment))) : null;
  return {
    ...row,
    refundState: row.status === 'inspected' ? refundState : 'none',
    lines: group.items.map((i) => {
      const line = order.lineItems.find((l) => l.id === i.lineItemId);
      return { returnItemId: i.id, lineItemId: i.lineItemId ?? '', name: line ? lineName(line, locale) : '', quantity: i.quantity };
    }),
    currency: order.totalPrice.currencyCode,
    maxRefundCents,
    hasPayment: payment !== null,
    comment: text(group.items[0].comment) ?? null,
    fitting: row.reason === 'wrong-fit' ? fittingOf(order, group.items) : null,
  };
}

export async function getOrderForReturn(storeKey: string, orderNumber: string, now: Date = new Date()): Promise<OrderForReturn> {
  const order = await orderByNumber(storeKey, orderNumber);
  const deliveredAt = text(order.custom?.fields?.deliveredAt) ?? null;
  const returned = returnedQuantities(order);
  return {
    orderNumber: order.orderNumber ?? order.id,
    deliveredAt,
    windowOpen: withinReturnWindow(deliveredAt, now),
    lines: order.lineItems.map((l) => ({ lineItemId: l.id, name: lineName(l, 'en-US'), purchased: l.quantity, returned: returned.get(l.id) ?? 0, available: Math.max(0, l.quantity - (returned.get(l.id) ?? 0)) })),
  };
}

/** Quantity already returned per line; rejected returns do not count. */
function returnedQuantities(order: OrderLike): Map<string, number> {
  const out = new Map<string, number>();
  for (const info of order.returnInfo ?? []) {
    for (const item of info.items) {
      if (statusOfItem(item) === 'rejected' || !item.lineItemId) continue;
      out.set(item.lineItemId, (out.get(item.lineItemId) ?? 0) + item.quantity);
    }
  }
  return out;
}

// ---------------------------------------------------------------- writes

const BASE32 = 'ABCDEFGHJKMNPQRSTVWXYZ0123456789';
function trackingId(now: Date): string {
  const bytes = randomBytes(5);
  const code = [...bytes].map((b) => BASE32[b % BASE32.length]).join('');
  return `RT-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${code}`;
}

export interface ReturnInput {
  orderNumber: string;
  items: { lineItemId: string; quantity: number }[];
  reason: string;
  comment?: string;
}

export async function createReturn(storeKey: string, input: ReturnInput, now: Date = new Date()): Promise<{ returnNumber: string; tracking: string }> {
  if (!isReturnReason(input.reason)) throw new CatalogError(400, 'INVALID_REASON', 'Choose a valid return reason');
  if (input.items.length === 0) throw new CatalogError(400, 'NO_ITEMS', 'Choose at least one item');
  const tracking = trackingId(now);
  let returnNumber = '';
  await updateOrder(storeKey, input.orderNumber, (order) => {
    const problem = returnWindowProblem(text(order.custom?.fields?.deliveredAt), now);
    if (problem) throw new CatalogError(409, problem, problem === 'NOT_DELIVERED' ? 'The order has not been delivered yet' : 'The 30-day return window has closed');
    const returned = returnedQuantities(order);
    for (const item of input.items) {
      const line = order.lineItems.find((l) => l.id === item.lineItemId);
      if (!line) throw new CatalogError(400, 'INVALID_LINE', 'The item is not part of this order');
      if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > line.quantity - (returned.get(line.id) ?? 0)) {
        throw new CatalogError(400, 'QUANTITY_EXCEEDS_PURCHASED', 'The quantity is more than was purchased and not yet returned');
      }
    }
    const existing = new Set(groupsOf(order).map((g) => g.number));
    let n = existing.size + 1;
    while (existing.has(`RET-${order.orderNumber ?? order.id}-${n}`)) n += 1;
    returnNumber = `RET-${order.orderNumber ?? order.id}-${n}`;
    return [
      {
        action: 'addReturnInfo',
        returnTrackingId: tracking,
        returnDate: now.toISOString(),
        items: input.items.map((item) => ({
          lineItemId: item.lineItemId,
          quantity: item.quantity,
          ...(input.comment ? { comment: input.comment } : {}),
          shipmentState: 'Advised',
          custom: { type: { typeId: 'type', key: RETURN_TYPE }, fields: { returnNumber, status: 'requested', reason: input.reason } },
        })),
      },
    ];
  });
  return { returnNumber, tracking };
}

export interface TransitionInput {
  refundCents?: number;
  reason?: string;
}

export type TransitionResult =
  | { status: ReturnStatus; refund?: undefined }
  | { status: ReturnStatus; refund: { outcome: 'approved' | 'received' } | { noPayment: true } };

export async function transitionReturn(storeKey: string, returnNumber: string, to: ReturnStatus, input: TransitionInput = {}, now: Date = new Date()): Promise<TransitionResult> {
  const { order: found, group } = await findReturn(storeKey, returnNumber);
  const { order, refundState } = await reconcileRefund(storeKey, found, returnNumber);
  const items = (groupsOf(order).find((g) => g.number === returnNumber) ?? group).items;
  const from = statusOfItem(items[0]);
  if (!from) throw new CatalogError(404, 'RETURN_NOT_FOUND', 'Return not found');
  if (!canTransition(from, to)) throw new CatalogError(409, 'INVALID_TRANSITION', `A ${from} return cannot move to ${to}`);

  if (to === 'refunded') return refund(storeKey, order, returnNumber, items, refundState, input, now);

  if (to === 'rejected') {
    const reason = input.reason?.trim();
    if (!reason) throw new CatalogError(400, 'REASON_REQUIRED', 'A reason is required to reject a return');
    if (reason.length > 500) throw new CatalogError(400, 'REASON_TOO_LONG', 'The reason is too long');
    if (refundState === 'pending') throw new CatalogError(409, 'REFUND_PENDING', 'A refund is already waiting for confirmation');
    await updateOrder(storeKey, order.orderNumber ?? order.id, (current) => {
      const g = groupsOf(current).find((x) => x.number === returnNumber);
      if (!g || statusOfItem(g.items[0]) !== from) throw new CatalogError(409, 'INVALID_TRANSITION', 'The return changed, reload and try again');
      const native = nativeStates('rejected', from === 'inspected');
      return itemActions(g.items, (item) => [
        { action: 'setReturnItemCustomField', returnItemId: item.id, name: 'status', value: 'rejected' },
        { action: 'setReturnItemCustomField', returnItemId: item.id, name: 'rejectReason', value: reason },
        { action: 'setReturnShipmentState', returnItemId: item.id, shipmentState: native.shipmentState },
        { action: 'setReturnPaymentState', returnItemId: item.id, paymentState: native.paymentState },
      ]);
    });
    return { status: 'rejected' };
  }

  await updateOrder(storeKey, order.orderNumber ?? order.id, (current) => {
    const g = groupsOf(current).find((x) => x.number === returnNumber);
    if (!g || statusOfItem(g.items[0]) !== from) throw new CatalogError(409, 'INVALID_TRANSITION', 'The return changed, reload and try again');
    const native = nativeStates(to);
    return itemActions(g.items, (item) => [
      { action: 'setReturnItemCustomField', returnItemId: item.id, name: 'status', value: to },
      { action: 'setReturnShipmentState', returnItemId: item.id, shipmentState: native.shipmentState },
    ]);
  });
  return { status: to };
}

async function refund(storeKey: string, order: OrderLike, returnNumber: string, items: ItemLike[], refundState: RefundState, input: TransitionInput, now: Date): Promise<TransitionResult> {
  const cents = input.refundCents;
  if (cents === undefined || !Number.isInteger(cents) || cents <= 0) throw new CatalogError(400, 'REFUND_AMOUNT_REQUIRED', 'Enter the refund amount');
  if (refundState === 'pending') throw new CatalogError(409, 'REFUND_PENDING', 'A refund is already waiting for confirmation');
  const orderNumber = order.orderNumber ?? order.id;
  const share = paidShare(order, items);
  const paymentId = paymentIdOf(order);
  const payment = paymentId ? await readPayment(paymentId) : null;

  if (!payment) {
    // No Payment of a Checkout flow: only the amount is recorded and the shop settles manually. Nothing is sent to Checkout.
    if (cents > share) throw new CatalogError(400, 'REFUND_EXCEEDS_PAID', 'The refund is more than the returned items cost');
    await updateOrder(storeKey, orderNumber, (current) => {
      const g = groupsOf(current).find((x) => x.number === returnNumber);
      if (!g) return [];
      return itemActions(g.items, (item) => [
        { action: 'setReturnItemCustomField', returnItemId: item.id, name: 'refundCents', value: cents },
        { action: 'setReturnItemCustomField', returnItemId: item.id, name: 'status', value: 'refunded' },
        { action: 'setReturnShipmentState', returnItemId: item.id, shipmentState: nativeStates('refunded').shipmentState },
        { action: 'setReturnPaymentState', returnItemId: item.id, paymentState: nativeStates('refunded').paymentState },
      ]);
    });
    return { status: 'refunded', refund: { noPayment: true } };
  }

  const paid = captured(payment);
  if (paid === 0) {
    throw new CatalogError(409, hasAuthorization(payment) ? 'CAPTURE_REQUIRED' : 'NO_CAPTURE', hasAuthorization(payment) ? 'Capture the payment first' : 'The payment has no captured amount to refund');
  }
  const max = Math.min(share, paid - activeRefunds(payment));
  if (cents > max) throw new CatalogError(400, 'REFUND_EXCEEDS_PAID', 'The refund is more than was paid for the returned items minus earlier refunds', { maxRefundCents: Math.max(0, max) });

  // Record the request time BEFORE calling Checkout, so the Refund transaction it creates is always newer than the record.
  const requestedAt = now.toISOString();
  const setFields = (current: OrderLike) => {
    const g = groupsOf(current).find((x) => x.number === returnNumber);
    return g
      ? itemActions(g.items, (item) => [
          { action: 'setReturnItemCustomField', returnItemId: item.id, name: 'refundCents', value: cents },
          { action: 'setReturnItemCustomField', returnItemId: item.id, name: 'refundRequestedAt', value: requestedAt },
        ])
      : [];
  };
  await updateOrder(storeKey, orderNumber, setFields);
  let outcome: 'approved' | 'rejected' | 'received';
  try {
    outcome = (await refundPayment(payment.id, { centAmount: cents, currencyCode: order.totalPrice.currencyCode })).outcome;
  } catch (error) {
    await updateOrder(storeKey, orderNumber, (current) => {
      const g = groupsOf(current).find((x) => x.number === returnNumber);
      return g ? itemActions(g.items, (item) => [{ action: 'setReturnItemCustomField', returnItemId: item.id, name: 'refundRequestedAt' }]) : [];
    }).catch(() => undefined);
    if (error instanceof CheckoutError) throw new CatalogError(409, 'REFUND_UNAVAILABLE', 'Checkout could not take the refund request, try again');
    throw error;
  }
  if (outcome === 'rejected') {
    await updateOrder(storeKey, orderNumber, (current) => {
      const g = groupsOf(current).find((x) => x.number === returnNumber);
      return g ? itemActions(g.items, (item) => [{ action: 'setReturnItemCustomField', returnItemId: item.id, name: 'refundRequestedAt' }]) : [];
    }).catch(() => undefined);
    throw new CatalogError(409, 'REFUND_REJECTED', 'The payment provider rejected the refund');
  }
  return { status: 'inspected', refund: { outcome } };
}

/** Admin action "Mark delivered" (D9): sets `custom.deliveredAt` of the order once; a second call keeps the first date. */
export async function markDelivered(storeKey: string, orderNumber: string, now: Date = new Date()): Promise<{ deliveredAt: string }> {
  let deliveredAt = now.toISOString();
  await updateOrder(storeKey, orderNumber, (order) => {
    const existing = text(order.custom?.fields?.deliveredAt);
    if (existing) {
      deliveredAt = existing;
      return [];
    }
    return order.custom?.fields
      ? [{ action: 'setCustomField', name: 'deliveredAt', value: deliveredAt }]
      : [{ action: 'setCustomType', type: { typeId: 'type', key: CHECKOUT_TYPE }, fields: { deliveredAt } }];
  });
  return { deliveredAt };
}
