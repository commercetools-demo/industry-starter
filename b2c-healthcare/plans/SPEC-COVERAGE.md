# Spec coverage

Every capability under `openspec/specs/` and `openspec/changes/bootstrap-storefront/specs/` and where it is built. The owner put the formerly deferred capabilities in scope on 2026-10-08 (`Q-006`), so nothing is deferred now. "B2C-excluded" parts are listed inside the specs themselves (`_Excluded for B2C_`) and are not built.

| Capability | Workstream | v1 status | Notes |
| --- | --- | --- | --- |
| storefront-project-bootstrap | A | in | |
| storefront-bff-and-session | D | in | cookie holds ids and locale only |
| storefront-locale-routing | C (+V) | in | one region (en-US) at launch |
| storefront-data-loading | G | in | |
| design-system-tokens | B | in | D2, D3, D4 |
| design-storefront-shell | H | in | |
| design-home-page | M | in | stats only if sourced |
| home-landing-page | M | in | |
| design-plp | K (doctors), N (prescriptions) | in | |
| product-listing-page | K | in | |
| search-results-page | K | in | exact-SKU resolution does not apply to doctors; see QUESTIONS |
| discovery-and-browse | K | in | |
| design-pdp | L | in | |
| product-detail-page | L | in | |
| design-cart | O | in | |
| cart-page | O | in | |
| cart-management | O | in | |
| design-checkout | Q (checkout), S (order) | in | |
| checkout-page | Q | in | |
| checkout | Q | in | |
| payment-methods | T | in | net terms / credit line excluded (B2C) |
| order-confirmation-page | S | in | |
| order-history | S | in | |
| post-purchase-order-management | S | in | cancellation per Q |
| design-account-area | R | in | |
| account-dashboard | R | in | B2C subset |
| account-and-self-service | R | in | |
| account-sign-in | J | in | |
| authentication-and-identity | J | in | |
| account-registration-request | J | partial | B2C: self-registration, no seller activation |
| email-verification | J | in | no email: auto-verify at registration (Q-008/Q-073) |
| password-reset | – | **omitted** (Q-070 = omit UI) | no reset page/link; spec stays unbuilt |
| address-book | P | in | not designed → SO-03 |
| error-pages | I | in | not designed → SO-03 |
| prescription-bound-supply | N | in | |
| dispensing-quantity-limit | N | in | BFF-only enforcement (Q-005 = B): the "direct API call" scenario is a documented gap |
| expiry-dated-supply | N | in | single worst-case date per supply location |
| health-data-minimization | X (rules enforced from D onward) | in | |
| faq, contact-us, about-us, policy-pages, blog-resources | V | in | not designed → SO-03 |
| switching-region-or-language | W | partial | single region at launch |
| saved-lists | T | in (owner 2026-10-08) | Q-066 |
| subscriptions-and-recurring-orders | T | in (owner 2026-10-08) | auto-refill claim on home shown once built |
| payer-and-patient-cost-share | U | in (owner 2026-10-08) | mock resolver, Q-060 |
| benefit-allowance-drawdown | U | in (owner 2026-10-08) | Q-062 |
| eligible-item-tender-restriction | U | in (owner 2026-10-08) | Q-063 |
| credentialed-purchase-scope | U | in (owner 2026-10-08) | controlled medicines only; see Q-065 |
