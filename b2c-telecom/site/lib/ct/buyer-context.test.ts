/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// @vitest-environment node
import * as fx from '@/lib/offers/__fixtures__/offers';
import type { HeldService, Market } from '@/lib/types';

const cookieValue = vi.fn<() => string | undefined>();
const declaredValue = vi.fn<() => string | undefined>();
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = name === 'malva-postal-code' ? cookieValue() : name === 'malva-buyer-context' ? declaredValue() : undefined;
      return value === undefined ? undefined : { name, value };
    },
  }),
}));
const getSession = vi.fn<() => Promise<{ customerId?: string }>>();
vi.mock('./session', () => ({ getSession: () => getSession() }));
const customerExecute = vi.fn();
const withId = vi.fn<(args: { ID: string }) => { get: () => { execute: typeof customerExecute } }>(() => ({ get: () => ({ execute: customerExecute }) }));
vi.mock('./client', () => ({ getApiRoot: () => ({ customers: () => ({ withId }) }) }));
vi.mock('./timeout', () => ({ withTimeout: (promise: Promise<unknown>) => promise }));
const getAllOffers = vi.fn();
vi.mock('./catalog', () => ({ getAllOffers: (market: Market) => getAllOffers(market) }));
const getHoldings = vi.fn<(customerId: string) => Promise<HeldService[]>>();
vi.mock('./holdings', () => ({ getHoldings: (customerId: string) => getHoldings(customerId) }));
const getCustomerGroupKeys = vi.fn<() => Promise<Record<string, string>>>();
vi.mock('./customer-groups', () => ({ getCustomerGroupKeys: () => getCustomerGroupKeys() }));

import { getBuyerContext } from './buyer-context';

const DE: Market = { locale: 'de-DE', currency: 'EUR', country: 'DE' };
const held = (offerKey: string): HeldService => ({ offerKey, offerName: offerKey, source: 'order', reference: 'MLV-1' });

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  cookieValue.mockReturnValue(undefined);
  declaredValue.mockReturnValue(undefined);
  getSession.mockResolvedValue({});
  getAllOffers.mockResolvedValue(fx.ALL_OFFERS);
  getHoldings.mockResolvedValue([]);
  getCustomerGroupKeys.mockResolvedValue({ g1: 'employee', g2: 'existing-customer', g3: 'small-business' });
  customerExecute.mockResolvedValue({ body: {} });
});

describe('getBuyerContext', () => {
  it('anonymous: consumer, not an existing customer, channel online, nothing held, no location', async () => {
    const buyer = await getBuyerContext();
    expect(buyer).toMatchObject({ customerType: 'consumer', isExistingCustomer: false, channel: 'online', held: [], signedIn: false });
    expect(buyer.location).toBeUndefined();
    expect(buyer.now).toBeInstanceOf(Date);
    expect(withId).not.toHaveBeenCalled();
  });

  it('anonymous: the declared type and existing-customer answer come from the cookie; no answer is not the same as no', async () => {
    expect(await getBuyerContext()).toMatchObject({ customerType: 'consumer', isExistingCustomer: false, existingUnspecified: true });
    declaredValue.mockReturnValue('employee:yes');
    expect(await getBuyerContext()).toMatchObject({ customerType: 'employee', isExistingCustomer: true, existingUnspecified: false });
    declaredValue.mockReturnValue('small-business:no');
    expect(await getBuyerContext()).toMatchObject({ customerType: 'small-business', isExistingCustomer: false, existingUnspecified: false });
  });

  it('a forged cookie value is ignored', async () => {
    declaredValue.mockReturnValue('root:yes');
    expect(await getBuyerContext()).toMatchObject({ customerType: 'consumer', isExistingCustomer: true });
  });

  it('signed in: the account governs and the declaration is ignored', async () => {
    declaredValue.mockReturnValue('employee:yes');
    getSession.mockResolvedValue({ customerId: 'c1' });
    expect(await getBuyerContext()).toMatchObject({ customerType: 'consumer', isExistingCustomer: false, existingUnspecified: false, signedIn: true });
  });

  it('resolves the remembered ZIP for the market country and ignores an invalid cookie', async () => {
    cookieValue.mockReturnValue('60601');
    expect((await getBuyerContext()).location).toMatchObject({ postalCode: '60601', country: 'US', served: { cable: true, 'fixed-wireless': false, mobile: true } });
    expect((await getBuyerContext(DE)).location).toMatchObject({ postalCode: '60601', country: 'DE' }); // five digits are valid for DE too
    cookieValue.mockReturnValue('abc');
    expect((await getBuyerContext()).location).toBeUndefined();
  });

  it('signed in: customer groups map to the type (assignments included), employee wins', async () => {
    getSession.mockResolvedValue({ customerId: 'c1' });
    customerExecute.mockResolvedValue({ body: { customerGroup: { id: 'g3' }, customerGroupAssignments: [{ customerGroup: { id: 'g1' } }, { customerGroup: { id: 'unknown' } }] } });
    const buyer = await getBuyerContext();
    expect(buyer).toMatchObject({ customerType: 'employee', signedIn: true, isExistingCustomer: false });
    expect(withId).toHaveBeenCalledWith({ ID: 'c1' });
  });

  it('the call-center group puts a signed-in customer in the call-center channel; a visitor is always online', async () => {
    getCustomerGroupKeys.mockResolvedValue({ g1: 'employee', g2: 'existing-customer', g3: 'small-business', g4: 'call-center' });
    getSession.mockResolvedValue({ customerId: 'c1' });
    customerExecute.mockResolvedValue({ body: { customerGroup: { id: 'g4' } } });
    expect(await getBuyerContext()).toMatchObject({ channel: 'call-center', groupKeys: ['call-center'], customerType: 'consumer' });
    getSession.mockResolvedValue({});
    declaredValue.mockReturnValue('employee:no');
    expect(await getBuyerContext()).toMatchObject({ channel: 'online', groupKeys: ['employee'] });
  });

  it('the existing-customer group sets existing', async () => {
    getSession.mockResolvedValue({ customerId: 'c1' });
    customerExecute.mockResolvedValue({ body: { customerGroup: { id: 'g2' } } });
    expect(await getBuyerContext()).toMatchObject({ customerType: 'consumer', isExistingCustomer: true });
  });

  it('one held service sets existing and is exposed', async () => {
    getSession.mockResolvedValue({ customerId: 'c1' });
    getHoldings.mockResolvedValue([held('malva-offer-cable-500')]);
    const buyer = await getBuyerContext();
    expect(buyer.isExistingCustomer).toBe(true);
    expect(buyer.held.map((service) => service.offerKey)).toEqual(['malva-offer-cable-500']);
  });

  it('a customer read failure falls back to the anonymous context (signedIn true) without throwing', async () => {
    getSession.mockResolvedValue({ customerId: 'c1' });
    customerExecute.mockRejectedValue({ statusCode: 500 });
    const buyer = await getBuyerContext();
    expect(buyer).toMatchObject({ customerType: 'consumer', isExistingCustomer: false, held: [], signedIn: true });
  });
});
