/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { errorResponse, json } from '@/lib/ct/http';
import { getOfferDetail } from '@/lib/ct/offers-api';
import { getMarket } from '@/lib/market/server';
import { OffersApiError, UPSTREAM_MESSAGE } from '@/lib/offers-api/errors';

export const dynamic = 'force-dynamic';

// GET /api/offers/[key]: one offer with its three resolved groups (included, compatible add-ons, compatible equipment), each item with the
// buyer's price and the verdict of the shared compatibility evaluation. An offer the buyer may not see is as absent as an unknown key.

const KEY = /^malva-offer-[a-z0-9-]+$/;

export async function GET(_request: Request, context: { params: Promise<{ key: string }> }) {
  try {
    const { key } = await context.params;
    if (!KEY.test(key)) throw new OffersApiError('OFFER_NOT_FOUND', 'Offer not found.');
    const market = await getMarket();
    let detail;
    try {
      detail = await getOfferDetail(market, key);
    } catch (error) {
      console.error(error);
      throw new OffersApiError('UPSTREAM_UNAVAILABLE', UPSTREAM_MESSAGE);
    }
    if (!detail) throw new OffersApiError('OFFER_NOT_FOUND', 'Offer not found.');
    const response = json(detail);
    response.headers.set('cache-control', 'private, no-store');
    return response;
  } catch (error) {
    if (error instanceof OffersApiError) return json(error.toBody(), { status: error.status });
    return errorResponse(error);
  }
}
