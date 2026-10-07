import type { ProductDraft } from '../../types';
import { monthlyPrices, PLAN_PRICES, TERM_KEY } from '../prices';
import { buildOffer, type OfferSpec } from './helpers';

const PHONE_OFFERS = ['malva-offer-phone-essential', 'malva-offer-phone-plus', 'malva-offer-phone-unlimited', 'malva-offer-phone-unlimited-max'];

export const PHONE_MAX_PRICE_STEPS = JSON.stringify([
  { fromMonth: 0, percentOff: 15 },
  { fromMonth: 12, percentOff: 10 },
  { fromMonth: 24, percentOff: 0 },
]);

const EXTRAS: Record<string, OfferSpec['extras']> = {
  'malva-offer-phone-unlimited-max': { 'price-steps': PHONE_MAX_PRICE_STEPS },
};

function phoneOffer(key: string, spec: Partial<OfferSpec> = {}): ProductDraft {
  return buildOffer({
    key,
    extras: EXTRAS[key],
    ...spec,
    variants: PLAN_PRICES[key].map((v) => ({
      sku: v.sku,
      values: { 'contract-term': TERM_KEY[v.term], 'charge-type': 'monthly' },
      prices: monthlyPrices(v.usd),
    })),
  });
}

/** Phone plans are sold per line: cart quantity 1 to 5 is the number of lines (D-014). */
export const phoneOffers: ProductDraft[] = PHONE_OFFERS.map((key) => phoneOffer(key));

/** The online-only offer (a channel offer): Unlimited at $45, sold in the `online` channel only. */
export const phoneOnlineOnlyOffer: ProductDraft = phoneOffer('malva-offer-phone-online-only', {
  name: { en: 'Unlimited, online only', de: 'Unlimited, nur online' },
  extras: { channels: ['online'] },
});
