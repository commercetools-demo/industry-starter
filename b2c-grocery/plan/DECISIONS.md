# Decision log

Every answer from the product owner (Behnam) that changes implementation. Newest at the bottom of each section.
Junior devs: if a task conflicts with this file, stop and ask; do not guess.

## D-001 … Platform (given up front)
| ID | Decision | Date |
| --- | --- | --- |
| D-001 | commercetools project: `spec-test-b2c`, region `us-central1.gcp` (auth `https://auth.us-central1.gcp.commercetools.com`, API `https://api.us-central1.gcp.commercetools.com`) | 2026-10-06 |
| D-002 | Locales: `en-US`, `de-DE` only | 2026-10-06 |
| D-003 | Hosting: Netlify | 2026-10-06 |
| D-004 | Testing: unit tests only (no e2e) | 2026-10-06 |

## D-010 … Round 1
| ID | Decision | Date |
| --- | --- | --- |
| D-010 | Skin: **grocery content in the MALVA/Organic look**. Layouts, tokens and components from the design; categories, copy and attributes are grocery | 2026-10-06 |
| D-011 | Project `spec-test-b2c` already contains products and categories (to be inspected via commerce MCP) | 2026-10-06 |
| D-012 | Currency: `en-US` → `USD` / country `US`; `de-DE` → `EUR` / country `DE` | 2026-10-06 |
| D-013 | Test runner: **Vitest** (+ Testing Library assumed, jsdom); **no CI for now** — checks run locally through npm scripts | 2026-10-06 |

## D-020 … Round 2
| ID | Decision | Date |
| --- | --- | --- |
| D-020 | Credentials: the owner will provide an `.envrc` so the commerce MCP connects; Claude then inspects the project through MCP. **Nobody reads `~/.commercetools/*`.** Secrets never go in git, chat, or findings files | 2026-10-06 |
| D-021 | Adapt MALVA-only concepts: "Made to order" → stock status (In stock / Out of stock); "Ask a stylist" → "Contact us" link; delivery options come from commercetools shipping methods (no hard-coded prices/threshold); Journal stays static placeholder content | 2026-10-06 |
| D-022 | **v1 includes** delivery slots, weight-based pricing, out-of-stock substitutions and subscriptions/recurring orders. These have **no drawn design**; designs are proposed in the specs (change `grocery-storefront-features`) and must be signed off (see `TODO-MANUAL-TESTING.md`, items SO-*) | 2026-10-06 |
| D-023 | Package manager: **npm**. PDP option selectors are generated from the product type's variant attributes (skill's variant-config blocklist/swatch/sort), not fixed Finish/Size/Fitting | 2026-10-06 |

## Superseded or implied changes
- D-022 supersedes the "grocery behaviors are out of scope" non-goal in `malva-storefront-design/design.md` and `bootstrap-nextjs-storefront/design.md`. Both are updated in the planning pass.
- D-004 + D-013 mean "unit tests only, run locally": the `storefront-delivery-quality` CI requirement becomes a local `npm run verify` script (lint + typecheck + test + build).

## D-030 … Rounds 3–6 (grocery behaviors, checkout, scope)
| ID | Decision | Date |
| --- | --- | --- |
| D-030 | Weight pricing = **variant increments** (each sellable increment, e.g. 500 g / 1 kg, is a variant with its own price). Price per kg is a display calculation. A new spec `catalog-data-model` defines products and product types | 2026-10-06 |
| D-031 | Inventory: **InventoryMode `None`** on carts and orders (required by Order Edits). Because only `ReserveOnCart` blocks over-adding, the app itself checks availability (`ProductVariantAvailability`) before add-to-bag and quantity changes. *Supersedes the earlier "ReserveOnCart" answer* | 2026-10-06 |
| D-032 | Substitutions use **Order Edits**. Proposals are created outside the storefront (Merchant Center/API recipe, no dev route in the app). Storefront: per-line preference (LineItem custom field), order detail shows a pending proposal with Accept (apply the Order Edit) or Decline ("removal requested" recorded) | 2026-10-06 |
| D-033 | Delivery slots: **in-repo stub capacity service** (interface + JSON/in-memory), booked slot stored as cart custom fields. Capacity re-checked when the checkout session is created (see D-042) | 2026-10-06 |
| D-034 | Recurring orders: line item `recurrenceInfo.priceSelectionMode = Dynamic` (required field, no commercetools default); buyer told in plain words at setup that prices may change; recurrence policies (weekly, every 2 weeks, monthly) live in the project (seeded by `catalog-data-model`). Recurring Orders API is beta | 2026-10-06 |
| D-035 | Checkout: commercetools **Complete Checkout (hosted, `checkoutFlow`)**, PSP connector **Adyen** (test mode), session created server-side via Sessions API (`https://session.us-central1.gcp.commercetools.com/spec-test-b2c/sessions`) using the `manage_sessions` client. The drawn single-page checkout form is **replaced by the hosted UI** | 2026-10-06 |
| D-036 | Pre-checkout step lives in the **cart page**: per-line substitution preference, delivery address + slot picker, provisional-total notice; then "Checkout" launches the hosted flow | 2026-10-06 |
| D-037 | **Guest checkout allowed** (anonymous cart; sign-in merges it) | 2026-10-06 |
| D-038 | Emails: **no email sending**. New registrations are **auto-verified** (server creates an email token and confirms it immediately). Password reset creates a token; in development only a stub shows the reset link. Order confirmation email not sent | 2026-10-06 |
| D-039 | Content in v1: About us, FAQ, policy pages (static); Contact us (validated form, stub submit); product reviews as static placeholder (rendered only when review data exists); error pages | 2026-10-06 |
| D-040 | Saved lists (wishlist) need **sign-in**; anonymous heart click opens sign-in and returns | 2026-10-06 |
| D-041 | Account pages in v1: orders list, order detail (substitution consent, provisional total), address book, saved lists, subscriptions management. **Not in v1**: payment methods page, profile/password-change page | 2026-10-06 |
| D-042 | **Deviation for sign-off:** the hosted Checkout creates the order, so the app cannot reject at order placement (existing `delivery-slot-booking` scenario "slot exhausted before placement"). v1 re-validates and holds the slot when the checkout session is created and confirms the booking on the confirmation page. True placement-time rejection needs an API Extension (out of v1) | 2026-10-06 |
| D-043 | Listing: **24 products per page**, numbered pagination (`?page=N`), 3 columns, facets as drawn: category, price band, availability (In stock / Out of stock) | 2026-10-06 |
| D-044 | Not in v1: payment methods page, CI, e2e tests, email sending, attribute facets, Journal CMS, real contact delivery, real picking/capacity systems | 2026-10-06 |
| D-045 | **PROPOSED, needs owner confirmation (SO-15):** the Canvas page-builder block registry (43 blocks with authored-field validation) is **not built in v1**. Pages are composed in code; each page section is a standalone component named after its block (`HeroEditorial`, `CategoryShowcase`, `ProductGrid`, `BuyBox`, `Header`…) taking its authorable fields as props, so a registry can be added later without rewriting pages | 2026-10-06 |
| D-046 | **PROPOSED, needs owner confirmation (SO-16):** delivery slots carry **no price** in v1. Delivery cost is the `standard` commercetools shipping method rate (free above the threshold stored in the rate), applied to the cart when a deliverable address is set. This deviates from `delivery-slot-booking` ("each slot with its delivery charge") because slot charges are not billable by hosted Checkout | 2026-10-06 |
| D-047 | **Accepted risks (confirm in SO-17):** (1) the session JWT cookie holds customer email and name for 30 days with no server-side revocation; (2) rate limiting and the slot stub are in-memory per serverless instance; (3) the slot hold (15 min) can expire while a shopper pays, so oversell is possible until a real capacity system exists | 2026-10-06 |

## Open items (owner action needed — tracked in TODO-MANUAL-TESTING.md)
- `.envrc` for the commerce MCP so the project can be inspected (blocks workstream F).
- Adyen test account, Checkout application in Merchant Center, connector configured.
- Frontend B2C API client for the storefront with `manage_sessions`.
