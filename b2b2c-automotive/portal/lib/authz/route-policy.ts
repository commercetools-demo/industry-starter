// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// The route policy of every Route Handler under app/api/** (workstream X-01, decision D6): one line per route with the access each
// HTTP method needs. `scripts/check-routes.mjs` fails when a route file has no line here (or a line has no route file, or an
// exported method has no access), and `route-policy.test.ts` runs every line against the real handler with synthetic personas:
//   public   no session needed (sign-in, registration, locale, health which a release build drops)
//   session  any signed-in portal user (the handler then uses the session's own business unit and store)
//   <action> a PortalAction of lib/authz/permissions.ts: the store in the session and the role must allow it (layer two of
//            "permissions in two layers", `authorizeStore`), checked BEFORE any commercetools call
// State-changing methods are additionally gated by the same-origin check of proxy.ts (`lib/security/api-gate.ts`).
import type { PortalAction } from './permissions';

export type RouteMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
export type Access = 'public' | 'session' | PortalAction;
export interface RoutePolicy {
  pattern: string;
  methods: Partial<Record<RouteMethod, Access>>;
  /** The request is multipart (an upload); the generated test sends a form instead of JSON. */
  multipart?: boolean;
  /** Why this line is not the plain rule. */
  note?: string;
}

const p = (pattern: string, methods: RoutePolicy['methods'], extra: Pick<RoutePolicy, 'multipart' | 'note'> = {}): RoutePolicy => ({ pattern, methods, ...extra });

export const ROUTE_POLICY: readonly RoutePolicy[] = [
  p('/api/account/addresses', { GET: 'account.view', POST: 'account.edit' }),
  p('/api/account/addresses/[id]', { DELETE: 'account.edit' }),
  p('/api/account/addresses/[id]/default', { POST: 'account.edit' }),
  p('/api/account/business-units', { GET: 'account.view' }),
  p('/api/account/password', { PUT: 'account.edit' }),
  p('/api/account/profile', { GET: 'account.view', PUT: 'account.edit' }),
  p('/api/auth/accept-invite', { POST: 'public' }, { note: 'the invite token is the credential' }),
  p('/api/auth/demo-accounts', { GET: 'public' }, { note: 'answers 404 unless DEMO_LOGIN_ENABLED; never in production (check-no-demo-login)' }),
  p('/api/auth/demo-login', { POST: 'public' }, { note: 'answers 404 unless DEMO_LOGIN_ENABLED; never in production (check-no-demo-login)' }),
  p('/api/auth/login', { POST: 'public' }),
  p('/api/auth/logout', { POST: 'public' }, { note: 'idempotent: clears the cookie' }),
  p('/api/auth/register', { POST: 'public' }),
  p('/api/auth/reset', { POST: 'public' }, { note: 'on-screen reset, 404 unless DEMO_ONSCREEN_RESET (Q-X05)' }),
  p('/api/auth/reset-request', { POST: 'public' }, { note: 'on-screen reset, 404 unless DEMO_ONSCREEN_RESET (Q-X05)' }),
  p('/api/business-units', { GET: 'session' }),
  p('/api/business-units/current', { GET: 'session' }),
  p('/api/business-units/select', { POST: 'session' }, { note: 'the unit must be one of the associate\'s own (404 otherwise)' }),
  p('/api/company/addresses', { GET: 'company.view', POST: 'company.edit' }),
  p('/api/company/addresses/default', { POST: 'company.edit' }),
  p('/api/company/profile', { GET: 'company.view', PUT: 'company.edit' }),
  p('/api/company/roles', { GET: 'company.view' }),
  p('/api/company/users', { GET: 'company.view' }),
  p('/api/company/users/invite', { POST: 'company.edit' }),
  p(
    '/api/contentools/[...path]',
    { GET: 'content.edit', POST: 'content.edit', PUT: 'content.edit', PATCH: 'content.edit', DELETE: 'content.edit', HEAD: 'content.edit', OPTIONS: 'public' },
    { note: 'hardened proxy: allow-list, strict store, server-held JWT on writes' },
  ),
  p('/api/copilot/apply', { POST: 'session' }, { note: 'applyConfirmed re-checks the permission of the chosen action (403 otherwise)' }),
  p('/api/copilot/plan', { POST: 'session' }),
  p('/api/health', { GET: 'public' }, { note: 'removed from release builds (check-no-health-in-release)' }),
  p('/api/locale', { GET: 'public', POST: 'public' }),
  p('/api/notifications', { GET: 'session' }),
  p('/api/search/parts', { GET: 'session' }),
  p('/api/seller/assortment', { GET: 'catalog.view' }),
  p('/api/seller/assortment/assign', { POST: 'catalog.edit' }),
  p('/api/seller/assortment/chain', { GET: 'catalog.view' }),
  p('/api/seller/assortment/impact', { POST: 'catalog.edit' }),
  p('/api/seller/assortment/reconcile', { POST: 'catalog.edit' }),
  p('/api/seller/assortment/withdraw', { POST: 'catalog.edit' }),
  p('/api/seller/bundles', { GET: 'bundles.manage', POST: 'bundles.manage' }),
  p('/api/seller/bundles/[key]/publish', { POST: 'bundles.manage' }),
  p('/api/seller/bundles/components', { GET: 'bundles.manage' }),
  p('/api/seller/campaigns', { GET: 'marketing.manage' }),
  p('/api/seller/campaigns/[key]/claim', { POST: 'marketing.manage' }),
  p('/api/seller/campaigns/[key]/discount', { POST: 'marketing.manage' }),
  p('/api/seller/catalog/categories', { GET: 'catalog.view' }),
  p('/api/seller/customers', { GET: 'customers.view' }),
  p('/api/seller/customers/[id]', { GET: 'customers.view' }),
  p('/api/seller/customers/[id]/notes', { POST: 'customers.manage' }),
  p('/api/seller/customers/[id]/shop-as', { POST: 'customer-session.start' }),
  p('/api/seller/dashboard/heads-up', { GET: 'dashboard.view' }),
  p('/api/seller/dashboard/kpis', { GET: 'dashboard.view' }),
  p('/api/seller/dashboard/recent-orders', { GET: 'dashboard.view' }),
  p('/api/seller/dashboard/renewals', { GET: 'dashboard.view' }),
  p('/api/seller/dashboard/returns', { GET: 'dashboard.view' }),
  p('/api/seller/dashboard/stock', { GET: 'dashboard.view' }),
  p('/api/seller/dashboard/store-performance', { GET: 'store.view-performance' }),
  p('/api/seller/discounts', { GET: 'catalog.view' }),
  p('/api/seller/discounts/[kind]/[id]', { GET: 'catalog.view', PATCH: 'discount.edit', DELETE: 'discount.edit' }),
  p('/api/seller/discounts/[kind]/[id]/active', { POST: 'discount.edit' }),
  p('/api/seller/discounts/cart', { POST: 'discount.edit' }),
  p('/api/seller/discounts/priority', { PUT: 'discount.edit' }),
  p('/api/seller/discounts/product', { POST: 'discount.edit' }),
  p('/api/seller/email/campaigns', { GET: 'email.manage', POST: 'email.manage' }),
  p('/api/seller/email/campaigns/[id]/ready', { POST: 'email.manage' }),
  p('/api/seller/email/campaigns/suggest', { POST: 'email.manage' }),
  p('/api/seller/email/templates', { GET: 'email.manage' }),
  p('/api/seller/email/templates/[key]', { GET: 'email.manage', PUT: 'email.manage' }),
  p('/api/seller/email/templates/[key]/preview', { POST: 'email.manage' }),
  p('/api/seller/impersonation/exit', { POST: 'session' }, { note: 'the actor and store come from the session only' }),
  p('/api/seller/import/commit', { POST: 'import.run' }),
  p('/api/seller/import/validate', { POST: 'import.run' }),
  p('/api/seller/local-products', { GET: 'import.run', POST: 'import.run' }),
  p('/api/seller/local-products/vehicles', { GET: 'import.run' }),
  p('/api/seller/orders/[number]', { GET: 'returns.view' }),
  p('/api/seller/orders/[number]/delivered', { POST: 'customers.manage' }),
  p('/api/seller/partnership', { GET: 'partnership.view' }),
  p('/api/seller/prices', { GET: 'catalog.view', PUT: 'price.edit' }),
  p('/api/seller/prices/bulk', { POST: 'price.edit' }),
  p('/api/seller/prices/import', { POST: 'price.edit' }),
  p('/api/seller/returns', { GET: 'returns.view', POST: 'returns.process' }),
  p('/api/seller/returns/[number]', { GET: 'returns.view' }),
  p('/api/seller/returns/[number]/transition', { POST: 'returns.process' }),
  p('/api/seller/reviews', { GET: 'reviews.view' }),
  p('/api/seller/reviews/[id]/reply', { POST: 'reviews.moderate' }),
  p('/api/seller/reviews/[id]/visibility', { POST: 'reviews.moderate' }),
  p('/api/seller/store/branches', { GET: 'store.view', POST: 'store.edit' }),
  p('/api/seller/store/branches/[key]', { PUT: 'store.edit', DELETE: 'store.edit' }),
  p('/api/seller/store/branches/[key]/stock', { GET: 'store.view' }),
  p('/api/seller/store/branches/[key]/stock/[sku]', { PUT: 'store.edit' }),
  p('/api/seller/store/channels', { GET: 'store.view-performance' }),
  p('/api/seller/store/favicon', { POST: 'store.edit' }, { multipart: true }),
  p('/api/seller/store/geocode', { POST: 'store.edit' }),
  p('/api/seller/store/link-in-bio-status', { GET: 'store.view' }),
  p('/api/seller/store/logo', { POST: 'store.edit' }, { multipart: true }),
  p('/api/seller/store/settings', { GET: 'store.view', PUT: 'store.edit' }),
  p('/api/seller/store/theme', { DELETE: 'store.edit' }),
  p('/api/seller/subscriptions', { GET: 'subscriptions.view' }),
  p('/api/seller/subscriptions/[id]/audit', { GET: 'subscriptions.view' }),
  p('/api/seller/subscriptions/[id]/cancel', { POST: 'subscriptions.manage' }),
  p('/api/seller/subscriptions/[id]/pause', { POST: 'subscriptions.manage' }),
  p('/api/seller/subscriptions/[id]/resume', { POST: 'subscriptions.manage' }),
  p('/api/seller/subscriptions/[id]/skip', { POST: 'subscriptions.manage' }),
  p('/api/seller/tailoring', { GET: 'catalog.view' }),
  p('/api/seller/tailoring/[productId]', { GET: 'catalog.view', PUT: 'tailoring.edit' }),
  p('/api/seller/tailoring/[productId]/image', { POST: 'tailoring.edit' }, { multipart: true }),
  p('/api/seller/tailoring/[productId]/image-url', { POST: 'tailoring.edit' }),
  p('/api/seller/tailoring/[productId]/reset', { POST: 'tailoring.edit' }),
  p('/api/store/preview-pages', { GET: 'store.view' }),
];
