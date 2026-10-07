// @vitest-environment node
import * as fx from '@/lib/offers/__fixtures__/offers';
import type { CartLineRef, Offer } from '@/lib/types';

const getAllOffers = vi.fn<(market: { locale: string }) => Promise<Offer[]>>();
const getSession = vi.fn<() => Promise<{ cartId?: string }>>();
const getCartLineRefs = vi.fn<(cartId: string) => Promise<CartLineRef[]>>();
const { cartWrite } = vi.hoisted(() => ({ cartWrite: vi.fn() }));

vi.mock('@/lib/ct/catalog', () => ({ getAllOffers: (market: { locale: string }) => getAllOffers(market) }));
vi.mock('@/lib/ct/session', () => ({ getSession: () => getSession() }));
vi.mock('@/lib/ct/cart-context', () => ({ getCartLineRefs: (cartId: string) => getCartLineRefs(cartId), writeCart: cartWrite }));

import * as route from './route';

const post = (body: unknown) =>
  route.POST(new Request('http://localhost/api/offers/compatibility', { method: 'POST', headers: { 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  getAllOffers.mockResolvedValue(fx.ALL_OFFERS);
  getSession.mockResolvedValue({});
  getCartLineRefs.mockResolvedValue([]);
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
});
