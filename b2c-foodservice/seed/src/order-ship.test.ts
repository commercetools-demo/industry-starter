// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import { Runner } from './lib';
import {
  OrderOpError, parseOrderArgs, planDeliver, planReturn, planShip, resolveEnv, runOrderOp, unshippedUnits,
  type Action, type OrderClient, type OrderLike,
} from './order-ship';

const ship = (id: string, quantity: number) => ({ id, quantity, custom: { fields: { fulfilment: 'delivery' } } });
const collect = (id: string, quantity: number) => ({ id, quantity, custom: { fields: { fulfilment: 'collect' } }, supplyChannel: {} });
const order = (over: Partial<OrderLike> = {}): OrderLike => ({
  id: 'o1', version: 3, orderNumber: 'MC-1', lineItems: [ship('l1', 4), ship('l2', 1)], ...over,
});
const quiet = () => undefined;

/** An in-memory order: applies the subset of actions the tool sends, like the platform would. */
class FakeOrders implements OrderClient {
  constructor(public order: OrderLike) {}
  async getByNumber(n: string) {
    return n === this.order.orderNumber ? structuredClone(this.order) : undefined;
  }
  async update(o: OrderLike, actions: Action[]) {
    expect(o.version).toBe(this.order.version);
    for (const a of actions) {
      if (a.action === 'addDelivery') {
        const info = (this.order.shippingInfo ??= { deliveries: [] });
        (info.deliveries ??= []).push({ id: `d${info.deliveries.length + 1}`, items: a.items as { id: string; quantity: number }[] });
      }
      if (a.action === 'changeShipmentState') this.order.shipmentState = a.shipmentState as string;
      if (a.action === 'setReturnShipmentState') (this.order.returnInfo![0]!.items[0] as { shipmentState: string }).shipmentState = a.shipmentState as string;
      if (a.action === 'setReturnPaymentState') (this.order.returnInfo![0]!.items[0] as { paymentState: string }).paymentState = a.paymentState as string;
    }
    this.order.version += 1;
  }
}
const args = (command: string, extra: Partial<ReturnType<typeof parseOrderArgs>> = {}) => ({ command, orderNumber: 'MC-1', partial: false, dryRun: false, ...extra });

describe('ship', () => {
  it('ships every remaining unit with a parcel and a tracking number, and sets Shipped', () => {
    const actions = planShip(order(), { partial: false });
    expect(actions).toEqual([
      { action: 'addDelivery', items: [{ id: 'l1', quantity: 4 }, { id: 'l2', quantity: 1 }], parcels: [{ trackingData: { trackingId: 'MCF-TRK-MC-1-1', carrier: 'UPS' } }] },
      { action: 'changeShipmentState', shipmentState: 'Shipped' },
    ]);
  });

  it('collect lines are never shipped', () => {
    expect(unshippedUnits(order({ lineItems: [collect('c1', 2), ship('l1', 1)] }))).toEqual([{ id: 'l1', quantity: 1 }]);
    expect(() => planShip(order({ lineItems: [collect('c1', 2)] }), { partial: false })).toThrow(OrderOpError);
  });

  it('ship partial creates two deliveries over two runs', async () => {
    const fake = new FakeOrders(order({ lineItems: [ship('l1', 4)] }));
    const run = new Runner(false, quiet);
    const first = await runOrderOp(fake, args('ship', { partial: true }), run);
    expect(first[0]).toMatchObject({ items: [{ id: 'l1', quantity: 2 }] });
    expect(fake.order.shipmentState).toBe('Partial');
    await runOrderOp(fake, args('ship'), run);
    expect(fake.order.shippingInfo?.deliveries).toHaveLength(2);
    expect(fake.order.shippingInfo?.deliveries?.[1]?.items).toEqual([{ id: 'l1', quantity: 2 }]);
    expect(fake.order.shipmentState).toBe('Shipped');
    // a third run has nothing left, and Shipped is not shippable again
    await expect(runOrderOp(fake, args('ship'), run)).rejects.toThrow(/Cannot ship|Nothing left/);
  });

  it('a partial run that happens to cover the last unit sets Shipped', () => {
    expect(planShip(order({ lineItems: [ship('l1', 1)] }), { partial: true })[1]).toEqual({ action: 'changeShipmentState', shipmentState: 'Shipped' });
  });

  it('a multiple-shipping order carries its shipping key; the tracking number counts deliveries', () => {
    const o = order({ shippingMode: 'Multiple', shipping: [{ shippingKey: 'ship-1', shippingInfo: { deliveries: [{ id: 'd1', items: [{ id: 'l1', quantity: 1 }] }] } }] });
    const [add] = planShip(o, { partial: false });
    expect(add).toMatchObject({ shippingKey: 'ship-1', parcels: [{ trackingData: { trackingId: 'MCF-TRK-MC-1-2' } }] });
    expect((add as { items: unknown[] }).items).toEqual([{ id: 'l1', quantity: 3 }, { id: 'l2', quantity: 1 }]);
  });

  it('refuses a delivered order', () => {
    expect(() => planShip(order({ shipmentState: 'Delivered' }), { partial: false })).toThrow(/Cannot ship/);
  });
});

describe('deliver', () => {
  it('deliver needs shipped', () => {
    expect(() => planDeliver(order())).toThrow(/needs shipment state Shipped/);
    expect(() => planDeliver(order({ shipmentState: 'Partial' }))).toThrow(OrderOpError);
    expect(planDeliver(order({ shipmentState: 'Shipped' }))).toEqual([{ action: 'changeShipmentState', shipmentState: 'Delivered' }]);
  });
});

describe('return', () => {
  const withReturn = (shipmentState: string, paymentState = 'Initial') =>
    order({ shipmentState: 'Delivered', returnInfo: [{ items: [{ id: 'ri1', type: 'LineItemReturnItem', shipmentState, paymentState }] }] });

  it('return states follow the machine', () => {
    expect(planReturn(withReturn('Advised'), 'Returned')).toEqual([{ action: 'setReturnShipmentState', returnItemId: 'ri1', shipmentState: 'Returned' }]);
    expect(planReturn(withReturn('Returned'), 'BackInStock')).toHaveLength(1);
    expect(planReturn(withReturn('Returned'), 'Unusable')).toHaveLength(1);
    expect(planReturn(withReturn('Returned'), 'Refunded')).toEqual([{ action: 'setReturnPaymentState', returnItemId: 'ri1', paymentState: 'Refunded' }]);
    expect(planReturn(withReturn('Unusable'), 'NotRefunded')).toHaveLength(1);
  });

  it.each([
    ['Advised', 'BackInStock'],
    ['Advised', 'Refunded'],
    ['Unusable', 'Refunded'],
    ['BackInStock', 'Returned'],
  ])('refuses %s then %s', (from, to) => {
    expect(() => planReturn(withReturn(from), to)).toThrow(OrderOpError);
  });

  it('refuses a second refund decision, an unknown state and an order with no return', () => {
    expect(() => planReturn(withReturn('Returned', 'Refunded'), 'NotRefunded')).toThrow(/already/);
    expect(() => planReturn(withReturn('Advised'), 'Lost')).toThrow(/--set must be one of/);
    expect(() => planReturn(order(), 'Returned')).toThrow(/no return/);
  });

  it('runs end to end: Returned, then Refunded', async () => {
    const fake = new FakeOrders(withReturn('Advised'));
    const run = new Runner(false, quiet);
    await runOrderOp(fake, args('return', { set: 'Returned' }), run);
    await runOrderOp(fake, args('return', { set: 'Refunded' }), run);
    expect(fake.order.returnInfo?.[0]?.items[0]).toMatchObject({ shipmentState: 'Returned', paymentState: 'Refunded' });
  });
});

describe('runOrderOp', () => {
  it('--dry-run plans and prints but writes nothing', async () => {
    const fake = new FakeOrders(order());
    const lines: string[] = [];
    const actions = await runOrderOp(fake, args('ship', { dryRun: true }), new Runner(true, (l) => lines.push(l)));
    expect(actions).toHaveLength(2);
    expect(fake.order.version).toBe(3);
    expect(fake.order.shippingInfo).toBeUndefined();
    expect(lines[0]).toMatch(/^would ship order MC-1: addDelivery, changeShipmentState/);
  });

  it('refuses unknown commands, a missing or malformed number and an unknown order', async () => {
    const fake = new FakeOrders(order());
    const run = new Runner(false, quiet);
    await expect(runOrderOp(fake, args('cancel'), run)).rejects.toThrow(/Usage/);
    await expect(runOrderOp(fake, args('ship', { orderNumber: undefined }), run)).rejects.toThrow(/--order-number/);
    await expect(runOrderOp(fake, args('ship', { orderNumber: 'MC-1" or 1=1' }), run)).rejects.toThrow(/--order-number/);
    await expect(runOrderOp(fake, args('ship', { orderNumber: 'NOPE' }), run)).rejects.toThrow(/No order/);
  });

  it('parses the command line', () => {
    expect(parseOrderArgs(['ship', '--order-number', 'MC-9', '--partial', '--dry-run'])).toEqual({ command: 'ship', orderNumber: 'MC-9', partial: true, set: undefined, dryRun: true });
    expect(parseOrderArgs(['return', '--order-number', 'MC-9', '--set', 'Returned'])).toMatchObject({ command: 'return', set: 'Returned', partial: false });
  });
});

describe('project guard', () => {
  const env = (over: Record<string, string> = {}) => ({
    SEED_CTP_PROJECT_KEY: 'spec-test-b2c-food', SEED_CTP_AUTH_URL: 'https://auth.example.com', SEED_CTP_API_URL: 'https://api.example.com',
    SEED_CTP_CLIENT_ID: 'id', SEED_CTP_CLIENT_SECRET: 'secret', SEED_CTP_SCOPES: 'manage_orders', EXPECTED_PROJECT_KEY: 'spec-test-b2c-food', ...over,
  });

  it('foreign project key refused', () => {
    expect(resolveEnv(env()).projectKey).toBe('spec-test-b2c-food');
    expect(() => resolveEnv(env({ EXPECTED_PROJECT_KEY: 'some-other-project' }))).toThrow(/mismatch/);
    expect(() => resolveEnv(env({ SEED_CTP_PROJECT_KEY: 'team-health', EXPECTED_PROJECT_KEY: 'team-health' }))).toThrow(/another team/);
    expect(() => resolveEnv(env({ EXPECTED_PROJECT_KEY: '' }))).toThrow(/EXPECTED_PROJECT_KEY|Missing/);
  });
});
