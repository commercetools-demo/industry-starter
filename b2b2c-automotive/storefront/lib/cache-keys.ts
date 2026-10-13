// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// SWR cache keys: one place so hooks and `mutate` calls agree. Each workstream appends its keys.

/** The cart (workstream N). Mutating a key that starts with this prefix refreshes every cart read, summary included. */
export const KEY_CART = '/api/cart';
/** The signed-in shopper, `{ customer }` (workstream N, `useAccount`); `customer` is null when signed out. */
export const KEY_ACCOUNT = '/api/auth/me';
/** Units in the cart for the header (workstream I). */
export const KEY_CART_SUMMARY = '/api/cart/summary';
/** Branches of the session's store (workstream I); the locale is part of the key because branch names are localized. */
export const KEY_BRANCHES = '/api/store-context/branches';
export const keyBranches = (locale: string): string => `${KEY_BRANCHES}?locale=${encodeURIComponent(locale)}`;
/** The shopper's garage (workstream J): `{ garage, vehicles, active }`. */
export const KEY_GARAGE = '/api/garage';
/** Dependent vehicle selector options (workstream J); the query string carries market, make, model and year. */
export const KEY_VEHICLE_OPTIONS = '/api/vehicles/options';
/** Recurrence policies of "Subscribe and save" (workstream M); the locale is part of the key because policy names are localized. */
export const KEY_SUBSCRIPTION_POLICIES = '/api/subscriptions/policies';
export const keySubscriptionPolicies = (locale: string): string => `${KEY_SUBSCRIPTION_POLICIES}?locale=${encodeURIComponent(locale)}`;

// Account area (workstream Q). Each key is the route that answers it.
export const KEY_ACCOUNT_ADDRESSES = '/api/account/addresses';
export const KEY_ACCOUNT_PAYMENT_METHODS = '/api/account/payment-methods';
export const KEY_ACCOUNT_SUBSCRIPTIONS = '/api/account/subscriptions';
export const KEY_ACCOUNT_PROFILE = '/api/account/profile';
/** Demo shopper list of the sign-in page (workstream Q-13a). */
export const KEY_DEMO_ACCOUNTS = '/api/auth/demo-accounts';
