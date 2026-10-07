import type { ProductDraft } from '../../types';
import { ADDON_PRICES, monthlyPrices, TERM_KEY } from '../prices';
import { buildOffer } from './helpers';

export const addonOffers: ProductDraft[] = Object.entries(ADDON_PRICES).map(([key, price]) =>
  buildOffer({
    key,
    variants: [{ sku: price.sku, values: { 'contract-term': TERM_KEY.M2M, 'charge-type': 'monthly' }, prices: monthlyPrices(price.usd) }],
  }),
);
