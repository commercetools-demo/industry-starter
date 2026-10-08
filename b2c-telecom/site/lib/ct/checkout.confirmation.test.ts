// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ctLine, ctOrder, kindAttrs } from '@/test/fixtures/orders';
import { resetWorld, world } from '@/test/fixtures/checkoutWorld';

vi.mock('@/lib/ct/cart', async () => (await import('@/test/fixtures/checkoutWorld')).cartMock());
vi.mock('@/lib/ct/bundle', async () => (await import('@/test/fixtures/checkoutWorld')).bundleMock());
vi.mock('@/lib/ct/serviceability', async () => (await import('@/test/fixtures/checkoutWorld')).serviceabilityMock());
vi.mock('@/lib/ct/client', async () => (await import('@/test/fixtures/checkoutWorld')).clientMock());
vi.mock('@/lib/ct/devices', async () => (await import('@/test/fixtures/checkoutWorld')).devicesMock());
vi.mock('@/lib/ct/order-stamp', async () => (await import('@/test/fixtures/checkoutWorld')).stampMock());
vi.mock('@/lib/ct/checkout-session', async () => (await import('@/test/fixtures/checkoutWorld')).checkoutSessionMock());
vi.mock('@/lib/ct/customer', async () => (await import('@/test/fixtures/checkoutWorld')).customerMock());

import { getOrderForConfirmation, resolveReturnTarget } from './checkout';

const NUMBER = 'MLV-7K3F9QXD';
const lines = [ctLine({ id: 'l1', productKey: 'malva-offer-cable-500', sku: 'MLV-CBL-500-24M', name: 'Cable 500', total: 5999, recurring: 'Fixed', attributes: kindAttrs('base-package', 'cable') })];

function stored(patch: { customerId?: string | null; stamped?: boolean; orderState?: string } = {}) {
  const order = ctOrder({ orderNumber: NUMBER, total: 5999, lines, customerId: patch.customerId === undefined ? 'cust-1' : patch.customerId, ...(patch.orderState ? { orderState: patch.orderState } : {}), fields: patch.stamped === false ? {} : { serviceStartDate: '2026-10-12' } });
  const raw = { ...order, ...(patch.stamped === false ? { custom: undefined } : {}), customerEmail: 'alex@example.com', paymentState: 'Paid' } as unknown as Record<string, unknown>;
  world.orders.push(raw);
  return raw;
}

beforeEach(() => resetWorld());

describe('getOrderForConfirmation', () => {
  it('an unknown or malformed number is null', async () => {
    expect(await getOrderForConfirmation({}, NUMBER)).toBeNull();
    stored();
    expect(await getOrderForConfirmation({}, 'bad')).toBeNull();
  });

  it('the owner gets the full view with the contact email and the payment state', async () => {
    stored();
    const view = await getOrderForConfirmation({ customerId: 'cust-1' }, NUMBER);
    expect(view).toMatchObject({ full: true, owner: true, email: 'alex@example.com', isGuest: false, paymentState: 'Paid' });
    expect(view?.order.orderNumber).toBe(NUMBER);
  });

  it('the session that placed a guest order gets the full view, flagged as guest, and is not an owner', async () => {
    stored({ customerId: null });
    const view = await getOrderForConfirmation({ lastOrderNumber: NUMBER }, NUMBER);
    expect(view).toMatchObject({ full: true, owner: false, isGuest: true });
  });

  it('anyone else with the number gets the limited view: no email', async () => {
    stored();
    const view = await getOrderForConfirmation({ customerId: 'someone-else' }, NUMBER);
    expect(view).toMatchObject({ full: false, owner: false, email: null });
  });

  it('a paid order without its stamp is finalized on its first view (lazy path) and read again', async () => {
    stored({ stamped: false });
    const view = await getOrderForConfirmation({ customerId: 'cust-1' }, NUMBER);
    expect(world.stamped).toHaveLength(1);
    expect(view?.order.serviceStartDate).toBe('2026-10-12');
  });

  it('a stamped order is not finalized again', async () => {
    stored();
    await getOrderForConfirmation({ customerId: 'cust-1' }, NUMBER);
    expect(world.stamped).toEqual([]);
  });
});

describe('resolveReturnTarget', () => {
  it('uses a valid order number as is, else looks the order up by id, else null', async () => {
    expect(await resolveReturnTarget({ orderNumber: NUMBER })).toBe(NUMBER);
    expect(await resolveReturnTarget({ orderNumber: 'nope' })).toBeNull();
    world.orders.push({ id: 'o-9', orderNumber: NUMBER });
    expect(await resolveReturnTarget({ orderId: 'o-9' })).toBe(NUMBER);
    expect(await resolveReturnTarget({ orderId: 'missing' })).toBeNull();
  });
});
