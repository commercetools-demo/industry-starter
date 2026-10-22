<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Routes (Q-00)

Inventory taken on 2026-10-22 from `storefront/app/**/page.tsx` and `app/**/route.ts` at commit `5584c8be` of branch `ws/q-quality`. Node v22.21.1, `next` 16.4.2, React 19.2.4, `next-intl` 4.14.9, SWR 2.5.1, `@commercetools/platform-sdk` 8.27. Every page below exists under both locales (`/en-US`, `/en-CA`); the market follows the URL (`proxy.ts` moves the session to the market of the page that is loaded, never on a prefetch).

## Placeholders of `plans/E2E-JOURNEYS.md`

| Placeholder | Resolved to |
| --- | --- |
| `{PLP}` | `/en-US/category/pods` (also `coffee`, `machines`, `accessories`; `/en-US/shop` is all products) |
| `{PDP:pod}` | `/en-US/p/ember-ristretto/MCF-POD-EMBER-50` (`/en-US/p/andes-organic/MCF-POD-ANDES-10`, `/en-US/p/casa-espresso/MCF-POD-CASA-10`) |
| `{PDP:coffee}` | `/en-US/p/brazil-santos/MCF-COF-SANTOS-250-WB` |
| `{PDP:machine}` | `/en-US/p/barista-compact/MCF-MAC-B2C2-BLA-M` (a bean-to-cup machine without bundles: `/en-US/p/barista-pro-bean-to-cup/MCF-MAC-B2C1-SIL-M`) |
| `{PDP:accessory}` | `/en-US/p/descaling-kit-3-uses/MCF-ACC-DESCALE-WHI` |
| `{SEARCH}` | `/en-US/search?q=espresso` (no result: `?q=zzzzqq`) |
| `{ACCOUNT}` | `/en-US/account/orders` (signed in as a seeded demo customer; one order: `/en-US/account/orders/MCF-1001` on the mock) |

## Pages (`app/**/page.tsx`, 31)

| Route | Example | Notes |
| --- | --- | --- |
| `app/[locale]` | `/en-US`, `/en-CA` | home |
| `app/[locale]/(listing)/category/[slug]` | `/en-US/category/pods` | filters in the query (`?f_intensity=9`), sort, `?page=2` |
| `app/[locale]/(listing)/shop` | `/en-US/shop` | all products |
| `app/[locale]/(listing)/search` | `/en-US/search?q=espresso` | `noindex` |
| `app/[locale]/p/[slug]/[sku]` | see placeholders | product page; `?choose=grind` highlights a required choice |
| `app/[locale]/cart` | `/en-US/cart` | `noindex` |
| `app/[locale]/checkout` | `/en-US/checkout` | `noindex`; hands over to the hosted Checkout |
| `app/[locale]/checkout/confirmation` and `/[orderId]` | `/en-US/checkout/confirmation/<orderId>` | `noindex`; the id is a capability (question Q-Q-15) |
| `app/[locale]/account/sign-in`, `/register` | `/en-US/account/sign-in` | `noindex`; a signed-in visitor is sent to the account |
| `app/[locale]/account/(shell)` and `/orders`, `/orders/[orderNumber]`, `/subscriptions`, `/saved`, `/reviews`, `/addresses`, `/payment-methods`, `/profile`, `/settings`, `/collection` | `/en-US/account/subscriptions` | `noindex`, need a session |
| `app/[locale]/about`, `/contact`, `/faq` | `/en-US/faq` | content pages |
| `app/[locale]/policies/[slug]` | `/en-US/policies/shipping-returns` (also `privacy`, `terms`, `accessibility`) | |
| `app/[locale]/journal`, `/journal/[slug]` | `/en-US/journal/brew-a-better-cup` (also `descale-your-machine`, `capsule-take-back-plan`, `from-the-roastery`) | |
| `app/[locale]/[...rest]` | `/en-US/does-not-exist` | the localized 404 |
| `app/[locale]/dev/design`, `/dev/store-picker` | `/en-US/dev/design` | **development only**, removed before the deploy (`plans/DEPLOY-NETLIFY.md` section 3) |

## Route Handlers (`app/**/route.ts`, 45 files)

Same-origin guard on every mutating method (`lib/http/guard.ts`); the authorization of each is in `401-matrix.md`.

| Group | Routes (methods) |
| --- | --- |
| auth | `/api/auth/login` (POST), `/register` (POST), `/logout` (POST), `/me` (GET), `/demo-customers` (GET), `/demo-login` (POST) |
| session | `/api/session/market` (PUT), `/api/session/store` (PUT) |
| catalogue | `/api/search` (GET), `/api/availability` (GET), `/api/channels` (GET), `/api/recurrence-policies` (GET) |
| cart | `/api/cart` (GET, PATCH), `/api/cart/count` (GET), `/api/cart/lines` (POST), `/api/cart/lines/[lineId]` (PATCH, DELETE) |
| checkout | `/api/checkout` (GET), `/checkout/pickup` (PUT), `/checkout/session` (POST), `/checkout/complete` (POST), `/checkout/return` (GET, outside `/api` and `[locale]`: where a redirect payment returns; finalises the order and answers 303 to the confirmation page) |
| orders | `/api/orders` (GET), `/orders/[id]` (GET), `/orders/[id]/reorder` (POST), `/orders/[id]/returns` (POST) |
| recurring orders | `/api/recurring-orders` (GET), `/recurring-orders/[id]` (GET, PUT) |
| account | `/api/account/summary`, `/profile` (GET, PATCH), `/password` (POST), `/delete` (POST), `/addresses` (GET, POST), `/addresses/[id]` (PATCH, DELETE), `/payment-methods` (GET), `/payment-methods/[id]` (DELETE), `/payment-methods/[id]/default` (POST) |
| lists | `/api/shopping-lists` (GET, POST, DELETE), `/shopping-lists/add-to-cart` (POST) |
| reviews | `/api/reviews` (GET, POST), `/reviews/[id]` (PATCH, DELETE) |
| content | `/api/contact` (POST), `/faq-feedback` (POST), `/newsletter` (POST) |
| catch-all | `/api/[...rest]` answers 404 in the JSON envelope for every method |
| development only | `/api/health`, `/api/dev/session` (GET, POST) |

## Page list for the responsive and accessibility passes

24 page entries at 7 widths (`responsive/matrix.md`): home, home en-CA, listing, listing with a filter, listing en-CA, all products, search, search without result, product (pod, coffee, machine, accessory, pod en-CA), cart, checkout, sign-in, register, About, Contact, FAQ, a policy, Journal list and article, 404. Signed-in pages at 1440 and 375 px (`a11y/account-audit.json`): every account tab, one order, and the public pages again with a session.
