// @vitest-environment node
import * as fx from '@/lib/offers/__fixtures__/offers';
import type { BuyerContext, CartLineRef, Market, Offer } from '@/lib/types';

const getAllOffers = vi.fn<(market: { locale: string }) => Promise<Offer[]>>();
const getSession = vi.fn<() => Promise<{ cartId?: string }>>();
const getCartLineRefs = vi.fn<(cartId: string) => Promise<CartLineRef[]>>();
const getBuyerContext = vi.fn<(market?: Market) => Promise<BuyerContext>>();
const { cartWrite } = vi.hoisted(() => ({ cartWrite: vi.fn() }));

vi.mock('@/lib/ct/catalog', () => ({ getAllOffers: (market: { locale: string }) => getAllOffers(market) }));
vi.mock('@/lib/ct/buyer-context', () => ({ getBuyerContext: (market?: Market) => getBuyerContext(market) }));
vi.mock('@/lib/ct/session', () => ({ getSession: () => getSession() }));
vi.mock('@/lib/ct/cart-context', () => ({ getCartLineRefs: (cartId: string) => getCartLineRefs(cartId), writeCart: cartWrite }));

import * as route from './route';

const buyer = (patch: Partial<BuyerContext> = {}): BuyerContext => ({
  customerType: 'consumer',
  isExistingCustomer: false,
  channel: 'online',
  now: new Date('2026-10-07T12:00:00Z'),
  held: [],
  signedIn: false,
  ...patch,
});

const post = (body: unknown) =>
  route.POST(new Request('http://localhost/api/offers/compatibility', { method: 'POST', headers: { 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  getAllOffers.mockResolvedValue(fx.ALL_OFFERS);
  getSession.mockResolvedValue({});
  getCartLineRefs.mockResolvedValue([]);
  getBuyerContext.mockResolvedValue(buyer());
});

describe('POST /api/offers/compatibility', () => {
  it('card mode answers with the verdict and the reasons', async () => {
    const res = await post({ offerKey: 'malva-offer-router-ac1200', planOfferKey: 'malva-offer-cable-gig' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ offerKey: 'malva-offer-router-ac1200', mode: 'card', verdict: { status: 'unavailable' } });
    expect(body.verdict.reasons[0]).toMatchObject({ code: 'SPEED_TOO_LOW', params: { max: 300, needed: 1000 }, messageKey: 'offers.reason.SPEED_TOO_LOW' });
    expect(getCartLineRefs).not.toHaveBeenCalled();
  });

  it('Server re-checks what the card allowed: an incompatible offer returns the reasons and no cart write function is called', async () => {
    const res = await post({ offerKey: 'malva-offer-device-protect', planOfferKey: 'malva-offer-cable-gig', override: true });
    expect((await res.json()).verdict.status).toBe('unavailable');
    expect(cartWrite).not.toHaveBeenCalled();
    expect(Object.keys(route)).toEqual(['POST']);
  });

  it('Catalog edit changes behaviour: a second request after the mocked catalog changes returns the new verdict', async () => {
    const request = { offerKey: 'malva-offer-router-ac1200', planOfferKey: 'malva-offer-cable-gig' };
    expect((await (await post(request)).json()).verdict.status).toBe('unavailable');
    getAllOffers.mockResolvedValue(fx.ALL_OFFERS.map((offer) => (offer.key === request.offerKey ? fx.withFacts(offer, { maxDownstreamMbps: 1000 }) : offer)));
    expect((await (await post(request)).json()).verdict.status).toBe('allowed');
  });

  it('cart mode uses the session cart and ignores a body cartId', async () => {
    getSession.mockResolvedValue({ cartId: 'session-cart' });
    getCartLineRefs.mockResolvedValue([{ lineItemId: 'NET', offerKey: 'malva-offer-cable-500', quantity: 1 }]);
    const res = await post({ offerKey: 'malva-offer-spotify', cartId: 'someone-elses-cart' });
    const body = await res.json();
    expect(getCartLineRefs).toHaveBeenCalledWith('session-cart');
    expect(body).toMatchObject({ mode: 'cart', verdict: { status: 'allowed', parentLineItemId: 'NET' } });
  });

  it('cart mode without a cart is PARENT_REQUIRED, and a requested parent is honoured', async () => {
    const empty = await (await post({ offerKey: 'malva-offer-appletv' })).json();
    expect(empty.verdict.reasons[0].code).toBe('PARENT_REQUIRED');
    expect(getCartLineRefs).not.toHaveBeenCalled();
    getSession.mockResolvedValue({ cartId: 'c' });
    getCartLineRefs.mockResolvedValue([
      { lineItemId: 'PH', offerKey: 'malva-offer-phone-essential', quantity: 1 },
      { lineItemId: 'NET', offerKey: 'malva-offer-cable-500', quantity: 1 },
    ]);
    expect((await (await post({ offerKey: 'malva-offer-spotify' })).json()).verdict.candidateParents).toEqual(['PH', 'NET']);
    expect((await (await post({ offerKey: 'malva-offer-spotify', parentLineItemId: 'PH' })).json()).verdict.parentLineItemId).toBe('PH');
  });

  it('a plan candidate in cart mode lists its conflicts', async () => {
    getSession.mockResolvedValue({ cartId: 'c' });
    getCartLineRefs.mockResolvedValue([{ lineItemId: 'NET', offerKey: 'malva-offer-cable-500', quantity: 1 }]);
    const body = await (await post({ offerKey: 'malva-offer-wireless-5g' })).json();
    expect(body.verdict.reasons[0].code).toBe('EXCLUSIVE_CONFLICT');
    expect(body.verdict.replaces[0].lineItemId).toBe('NET');
  });

  it('answers 400 for bad JSON and bad shapes', async () => {
    for (const bad of ['not json', {}, [], { offerKey: 'nope' }, { offerKey: 'malva-offer-spotify', planOfferKey: 5 }, { offerKey: 'malva-offer-spotify', locale: 'fr-FR' }]) {
      const res = await post(bad);
      expect(res.status).toBe(400);
      expect((await res.json()).error.code).toBe('VALIDATION');
    }
  });

  it('answers 404 for an unknown offer or plan', async () => {
    expect((await post({ offerKey: 'malva-offer-nope' })).status).toBe(404);
    const res = await post({ offerKey: 'malva-offer-spotify', planOfferKey: 'malva-offer-nope' });
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe('NOT_FOUND');
  });

  it('answers 502 when the catalog or the cart read fails', async () => {
    getAllOffers.mockRejectedValueOnce(new Error('timeout'));
    const res = await post({ offerKey: 'malva-offer-spotify' });
    expect(res.status).toBe(502);
    expect((await res.json()).error.code).toBe('UPSTREAM_ERROR');
    getSession.mockResolvedValue({ cartId: 'c' });
    getCartLineRefs.mockRejectedValueOnce(new Error('boom'));
    expect((await post({ offerKey: 'malva-offer-spotify' })).status).toBe(502);
  });

  it('reads the catalog of the requested locale market', async () => {
    await post({ offerKey: 'malva-offer-spotify', planOfferKey: 'malva-offer-cable-500', locale: 'de-DE' });
    expect(getAllOffers).toHaveBeenCalledWith({ locale: 'de-DE', currency: 'EUR', country: 'DE' });
  });

  describe('K checks (held services, exclusivity, eligibility)', () => {
    it('a held-service conflict returns HELD_SERVICE_CONFLICT without replaces', async () => {
      getBuyerContext.mockResolvedValue(buyer({ signedIn: true, held: [{ offerKey: 'malva-offer-cable-500', offerName: 'Cable 500', source: 'order', reference: 'MLV-1' }] }));
      const body = await (await post({ offerKey: 'malva-offer-wireless-5g' })).json();
      expect(body.verdict.status).toBe('unavailable');
      expect(body.verdict.reasons.map((reason: { code: string }) => reason.code)).toEqual(['HELD_SERVICE_CONFLICT']);
      expect(body.verdict.replaces).toBeUndefined();
    });

    it('a cart conflict returns one EXCLUSIVE_CONFLICT with replaces (J and K do not duplicate it), symmetric in both orders', async () => {
      getSession.mockResolvedValue({ cartId: 'c' });
      getCartLineRefs.mockResolvedValue([{ lineItemId: 'NET', offerKey: 'malva-offer-cable-500', quantity: 1 }]);
      const forward = (await (await post({ offerKey: 'malva-offer-wireless-5g' })).json()).verdict;
      expect(forward.reasons.map((reason: { code: string }) => reason.code)).toEqual(['EXCLUSIVE_CONFLICT']);
      expect(forward.replaces).toEqual([{ lineItemId: 'NET', offerKey: 'malva-offer-cable-500', offerName: 'Cable 500' }]);
      getCartLineRefs.mockResolvedValue([{ lineItemId: 'AIR', offerKey: 'malva-offer-wireless-5g', quantity: 1 }]);
      const backward = (await (await post({ offerKey: 'malva-offer-cable-500' })).json()).verdict;
      expect(backward.status).toBe('unavailable');
      expect(backward.replaces[0].lineItemId).toBe('AIR');
    });

    it('a non conflicting plan stays allowed with no reasons', async () => {
      getSession.mockResolvedValue({ cartId: 'c' });
      getCartLineRefs.mockResolvedValue([{ lineItemId: 'NET', offerKey: 'malva-offer-cable-500', quantity: 1 }]);
      const body = await (await post({ offerKey: 'malva-offer-phone-unlimited' })).json();
      expect(body.verdict).toMatchObject({ status: 'allowed', reasons: [] });
    });

    it('an ineligible candidate is unavailable with its reason, also next to J reasons', async () => {
      getAllOffers.mockResolvedValue(fx.ALL_OFFERS.map((offer) => (offer.key === 'malva-offer-cable-existing-customer' ? { ...offer, existingCustomer: 'existing' as const } : offer)));
      const anonymous = await (await post({ offerKey: 'malva-offer-cable-existing-customer' })).json();
      expect(anonymous.verdict.status).toBe('unavailable');
      expect(anonymous.verdict.reasons[0]).toMatchObject({ code: 'NOT_ELIGIBLE_EXISTING_CUSTOMER', params: { rule: 'existing' } });
      getBuyerContext.mockResolvedValue(buyer({ isExistingCustomer: true, signedIn: true }));
      expect((await (await post({ offerKey: 'malva-offer-cable-existing-customer' })).json()).verdict.status).toBe('allowed');
    });

    it('answers with the same shape, never writes and an override stays unavailable (absolute)', async () => {
      getBuyerContext.mockResolvedValue(buyer({ held: [{ offerKey: 'malva-offer-cable-500', offerName: 'Cable 500', source: 'recurring-order', reference: 'RO-1' }] }));
      const res = await post({ offerKey: 'malva-offer-wireless-5g', override: true });
      const body = await res.json();
      expect(Object.keys(body).sort()).toEqual(['mode', 'offerKey', 'verdict']);
      expect(body.verdict.status).toBe('unavailable');
      expect(cartWrite).not.toHaveBeenCalled();
    });

    it('resolves the buyer for the requested market', async () => {
      await post({ offerKey: 'malva-offer-spotify', planOfferKey: 'malva-offer-cable-500', locale: 'de-DE' });
      expect(getBuyerContext).toHaveBeenCalledWith({ locale: 'de-DE', currency: 'EUR', country: 'DE' });
    });
  });
});
