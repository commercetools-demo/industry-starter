/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { ApiError } from '@/lib/api-error';
import { assertSameOrigin } from '@/lib/auth/origin';
import { RATE_LIMITS } from '@/lib/config/rateLimits';
import { json } from '@/lib/ct/http';
import { previewPricing } from '@/lib/ct/pricing-preview';
import { getSession } from '@/lib/ct/session';
import { getMarket } from '@/lib/market/server';
import { OffersApiError, UPSTREAM_MESSAGE } from '@/lib/offers-api/errors';
import { parsePreview } from '@/lib/offers-api/preview';
import { clientKey, rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

// POST /api/pricing/preview: prices a plan and its extras through the commercetools engine in one throwaway cart (deleted afterwards) and
// answers dueToday, thenMonthly, lines, promotions and issues. It creates nothing persistent and never changes the buyer's own cart.
// Same-origin and rate limit are checked before any commercetools call.

function toError(error: unknown): OffersApiError {
  if (error instanceof OffersApiError) return error;
  if (error instanceof ApiError && error.code === 'FORBIDDEN') return new OffersApiError('FORBIDDEN', 'Request origin not allowed.');
  console.error(error);
  return new OffersApiError('UPSTREAM_UNAVAILABLE', UPSTREAM_MESSAGE);
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const limited = rateLimit(clientKey(request, 'pricing-preview'), RATE_LIMITS.pricingPreview);
    if (!limited.ok) throw new OffersApiError('RATE_LIMITED', 'Too many requests. Try again shortly.', { retryAfterSeconds: limited.retryAfterSeconds });
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new OffersApiError('INVALID_REQUEST', 'The request body must be JSON.');
    }
    const input = parsePreview(body);
    const [session, market] = await Promise.all([getSession(), getMarket()]);
    return json(await previewPricing(session, market, input));
  } catch (caught) {
    const error = toError(caught);
    const headers: Record<string, string> = {};
    if (error.code === 'RATE_LIMITED' && typeof error.details?.retryAfterSeconds === 'number') headers['retry-after'] = String(error.details.retryAfterSeconds);
    return json(error.toBody(), { status: error.status, headers });
  }
}
