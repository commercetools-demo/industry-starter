# MALVA grocery storefront

Next.js 16 storefront on commercetools.

## Setup
```bash
nvm use            # Node 22 (.nvmrc at the repo root)
npm ci
cp .env.example .env.local   # fill in the values you were given; never commit .env.local
npm run dev        # http://localhost:3000
npm run verify     # lockfile check, lint, typecheck, unit tests, build
```

## Environment variables
All variables are read on the server only; none may ever be prefixed `NEXT_PUBLIC_` (`npm run check:secrets` and `npm run check:bundle`, both part of `npm run verify`, fail if a secret could reach the browser). The app refuses to start (and Netlify builds fail) naming the first missing required variable.

| Variable | Required | Secret | Notes |
| --- | --- | --- | --- |
| `CTP_PROJECT_KEY` | yes | no | commercetools project key |
| `CTP_AUTH_URL` | yes | no | region auth URL |
| `CTP_API_URL` | yes | no | region API URL (also derives the region) |
| `CTP_CLIENT_ID` | yes | **yes** | API client with the storefront scopes |
| `CTP_CLIENT_SECRET` | yes | **yes** | API client secret |
| `CTP_SCOPES` | yes | no | space-separated, each suffixed `:<project key>` |
| `CTP_CHECKOUT_APP_KEY` | yes | **yes** (treat as secret) | commercetools Checkout application key |
| `SESSION_SECRET` | yes | **yes** | at least 32 random characters; signs the session cookie |
| `HOME_LAYOUT`, `HOME_CONTACT_STRIP`, `HERO_IMAGE_URL`, `FEATURE_SUBSCRIPTIONS` | no | no | optional content and feature switches |

Where to set them: locally in `site/.env.local` (copy `.env.example`; never commit it, only `.env.example` is tracked and its secret values stay empty); on Netlify in the site's environment variables (Site configuration, Environment variables).

## Delivery slots (stub)
Delivery windows come from an in-repo stub service (`lib/slots/stub-service.ts`, configured in `lib/config/slots.ts`: 7 days, six 2-hour windows from 08:00, capacity 10 per window, 15-minute holds; times are UTC). Its state lives **in memory** of the server process: a cold start or redeploy (Netlify serverless) resets all holds and bookings, and separate serverless instances do not share capacity. The chosen slot itself is stored on the commercetools cart (`cart-delivery` custom fields), so the cart keeps it, but its capacity hold is gone until it is picked again or it is re-held when the checkout session is created. This is an accepted limitation for v1; replace `getSlotService()` in `lib/slots/index.ts` with a persistent service to remove it. Delivery cost is the commercetools shipping method `standard`; slots have no price.

## Deploying to Netlify
Hosting is Netlify. This project lives in a monorepo: the Netlify site's base directory is `b2c-grocery/site` (set in the Netlify UI), and `site/netlify.toml` sets build command `npm run build`, an `ignore` rule that skips builds when nothing in this project changed, and `NODE_VERSION = "22"`. The publish directory is left to Netlify's Next.js runtime. Netlify applies its Next.js runtime automatically; do not add plugins. There is no `vercel.json`. `content/**` is traced into the serverless bundle (`outputFileTracingIncludes`), and `/api/health` and every other dev-only route are absent or 404 in production.

### Before every release
1. `cd site && npm run verify:release` must pass. It runs `verify` and `check:release`, which fails if `app/api/health` exists, a `dev` route lacks the `NODE_ENV === 'development'` + `notFound()` guard, `netlify.toml` differs from the template, a `vercel.json` exists, or an `.env*` file (other than `.env.example`) is tracked.
2. Use the **Frontend B2C**-style API client with the storefront scopes only. The seed/admin client must not be used in production and is deleted from the project before launch (Z).

### First deploy (owner)
1. In Netlify create a site from this repository. Set Base directory to `b2c-grocery/site` (the monorepo root is the repository root). Leave the build command and publish directory blank so they come from `site/netlify.toml`.
2. Site configuration, Environment variables: set `CTP_PROJECT_KEY`, `CTP_AUTH_URL`, `CTP_API_URL`, `CTP_CLIENT_ID`, `CTP_CLIENT_SECRET`, `CTP_SCOPES`, `CTP_CHECKOUT_APP_KEY` and `SESSION_SECRET` (at least 32 random characters and different from your local value). Optional: `HOME_LAYOUT`, `HOME_CONTACT_STRIP`, `HERO_IMAGE_URL`, `FEATURE_SUBSCRIPTIONS`. Mark the secrets as secret values. Never put values in the repository, in `netlify.toml` or in chat.
3. Netlify builds set `NETLIFY=true`, so the build validates the environment and fails naming the first missing variable.
4. In the commercetools Checkout application (Merchant Center), add the Netlify URL (and the custom domain, if any) to the allowed origins, otherwise the hosted checkout is blocked.
5. Deploy and check the storefront, sign-in, cart and hosted checkout on the Netlify URL.

### Rollback
In Netlify, Deploys: open the last good deploy and choose "Publish deploy". No rebuild is needed. Environment variable changes only take effect on the next build, so after changing one, trigger a new deploy.

### Known and accepted
- Extra shipping methods: `standard-shipping` (500.00) and `express-shipping` (750.00) stay active next to `standard`; hosted Checkout lists every applicable method, so shoppers can see them.
- Accepted risks: the session cookie holds the customer email and name for 30 days with no server-side revocation; rate limiting and the slot stub are in memory per serverless instance; the 15-minute slot hold can expire while a shopper pays, so oversell is possible until a real capacity system exists.

## Architecture overview
The browser never talks to commercetools. Every call goes through route handlers (a backend for frontend, BFF) that use the server-only commercetools client in `lib/ct`.

```text
Browser (React, SWR for per-user state: cart, account, saved, subscriptions)
   |  fetch('/api/...')  + signed session cookie (httpOnly JWT: cart id, customer id, market)
   v
Route handlers  app/api/**/route.ts       getSession() -> validate input -> rate limit -> privateJson()
   |
   v
lib/ct/*  (server-only; SDK client with a client-credentials token, never sent to the browser)
   |
   v
commercetools (Composable Commerce API, Sessions API for the hosted Checkout)

Server components (app/[locale]/**/page.tsx) call lib/ct directly for the catalog:
product listing, product detail, search and home are server-rendered per locale (cached, no per-user data).
```

- **Session:** `lib/session.ts` keeps a signed cookie (`SESSION_SECRET`) with the anonymous or customer cart id, customer id, email, name and market. The market follows the URL locale.
- **Per-user state:** loaded client side with SWR through the hooks in `hooks/` and `context/` (`useCart`, `useOrders`, `useRecurring`, ...). Responses under `/api/account/*` are `Cache-Control: private, no-store`.
- **Catalog:** server-rendered; mappers in `lib/mappers` turn commercetools types into the view types in `lib/types.ts`, so components never see raw API shapes.
- **Checkout:** the cart page collects address, delivery slot and substitution preferences; "Checkout" creates a Sessions API session server-side and the hosted commercetools Checkout renders inline on `/checkout`.

## Directory map
| Path | What lives there |
| --- | --- |
| `app/[locale]/` | Pages (always locale-prefixed). `account/(protected)/` holds the pages that need sign-in |
| `app/api/` | Route handlers: `auth`, `cart`, `checkout`, `account`, `contact`, `locale`, `slots` |
| `components/` | UI by feature (`ui` primitives, `layout`, `product`, `cart`, `checkout`, `account`, `auth`, `home`, `search`, `content`, `contact`) |
| `hooks/`, `context/` | SWR hooks and providers for per-user state |
| `lib/ct/` | The only code that calls commercetools (server-only) |
| `lib/mappers/` | commercetools types to view types |
| `lib/api/` | Route helpers (`privateJson`, client-side API wrappers) |
| `lib/config/` | Feature switches, slots, price bands, substitution and variant config |
| `lib/slots/` | Delivery slot stub service |
| `lib/session.ts`, `lib/env.ts`, `lib/rate-limit.ts`, `lib/utils.ts` | Session cookie, environment validation, in-memory rate limiter, `COUNTRY_CONFIG` and money helpers |
| `i18n/`, `messages/` | next-intl routing and the `en-US` / `de-DE` message files |
| `content/<locale>/` | Markdown for About, FAQ, Journal and policies |
| `scripts/` | Release checks (`check-*.mjs`) and `scripts/seed/` (catalog seed and QA tools) |

Unit tests sit next to the code (`*.test.ts(x)`).

## How to add a country
Only two edits:
1. Add an entry to `COUNTRY_CONFIG` in `lib/utils.ts` (`locale`, `currency`, `country`, `label`). Routing, the language switch, market lookup and price formatting read from it.
2. Add `messages/<locale>.json` with the same keys as `en-US.json` (`messages/parity.test.ts` fails when keys differ), and optionally `content/<locale>/` for the static pages.

The commercetools project must also have the country, currency and language enabled, plus prices for it (`seed` data in `scripts/seed/data`).

## How to add a page
1. Create `app/[locale]/<route>/page.tsx` (server component). Call `setRequestLocale(locale)` and use `getTranslations`; put all text in `messages/*.json` for both locales.
2. If it needs sign-in, put it under `app/[locale]/account/(protected)/`; that layout redirects anonymous visitors to sign-in with `?redirect=`.
3. Load catalog data in the server component through `lib/ct`; load per-user data client side with an SWR hook.
4. Add a `page.test.tsx` next to it (render with Testing Library; mock `lib/ct`).

## How to add an API route
1. Create `app/api/<area>/<name>/route.ts`. Routes that carry customer data use `privateJson()` from `lib/api/private-json.ts` (sets `Cache-Control: private, no-store`).
2. Call `getSession()` first. Protected data routes must check `session.customerId` themselves and answer `unauthenticated()` (the `(protected)` layout guards pages only).
3. Validate the input; map commercetools errors to a short error code, never leak the raw error. Log only `e.message`.
4. Public write routes (login, register, contact, ...) use `rateLimit(clientKey(request, 'name'), LIMITS.name)` from `lib/rate-limit.ts`; add a limit to `LIMITS`.
5. Add `route.test.ts` next to the route (unauthenticated, validation, success, upstream failure); `app/api/account/private-responses.test.ts` checks the cache headers.
6. Run `npm run verify`.

## Seed and QA scripts
All scripts need an admin API client in `site/.env.seed` (see `scripts/seed/lib.ts` for the required variables). **`.env.seed` is never committed** (gitignored) and the client is deleted before launch.

| Command | Purpose |
| --- | --- |
| `npm run seed` | Creates product types, categories, products, inventory, shipping, recurrence policies and custom types (idempotent) |
| `npm run seed:verify` | Checks the project against the data model; run before a release |
| `npx tsx scripts/seed/create-qa-order.ts [--status ...] [--orders N] [--final-cents N]` | Throwaway `qa-*@example.com` customer with orders |
| `npx tsx scripts/seed/create-qa-substitution.ts` | Substitution Order Edit proposal on a QA order |
| `npx tsx scripts/seed/create-qa-recurring.ts --policy every-2-weeks` | Recurring Order for a QA customer |
| `npx tsx scripts/seed/cleanup-qa.ts` | Deletes the QA customers, their orders, carts and recurring orders |

## Known limitations
- **Slots reset on cold start:** the delivery slot stub is in memory per instance; capacity is lost on restart and not shared between serverless instances (see "Delivery slots (stub)").
- **No email sending:** registrations are auto-verified and password reset only generates a token (a development stub shows the link). No order confirmation email.
- **Hosted checkout:** the hosted Checkout creates the order, so a slot cannot be rejected at placement; it is validated and held when the checkout session is created.
- **Accepted risks:** 30-day session cookie with email and name and no revocation; in-memory rate limit and slots; the slot hold can expire while paying.
- **Shipping methods:** the old shipping methods (500.00 and 750.00) are visible in hosted Checkout.
- **Reviews are a placeholder** (rendered only when review data exists).
- **Beta APIs:** Recurring Orders and `priceSelectionMode` (Dynamic) are beta in commercetools and may change.
- **Content needs owner review:** the German copy is machine translated; images and the About, FAQ, Journal and policy texts are placeholders (legal text especially).
- **Trial project:** `spec-test-b2c` is a trial project that ends in 2026-11.
- Not in v1: payment methods and profile pages, CI, e2e tests, real contact delivery.
