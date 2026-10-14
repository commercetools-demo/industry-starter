// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signOrderAccessToken } from '@/lib/order-access';
import type { Session } from '@/lib/types';

const state = vi.hoisted(() => ({ session: {} as Session }));
const getOrder = vi.hoisted(() => vi.fn());
const getRecurring = vi.hoisted(() => vi.fn());
const getShellContext = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));
vi.mock('next-intl/server', () => ({ setRequestLocale: () => undefined, getTranslations: async () => (key: string) => key }));
vi.mock('@/lib/session', () => ({ getSession: async () => state.session }));
vi.mock('@/lib/ct/orders', () => ({ getOrderForConfirmation: getOrder, getRecurringOrderForOrder: getRecurring }));
vi.mock('@/lib/ct/shell', () => ({ getShellContext }));
vi.mock('@/components/order/OrderConfirmation', () => ({ OrderConfirmation: () => null }));

import Page, { generateMetadata } from './page';

const STORE = 'mau-reseller-north';
const NUMBER = 'MA-0123ABCD';
const params = (store = STORE, locale = 'en-US') => Promise.resolve({ locale, store, orderNumber: NUMBER });
const search = (query: Record<string, string> = {}) => Promise.resolve(query);
const branch = { key: 'mau-br-north-berlin', channelId: 'ch', name: 'Malva Berlin', address: { street: 'Hauptstr. 1', postalCode: '10115', city: 'Berlin' }, hours: {}, timezone: 'Europe/Berlin', pickupMode: 'same-day' };
const money = (centAmount: number) => ({ centAmount, currencyCode: 'EUR', fractionDigits: 2 });
const order = (extra: Record<string, unknown> = {}) => ({
  id: 'o-1',
  orderNumber: NUMBER,
  customerEmail: 'qa-p1@example.com',
  anonymousId: 'anon-1',
  store: { key: STORE },
  orderState: 'Open',
  paymentState: 'Paid',
  totalPrice: money(1000),
  lineItems: [{ id: 'l', name: { 'en-US': 'Disc' }, quantity: 1, price: { value: money(1000) }, totalPrice: money(1000), variant: { sku: 's' } }],
  shippingInfo: { price: money(0), shippingMethod: { obj: { key: 'mau-ship-pickup' } } },
  custom: { fields: { pickupBranchKey: 'mau-br-north-berlin' } },
  ...extra,
});
const render = async (query?: Record<string, string>, store = STORE) => (await Page({ params: params(store), searchParams: search(query) })) as { props: Record<string, unknown> };

beforeEach(() => {
  state.session = { storeKey: STORE, anonymousId: 'anon-1' };
  getOrder.mockReset().mockResolvedValue(order());
  getRecurring.mockReset().mockResolvedValue(null);
  getShellContext.mockReset().mockResolvedValue({ branches: [branch], settings: { name: 'Malva North', shipDays: { min: 2, max: 3 }, timezone: 'Europe/Berlin' } });
});

describe('confirmation page', () => {
  it('refresh shows same order', async () => {
    const first = await render();
    const second = await render();
    expect((first.props.view as { number: string }).number).toBe(NUMBER);
    expect((second.props.view as { number: string }).number).toBe(NUMBER);
    expect(getOrder).toHaveBeenCalledWith(STORE, NUMBER);
  });
  it('other buyer gets 404', async () => {
    state.session = { storeKey: STORE, anonymousId: 'someone-else', customerId: 'c-2' };
    await expect(render()).rejects.toThrow('NEXT_NOT_FOUND');
  });
  it('token holder sees order', async () => {
    state.session = { storeKey: STORE, anonymousId: 'someone-else' };
    const token = await signOrderAccessToken({ orderId: 'o-1', storeKey: STORE });
    const element = await render({ t: token });
    expect(element.props.viewer).toBe('guest');
    expect(element.props.privatePath).toBe(`/en-US/${STORE}/checkout/confirmation/${NUMBER}?t=${token}`);
  });
  it('a token for another order gets 404', async () => {
    state.session = { storeKey: STORE, anonymousId: 'someone-else' };
    await expect(render({ t: await signOrderAccessToken({ orderId: 'o-2', storeKey: STORE }) })).rejects.toThrow('NEXT_NOT_FOUND');
  });
  it('unknown number gets 404 the same way as a stranger', async () => {
    getOrder.mockResolvedValue(null);
    await expect(render()).rejects.toThrow('NEXT_NOT_FOUND');
  });
  it('an order of another store gets 404', async () => {
    getOrder.mockResolvedValue(order({ store: { key: 'mau-other' } }));
    await expect(render()).rejects.toThrow('NEXT_NOT_FOUND');
  });
  it('the same browser gets a private link even without a token in the address', async () => {
    const element = await render();
    expect(element.props.viewer).toBe('guest');
    expect(String(element.props.privatePath)).toMatch(/\?t=ey/);
  });
  it('the signed-in owner gets view order and no private link', async () => {
    getOrder.mockResolvedValue(order({ customerId: 'c-1' }));
    state.session = { storeKey: STORE, customerId: 'c-1' };
    const element = await render();
    expect(element.props.viewer).toBe('owner');
    expect(element.props.privatePath).toBeNull();
  });
  it('a link holder of an order with an account is not offered account creation', async () => {
    getOrder.mockResolvedValue(order({ customerId: 'c-1' }));
    state.session = { storeKey: STORE, anonymousId: 'someone-else' };
    const element = await render({ t: await signOrderAccessToken({ orderId: 'o-1', storeKey: STORE }) });
    expect(element.props.viewer).toBe('holder');
  });
  it('pickup facts come from the branch of the order', async () => {
    const element = await render();
    expect((element.props.view as { pickup: { branchName: string } }).pickup.branchName).toBe('Malva Berlin');
  });
  it('the recurring order is read only for subscription orders', async () => {
    await render();
    expect(getRecurring).not.toHaveBeenCalled();
    getOrder.mockResolvedValue(order({ lineItems: [{ ...(order().lineItems[0] as object), recurrenceInfo: { recurrencePolicy: { id: 'rp' } } }] }));
    await render();
    expect(getRecurring).toHaveBeenCalledWith('o-1');
  });
  it('an unsupported locale gets 404', async () => {
    await expect(Page({ params: params(STORE, 'fr-FR'), searchParams: search() })).rejects.toThrow('NEXT_NOT_FOUND');
  });
  it('metadata is noindex and no-referrer', async () => {
    const meta = await generateMetadata({ params: params(), searchParams: search() });
    expect(meta.robots).toEqual({ index: false, follow: false });
    expect(meta.referrer).toBe('no-referrer');
  });
});
