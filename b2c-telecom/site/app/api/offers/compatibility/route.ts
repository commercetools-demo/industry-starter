import { ApiError } from '@/lib/api-error';
import { isLocale, marketFromLocale } from '@/lib/config/markets';
import { getCartLineRefs } from '@/lib/ct/cart-context';
import { getAllOffers } from '@/lib/ct/catalog';
import { errorResponse, json } from '@/lib/ct/http';
import { getSession } from '@/lib/ct/session';
import { evaluateAddition } from '@/lib/offers/compat';
import type { CartLineRef, Locale, Offer } from '@/lib/types';

// Answers "may this offer be added?" for the plan card (card mode) or the session cart (cart mode). Read-only: it never
// writes a cart, and there is no override parameter (D-022). The cart id comes from the session, never from the body (IDOR).

const OFFER_KEY = /^malva-offer-[a-z0-9-]+$/;
const invalid = (message: string) => new ApiError('VALIDATION', message);

interface Parsed {
  offerKey: string;
  planOfferKey?: string;
  parentLineItemId?: string;
  locale: Locale;
}

function parse(body: unknown): Parsed {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) throw invalid('Expected a JSON object');
  const { offerKey, planOfferKey, parentLineItemId, locale } = body as Record<string, unknown>;
  if (typeof offerKey !== 'string' || !OFFER_KEY.test(offerKey)) throw invalid('offerKey is required');
  if (planOfferKey !== undefined && (typeof planOfferKey !== 'string' || !OFFER_KEY.test(planOfferKey))) throw invalid('planOfferKey is invalid');
  if (parentLineItemId !== undefined && (typeof parentLineItemId !== 'string' || parentLineItemId === '')) throw invalid('parentLineItemId is invalid');
  if (locale !== undefined && !isLocale(locale)) throw invalid('Unsupported locale');
  return { offerKey, planOfferKey, parentLineItemId, locale: locale ?? 'en-US' };
}

export async function POST(request: Request) {
  try {
    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      throw invalid('Invalid JSON');
    }
    const input = parse(raw);

    let offers: Offer[];
    try {
      offers = await getAllOffers(marketFromLocale(input.locale));
    } catch (error) {
      console.error(error);
      throw new ApiError('UPSTREAM_ERROR', 'The catalog is temporarily unavailable');
    }
    const offersByKey = Object.fromEntries(offers.map((offer) => [offer.key, offer]));
    const candidate = offersByKey[input.offerKey];
    if (!candidate) throw new ApiError('NOT_FOUND', 'Offer not found');
    const planOffer = input.planOfferKey === undefined ? undefined : offersByKey[input.planOfferKey];
    if (input.planOfferKey !== undefined && !planOffer) throw new ApiError('NOT_FOUND', 'Plan offer not found');

    let cart: CartLineRef[] = [];
    if (!planOffer) {
      const { cartId } = await getSession();
      try {
        cart = cartId ? await getCartLineRefs(cartId) : [];
      } catch (error) {
        console.error(error);
        throw new ApiError('UPSTREAM_ERROR', 'The cart is temporarily unavailable');
      }
    }

    const verdict = evaluateAddition({ candidate, cart, planOffer, requestedParentLineItemId: input.parentLineItemId, offersByKey });
    return json({ offerKey: candidate.key, mode: planOffer ? 'card' : 'cart', verdict });
  } catch (error) {
    return errorResponse(error);
  }
}
