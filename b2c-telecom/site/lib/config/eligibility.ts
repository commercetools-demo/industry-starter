/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import type { CustomerType } from '@/lib/types';

/** The storefront is one sales channel; an offer listing other channels only is not sold here. */
export const SALES_CHANNEL = 'online';
/** Remembered ZIP (HttpOnly). The country always comes from the market, never from the cookie. */
export const POSTAL_COOKIE = 'malva-postal-code';
export const POSTAL_COOKIE_MAX_AGE = 2_592_000; // 30 days

/** What an anonymous visitor declares about themselves (HttpOnly): `<customerType>:<yes|no|unspecified>`. */
export const BUYER_CONTEXT_COOKIE = 'malva-buyer-context';
export const BUYER_CONTEXT_COOKIE_MAX_AGE = 2_592_000; // 30 days

/** Customer Group keys (D-058). */
export const GROUP_EMPLOYEE = 'employee';
export const GROUP_SMALL_BUSINESS = 'small-business';
export const GROUP_EXISTING_CUSTOMER = 'existing-customer';
/** Agents' customers: their group puts the buyer in the call-center sales channel (a visitor cannot choose a channel). */
export const GROUP_CALL_CENTER = 'call-center';
export const CHANNEL_CALL_CENTER = 'call-center';

/** First match wins. */
export const CUSTOMER_TYPE_PRIORITY: readonly CustomerType[] = ['employee', 'small-business', 'consumer'];
