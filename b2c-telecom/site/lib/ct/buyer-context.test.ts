// @vitest-environment node
import * as fx from '@/lib/offers/__fixtures__/offers';
import type { HeldService, Market } from '@/lib/types';

const cookieValue = vi.fn<() => string | undefined>();
vi.mock('next/headers', () => ({ cookies: async () => ({ get: (name: string) => (name === 'malva-postal-code' && cookieValue() !== undefined ? { name, value: cookieValue() } : undefined) }) }));
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
