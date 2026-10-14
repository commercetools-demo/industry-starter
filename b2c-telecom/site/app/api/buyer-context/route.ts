/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { ApiError } from '@/lib/api-error';
import { assertSameOrigin } from '@/lib/auth/origin';
import { BUYER_CONTEXT_COOKIE, BUYER_CONTEXT_COOKIE_MAX_AGE } from '@/lib/config/eligibility';
import { getBuyerContext } from '@/lib/ct/buyer-context';
import { getActiveCartForSession, setCartCustomerGroup } from '@/lib/ct/cart';
import { errorResponse, json } from '@/lib/ct/http';
import { getSession } from '@/lib/ct/session';
import { getMarket } from '@/lib/market/server';
import { cartGroupKeyOf, isCustomerType, isDeclaredExisting, serializeDeclared, type DeclaredExisting } from '@/lib/offers/declared';
import type { BuyerContext, CustomerType, ServiceLocation } from '@/lib/types';

export const dynamic = 'force-dynamic';

// The buyer context bar of the plan finder reads and writes the visitor's declaration here. An anonymous visitor's declaration is kept
// in an HttpOnly cookie and applied to their cart as its customer group; a signed-in customer's account governs and a declaration is
// ignored (answered with `fromAccount: true`). The location is not stored here: it has its own routes (/api/serviceability, /api/cart/address).

export interface BuyerContextView {
  customerType: CustomerType;
  existingCustomer: DeclaredExisting;
  /** Customer type and existing-customer come from the signed-in account and cannot be changed here. */
  fromAccount: boolean;
  location: ServiceLocation | null;
}

const viewOf = (buyer: BuyerContext): BuyerContextView => ({
  customerType: buyer.customerType,
  existingCustomer: buyer.isExistingCustomer ? 'yes' : buyer.existingUnspecified ? 'unspecified' : 'no',
  fromAccount: buyer.signedIn,
  location: buyer.location ?? null,
});

export async function GET() {
  try {
    return json({ context: viewOf(await getBuyerContext(await getMarket())) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ApiError('VALIDATION', 'The request body must be JSON.');
    }
    if (typeof body !== 'object' || body === null || Array.isArray(body)) throw new ApiError('VALIDATION', 'The request body must be a JSON object.');
    const { customerType, existingCustomer } = body as Record<string, unknown>;
    if (customerType !== undefined && !isCustomerType(customerType)) throw new ApiError('VALIDATION', 'customerType is not one of consumer, small-business, employee.');
    if (existingCustomer !== undefined && !isDeclaredExisting(existingCustomer)) throw new ApiError('VALIDATION', 'existingCustomer is not one of yes, no, unspecified.');

    const market = await getMarket();
    const before = await getBuyerContext(market);
    if (before.signedIn) return json({ context: viewOf(before) });

    const declared = {
      customerType: customerType ?? before.customerType,
      existing: existingCustomer ?? (before.isExistingCustomer ? 'yes' : before.existingUnspecified ? 'unspecified' : 'no'),
    } as const;
    const view: BuyerContextView = { customerType: declared.customerType, existingCustomer: declared.existing, fromAccount: false, location: before.location ?? null };

    // The anonymous cart carries the declared audience as its customer group, so eligibility, prices and discounts agree.
    const session = await getSession();
    const cart = session.cartId ? await getActiveCartForSession(session, market) : null;
    if (cart) await setCartCustomerGroup(cart, cartGroupKeyOf({ signedIn: false, customerType: declared.customerType, isExistingCustomer: declared.existing === 'yes' }));

    const response = json({ context: view });
    response.cookies.set(BUYER_CONTEXT_COOKIE, serializeDeclared(declared), {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: process.env.NODE_ENV === 'production',
      maxAge: BUYER_CONTEXT_COOKIE_MAX_AGE,
    });
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
