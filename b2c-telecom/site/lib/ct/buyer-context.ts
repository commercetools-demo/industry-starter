/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import 'server-only';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { marketFromLocale } from '@/lib/config/markets';
import { BUYER_CONTEXT_COOKIE, CHANNEL_CALL_CENTER, GROUP_CALL_CENTER, GROUP_EXISTING_CUSTOMER, POSTAL_COOKIE, SALES_CHANNEL } from '@/lib/config/eligibility';
import { groupKeyOf, parseDeclared } from '@/lib/offers/declared';
import { customerTypeFromGroups } from '@/lib/offers/eligibility';
import { normalizePostalCode } from '@/lib/offers/serviceability';
import type { BuyerContext, HeldService, Locale, Market, ServiceLocation } from '@/lib/types';
import { getAllOffers } from './catalog';
import { getApiRoot } from './client';
import { getCustomerGroupKeys } from './customer-groups';
import { getHoldings } from './holdings';
import { getServiceability } from './serviceability';
import { getSession } from './session';
import { withTimeout } from './timeout';

export { getCustomerGroupKeys };

/** The remembered ZIP (cookie `malva-postal-code`) resolved for the market's country; an invalid value is ignored. */
async function readLocation(country: Market['country']): Promise<ServiceLocation | undefined> {
  const raw = (await cookies()).get(POSTAL_COOKIE)?.value;
  if (raw === undefined) return undefined;
  const postalCode = normalizePostalCode(raw, country);
  if (postalCode === null) return undefined;
  try {
    return await getServiceability().check(postalCode, country);
  } catch (error) {
    console.error(error);
    return undefined;
  }
}

async function readGroupKeys(customerId: string): Promise<string[]> {
  const [{ body }, keyById] = await Promise.all([
    withTimeout(getApiRoot().customers().withId({ ID: customerId }).get().execute(), 'buyer-context.customer'),
    getCustomerGroupKeys(),
  ]);
  const ids = [body.customerGroup?.id, ...(body.customerGroupAssignments ?? []).map((assignment) => assignment.customerGroup.id)];
  return ids.flatMap((id) => {
    const key = id === undefined ? undefined : keyById[id];
    return key === undefined ? [] : [key];
  });
}

// React `cache` keys by argument identity, so the argument is a primitive (the locale); one resolution per request and market.
const resolve = cache(async (locale: Locale): Promise<BuyerContext> => {
  const market = marketFromLocale(locale);
  const [session, location, declaredRaw] = await Promise.all([getSession(), readLocation(market.country), cookies().then((jar) => jar.get(BUYER_CONTEXT_COOKIE)?.value)]);
  // The declaration is read for anonymous sessions only; a signed-in customer's groups replace it below.
  const declared = parseDeclared(declaredRaw);
  const anonymous: BuyerContext = {
    customerType: declared.customerType,
    isExistingCustomer: declared.existing === 'yes',
    existingUnspecified: declared.existing === 'unspecified',
    // The declared audience is the cart's customer group (a cart carries one), so prices follow what eligibility says.
    groupKeys: [groupKeyOf(declared.customerType, declared.existing === 'yes')].flatMap((key) => (key ? [key] : [])),
    held: [],
    signedIn: false,
    channel: SALES_CHANNEL,
    now: new Date(),
    location,
  };
  const customerId = session.customerId;
  if (!customerId) return anonymous;
  try {
    const offersByKey = Object.fromEntries((await getAllOffers(market)).map((offer) => [offer.key, offer]));
    const [groupKeys, held]: [string[], HeldService[]] = await Promise.all([readGroupKeys(customerId), getHoldings(customerId, offersByKey)]);
    return {
      ...anonymous,
      existingUnspecified: false,
      groupKeys,
      // Only a signed-in customer in the call-center group is in that channel; a visitor cannot pick one.
      channel: groupKeys.includes(GROUP_CALL_CENTER) ? CHANNEL_CALL_CENTER : SALES_CHANNEL,
      customerType: customerTypeFromGroups(groupKeys),
      isExistingCustomer: groupKeys.includes(GROUP_EXISTING_CUSTOMER) || held.length > 0,
      held,
      signedIn: true,
    };
  } catch (error) {
    // Never block browsing: fall back to the anonymous context but remember that the buyer is signed in.
    console.error(error);
    return { ...anonymous, customerType: 'consumer', isExistingCustomer: false, existingUnspecified: false, groupKeys: [], signedIn: true };
  }
});

/**
 * Who is buying, from where, holding what. Server-side only, one resolution per request (React `cache`). Anonymous: consumer,
 * not an existing customer, channel `online`. Signed in: customer type from Customer Groups (D-058), existing customer by the
 * `existing-customer` group or at least one held service (D-021). Default market is en-US.
 */
export function getBuyerContext(market?: Market): Promise<BuyerContext> {
  return resolve(market?.locale ?? 'en-US');
}
