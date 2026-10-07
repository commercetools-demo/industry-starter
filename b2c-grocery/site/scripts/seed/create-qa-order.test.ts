import { describe, it, expect, vi } from 'vitest';
import { DEFS, skuOf } from './data/catalog';
import { QA_PASSWORD, QA_SKUS, createQaOrder, parseArgs, qaCartDraft, qaCustomerDraft, qaEmail, qaOrderDraft, qaSlot, statusActions } from './create-qa-order';

describe('create-qa-order drafts', () => {
  it('QA email matches the cleanup pattern; the password is the fixed throwaway', () => {
    expect(qaEmail('abc123')).toBe('qa-abc123@example.com');
    expect(qaEmail()).toMatch(/^qa-.*@example\.com$/);
    expect(qaCustomerDraft('qa-x@example.com')).toMatchObject({ password: QA_PASSWORD, email: 'qa-x@example.com', defaultShippingAddress: 0 });
  });

  it('QA SKUs exist in the seeded catalog', () => {
    const skus = DEFS.flatMap((d) => d.variants.map((v) => skuOf(d.key, v)));
    for (const sku of QA_SKUS) expect(skus).toContain(sku);
  });

  it('slot is tomorrow 10:00-12:00 UTC with the YYYY-MM-DD-HH id', () => {
    expect(qaSlot(new Date('2026-10-12T23:30:00Z'))).toEqual({ slotId: '2026-10-13-10', slotStart: '2026-10-13T10:00:00.000Z', slotEnd: '2026-10-13T12:00:00.000Z' });
    expect(qaSlot(new Date('2026-12-31T08:00:00Z')).slotId).toBe('2027-01-01-10');
  });

  it('cart: customer, US market, standard shipping, two lines and the cart-delivery slot', () => {
    const cart = qaCartDraft('cust-1', 'qa-x@example.com', new Date('2026-10-12T09:00:00Z'));
    expect(cart).toMatchObject({ customerId: 'cust-1', currency: 'USD', country: 'US', inventoryMode: 'None', shippingMethod: { key: 'standard' } });
    expect(cart.lineItems?.map((l) => l.sku)).toEqual([...QA_SKUS]);
    expect(cart.custom).toMatchObject({ type: { key: 'cart-delivery' }, fields: { slotId: '2026-10-13-10' } });
  });

  it('order draft marks the order paid', () => {
    expect(qaOrderDraft({ id: 'c1', version: 5 }, 'QA-1')).toEqual({ cart: { typeId: 'cart', id: 'c1' }, version: 5, orderNumber: 'QA-1', paymentState: 'Paid', shipmentState: 'Pending' });
  });

  it('status actions follow the mapper table', () => {
    expect(statusActions('processing')).toEqual([]);
    expect(statusActions('packing')).toEqual([{ action: 'setShipmentState', shipmentState: 'Ready' }]);
    expect(statusActions('on-its-way')).toEqual([{ action: 'setShipmentState', shipmentState: 'Shipped' }]);
    expect(statusActions('delivered')[0]).toEqual({ action: 'setShipmentState', shipmentState: 'Delivered' });
    expect(statusActions('cancelled')).toEqual([{ action: 'changeOrderState', orderState: 'Cancelled' }]);
  });

  it('parseArgs: defaults, values and validation', () => {
    expect(parseArgs([])).toEqual({ status: 'processing', orders: 1 });
    expect(parseArgs(['--status', 'packing', '--orders', '3', '--final-cents', '1100'])).toEqual({ status: 'packing', orders: 3, finalCents: 1100 });
    expect(() => parseArgs(['--status', 'nope'])).toThrow();
    expect(() => parseArgs(['--orders', '0'])).toThrow();
    expect(() => parseArgs(['--final-cents', '-1'])).toThrow();
  });
});

describe('createQaOrder (mocked admin client)', () => {
  it('creates a customer, a cart and an order per requested order and applies the status', async () => {
    const calls: string[] = [];
    const exec = (name: string, body: unknown) => ({ execute: async () => (calls.push(name), { body }) });
    const root = {
      customers: () => ({ post: () => exec('customer', { customer: { id: 'cust-1' } }) }),
      carts: () => ({ post: () => exec('cart', { id: 'cart-1', version: 3 }) }),
      orders: () => ({
        post: () => exec('order', { id: 'order-1', version: 1 }),
        withId: () => ({ post: vi.fn(({ body }: { body: { actions: { action: string }[] } }) => exec(`update:${body.actions.map((a) => a.action).join('+')}`, { id: 'order-1', version: 2 })) }),
      }),
    };
    const result = await createQaOrder(root as never, { status: 'packing', orders: 2 });
    expect(result.customerId).toBe('cust-1');
    expect(result.orders).toHaveLength(2);
    expect(calls).toEqual(['customer', 'cart', 'order', 'update:setShipmentState', 'cart', 'order', 'update:setShipmentState']);
  });
});
