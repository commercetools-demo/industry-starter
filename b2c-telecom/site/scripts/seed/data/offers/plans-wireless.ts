import type { ProductDraft } from '../../types';
import { monthlyPrices, PLAN_PRICES, TERM_KEY } from '../prices';
import { buildOffer, type OfferSpec } from './helpers';

const WIRELESS_OFFERS = ['malva-offer-wireless-lite', 'malva-offer-wireless-5g', 'malva-offer-wireless-5g-plus'];

const EXTRAS: Record<string, OfferSpec['extras']> = {
  'malva-offer-wireless-5g': { 'intro-free-months': 1 },
};

export const wirelessOffers: ProductDraft[] = WIRELESS_OFFERS.map((key) =>
  buildOffer({
    key,
    extras: EXTRAS[key],
    variants: PLAN_PRICES[key].map((v) => ({
      sku: v.sku,
      values: { 'contract-term': TERM_KEY[v.term], 'charge-type': 'monthly' },
      prices: monthlyPrices(v.usd),
    })),
  }),
);
