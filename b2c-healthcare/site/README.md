# Malva Healthcare storefront

Next.js 16 (App Router) + React 19 + Tailwind v4 + next-intl, backed by commercetools. Route Handlers under `app/api/` are the BFF.

## Run

```bash
npm ci
cp .env.example .env.local   # fill in values; never commit this file
PORT=3000 npm run dev
```

## Environment

All variables are listed, without values, in `.env.example`. They are server-only: none may carry a `NEXT_PUBLIC_` prefix. Seed scripts use `.env.seed.example` (copy to `.env.seed.local`).

## Quality gate

`npm run check` runs type-check, lint, the version gate, the token parity check and the unit tests. `npm run verify:build` runs the gate and then `npm run build`. A commit must pass the gate.

## Locale routing and navigation

- Every page lives under `/<locale>/...` (`localePrefix: 'always'`); `proxy.ts` redirects unprefixed or unsupported prefixes. Supported regions are the keys of `COUNTRY_CONFIG` in `lib/utils.ts`, the only place country, currency and language are written.
- Import `Link`, `redirect`, `usePathname`, `useRouter` and `getPathname` from `@/i18n/routing`. Lint fails on `next/link` and on anything but `notFound` from `next/navigation` in locale UI. There is no codemod: fix a flagged import by hand by changing the module path (the names are identical).
- Strings come from `messages/en-US.json` (`useTranslations` / `getTranslations`). A missing key is logged in development and shows default-locale text in production.
- `<html lang>` is set in `app/layout.tsx` from the active locale.

## Add a region

v1 sells in one region (`en-US`), so the header shows no region switcher. A switcher appears as soon as two or more regions are valid (`lib/regions.ts`); everything else already works for any number of regions (proven with a throwaway second entry in `lib/add-region.test.ts`).

1. **`COUNTRY_CONFIG` in `lib/utils.ts`**: add one entry, for example `'de-DE': { country: 'DE', currency: 'EUR', language: 'de' }`. Routing (`i18n/routing.ts`), the session region and the switcher all derive from this table; nothing else lists locales.
2. **commercetools project settings**: add the country, currency and language. `getValidCountryConfig()` (`lib/ct/locale-validation.ts`) leaves out any region the project does not enable, so a half-configured region never shows up in the switcher and `POST /api/locale` refuses it.
3. **Prices in the seed (workstream E, `scripts/seed/data/*`)**: give every doctor fee (per price channel) and every medication a price in the new currency, then run `npm run seed`. A product without a price in the visitor's currency is not sellable there: search leaves it out, and reads carry `sellableInRegion: false` (the profile page shows "not available in this region"). Also check the shipping zones and rates, the tax category rates and the stock channels for the new country.
4. **Messages**: add `messages/<locale>.json` (for example `messages/de-DE.json`). It may be partial: a missing key shows the `en-US` text. The `region` namespace holds the switcher texts.
5. **Test**: extend `COUNTRY_CONFIG` in a test with `vi.mock('@/lib/utils', ...)` as `lib/add-region.test.ts` does; do not add the region to the real table before the project data exists.

A region switch writes locale, country and currency together (`POST /api/locale`). A cart's currency is fixed at creation, so a switch that changes the currency empties the cart (the patient is told, prescription lines can be added again) and the old cart is left to expire; the cart code ignores any cart whose currency differs from the session's.

## Server versus client (rule stub)

- `lib/ct/**` and `lib/session.ts` are server-only (`import 'server-only'`); components, hooks and context never import them, only types from `lib/types.ts`.
- Client code talks to the BFF over `fetch('/api/...')` through hooks.
- Never put secrets or health data in URLs, logs or client bundles.

## Route Handler template (BFF)

Every handler under `app/api/` does three things: validate the session, call **one** function in `lib/ct/<namespace>.ts`, return JSON. No `apiRoot` or SDK import in the handler.

```ts
import { handle, requireCustomer } from '@/lib/api';
import { getOrders } from '@/lib/ct/orders';

export async function GET() {
  return handle(async () => {
    const { customerId } = await requireCustomer(); // 401 { error } before any commercetools call
    return getOrders(customerId);
  });
}
```

- `handle(fn)` returns the value as JSON and maps any thrown error to a safe `{ error }` (never the raw SDK error, request body or credentials). Throw `new ApiError(status, 'safe message')` for your own errors.
- Public endpoints (catalog) skip `requireCustomer()`.
- Tests: mock `@/lib/session` and `@/lib/ct/*`; use `expectUnauthenticated(handler, [ctMock])` and `expectSanitizedError(handler, ['secret text'])` from `@/test/api`. Session/JWT tests need `// @vitest-environment node` (jose does not accept jsdom `Uint8Array`).
- Session cookie: `malva_session` (HTTP-only, SameSite=Lax, 30 days) holds `customerId`, `cartId`, `country`, `currency`, `locale` only; use the helpers in `lib/session.ts` (`getSession`, `updateSession`, `setCustomer`, `setCart`, `clearCustomer`, `clearCart`, `setLocale`).

## Data loading: Server/Client boundary and cache TTLs

| Data | Where it loads | Cache |
| --- | --- | --- |
| Catalog (listing, detail, search results) | Server Component calls `lib/ct/*` directly; independent calls in `Promise.all` | none (prices depend on currency/country); per-request `cache()` via `getProductByKeyCached`, shared by `generateMetadata` and the page |
| Cart, account, orders, appointments, labs | `'use client'` SWR hook (`hooks/`) to Route Handler to `lib/ct/*` | none, never `unstable_cache` |
| First paint of cart and user | root layout seeds `SWRConfig fallback` (`KEY_CART`, `KEY_ACCOUNT`) from the session; a stale `cartId` is cleared and tolerated | none |

`unstable_cache` is for public data identical for every visitor only:

| Function | TTL |
| --- | --- |
| `getProjectSettings` (`lib/ct/project.ts`; also drives `getValidCountryConfig`) | 300 s |
| `getCategoryTree` (`lib/ct/categories.ts`) | 60 s |
| `getShippingMethods` (`lib/ct/shipping.ts`) | 60 s |

Never cache prices, carts, accounts, orders, availability or anything that receives `customerId`, `cartId` or a session (a test scans `lib/ct/*`).

Rules:
- Pass only serializable props from Server to Client Components; put handlers in a `'use client'` child.
- Client code uses hooks and the path constants in `lib/api-paths.ts` (a literal `fetch('/api/...')` fails lint). SWR keys live in `lib/cache-keys.ts`.
- `redirect()` and `notFound()` stay outside `try/catch` (or the catch calls `unstable_rethrow`); a test scans for it.
- Cart mutations run in `withCartRetry(fn)` (`lib/api-retry.ts`): `fn` refetches the cart itself, a 409 retries once.
- Sign-out calls `useClearPatientState()` (`hooks/sign-out.ts`), which writes `null` to both keys (SWR would otherwise fall back to the layout fallback).
- Region switching is atomic: `POST /api/locale { locale }` writes locale, country and currency from `COUNTRY_CONFIG` and clears `cartId` on a currency change.
- Search uses `searchProducts` (`lib/ct/search.ts`, Product Search API).

## Identity: sign-in, create account, session

- Pages and routes: `/login` (`SignInCard`, `?next=` sanitized by `lib/next-path.ts`, default `/account`; signed-in visitors are redirected away), `POST /api/auth/login|register|logout`, `GET /api/auth/me` (`null` when signed out), `POST /api/account/password` (signed in: current + new password). All logic is in `lib/ct/identity.ts`; the session cookie keeps `customerId` and `cartId` only.
- Sign-in sends the session cart as `anonymousCart` (merge mode `MergeWithExistingCustomerCart`), so nothing in the anonymous cart is dropped; the `cartId` that comes back replaces the one in the session.
- Failures never reveal whether an email is registered: unknown email and wrong password give the same 401 text; a duplicate registration gets one generic refusal that points to sign-in; lockout (5 failures per 10 minutes, kept in `malva-ratelimit`, bucket = hash of email + client address for sign-in, client address for registration) answers the same for every address.
- **Email verification is automatic.** There is no email provider (D-029): registration creates the customer and immediately runs the email-token flow server-side (`emailToken` then `emailConfirm`), so `isEmailVerified` is true on return and the card shows an on-screen confirmation. The resend, expired-token and link-opened-twice paths exist as server functions (`requestFreshVerification`, `confirmEmail`) with unit tests but have no page or route (demo-hidden).
- **Password reset is intentionally absent** (D-032): no page, route, link or function. Signed-in patients can change their password.
- Customers are active immediately (no seller activation step, so the "request held until activated" part of `account-registration-request` does not apply). Each new customer gets `custom.patientRef` (`pt_` + 8 characters) on the `mlv-patient` type; no funding scheme is assigned.
- Password rule: at least 10 characters (`lib/password-policy.ts`, used by the form and the server). Pages that need a patient go under `app/[locale]/(protected)/`, whose layout shows `RequireSignIn` instead of the page when signed out.

## Prescriptions and dispensing rules

- `/prescriptions` (signed in): `POST /api/prescriptions/lookup { rx }` (normalises `rx 48213` to `RX-48213`, looks among the patient's OWN prescriptions, 5 failed lookups per 10 minutes then 429; unknown and foreign numbers get the identical 404 text) and `GET /api/prescriptions` (own prescriptions for the quick-picks). The RX number and the lookup input are never logged and never placed in a URL.
- Rules are pure functions in `lib/dispense/rules.ts` (authorization window and remaining refills, stock, per-order and calendar-month ceilings, shelf life); `lib/ct/prescription-view.ts` applies them to a card. A row that cannot be dispensed is shown with its reason and cannot be selected.
- Consumption happens once, at order placement: the order workstream calls `consumeAuthorization(orderId, lines)` (`lib/ct/dispense-ledger.ts`, idempotent on the order id; `malva-rx` `refillsLeft` and a `malva-dispense-ledger` entry per order). `restoreAuthorization(orderId)` gives the refill back on cancellation before shipping. The cart workstream uses `validateRxSelection` (`lib/ct/prescriptions.ts`) for add-to-cart and when the cart loads.
- Ceilings: the per-order limit is the native inventory limit (`maxCartQuantity`, platform-enforced); the per-patient ceiling counts the **calendar month** (stated in the UI) from the dispense ledger. Shelf life: product attribute `minRemainingShelfLifeDays` against the inventory custom field `expiryDate`; short-dated stock is offered with its actual expiry and its own price only when the variant has a price on channel `mlv-short-dated`, otherwise it is excluded with a reason.
- Browser checks without commercetools: `MALVA_FIXTURES=1` also serves the seed patients' prescriptions; `SESSION_SECRET=... npx tsx scripts/dev-session.ts` prints a session cookie for Sam Rivera. Development only.

### Known gap: limits bypassable through the API

Quantity ceilings and prescription limits are enforced in the storefront BFF only (D-028, Q-005 = B). The commerce API itself does not know them, except for the native per-order inventory limit (`maxCartQuantity`), which the platform enforces on every cart create/update and order creation. A client with API credentials can therefore add prescription medication to a cart without a prescription, exceed the per-patient calendar-month ceiling, and order against an exhausted or expired prescription, because none of those rules run on the platform side. This is the "Request arriving outside the storefront" scenario of `dispensing-quantity-limit`, deliberately not met in v1. Closing it needs a commercetools API Extension on cart update and order creation that calls the same functions in `lib/dispense/rules.ts` and `lib/ct/dispense-ledger.ts` (a future task, not part of this build).

## Checkout and payment

`/checkout` is one page: delivery address, delivery speed, payment, and a sticky order summary. Every figure on it is the platform's: after each change of address or delivery method the cart is read again and shipping, tax and total come from that answer. Delivery options come from `shipping-methods/matching-cart`; same-day (`mlv-same-day`) is offered only before 14:00 America/New_York (`lib/checkout/config.ts`, D-033) and only where the platform returns it (NY, TX, IL). The order is placed once (`lib/ct/orders.ts`): an attempt lock keyed by cart id plus cart version makes a double submit create one order; the cart total is compared with the amount the buyer saw and with the authorized amount; prescription rules are re-run; the order gets `MLV-<6 digits>` from the `malva-counter` object, state `mlv-received`, the prescription record on its lines, and the prescription is consumed once for the order id.

### Payment lifecycle in the demo

- Payment is commercetools Checkout in payment-only mode with a Stripe connector (D-026). The storefront creates a Checkout session (`POST /api/checkout/session`) and mounts the SDK's payment component; no card field exists in storefront code (a test enforces it). Behind it sits the `PaymentProvider` interface (`lib/checkout/payment-provider.ts`): the real adapter (`lib/ct/checkout-provider.ts`, needs `CTP_CHECKOUT_APP_KEY`, the Checkout Application of the Merchant Center) and a dev-only fake (`lib/checkout/fake-provider.ts`). The fake is loaded only with `MALVA_FIXTURES=1` outside production and the page then shows "DEMO payment (no PSP configured)"; nothing is charged.
- Authorize only. The demo authorizes at checkout and does not capture. Capture on `mlv-packed-shipped` is out of v1.
- To capture by hand: in the Merchant Center open the order, Payments tab, and use the PSP (Stripe dashboard, "Capture" on the PaymentIntent) or the Checkout Payment Intents API (`POST https://checkout.{region}.commercetools.com/{projectKey}/payment-intents/{paymentId}` with `{"actions":[{"action":"capturePayment","amount":{...}}]}`, scope `manage_checkout_payment_intents`).
- To refund by hand: the same endpoint with `refundPayment` (after a capture), or refund in the Stripe dashboard. To void an authorization that will not be captured: `cancelPayment`. The storefront itself releases the authorization when the cart total moves after authorization, when order creation fails, or when the prescription refuses at the last moment.
- Stripe sandbox test cards (use only in the sandbox, never type them in a build without a sandbox connector): `4242 4242 4242 4242` succeeds, `4000 0000 0000 0002` is declined, `4000 0025 0000 3155` asks for 3D Secure; any future expiry, any CVC. They are typed into the Checkout widget, never into storefront code.
- Needs OA-04 (a Checkout Application and a Stripe sandbox connector). Until then, the real adapter reports "Payment is not available right now" and no order can be placed outside fixture mode.
- Browser check without commercetools: `MALVA_FIXTURES=1`, `SESSION_SECRET=... npx tsx scripts/dev-session.ts` for a cookie, add lines from `/prescriptions`, open `/checkout`; `SAME_DAY_NOW_OVERRIDE=2026-10-08T09:00:00-04:00` shows both sides of the cut-off. Development only.

## Saved lists, auto-refill and saved payment methods (workstream T)

- **My medicines** (`/account/lists`): commercetools Shopping Lists, one per customer (`key mlv-list-<id>`, `deleteDaysAfterLastModification` 360). A line is a SKU plus the prescription reference (`rxNumber`, `rxLineRef`, custom type `mlv-list-line`) and the price when it was saved; the sig is never stored. "Add all to cart" (`POST /api/lists/:id/add-all-to-cart`) re-validates every line now through the dispensing rules, adds the dispensable ones and names the others with a reason. Prices on the detail page come from one catalog read per page view, never a throwaway cart; a price that moved since saving shows the delta.
- **Auto-refill** (`/account/auto-refill`): commercetools Recurring Orders created from a recurring Cart (policies `mlv-monthly` and `mlv-quarterly`, `Dynamic` price selection, the saved payment method as a 100% `Checkout` payment allocation). The platform generates the orders; with no API Extension (D-028) the gate runs ahead of each run: the Netlify scheduled function `netlify/functions/auto-refill-run.ts` (daily 05:00 UTC) calls `POST /api/internal/auto-refill-run` with the shared secret `AUTO_REFILL_RUN_SECRET`, which runs `decideRun` (`lib/refill/decide-run.ts`) for every Active recurring order due within 36 hours: valid -> goes ahead; ceiling -> that run is skipped; expired or no payment method -> paused; no refills left -> the series is canceled. Each check is recorded in the `malva-refill-log` Custom Object (ids, date, reason code only) and shown as "Last run: skipped, ...". The same function then gives the orders the platform generated an `MLV-` number, the state `mlv-received` and consumes the prescription once per order. Local run: `npx netlify functions:invoke auto-refill-run --headers '{"x-refill-secret":"<secret>"}'`.
- **Payment methods** (`/account/payment-methods`): Checkout Stored Payment Methods through the `PaymentMethod` API, behind `PaymentProvider.listStoredMethods / setDefaultStoredMethod / removeStoredMethod`. The page, the routes and the logs see only the descriptor (brand, last four, expiry, default flag); the provider token never leaves `lib/ct/stored-methods.ts` (a guard test checks it). Setting a default clears the previous one explicitly; removing the default promotes nothing; removing a card an active refill is charged to asks first and pauses those refills. A card is saved by the Checkout widget at payment time (cart `customerId` ties it to the customer), not by a storefront form.
- Scopes added to the API client: `manage_shopping_lists`, `manage_recurring_orders`, `view_recurrence_policies`, `manage_payment_methods` (see `.env.example`). Seed: `npm run seed` creates the `mlv-list-line` type and the two policies.
- Browser check without commercetools: `MALVA_FIXTURES=1` (plus dummy `CTP_*` values and `AUTO_REFILL_ENABLED=true`), a cookie from `scripts/dev-session.ts`, `POST /api/payment-methods/demo-add` for a demo card, then save, enable, pause and remove through the pages or `curl`. Development only; the fake provider and fixtures never load in production.
