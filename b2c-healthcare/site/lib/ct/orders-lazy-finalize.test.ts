// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkoutCreatesOrder } from '@/test/checkout-flow';
import { createFakeObjects, type FakeObjects } from '@/test/fake-custom-objects';
import { createFakeShop, type FakeShop } from '@/test/fake-shop';
import type { Prescription } from '@/lib/clinical/types';

let shop: FakeShop;
let objects: FakeObjects;
vi.mock('@/lib/ct/client', () => ({
  apiRoot: new Proxy({}, { get: (_t, p) => (p === 'customObjects' ? objects.customObjects : (shop.apiRoot as Record<string, unknown>)[p as string]) }),
}));
vi.mock('@/lib/ct/patient', () => ({ getPatient: async () => ({ patientRef: 'pt_sam', name: 'Sam Rivera' }) }));
vi.mock('@/lib/ct/rx-catalog', () => ({ getCatalogBySku: async () => new Map() }));
vi.mock('@/lib/ct/prescriptions', () => ({ RxNotFoundError: class extends Error {}, validateRxSelection: vi.fn(), findOwnPrescription: vi.fn() }));
vi.mock('@/lib/ct/fixtures', () => ({ loadCheckoutFixtures: async () => null, loadFundingFixtures: async () => null, loadDevRoot: async () => null, loadRxFixtures: async () => null }));
vi.mock('@/lib/checkout/provider', () => ({ getPaymentProvider: async () => ({ kind: 'demo', release: vi.fn(), refund: vi.fn() }) }));

import { CONTAINERS } from '@/lib/ct/custom-objects';
import { getOrderForCustomer, listOrdersForCustomer, orderBelongsTo } from './orders-read';

const rx = (): Prescription => ({ number: 'RX-77102', patientRef: 'pt_sam', prescriber: 'Dr. Test', issuedAt: '2026-09-24', refillsLeft: 3, lines: [{ lineRef: 'RX-77102-1', sku: 'MED-ator', name: 'A', sig: 'sig', qty: 30 }] });
const refills = () => (objects.objects.find((o) => o.container === CONTAINERS.rx)!.value as Prescription).refillsLeft;

beforeEach(() => {
  shop = createFakeShop();
  objects = createFakeObjects();
  objects.objects.push({ id: 'o-rx', container: CONTAINERS.rx, key: 'RX-77102', version: 1, value: rx(), createdAt: '', lastModifiedAt: '' });
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('order-confirmation-page: an order Checkout created is finalized when it is read (AA)', () => {
  it('Revisited later: the browser never called back, so reading the order gives it its MLV- number and state and consumes the prescription once', async () => {
    const cart = shop.seedCart();
    const order = await checkoutCreatesOrder(shop, cart.id);
    expect(shop.orders[0].orderNumber).toBeUndefined();
    const first = await getOrderForCustomer(order.id, 'c-sam', 'en-US');
    expect(first).toMatchObject({ orderNumber: 'MLV-000001', status: 'received' });
    // A second read (and the browser callback arriving late) change nothing.
    expect(await getOrderForCustomer(order.id, 'c-sam', 'en-US')).toMatchObject({ orderNumber: 'MLV-000001' });
    expect(refills()).toBe(2);
  });

  it('the order list finalizes what is not finalized yet, and an order that is already complete is not touched again', async () => {
    const a = await checkoutCreatesOrder(shop, shop.seedCart().id);
    const list = await listOrdersForCustomer('c-sam', 'en-US');
    expect(list.map((o) => o.orderNumber)).toEqual(['MLV-000001']);
    const versionBefore = shop.orders[0].version;
    await listOrdersForCustomer('c-sam', 'en-US');
    expect(shop.orders[0].version).toBe(versionBefore);
    expect(a.id).toBe(shop.orders[0].id);
  });

  it('another customer\'s order is still not found, and is not finalized for them', async () => {
    const order = await checkoutCreatesOrder(shop, shop.seedCart().id);
    expect(await getOrderForCustomer(order.id, 'c-alex', 'en-US')).toBeNull();
    expect(shop.orders[0].orderNumber).toBeUndefined();
    expect(await orderBelongsTo(order.id, 'c-alex')).toBe(false);
    expect(await orderBelongsTo(order.id, 'c-sam')).toBe(true);
  });
});
