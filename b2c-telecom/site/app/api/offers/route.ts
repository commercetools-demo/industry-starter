/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { errorResponse, json } from '@/lib/ct/http';
import { listOffers } from '@/lib/ct/offers-api';
import { getMarket } from '@/lib/market/server';
import { OffersApiError, UPSTREAM_MESSAGE } from '@/lib/offers-api/errors';
import { parseFilters } from '@/lib/offers-api/filters';

export const dynamic = 'force-dynamic';

// GET /api/offers: the offers visible to this buyer, with the buyer's own prices (customer group and channel), filtered and paged.
// Never cached across buyers (`private, no-store`). An anonymous caller may try another context with customerType, existingCustomer and
// postalCode; a signed-in customer's account always governs.

const NO_STORE = { 'cache-control': 'private, no-store' };

export async function GET(request: Request) {
  try {
    const market = await getMarket();
    const filters = parseFilters(new URL(request.url).searchParams, market.country);
    let result;
    try {
      result = await listOffers(market, filters);
    } catch (error) {
      console.error(error);
      throw new OffersApiError('UPSTREAM_UNAVAILABLE', UPSTREAM_MESSAGE);
    }
    const response = json(result);
    response.headers.set('cache-control', NO_STORE['cache-control']);
    return response;
  } catch (error) {
    if (error instanceof OffersApiError) return json(error.toBody(), { status: error.status });
    return errorResponse(error);
  }
}
