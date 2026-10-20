<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Questions: workstream D (Server core)

Format: `Q-<L>-<n> | question | default | blocks? | status`.

Q-D-1 | Session cookie name. | `malva-session` | no | Open
Q-D-2 | Session lifetime: sliding or fixed? | Fixed 30 days from the last write (re-signed on every write, not on reads) | no | Open
Q-D-3 | Cookie size limit. | Refuse to sign a token over 3800 characters | no | Open
Q-D-4 | Anonymous id source. | `crypto.randomUUID()`, created with the first guest cart, cleared at login | no | Open
Q-D-5 | App `Money` and `Price` shapes. | `Money {centAmount, currencyCode}`, `Price {value, discounted?}` (discounted is the price to pay) | no | Open
Q-D-6 | Image sizing parameters at render time (host is the owner's image endpoint, OA-03). | `?auto=compress&fit=crop&w=<w>&h=<h>`, sizes 600x720, 1200x1440, 160x192, replaceable in `image-config.ts` | no | Open
Q-D-7 | Error code set and HTTP mapping. | Per workstream D section 3.3; commercetools 401/403 become `internal_error` 500 with an error log | no | Open
Q-D-8 | Create Review needs scope `manage_products` (broad: it also changes prices). Put it on the storefront client or isolate it? | Isolate: M adds a second server-only client used only by `lib/ct/reviews.ts`; the main client stays without it. Nothing built in D | M | Open
Q-D-9 | Dev-only `app/api/dev/session` route for self-verification. | Yes; 404 in production, predeploy fails while it exists, deleted in Q | no | Open
Q-D-10 | Live probe as a `*.live.ts` run outside `check` (exception to "no real API in tests"). | Yes, read-only, evidence contains names and counts only | no | Open
Q-D-11 | Product-level attributes (`badge`, `subscribable`) on a projection. | Seed defines them as `SameForAll` attributes (seed/src/data/product-types.ts) so they come back on `masterVariant.attributes`; mapper reads those and overlays `projection.attributes` if present; D-10 verifies live | no | Open
Q-D-12 | Rating display rounding. | `Math.round(x * 10) / 10` | no | Open
Q-D-13 | `getLocalizedString` fallback order. | exact, same language, `en-US`, first value | no | Open
Q-D-14 | Server cache TTLs. | project 300 s, categories 60, channels 60, shipping methods 60, recurrence policies 300 | no | Open
Q-D-15 | 409 retry policy. | One retry after re-reading, no delay; second 409 is `conflict` 409 | no | Open
Q-D-16 | Currencies without two decimals. | Digit count from `Intl` (only USD, EUR, GBP used, all 2) | no | Open
