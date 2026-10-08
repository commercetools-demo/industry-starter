# Dependency plan A → Z

Letters are in a valid **build order**: every workstream depends only on earlier letters. `plans/verify-plan.mjs` checks this automatically once the workstream files exist. Status of the draft: **DRAFT v2** (2026-10-08) — all capabilities are in v1 (owner answer to Q-006); details of each letter are finalized spec by spec with the owner.

## Workstreams

| ID | Workstream | Implements (OpenSpec capability) | Depends on | Owner prerequisites | Parallel with |
| --- | --- | --- | --- | --- | --- |
| A | Scaffold, tooling, `npm run check` | storefront-project-bootstrap | — | — | — |
| B | Design tokens, fonts, design lint, token parity | design-system-tokens | A | SO-01 (D4 contrast) | C, D, E |
| C | Locale routing, messages, region config | storefront-locale-routing | A | — | B, D, E |
| D | BFF core: commercetools client, session, env, health | storefront-bff-and-session | A | OA-02, OA-03 | B, C, E |
| E | Seed: clean sample data, catalog data model, shipping, tax, images | *(SEED-PLAN.md; models D1)* | A | OA-01 | B, C, D |
| F | Scheduling, clinical stand-in, demo patients, reviews, order states (seed + `lib/ct` modules) | *(D1, D7; feeds K, L, N, R)* | E | OA-01 | B, C, D |
| G | Data-loading foundation: types, mappers, cached reads, SWR keys | storefront-data-loading | C, D, E | — | F |
| H | Design-system primitives and shell: nav, mobile menu, footer, toast, modal, protected-route prompt | design-storefront-shell | B, C, D, G | SO-02 (mobile menu) | F |
| I | Error pages, not-found, env guards | error-pages | D, H | SO-03 | J, K |
| J | Identity: sign-in / create account, session lifecycle, email verification (auto-verify) | authentication-and-identity, account-sign-in, account-registration-request (B2C subset), email-verification, password-reset | D, H | – | I, K |
| K | Doctor list and search | design-plp (doctors), product-listing-page, search-results-page, discovery-and-browse | F, G, H | — | I, J |
| L | Doctor profile, booking, booking confirmation | design-pdp, product-detail-page | F, G, H, J, K | SO-04 (consent copy) | N |
| M | Home page | design-home-page, home-landing-page | G, H, K | — | N |
| N | Prescription lookup and dispensing rules | design-plp (prescriptions), prescription-bound-supply, dispensing-quantity-limit, expiry-dated-supply | F, G, H, J | – | L, M |
| O | Cart | design-cart, cart-page, cart-management | G, H, J, N | — | P |
| P | Address book | address-book | H, J | SO-03 | O |
| Q | Checkout and payment | design-checkout (checkout), checkout-page, checkout, payment-methods (widget only) | O, P, J | OA-04 (PSP) | — |
| R | Account area: shell, overview, labs, appointments | design-account-area, account-dashboard, account-and-self-service | F, G, H, J, L | — | Q |
| S | Orders: confirmation and tracking, history, post-purchase | design-checkout (order), order-confirmation-page, order-history, post-purchase-order-management | Q, R | — | — |
| T | Saved lists ("My medicines"), recurring orders / auto-refill, saved payment methods | saved-lists, subscriptions-and-recurring-orders, payment-methods (saved methods) | K, N, J, Q, R, S | OA-04 (stored payment methods in PSP) | U, V, W |
| U | Funding and restricted tender: payer cost-share, benefit allowance, eligible-item tender, credentialed purchase scope | payer-and-patient-cost-share, benefit-allowance-drawdown, eligible-item-tender-restriction, credentialed-purchase-scope | N, O, Q, R, S | OA-04 | T, V, W |
| V | Static content: FAQ, contact, about, policies, health journal | faq, contact-us, about-us, policy-pages, blog-resources | C, G, H | – | T, U, W |
| W | Region and language switching (v1: single region, structure only) | switching-region-or-language | C, D, H, O | — | T, U, V |
| X | Health-data minimization hardening and privacy operations | health-data-minimization | F, L, N, Q, R, S, T, U | SO-04 | — |
| Y | Deployment | *(storefront-project-bootstrap: reproducible build; hosting per Q-009)* | I–X | OA-06 (hosting) | — |
| Z | Release readiness: browser sweep, Lighthouse, accessibility, security review, final verification | all | A–Y | all OA | — |

## Graph

```mermaid
graph LR
  A --> B & C & D & E
  E --> F
  C & D & E --> G
  B & C & D & G --> H
  D & H --> I
  D & H --> J
  F & G & H --> K
  F & G & H & J & K --> L
  G & H & K --> M
  F & G & H & J --> N
  G & H & J & N --> O
  H & J --> P
  O & P & J --> Q
  F & G & H & J & L --> R
  Q & R --> S
  F & L & N & Q & R & S --> T
  K & N & J & Q & R & S --> T
  N & O & Q & R & S --> U
  C & G & H --> V
  C & D & H & O --> W
  F & L & N & Q & R & S & T & U --> X
  I & J & K & L & M & N & O & P & Q & R & S & T & U & V & W & X --> Y
  Y --> Z
```

## Critical path
`A → D → G → H → J → N → O → Q → S → U → X → Y → Z` (13 steps). E and F are off the critical path only if they finish before G/K/N start; they are scheduled **first after A** because every data-driven page needs the seeded catalog.

## Parallel lanes (when more than one junior is available)
| Wave | Workstreams that can run at the same time |
| --- | --- |
| 1 | A |
| 2 | B, C, D, E |
| 3 | F, G |
| 4 | H |
| 5 | I, J, K |
| 6 | L, M, N, P, V |
| 7 | O, R, W |
| 8 | Q |
| 9 | S |
| 10 | T, U |
| 11 | X |
| 12 | Y |
| 13 | Z |

## Gates (what must be true before the next wave)
| Gate | Condition | Checked by |
| --- | --- | --- |
| G1 after A | clean clone → `npm ci` → `npm run check` → `npm run build` green | Claude |
| G2 after D+E | `/api/health` returns project key; seeded catalog readable with the Frontend (non-admin) client; Product Search returns doctors | Claude (browser + MC MCP) |
| G3 after H | placeholder page renders under `/en-US` with tokens, nav, footer, no console errors; keyboard focus visible | Claude (browser) |
| G4 after J | register → verify → sign in → sign out round-trip in a real browser; cookie is HTTP-only and carries ids only | Claude (browser) |
| G5 after Q | an order is created from a seeded prescription with the chosen payment approach; order readable only by its patient | Claude (browser) + OA-04 |
| G6 after X | scan shows no health data in URLs/logs/orders; erasure and subject-access scripts pass on a throwaway customer | Claude |
| G7 after Y | deployed site passes the Z checklist | Claude + owner SO |

## What blocks what (owner prerequisites, in the order they are needed)
1. **OA-01** seed admin API client (before E). 2. **OA-02/03** Frontend API client + session secret (before D). 3. **SO-01** contrast decision (before B ends). 4. ~~OA-05~~ (dropped: no email provider). 5. **OA-04** Stripe sandbox / Checkout (before Q). 6. **OA-06** hosting account (before Y). Details and exact steps: `TODO-MANUAL-TESTING.md`.
