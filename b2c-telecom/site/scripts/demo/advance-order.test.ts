import { EXIT } from '../seed/config';
import type { CtApi } from '../seed/lib';
import { main, planAdvance, type RawOrder } from './advance-order';

const SOURCE = { CTP_SEED_PROJECT_KEY: 'spec-test-b2c-telecom', CTP_SEED_AUTH_URL: 'a', CTP_SEED_API_URL: 'b', CTP_SEED_CLIENT_ID: 'c', CTP_SEED_CLIENT_SECRET: 'd' };
const ORDER: RawOrder = {
  id: 'o1',
  version: 7,
  shippingInfo: { deliveries: [] },
  lineItems: [
    { id: 'plan', quantity: 1, recurrenceInfo: {} },
    { id: 'router', quantity: 1 },
    { id: 'mesh', quantity: 2 },
  ],
};

function api(order: RawOrder | null): CtApi & { posts: Array<{ path: string; body: unknown }> } {
  const posts: Array<{ path: string; body: unknown }> = [];
  return {
    posts,
    writes: 0,
    get: async (path: string) => (path === '' ? { key: 'spec-test-b2c-telecom' } : path.startsWith('orders/order-number=') ? order : null),
    post: async (path: string, body: unknown) => {
      posts.push({ path, body });
      return {};
    },
    del: async () => ({}),
  } as unknown as CtApi & { posts: Array<{ path: string; body: unknown }> };
}

describe('planAdvance', () => {
  it('--ship-two-parcels: two deliveries, three parcels with the demo carrier, then Partial', () => {
    const actions = planAdvance(ORDER, 'ship-two-parcels');
    expect(actions).toEqual([
      { action: 'addDelivery', items: [{ id: 'router', quantity: 1 }], parcels: [{ trackingData: { trackingId: 'DP000111', carrier: 'DemoPost' }, items: [{ id: 'router', quantity: 1 }] }, { trackingData: { trackingId: 'DP000222', carrier: 'DemoPost' } }] },
      { action: 'addDelivery', items: [{ id: 'mesh', quantity: 2 }], parcels: [{ trackingData: { trackingId: 'DP000333', carrier: 'DemoPost' }, items: [{ id: 'mesh', quantity: 2 }] }] },
      { action: 'changeShipmentState', shipmentState: 'Partial' },
    ]);
  });

  it('--ship-two-parcels needs two lines', () => {
    expect(() => planAdvance({ ...ORDER, lineItems: [{ id: 'a', quantity: 1 }] }, 'ship-two-parcels')).toThrow('at least two lines');
  });

  it('--ship-all delivers only what is still missing, then Shipped', () => {
    const shipped = { ...ORDER, shippingInfo: { deliveries: [{ items: [{ id: 'router', quantity: 1 }] }, { items: [{ id: 'mesh', quantity: 1 }] }] } };
    expect(planAdvance(shipped, 'ship-all')).toEqual([
      { action: 'addDelivery', items: [{ id: 'plan', quantity: 1 }, { id: 'mesh', quantity: 1 }], parcels: [{ trackingData: { trackingId: 'DP000444', carrier: 'DemoPost' }, items: [{ id: 'plan', quantity: 1 }, { id: 'mesh', quantity: 1 }] }] },
      { action: 'changeShipmentState', shipmentState: 'Shipped' },
    ]);
    const complete = { ...ORDER, shippingInfo: { deliveries: [{ items: ORDER.lineItems.map((line) => ({ id: line.id, quantity: line.quantity })) }] } };
    expect(planAdvance(complete, 'ship-all')).toEqual([{ action: 'changeShipmentState', shipmentState: 'Shipped' }]);
  });

  it('refuses to ship an order without a shipping method', () => {
    const { shippingInfo: _unused, ...bare } = ORDER;
    void _unused;
    expect(() => planAdvance(bare, 'ship-all')).toThrow('no shipping method');
  });

  it('--deliver sets Delivered', () => {
    expect(planAdvance(ORDER, 'deliver')).toEqual([{ action: 'changeShipmentState', shipmentState: 'Delivered' }]);
  });

  it('--seed-received-return adds an item that is already Returned, for a line of this order only', () => {
    const now = new Date('2026-05-10T09:30:00Z');
    expect(planAdvance(ORDER, 'seed-received-return', { line: 'router', now })).toEqual([
      { action: 'addReturnInfo', returnDate: '2026-05-10T09:30:00.000Z', items: [{ key: 'demo-ret-20260510093000', lineItemId: 'router', quantity: 1, comment: 'demo: received', shipmentState: 'Returned' }] },
    ]);
    expect(() => planAdvance(ORDER, 'seed-received-return', { line: 'nope', now })).toThrow('--line');
    expect(() => planAdvance(ORDER, 'seed-received-return', { now })).toThrow('--line');
  });

  it('--refund sets Refunded on every Initial return item and nothing else', () => {
    const order = { ...ORDER, returnInfo: [{ items: [{ id: 'r1', paymentState: 'NonRefundable' }, { id: 'r2', paymentState: 'Initial' }, { id: 'r3', paymentState: 'Initial' }] }] };
    expect(planAdvance(order, 'refund')).toEqual([
      { action: 'setReturnPaymentState', returnItemId: 'r2', paymentState: 'Refunded' },
      { action: 'setReturnPaymentState', returnItemId: 'r3', paymentState: 'Refunded' },
    ]);
    expect(() => planAdvance(ORDER, 'refund')).toThrow('No return item');
  });
});

describe('advance-order main', () => {
  it('posts the actions with the order version when the project is confirmed', async () => {
    const fake = api(ORDER);
    const lines: string[] = [];
    expect(await main(['--confirm-project', 'spec-test-b2c-telecom', '--order', 'MLV-ABC12345', '--deliver'], { api: fake, source: SOURCE, log: (line) => lines.push(line) })).toBe(EXIT.OK);
    expect(fake.posts).toEqual([{ path: 'orders/o1', body: { version: 7, actions: [{ action: 'changeShipmentState', shipmentState: 'Delivered' }] } }]);
    expect(lines).toEqual(['MLV-ABC12345: changeShipmentState Delivered']);
  });

  it('refuses without the project confirmation and for another project key, before any write', async () => {
    const fake = api(ORDER);
    const quiet = () => undefined;
    expect(await main(['--order', 'MLV-ABC12345', '--deliver'], { api: fake, source: SOURCE, log: quiet })).toBe(EXIT.TARGET_REFUSED);
    expect(await main(['--confirm-project', 'spec-test-b2c-telecom', '--order', 'MLV-ABC12345', '--deliver'], { api: fake, source: { ...SOURCE, CTP_SEED_PROJECT_KEY: 'production-shop' }, log: quiet })).toBe(EXIT.TARGET_REFUSED);
    expect(await main(['--confirm-project', 'production-shop', '--order', 'MLV-ABC12345', '--deliver'], { api: fake, source: { ...SOURCE, CTP_SEED_PROJECT_KEY: 'production-shop' }, log: quiet })).toBe(EXIT.TARGET_REFUSED);
    expect(fake.posts).toHaveLength(0);
  });

  it('needs an order and exactly one flag, and reports an unknown order', async () => {
    const fake = api(null);
    const lines: string[] = [];
    const log = (line: string) => lines.push(line);
    const base = ['--confirm-project', 'spec-test-b2c-telecom'];
    expect(await main([...base, '--deliver'], { api: fake, source: SOURCE, log })).toBe(EXIT.FAILED);
    expect(await main([...base, '--order', 'MLV-ABC12345'], { api: fake, source: SOURCE, log })).toBe(EXIT.FAILED);
    expect(await main([...base, '--order', 'MLV-ABC12345', '--deliver', '--refund'], { api: fake, source: SOURCE, log })).toBe(EXIT.FAILED);
    expect(await main([...base, '--order', 'MLV-ABC12345', '--deliver'], { api: fake, source: SOURCE, log })).toBe(EXIT.FAILED);
    expect(lines.at(-1)).toContain('No order MLV-ABC12345');
    expect(fake.posts).toHaveLength(0);
  });
});
