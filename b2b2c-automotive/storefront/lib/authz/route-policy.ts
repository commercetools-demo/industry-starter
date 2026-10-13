// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// The route policy of every Route Handler under app/api/** (workstream X-01, decision D6): one line per route with the access each
// HTTP method needs. `scripts/check-route-policy.mjs` (run by `npm run check`) fails when a route file has no line here, a line has no
// route file, or an exported method has no access. `route-policy.test.ts` runs every line against the real handler with synthetic personas.
//   public    no session needed (sign-in, registration, locale, catalogue helpers); the store comes from the session set by proxy.ts
//   cart      anonymous or signed in, but only the cart of the session; no store session is a refusal, never another visitor's cart
//   customer  a signed-in shopper of the session's store: 401 without a customer, every query scoped by customer id and store key
//   token     a signed single-use token or a private link is the credential (shop-as hand-off, order claim)
//   dev       development helper: 404 in production (also checked by check-no-dev-pages and the build)
// State-changing methods are additionally gated by the same-origin check of proxy.ts (`lib/security/api-gate.ts`); `/api/impersonate` is the one exemption.

export type RouteMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
export type Access = 'public' | 'cart' | 'customer' | 'token' | 'dev';
export interface RoutePolicy {
  pattern: string;
  methods: Partial<Record<RouteMethod, Access>>;
  /** Why this line is not the plain rule. */
  note?: string;
}

const p = (pattern: string, methods: RoutePolicy['methods'], extra: Pick<RoutePolicy, 'note'> = {}): RoutePolicy => ({ pattern, methods, ...extra });

export const ROUTE_POLICY: readonly RoutePolicy[] = [
  p('/api/account/addresses', { GET: 'customer', POST: 'customer' }),
  p('/api/account/addresses/[id]', { PUT: 'customer', PATCH: 'customer', DELETE: 'customer' }),
  p('/api/account/delete', { POST: 'customer' }),
  p('/api/account/email', { POST: 'customer' }),
  p('/api/account/orders/[orderNumber]/reorder', { POST: 'customer' }),
  p('/api/account/orders/[orderNumber]/return', { POST: 'customer' }),
  p('/api/account/password', { POST: 'customer' }),
  p('/api/account/payment-methods', { GET: 'customer' }),
  p('/api/account/payment-methods/[id]', { DELETE: 'customer' }),
  p('/api/account/profile', { GET: 'customer', PUT: 'customer' }),
  p('/api/account/subscriptions', { GET: 'customer' }),
  p('/api/account/subscriptions/[id]', { PUT: 'customer' }),
  p('/api/auth/demo-accounts', { GET: 'public' }, { note: '404 unless DEMO_LOGIN_ENABLED; never in production (check-no-demo-login)' }),
  p('/api/auth/demo-login', { POST: 'public' }, { note: '404 unless DEMO_LOGIN_ENABLED; never in production (check-no-demo-login)' }),
  p('/api/auth/forgot-password', { POST: 'public' }, { note: 'on-screen reset: 404 unless DEMO_ONSCREEN_RESET (Q-X05)' }),
  p('/api/auth/login', { POST: 'public' }, { note: 'a customer of another store is refused with the generic message (C16); rate limited per client' }),
  p('/api/auth/logout', { POST: 'public' }, { note: 'idempotent: clears the cookie' }),
  p('/api/auth/me', { GET: 'public' }, { note: 'answers { customer: null } when signed out; masked while shopping as a customer' }),
  p('/api/auth/register', { POST: 'public' }),
  p('/api/auth/reset-password', { POST: 'public' }, { note: 'on-screen reset: 404 unless DEMO_ONSCREEN_RESET (Q-X05)' }),
  p('/api/cart', { GET: 'cart', POST: 'cart' }),
  p('/api/cart/delivery', { PUT: 'cart' }),
  p('/api/cart/discount-codes', { POST: 'cart', DELETE: 'cart' }),
  p('/api/cart/items', { POST: 'cart' }),
  p('/api/cart/items/[lineItemId]', { PATCH: 'cart', DELETE: 'cart' }),
  p('/api/cart/lines', { POST: 'cart' }),
  p('/api/cart/summary', { GET: 'cart' }),
  p('/api/checkout/session', { POST: 'cart' }, { note: 'the amount, currency and address come from the persisted cart, never from the body' }),
  p('/api/contentools/[...path]', { GET: 'public', POST: 'public', PUT: 'public', PATCH: 'public', DELETE: 'public', HEAD: 'public', OPTIONS: 'public' }, { note: 'read-only proxy: every write method is 404 (route.attacks.test.ts)' }),
  p('/api/dev/checkout/complete', { POST: 'dev' }, { note: '404 in production and without CHECKOUT_DEV_COMPLETE' }),
  p('/api/garage', { GET: 'public', POST: 'public', PATCH: 'public', DELETE: 'public' }, { note: 'a cookie garage for visitors, a custom field of the signed-in customer' }),
  p('/api/garage/active', { POST: 'public' }),
  p('/api/garage/merge', { POST: 'customer' }),
  p('/api/health', { GET: 'public' }, { note: 'removed from release builds (check-no-health-in-release)' }),
  p('/api/impersonate', { POST: 'token' }, { note: 'cross-origin form post from the portal, exempt from the origin gate; single-use HS256 token, 60 seconds' }),
  p('/api/impersonate/exit', { POST: 'public' }, { note: 'only an impersonation session is touched' }),
  p('/api/locale', { GET: 'public', POST: 'public' }),
  p('/api/orders/[orderNumber]/claim', { POST: 'token' }, { note: 'the owner browser or the holder of the private link; every other case is one 404; rate limited per client' }),
  p('/api/reviews', { POST: 'customer' }, { note: 'verified buyers only (403 NOT_A_BUYER)' }),
  p('/api/store-context/branch', { POST: 'public' }),
  p('/api/store-context/branches', { GET: 'public' }),
  p('/api/store-context/geocode', { GET: 'public' }),
  p('/api/subscriptions/policies', { GET: 'public' }),
  p('/api/vehicles/lookup', { POST: 'public' }),
  p('/api/vehicles/options', { GET: 'public' }),
];
