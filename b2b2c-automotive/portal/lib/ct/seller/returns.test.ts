import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createVFake, type VFake } from '@/lib/portal/v-fixture-root';

const checkout = vi.hoisted(() => ({ refundPayment: vi.fn() }));
vi.mock('@/lib/ct/checkout-payments', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/ct/checkout-payments')>()), refundPayment: checkout.refundPayment }));

import { createReturn, getReturn, listReturns, markDelivered, reconcileRefund, returnRows, transitionReturn, type OrderLike } from './returns';
import { setVRootForTest } from './v-root';

const NOW = new Date('2026-10-12T10:00:00Z');
const DAY = 86_400_000;
const ago = (days: number) => new Date(NOW.getTime() - days * DAY).toISOString();

let fake: VFake;
type Obj = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function seedOrder(over: { number: string; store?: string; deliveredDaysAgo?: number | null; payment?: 'charge' | 'authorization' | 'none'; lines?: { id: string; quantity: number; cents: number }[] }): Obj {
  const store = over.store ?? 'store-a';
  const lines = over.lines ?? [{ id: 'l1', quantity: 2, cents: 2000 }, { id: 'l2', quantity: 1, cents: 5000 }];
  const total = lines.reduce((s, l) => s + l.cents, 0);
  const order: Obj = {
    id: `id-${over.number}`,
    version: 1,
    orderNumber: over.number,
    customerId: 'cust-1',
    customerEmail: 'anna@example.com',
    createdAt: ago(40),
    store: { typeId: 'store', key: store },
    orderState: 'Open',
    totalPrice: { centAmount: total, currencyCode: 'EUR', fractionDigits: 2 },
    lineItems: lines.map((l) => ({ id: l.id, name: { 'en-US': `Part ${l.id}` }, quantity: l.quantity, totalPrice: { centAmount: l.cents, currencyCode: 'EUR' } })),
    ...(over.deliveredDaysAgo === null || over.deliveredDaysAgo === undefined ? {} : { custom: { type: { typeId: 'type', id: 't' }, fields: { deliveredAt: ago(over.deliveredDaysAgo) } } }),
  };
  const kind = over.payment ?? 'charge';
  if (kind !== 'none') {
    fake.db.payments.push({ id: `pay-${over.number}`, version: 1, transactions: [{ id: 'tx1', type: kind === 'charge' ? 'Charge' : 'Authorization', state: 'Success', amount: { centAmount: total, currencyCode: 'EUR' }, timestamp: ago(39) }] });
    order.paymentInfo = { payments: [{ typeId: 'payment', id: `pay-${over.number}` }] };
  }
  fake.db.orders.push(order);
  return order;
}

const updates = () => fake.calls.filter((c) => c.op === 'order.update').map((c) => c.args as { actions: Obj[] });
const find = (n: string) => fake.db.orders.find((o) => o.orderNumber === n) as Obj;

beforeEach(() => {
  fake = createVFake({ now: () => NOW });
  setVRootForTest(fake.root);
  checkout.refundPayment.mockReset();
  checkout.refundPayment.mockImplementation(async (id: string, amount: { centAmount: number; currencyCode: string }) => fake.refundPayment(id, amount));
});
afterEach(() => setVRootForTest(undefined));

describe('return create validations', () => {
  it("an order of another store is ORDER_NOT_FOUND, the same as a missing one", async () => {
    seedOrder({ number: 'A-1', store: 'store-b', deliveredDaysAgo: 2 });
    const input = { orderNumber: 'A-1', items: [{ lineItemId: 'l1', quantity: 1 }], reason: 'defective' };
    const other = await createReturn('store-a', input, NOW).catch((e: unknown) => e);
    const missing = await createReturn('store-a', { ...input, orderNumber: 'NOPE' }, NOW).catch((e: unknown) => e);
    expect(other).toMatchObject({ status: 404, code: 'ORDER_NOT_FOUND' });
    expect((other as Error).message).toBe((missing as Error).message);
    expect(updates()).toHaveLength(0);
  });

  it('refuses a quantity above purchased minus already returned; rejected returns do not count', async () => {
    seedOrder({ number: 'A-2', deliveredDaysAgo: 3 });
    await createReturn('store-a', { orderNumber: 'A-2', items: [{ lineItemId: 'l1', quantity: 2 }], reason: 'defective' }, NOW);
    await expect(createReturn('store-a', { orderNumber: 'A-2', items: [{ lineItemId: 'l1', quantity: 1 }], reason: 'defective' }, NOW)).rejects.toMatchObject({ code: 'QUANTITY_EXCEEDS_PURCHASED' });
    await transitionReturn('store-a', 'RET-A-2-1', 'rejected', { reason: 'Used' }, NOW);
    const again = await createReturn('store-a', { orderNumber: 'A-2', items: [{ lineItemId: 'l1', quantity: 2 }], reason: 'other' }, NOW);
    expect(again.returnNumber).toBe('RET-A-2-2');
    await expect(createReturn('store-a', { orderNumber: 'A-2', items: [{ lineItemId: 'nope', quantity: 1 }], reason: 'other' }, NOW)).rejects.toMatchObject({ status: 400 });
  });

  it('sends addReturnInfo with Advised shipment state and the custom fields; number and tracking have their formats', async () => {
    seedOrder({ number: 'A-3', deliveredDaysAgo: 1 });
    const result = await createReturn('store-a', { orderNumber: 'A-3', items: [{ lineItemId: 'l2', quantity: 1 }], reason: 'wrong-fit', comment: 'TST-V-return' }, NOW);
    expect(result.returnNumber).toBe('RET-A-3-1');
    expect(result.tracking).toMatch(/^RT-20261012-[A-Z0-9]{5}$/);
    expect(updates()[0].actions[0]).toMatchObject({
      action: 'addReturnInfo',
      returnTrackingId: result.tracking,
      items: [{ lineItemId: 'l2', quantity: 1, comment: 'TST-V-return', shipmentState: 'Advised', custom: { type: { key: 'malva-return-item' }, fields: { returnNumber: 'RET-A-3-1', status: 'requested', reason: 'wrong-fit' } } }],
    });
  });
});

describe('return window', () => {
  it('an undelivered order is NOT_DELIVERED; day 30 is accepted, day 31 is RETURN_WINDOW_CLOSED', async () => {
    seedOrder({ number: 'W-0' });
    seedOrder({ number: 'W-30', deliveredDaysAgo: 30 });
    seedOrder({ number: 'W-31', deliveredDaysAgo: 31 });
    const item = (orderNumber: string) => ({ orderNumber, items: [{ lineItemId: 'l1', quantity: 1 }], reason: 'defective' });
    await expect(createReturn('store-a', item('W-0'), NOW)).rejects.toMatchObject({ status: 409, code: 'NOT_DELIVERED' });
    await expect(createReturn('store-a', item('W-31'), NOW)).rejects.toMatchObject({ status: 409, code: 'RETURN_WINDOW_CLOSED' });
    await expect(createReturn('store-a', item('W-30'), NOW)).resolves.toMatchObject({ returnNumber: 'RET-W-30-1' });
  });

  it('Mark delivered sets deliveredAt once and a second call keeps the first date; another store is 404', async () => {
    seedOrder({ number: 'D-1' });
    seedOrder({ number: 'D-2', store: 'store-b' });
    const first = await markDelivered('store-a', 'D-1', NOW);
    const second = await markDelivered('store-a', 'D-1', new Date(NOW.getTime() + DAY));
    expect(second).toEqual(first);
    expect(updates()).toHaveLength(1);
    expect(updates()[0].actions[0]).toMatchObject({ action: 'setCustomType', type: { key: 'malva-checkout' }, fields: { deliveredAt: first.deliveredAt } });
    await expect(markDelivered('store-a', 'D-2', NOW)).rejects.toMatchObject({ status: 404 });
  });
});

async function inspected(number: string, over: Parameters<typeof seedOrder>[0] = { number }) {
  seedOrder({ deliveredDaysAgo: 2, ...over });
  await createReturn('store-a', { orderNumber: number, items: [{ lineItemId: 'l1', quantity: 1 }], reason: 'defective' }, NOW);
  const rn = `RET-${number}-1`;
  await transitionReturn('store-a', rn, 'received', {}, NOW);
  await transitionReturn('store-a', rn, 'inspected', {}, NOW);
  return rn;
}

describe('return lifecycle', () => {
  it('allows the lifecycle moves and refuses the others', async () => {
    seedOrder({ number: 'L-1', deliveredDaysAgo: 2 });
    await createReturn('store-a', { orderNumber: 'L-1', items: [{ lineItemId: 'l1', quantity: 1 }], reason: 'defective' }, NOW);
    await expect(transitionReturn('store-a', 'RET-L-1-1', 'inspected', {}, NOW)).rejects.toMatchObject({ status: 409, code: 'INVALID_TRANSITION' });
    await expect(transitionReturn('store-a', 'RET-L-1-1', 'refunded', { refundCents: 1 }, NOW)).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
    await transitionReturn('store-a', 'RET-L-1-1', 'in-transit', {}, NOW);
    await transitionReturn('store-a', 'RET-L-1-1', 'received', {}, NOW);
    const item = find('L-1').returnInfo[0].items[0];
    expect(item).toMatchObject({ shipmentState: 'Returned', paymentState: 'Initial', custom: { fields: { status: 'received' } } });
  });

  it('reject needs a reason, stores it, and sets Unusable and NotRefunded after inspection', async () => {
    const rn = await inspected('L-2');
    await expect(transitionReturn('store-a', rn, 'rejected', {}, NOW)).rejects.toMatchObject({ status: 400, code: 'REASON_REQUIRED' });
    await transitionReturn('store-a', rn, 'rejected', { reason: 'Worn parts' }, NOW);
    expect(find('L-2').returnInfo[0].items[0]).toMatchObject({ shipmentState: 'Unusable', paymentState: 'NotRefunded', custom: { fields: { status: 'rejected', rejectReason: 'Worn parts' } } });
  });

  it('a return of another store is 404 and no update is sent', async () => {
    seedOrder({ number: 'L-3', store: 'store-b', deliveredDaysAgo: 1 });
    await expect(transitionReturn('store-a', 'RET-L-3-1', 'received', {}, NOW)).rejects.toMatchObject({ status: 404 });
    expect(updates()).toHaveLength(0);
  });
});

describe('refund goes through checkout', () => {
  it('requests the refund once through Checkout, never writes a Payment transaction, and the return stays Inspected with a pending refund', async () => {
    const rn = await inspected('R-1');
    const result = await transitionReturn('store-a', rn, 'refunded', { refundCents: 1000 }, NOW);
    expect(result).toEqual({ status: 'inspected', refund: { outcome: 'received' } });
    expect(checkout.refundPayment).toHaveBeenCalledTimes(1);
    expect(checkout.refundPayment).toHaveBeenCalledWith('pay-R-1', { centAmount: 1000, currencyCode: 'EUR' });
    for (const c of fake.calls) expect(c.op).not.toMatch(/payment\.(update|create)/);
    const item = find('R-1').returnInfo[0].items[0];
    expect(item.custom.fields).toMatchObject({ status: 'inspected', refundCents: 1000, refundRequestedAt: NOW.toISOString() });
    const row = returnRows([find('R-1') as OrderLike])[0];
    expect(row).toMatchObject({ status: 'inspected', refundState: 'pending' });
  });

  it('refuses a refund above the paid share of the returned lines minus earlier refunds (400 REFUND_EXCEEDS_PAID)', async () => {
    const rn = await inspected('R-2');
    // line l1: 2 units for 2000 cents, one returned: at most 1000.
    await expect(transitionReturn('store-a', rn, 'refunded', { refundCents: 1001 }, NOW)).rejects.toMatchObject({ status: 400, code: 'REFUND_EXCEEDS_PAID', details: { maxRefundCents: 1000 } });
    await expect(transitionReturn('store-a', rn, 'refunded', {}, NOW)).rejects.toMatchObject({ code: 'REFUND_AMOUNT_REQUIRED' });
    expect(checkout.refundPayment).not.toHaveBeenCalled();
    const pay = fake.db.payments.find((p) => p.id === 'pay-R-2') as Obj;
    pay.transactions.push({ id: 'old', type: 'Refund', state: 'Success', amount: { centAmount: 7000 - 500, currencyCode: 'EUR' }, timestamp: ago(1) });
    await expect(transitionReturn('store-a', rn, 'refunded', { refundCents: 600 }, NOW)).rejects.toMatchObject({ code: 'REFUND_EXCEEDS_PAID' });
  });

  it('with only an authorization it says to capture the payment first', async () => {
    const rn = await inspected('R-3', { number: 'R-3', payment: 'authorization' });
    await expect(transitionReturn('store-a', rn, 'refunded', { refundCents: 500 }, NOW)).rejects.toMatchObject({ status: 409, code: 'CAPTURE_REQUIRED' });
    expect(checkout.refundPayment).not.toHaveBeenCalled();
  });

  it('a Checkout failure clears the request time and reports REFUND_UNAVAILABLE', async () => {
    const { CheckoutError } = await import('@/lib/ct/checkout-payments');
    const rn = await inspected('R-4');
    checkout.refundPayment.mockRejectedValueOnce(new CheckoutError(502, 'down'));
    await expect(transitionReturn('store-a', rn, 'refunded', { refundCents: 500 }, NOW)).rejects.toMatchObject({ code: 'REFUND_UNAVAILABLE' });
    expect(find('R-4').returnInfo[0].items[0].custom.fields.refundRequestedAt).toBeUndefined();
  });
});

describe('refund reconcile', () => {
  const orderOf = (n: string) => find(n) as unknown as OrderLike;

  it('a Refund transaction in Success moves the return to Refunded with paymentState Refunded', async () => {
    const rn = await inspected('C-1');
    await transitionReturn('store-a', rn, 'refunded', { refundCents: 1000 }, NOW);
    const pay = fake.db.payments.find((p) => p.id === 'pay-C-1') as Obj;
    expect(pay.transactions.at(-1)).toMatchObject({ type: 'Refund', state: 'Pending' });
    expect((await reconcileRefund('store-a', orderOf('C-1'), rn)).refundState).toBe('pending');
    pay.transactions.at(-1).state = 'Success';
    const result = await reconcileRefund('store-a', orderOf('C-1'), rn);
    expect(result.refundState).toBe('none');
    expect(find('C-1').returnInfo[0].items[0]).toMatchObject({ paymentState: 'Refunded', shipmentState: 'Returned', custom: { fields: { status: 'refunded' } } });
    expect((await getReturn('store-a', rn)).status).toBe('refunded');
  });

  it('a Failure shows "failed" and allows a retry; a pending refund blocks a second request and a reject', async () => {
    const rn = await inspected('C-2');
    await transitionReturn('store-a', rn, 'refunded', { refundCents: 1000 }, NOW);
    await expect(transitionReturn('store-a', rn, 'refunded', { refundCents: 1000 }, NOW)).rejects.toMatchObject({ code: 'REFUND_PENDING' });
    await expect(transitionReturn('store-a', rn, 'rejected', { reason: 'x' }, NOW)).rejects.toMatchObject({ code: 'REFUND_PENDING' });
    const pay = fake.db.payments.find((p) => p.id === 'pay-C-2') as Obj;
    pay.transactions.at(-1).state = 'Failure';
    expect((await getReturn('store-a', rn)).refundState).toBe('failed');
    const list = await listReturns('store-a', 'open', 'en-US', NOW);
    expect(list.rows.find((r) => r.returnNumber === rn)?.refundState).toBe('failed');
    const later = new Date(NOW.getTime() + 5 * 60_000);
    await expect(transitionReturn('store-a', rn, 'refunded', { refundCents: 1000 }, later)).resolves.toMatchObject({ status: 'inspected' });
    expect(checkout.refundPayment).toHaveBeenCalledTimes(2);
  });

  it('an order without a Payment records the amount only and moves to Refunded without calling Checkout', async () => {
    const rn = await inspected('C-3', { number: 'C-3', payment: 'none' });
    const result = await transitionReturn('store-a', rn, 'refunded', { refundCents: 900 }, NOW);
    expect(result).toEqual({ status: 'refunded', refund: { noPayment: true } });
    expect(checkout.refundPayment).not.toHaveBeenCalled();
    expect(find('C-3').returnInfo[0].items[0].custom.fields).toMatchObject({ refundCents: 900, status: 'refunded' });
  });

  it('KPIs count open returns, the 90 day rate and what was refunded this month', async () => {
    await inspected('K-1');
    const list = await listReturns('store-a', 'open', 'en-US', NOW);
    expect(list.kpis.open).toBe(1);
    expect(list.kpis.returnRatePercent).toBe(33.3);
    expect(list.kpis.refundedThisMonthCents).toBe(0);
    expect((await listReturns('store-a', 'closed', 'en-US', NOW)).rows).toHaveLength(0);
  });
});
