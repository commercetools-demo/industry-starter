# TODO — owner actions, sign-offs and owner-only manual tests

Owner: Behnam. Claude runs every test it can (Chrome checks, `VERIFICATION-LOG.md`); this file holds only what **needs a person**. Junior developers **add rows** for M-tests; only the owner sets `PASS`/`FAIL`/`DONE`/`APPROVED`.
Never put secrets in this file.

Status values: `TODO` · `BLOCKED` · `IN PROGRESS` · `DONE` / `PASS` / `APPROVED` / `WAIVED` · `FAIL (note)`.

## 1. Owner actions (blockers)

| ID | Action | Why / blocks | Status |
| --- | --- | --- | --- |
| OA-01 | Provide `.envrc` so the commerce MCP connects (project key `spec-test-b2c-telecom`, `IS_ADMIN=true`). Never paste secrets in chat | Claude inspects the project and verifies work | DONE (verified by Claude 2026-10-07: `read_project` returns `spec-test-b2c-telecom`) |
| OA-02 | In Merchant Center create a **storefront API client** for `spec-test-b2c-telecom`; put `CTP_CLIENT_ID`, `CTP_CLIENT_SECRET`, `CTP_SCOPES` in `site/.env.local` (gitignored). Scopes (each suffixed `:spec-test-b2c-telecom`, space-separated; names verified against https://docs.commercetools.com/api/scopes): `manage_sessions manage_orders manage_order_edits manage_customers manage_shopping_lists create_anonymous_token view_published_products view_products view_categories view_standalone_prices view_product_selections view_shipping_methods view_tax_categories view_cart_discounts view_discount_codes view_types view_project_settings view_sessions view_payments manage_payments view_payment_methods manage_payment_methods view_recurring_orders manage_recurring_orders view_recurrence_policies view_key_value_documents manage_my_payments` | E live checks, every Chrome check | DONE (owner reported 2026-10-07; token verified by Claude: scopes recorded in PROJECT-FINDINGS.md) |
| OA-03 | Create a **seed/admin API client** with create/delete rights on products, categories, product types, types, inventory, customers, customer groups, shipping methods, tax categories, zones, cart discounts, discount codes, recurrence policies, payment methods and **`manage_project`** (needed to activate Product Search indexing), `manage_key_value_documents` (serviceability table and release records), `manage_recurrence_policies`, `manage_recurring_orders`, `manage_payment_methods`, `manage_states`; put values in `site/.env.seed` (gitignored). Revoke after the final release | F seed run, G, X | DONE (owner reported 2026-10-07; token verified by Claude) |
| OA-04 | Approve the **destructive cleanup** of the furniture sample data after reading Claude's inventory list in `PROJECT-FINDINGS.md` (3 product types, their products, categories, inventory). Reply `APPROVED` here | F cleanup task, G | APPROVED and EXECUTED 2026-10-07 (scope: catalog plus sample customers, carts, orders, store; see PROJECT-FINDINGS.md) |
| OA-05 | In Merchant Center → Checkout create a **Complete checkout** application (US and DE; allowed origins `http://localhost:3000`, `http://localhost:3010`, the Netlify URL), add an **Adyen** payment integration in test mode (needs your Adyen test merchant account, API key, client key, HMAC) with **Stored Payment Methods** enabled and recurring-order support, attach it to the application, put its key in `site/.env.local` as `CTP_CHECKOUT_APP_KEY` and in the Netlify env | L spike (L-08), U, Y | TODO |
| OA-06 | Create the Netlify site from this repo (base directory `site`) and add the env vars in the Netlify UI | Y | TODO |
| OA-07 | Merge this planning work to `main` so juniors branch from it | all developers | TODO |

## 2. Design sign-offs (undrawn designs, proposals)

Claude builds these exactly as specified in the workstream and takes screenshots; you approve or request changes.

| ID | What to review | Spec / workstream | Status |
| --- | --- | --- | --- |
| SO-01 | Mobile header: slide-in drawer navigation (<768 px) and mobile layouts of home, listings, bundle | storefront-shell (I) | WAIVED (D-068: build first, owner comments on screenshots) |
| SO-02 | Add-on / equipment pickers on the plan card, incompatible and unavailable states | offer-compatible-addons (N) | WAIVED (D-068: build first, owner comments on screenshots) |
| SO-03 | Device card: color/memory pickers and the acquisition-mode selector (outright / installments / lease) with the financing decision outcome | device-acquisition-mode (Q) | WAIVED (D-068: build first, owner comments on screenshots) |
| SO-04 | Price schedule display (intro period and yearly steps) before signing, and the "price locked" copy | term-phased-price-schedule, introductory-period-price (M) | WAIVED (D-068: build first, owner comments on screenshots) |
| SO-05 | Checkout steps (details, address, delivery, review) around the hosted payment, confirmation page and order states | checkout, order-confirmation-page (U) | WAIVED (D-068: build first, owner comments on screenshots) |
| SO-06 | Cancel-order and device-return flows | post-purchase-order-management (V) | WAIVED (D-068: build first, owner comments on screenshots) |
| SO-07 | Account pages: dashboard, order list/detail, address book, saved payment methods (list-only), saved lists | S, T | WAIVED (D-068: build first, owner comments on screenshots) |
| SO-08 | Broadband Facts label legal wording (policy URLs, support phone, FCC footnote) — placeholders `malva.example` and `1-800-MALVA-00` are replaced | broadband-facts-label (M) | TODO |
| SO-09 | Static pages copy (about, FAQ, blog, policies) and image credits | W | TODO |

## 3. Owner-only manual tests

<!-- M-TESTS:BEGIN (generated by plan/verify-plan.mjs --sync; statuses are preserved) -->
| ID | WS | Owner-only manual test (what to do → expected) | Needs | Status |
| --- | --- | --- | --- | --- |
| M-G-1 | G | owner opens Merchant Center → Products and opens five offers across the categories → the images are acceptable for a demo (subjective visual sign-off); if not, the owner names the entries and G edits `image-terms.ts` and re-runs `seed:images`. | OA-03 | TODO |
| M-L-1 | L | In Merchant Center → Checkout open the Adyen payment integration attached to the application whose key is in `CTP_CHECKOUT_APP_KEY` → "Stored payment methods" is enabled, the integration status is Active, and the connector lists recurring-orders support. Record the answer in `TODO-MANUAL-TESTING.md`. | OA-05 | TODO |
| M-L-2 | L | Read the `SPIKE-L` block in `PROJECT-FINDINGS.md` and reply `APPROVED` (or the changes wanted) in `TODO-MANUAL-TESTING.md` → Gate 2 passes. M and U do not start before this is APPROVED. | OA-05 | TODO |
| M-M-1 | M | Review the Broadband Facts label wording (policy URLs, support phone, FCC footnote) in `lib/config/label.ts` and the label on `/en-US/bundle` → approve or send the real wording; the placeholders `malva.example` and `1-800-MALVA-00` are replaced. | — | TODO |
| M-Q-2 | Q | confirm the demonstration price table (section 1, USD/EUR) and the stub limit (USD 2,500 / EUR 2,300) are acceptable as demo data → reply in `TODO-MANUAL-TESTING.md`. | OA-03 | TODO |
| M-T-1 | T | add `manage_payment_methods` (and `view_payment_methods`) to the storefront API client in Merchant Center and restart the dev server → `/en-US/account/payment-methods` stops showing "temporarily unavailable" and lists the seeded cards. | OA-02 | TODO |
| M-U-1 | U | pay with Visa `4111 1111 4555 1142` / `03/30` / `737` signed in as a registered customer (tick "save card" if offered) → redirected to `/en-US/order-confirmation/MLV-…` with banner "Order placed.", bundle empty, header pill count 0; Merchant Center → Orders shows the order with `orderNumber` = the one shown, a Payment with a transaction `Authorization` or `Charge`, custom type `malva-order` with the three fields; Merchant Center → Recurring orders shows one recurring order per monthly line. | OA-05 | TODO |
| M-U-2 | U | pay with holder name `REFUSED` → hosted component shows its failure state, you stay on step 5, no order in Merchant Center, bundle intact; pay again with the good card works and creates **one** order (same number as before). | OA-05 | TODO |
| M-U-3 | U | signed out (guest) full purchase → confirmation shows the guest text and no "View order"; the order exists with `customerEmail` and no `customerId`. | OA-05 | TODO |
| M-W-1 | W | Read the en-US and de-DE copy of `about`, `faq`, `support`, the three blog articles and the five legal files in `site/content/`; confirm the About page contains no claim you would not sign, replace the placeholder address `support@malva.example` in `site/lib/config/contact.ts` with a real mailbox (or keep it as a demo), and replace the placeholder legal text with real legal text before any non-demo use → approve or list changes; also approve the Pexels image-credits wording and that German copy is acceptable (it is machine-translated, flagged in `IDEAS.md`). | — | TODO |
| M-Y-1 | Y | 1. In Netlify create the site from this repository (Package directory `b2c-telecom`, see Design). 2. In Site configuration, Environment variables, set the eight required variables from the table (values from your `site/.env.local`; `SESSION_SECRET` is a new 32+ character random value, not the local one; tick "Contains secret values" for `CTP_CLIENT_SECRET` and `SESSION_SECRET`), plus `DEMO_SHOW_RESET_LINK=true`. 3. Deploy the release branch → the build succeeds and the deploy is published; give Claude the site URL. If it fails, paste the log without values into `plan/QUESTIONS.md`. | OA-06 | TODO |
| M-Y-2 | Y | In Merchant Center, Checkout, add the Netlify origin (for example `https://<site>.netlify.app`, no trailing slash) to the application's allowed origins → the hosted checkout loads on the deployed site (Claude verifies in C-Y-9). | OA-05 | TODO |
| M-Y-3 | Y | In a branch deploy or deploy preview delete one required variable (for example `CTP_SCOPES`) and deploy → the Netlify build fails and the log names `CTP_SCOPES` without printing any value; restore the variable and redeploy. | OA-06 | TODO |
| M-Y-4 | Y | In Netlify, Deploys, pick the previous successful deploy and "Publish deploy" → the earlier version is live (reload the site); then publish the latest deploy again. | OA-06 | TODO |
| M-Z-1 | Z | Revoke the seed/admin API client in Merchant Center and confirm `npm run seed` now fails with an authentication error → seeding no longer possible with the old credentials. | OA-03 | TODO |
| M-Z-2 | Z | Skim `plan/FINAL-REPORT.md` and the Netlify site; approve release or list changes → `APPROVED` in `TODO-MANUAL-TESTING.md`. | OA-05, OA-06 | TODO |
<!-- M-TESTS:END -->
