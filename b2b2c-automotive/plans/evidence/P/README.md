<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Evidence for workstream P (order confirmation, no emails)

Recorded 2026-10-12 by J21 **offline**: headless Chrome over the DevTools protocol against a throw-away local stand-in (outside the repo, extended from O's) for the commercetools API, the Checkout Sessions API and the hosted Checkout script. Store `mau-reseller-north`. Nothing touched a real commercetools project, Stripe or seed credentials. The stand-in's order, customer and tax data are synthetic (the en-US cart is USD with 0% tax there), so amounts prove formatting and wiring, not real prices.

| File | Proves |
| --- | --- |
| `P-run1.txt` | Guest pickup: hosted pay -> `/checkout/return` -> `/{locale}/{store}/checkout/confirmation/{number}?t=`; number in the URL equals the order's; h1 focused; headings; noindex and referrer meta; `Referrer-Policy: no-referrer`; no horizontal scroll at 375/768/1024/1440; reload shows the same order; Copy link fallback; stranger and tampered token and other store get the generic 404; token holder in a cookie-less context sees the order; no commercetools host called from the browser, no mail request |
| `P-run2.txt` | Ship order (address from the order, "2-3 business days" from the store ship days, timeline), states shipped and delivered, `ready-for-pickup` state, pending payment wording, weak and common password messages, account created (customer in the order's store with `malva-customer`, order attached, signed in, header without Sign in), claim again refused generically and rate limited, signed-in owner without token (View order, no Create account), subscription block (frequency, next date from the Recurring Order, "being set up" without one), de-DE, print media hides the actions, dev completion helper -> confirmation |
| `storefront-P-01-pickup-{375,768,1024,1440}.png` | Guest pickup page |
| `storefront-P-02-stranger-404-1024.png`, `storefront-P-02-token-ok-1024.png` | Stranger and token holder |
| `storefront-P-03-ship-{375,768,1024,1440}.png`, `storefront-P-03-ship-delivered-1024.png` | Shipping order and the delivered state |
| `storefront-P-04-weak-password-1024.png`, `storefront-P-04-account-created-1024.png` | Create account |
| `storefront-P-05-owner-{375,1024}.png` | Signed-in owner (the stand-in customer's order is de-DE: the page follows the order's locale) |
| `storefront-P-06-subscription-1024.png`, `storefront-P-06-subscription-setting-up-1024.png` | Subscription block |
| `storefront-P-07-de-{375,1440}.png` | de-DE, euro formatting |
| `storefront-P-08-print-1024.png` | Print media |
| `storefront-P-09-dev-completion-1440.png` | Dev completion helper order (payment Pending wording) |

Not done here (needs OA-05 and the live project): `P-mcp.txt` (MCP read-backs: order state `ready-for-pickup`, store settings, orders, customers, recurring orders) and the real Stripe payment wording: rows M-P04 to M-P07. The console shows only the intended 4xx responses (404 for the stranger checks, 400 and 409 for the weak password and refused claim), nothing else.
