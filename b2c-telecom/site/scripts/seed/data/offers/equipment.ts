/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import type { ProductDraft } from '../../types';
import { EQUIPMENT_PRICES, monthlyPrices, oneTimePrices, TERM_KEY } from '../prices';
import { buildOffer, type OfferVariantSpec } from './helpers';

/** Rental variant first (the master, monthly price) then purchase (one-time price); the 5G gateway is rental only. */
export const equipmentOffers: ProductDraft[] = Object.entries(EQUIPMENT_PRICES).map(([key, price]) => {
  const variants: OfferVariantSpec[] = [
    { sku: price.rent.sku, values: { 'contract-term': TERM_KEY.M2M, 'charge-type': 'monthly-rental' }, prices: monthlyPrices(price.rent.usd) },
  ];
  if (price.buy) {
    variants.push({ sku: price.buy.sku, values: { 'contract-term': TERM_KEY.M2M, 'charge-type': 'one-time' }, prices: oneTimePrices(price.buy.usd) });
  }
  return buildOffer({ key, variants });
});
